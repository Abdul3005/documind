"""Pydantic v2 schemas for Search Engine API."""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """Payload for POST /api/v1/search."""

    query: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Search query string (keywords or natural language)",
        examples=["Senior PyTorch Deep Learning Engineer with vLLM experience"],
    )
    top_k: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Maximum number of ranked results to retrieve",
        examples=[10],
    )
    method: Literal["semantic", "keyword", "both"] = Field(
        default="semantic",
        description="Search algorithm: 'semantic' (vector embeddings), 'keyword' (BM25), or 'both' (RRF hybrid)",
        examples=["semantic"],
    )


class SearchResultItem(BaseModel):
    """Individual ranked document search result."""

    id: str = Field(..., description="Unique document ID")
    score: float = Field(..., description="Relevance score (cosine similarity for vector, BM25 score for keyword, RRF for both)")
    text: str = Field(..., description="Document content text")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata dictionary (title, category, tags, etc.)")
    rank: int = Field(..., description="1-indexed rank position")
    algorithm: str = Field(..., description="Algorithm used to retrieve this record")


class SearchResponse(BaseModel):
    """Response payload for POST /api/v1/search."""

    query: str = Field(..., description="Original search query")
    method: str = Field(..., description="Search method executed")
    latency_ms: float = Field(..., description="Retrieval latency in milliseconds")
    total_results: int = Field(..., description="Total items returned in results list")
    results: List[SearchResultItem] = Field(default_factory=list, description="Ranked list of matching records")
    hybrid_details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Detailed breakdowns of keyword vs semantic rankings when method='both'",
    )


class BenchmarkRequest(BaseModel):
    """Payload for POST /api/v1/benchmark."""

    top_k: int = Field(
        default=5,
        ge=1,
        le=50,
        description="Number of top candidates to evaluate per query case",
    )
    include_latency_profile: bool = Field(
        default=True,
        description="Whether to execute multi-iteration latency profiling",
    )


class BenchmarkTestCaseResult(BaseModel):
    """Detailed evaluation result for a single benchmark query."""

    test_id: int
    category: str
    query: str
    description: str
    jaccard_overlap: float
    bm25: Dict[str, Any]
    vector_search: Dict[str, Any]
    winner: str
    rationale: str


class BenchmarkResponse(BaseModel):
    """Response payload for POST /api/v1/benchmark."""

    benchmark_cases_count: int
    corpus_documents: int
    embedding_device: str
    top_k_evaluated: int
    results: List[BenchmarkTestCaseResult]
    latency_profile: Optional[Dict[str, Any]] = None


class HealthResponse(BaseModel):
    """Response payload for GET /health and GET /api/v1/health."""

    status: str = "healthy"
    corpus_size: int
    embedding_device: str
    embedding_dimension: int
    model_name: str
    timestamp: float
