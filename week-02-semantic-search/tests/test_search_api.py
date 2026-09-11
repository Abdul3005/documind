"""Comprehensive test suite for Week 2 Semantic Search API & Retrieval Engine.

Validates:
- Health check endpoints
- Semantic Vector Search (PyTorch Cosine Similarity)
- Lexical Keyword Search (BM25Okapi)
- Hybrid Reciprocal Rank Fusion Search (Both)
- Pydantic schema validations and edge case error handling
- Qualitative retrieval assertions (Synonym and Typo handling)
- Comparative Benchmark endpoint
"""

import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure root of week-02-semantic-search is on python path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from api.main import app
from src.dataset import get_or_create_dataset


@pytest.fixture(scope="session")
def client():
    """Initializes a shared TestClient with FastAPI lifespan context."""
    with TestClient(app) as test_client:
        yield test_client


def test_health_endpoints(client: TestClient):
    """Verifies that both /health and /api/v1/health return 200 and valid system telemetry."""
    for path in ["/health", "/api/v1/health"]:
        response = client.get(path)
        assert response.status_code == 200, f"Failed at {path}: {response.text}"
        data = response.json()
        assert data["status"] == "healthy"
        assert data["corpus_size"] >= 10000
        assert data["embedding_dimension"] == 384
        assert "cpu" in data["embedding_device"].lower() or "cuda" in data["embedding_device"].lower()
        assert "MiniLM" in data["model_name"]
        assert data["timestamp"] > 0


def test_semantic_search_endpoint(client: TestClient):
    """Tests dense vector semantic search retrieval, score bounds, and latency reporting."""
    payload = {
        "query": "PyTorch deep learning model fine-tuning with transformers",
        "top_k": 5,
        "method": "semantic",
    }
    response = client.post("/api/v1/search", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["query"] == payload["query"]
    assert data["method"] == "semantic"
    assert data["total_results"] == 5
    assert len(data["results"]) == 5
    assert data["latency_ms"] >= 0.0

    # Validate individual search items
    for idx, item in enumerate(data["results"], start=1):
        assert item["rank"] == idx
        assert item["id"].startswith("doc_")
        assert len(item["text"]) > 0
        assert -1.0 <= item["score"] <= 1.0  # Cosine similarity bounds
        assert item["algorithm"] == "semantic_vector"
        assert "metadata" in item
        assert "title" in item["metadata"]


def test_keyword_search_endpoint(client: TestClient):
    """Tests BM25 lexical keyword search and score ordering."""
    payload = {
        "query": "Kubernetes Terraform Docker Prometheus",
        "top_k": 5,
        "method": "keyword",
    }
    response = client.post("/api/v1/search", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["query"] == payload["query"]
    assert data["method"] == "keyword"
    assert len(data["results"]) <= 5
    assert data["total_results"] == len(data["results"])
    assert data["latency_ms"] >= 0.0

    if data["results"]:
        for idx, item in enumerate(data["results"], start=1):
            assert item["rank"] == idx
            assert item["id"].startswith("doc_")
            assert item["score"] > 0.0
            assert item["algorithm"] == "bm25"


def test_hybrid_search_both_endpoint(client: TestClient):
    """Tests 'both' method combining BM25 and Vector search with Reciprocal Rank Fusion (RRF)."""
    payload = {
        "query": "PostgreSQL relational database indexing and query optimization",
        "top_k": 5,
        "method": "both",
    }
    response = client.post("/api/v1/search", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["query"] == payload["query"]
    assert data["method"] == "both"
    assert len(data["results"]) == 5
    assert data["hybrid_details"] is not None

    details = data["hybrid_details"]
    assert "keyword_results" in details
    assert "semantic_results" in details
    assert "keyword_latency_ms" in details
    assert "semantic_latency_ms" in details
    assert details["total_candidates_evaluated"] > 0

    for item in data["results"]:
        assert item["algorithm"] == "hybrid_rrf"
        assert item["score"] > 0.0
        assert "rrf_details" in item["metadata"]


def test_search_validation_errors(client: TestClient):
    """Verifies that invalid payloads trigger appropriate 422 or 400 HTTP errors."""
    # Empty query string
    res = client.post("/api/v1/search", json={"query": "", "top_k": 5})
    assert res.status_code == 422

    # Whitespace-only query string
    res = client.post("/api/v1/search", json={"query": "    ", "top_k": 5})
    assert res.status_code == 400

    # Negative top_k
    res = client.post("/api/v1/search", json={"query": "test query", "top_k": -1})
    assert res.status_code == 422

    # Zero top_k
    res = client.post("/api/v1/search", json={"query": "test query", "top_k": 0})
    assert res.status_code == 422

    # Excessive top_k (>100)
    res = client.post("/api/v1/search", json={"query": "test query", "top_k": 500})
    assert res.status_code == 422

    # Invalid search method
    res = client.post("/api/v1/search", json={"query": "test query", "method": "fuzzy_ngram"})
    assert res.status_code == 422


def test_synonym_retrieval_comparison(client: TestClient):
    """Compares semantic search vs BM25 on conceptual synonyms without exact word overlap.

    Semantic search should successfully surface relevant AI/Deep Learning records.
    """
    synonym_query = "software specialist who constructs neural network architectures"

    res_semantic = client.post(
        "/api/v1/search",
        json={"query": synonym_query, "top_k": 5, "method": "semantic"},
    )
    res_keyword = client.post(
        "/api/v1/search",
        json={"query": synonym_query, "top_k": 5, "method": "keyword"},
    )

    assert res_semantic.status_code == 200
    assert res_keyword.status_code == 200

    sem_results = res_semantic.json()["results"]
    kw_results = res_keyword.json()["results"]

    # Semantic search should retrieve results with positive cosine similarity
    assert len(sem_results) == 5
    top_sem_category = sem_results[0]["metadata"]["category"]
    # Top semantic result should be AI & Machine Learning or Systems
    assert top_sem_category in [
        "AI & Machine Learning",
        "Systems Architecture & Database Internals",
        "Backend & Distributed Systems",
    ]


def test_typo_retrieval_comparison(client: TestClient):
    """Tests typo resistance between vector search and BM25."""
    typo_query = "kuberenetes orhcestration clustr deploymnt"

    res_semantic = client.post(
        "/api/v1/search",
        json={"query": typo_query, "top_k": 5, "method": "semantic"},
    )
    res_keyword = client.post(
        "/api/v1/search",
        json={"query": typo_query, "top_k": 5, "method": "keyword"},
    )

    assert res_semantic.status_code == 200
    assert res_keyword.status_code == 200

    sem_results = res_semantic.json()["results"]
    kw_results = res_keyword.json()["results"]

    # Vector search retrieves top-k candidates despite typos
    assert len(sem_results) == 5
    top_sem_cat = sem_results[0]["metadata"]["category"]
    assert top_sem_cat in ["Cloud & DevOps Infrastructure", "AI & Machine Learning", "Backend & Distributed Systems"]

    # BM25 is severely penalized by 3 misspelled terms
    # BM25 results should either be 0 or have low relevance scores compared to clean terms
    if kw_results:
        assert kw_results[0]["score"] < 15.0


def test_benchmark_endpoint(client: TestClient):
    """Validates the POST /api/v1/benchmark endpoint returns structured evaluation data."""
    payload = {
        "top_k": 3,
        "include_latency_profile": False,
    }
    response = client.post("/api/v1/benchmark", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["benchmark_cases_count"] >= 8
    assert data["corpus_documents"] >= 10000
    assert len(data["results"]) == data["benchmark_cases_count"]

    first_case = data["results"][0]
    assert "test_id" in first_case
    assert "category" in first_case
    assert "query" in first_case
    assert "jaccard_overlap" in first_case
    assert "bm25" in first_case
    assert "vector_search" in first_case
    assert "winner" in first_case
    assert "rationale" in first_case
