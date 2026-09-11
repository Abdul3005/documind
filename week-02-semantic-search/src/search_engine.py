"""Unified Search Engine combining BM25 Keyword Search and Dense Vector Embedding Search.

Features:
- BM25Okapi lexical keyword matching with custom tokenization.
- Cosine similarity dense vector search using PyTorch tensors.
- Hybrid search with Reciprocal Rank Fusion (RRF).
- Microsecond-accurate latency profiling.
"""

import os
import re
import sys
import time
from typing import Any, Dict, List, Literal, Optional, Tuple, Union

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import numpy as np
import torch
from rank_bm25 import BM25Okapi

from src.embeddings import EmbeddingEngine


def tokenize_text(text: str) -> List[str]:
    """Tokenizes a string for BM25 search: lowercasing, alphanumeric extraction."""
    if not text:
        return []
    # Extract lowercase alphanumeric words (handling hyphens/underscores in technical terms)
    return [token.lower() for token in re.findall(r"\b[a-zA-Z0-9_\-\.]{2,}\b", text)]


class SearchEngine:
    """Production search engine coordinating BM25 lexical search and PyTorch vector search."""

    def __init__(
        self,
        documents: List[Dict[str, Any]],
        embeddings: Optional[torch.Tensor] = None,
        embedding_engine: Optional[EmbeddingEngine] = None,
        embeddings_cache_path: str = "data/embeddings.pt",
    ):
        """Initializes the unified search engine with documents and index structures.

        Args:
            documents: List of document dicts containing 'id', 'text', and 'metadata'.
            embeddings: Optional preloaded PyTorch tensor (N, D).
            embedding_engine: Optional EmbeddingEngine instance.
            embeddings_cache_path: Path to load/save embeddings if not supplied.
        """
        self.documents = documents
        self.doc_count = len(documents)
        self.doc_map = {doc["id"]: doc for doc in documents}
        self.embeddings_cache_path = embeddings_cache_path

        print(f"[*] Initializing SearchEngine with {self.doc_count:,} documents...")

        # 1. Initialize BM25 Keyword Index
        t0 = time.perf_counter()
        print("[*] Building BM25Okapi index...")
        self.corpus_tokenized = [tokenize_text(doc["text"]) for doc in self.documents]
        self.bm25 = BM25Okapi(self.corpus_tokenized)
        bm25_init_ms = (time.perf_counter() - t0) * 1000
        print(f"[OK] BM25 index built in {bm25_init_ms:.1f}ms")

        # 2. Initialize Vector Embedding Engine & Tensor Cache
        self.embedding_engine = embedding_engine or EmbeddingEngine()
        if embeddings is not None:
            self.embeddings = embeddings.to(self.embedding_engine.device)
        else:
            self.embeddings = self.embedding_engine.get_or_compute_embeddings(
                documents=self.documents,
                filepath=self.embeddings_cache_path,
            )

        print(
            f"[OK] SearchEngine ready. Corpus size: {self.doc_count:,} | "
            f"Embeddings: {list(self.embeddings.shape)} on {self.embedding_engine.device}"
        )

    def search_keyword(
        self,
        query: str,
        top_k: int = 10,
    ) -> Tuple[List[Dict[str, Any]], float]:
        """Performs lexical BM25 keyword search.

        Args:
            query: Search query string.
            top_k: Number of top results to return.

        Returns:
            Tuple of (list of ranked result dicts, latency in milliseconds).
        """
        t0 = time.perf_counter()
        tokenized_query = tokenize_text(query)

        if not tokenized_query:
            return [], (time.perf_counter() - t0) * 1000

        # Compute BM25 raw scores across entire corpus
        scores = self.bm25.get_scores(tokenized_query)
        # Find top_k indices with positive scores
        top_indices = np.argsort(scores)[::-1][:top_k]

        results = []
        for rank, idx in enumerate(top_indices, start=1):
            score = float(scores[idx])
            # Only include results with positive BM25 scores (unless all 0)
            if score <= 0.0 and len(results) > 0:
                break
            doc = self.documents[idx]
            results.append({
                "id": doc["id"],
                "score": round(score, 4),
                "text": doc["text"],
                "metadata": doc.get("metadata", {}),
                "rank": rank,
                "algorithm": "bm25",
            })

        latency_ms = (time.perf_counter() - t0) * 1000
        return results, latency_ms

    def search_semantic(
        self,
        query: str,
        top_k: int = 10,
    ) -> Tuple[List[Dict[str, Any]], float]:
        """Performs dense vector embedding search using PyTorch cosine similarity.

        Args:
            query: Search query string.
            top_k: Number of top results to return.

        Returns:
            Tuple of (list of ranked result dicts, latency in milliseconds).
        """
        t0 = time.perf_counter()

        # Encode query to unit-normalized tensor (1, D)
        query_embedding = self.embedding_engine.encode_query(query, normalize_embeddings=True)

        # Cosine similarity is dot product when vectors are L2-normalized:
        # (1, D) @ (D, N) -> (1, N)
        with torch.no_grad():
            similarity_scores = torch.matmul(query_embedding, self.embeddings.T).squeeze(0)
            # Fetch top-k indices and scores
            actual_k = min(top_k, self.doc_count)
            top_scores, top_indices = torch.topk(similarity_scores, k=actual_k, largest=True)

        # Move tensors to CPU for serialization
        top_scores_cpu = top_scores.cpu().tolist()
        top_indices_cpu = top_indices.cpu().tolist()

        results = []
        for rank, (idx, score) in enumerate(zip(top_indices_cpu, top_scores_cpu), start=1):
            doc = self.documents[idx]
            results.append({
                "id": doc["id"],
                "score": round(float(score), 4),
                "text": doc["text"],
                "metadata": doc.get("metadata", {}),
                "rank": rank,
                "algorithm": "semantic_vector",
            })

        latency_ms = (time.perf_counter() - t0) * 1000
        return results, latency_ms

    def search_both(
        self,
        query: str,
        top_k: int = 10,
        rrf_k: int = 60,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any], float]:
        """Executes both BM25 and Vector search and fuses them using Reciprocal Rank Fusion (RRF).

        RRF Formula:
            RRF_Score(d) = sum(1 / (rrf_k + rank(d))) for each system where d was retrieved.

        Args:
            query: Search query string.
            top_k: Number of results to return in fused list.
            rrf_k: Smoothing constant for RRF (default: 60).

        Returns:
            Tuple of (fused results list, dict with separate keyword & semantic details, total latency in ms).
        """
        t0 = time.perf_counter()

        # Execute both retrievers
        keyword_results, kw_latency = self.search_keyword(query, top_k=top_k * 2)
        semantic_results, sem_latency = self.search_semantic(query, top_k=top_k * 2)

        # Compute Reciprocal Rank Fusion scores
        rrf_scores: Dict[str, float] = {}
        algorithm_contributions: Dict[str, Dict[str, Any]] = {}

        # Process keyword ranks
        for item in keyword_results:
            doc_id = item["id"]
            rank = item["rank"]
            score_contrib = 1.0 / (rrf_k + rank)
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + score_contrib
            if doc_id not in algorithm_contributions:
                algorithm_contributions[doc_id] = {}
            algorithm_contributions[doc_id]["bm25_rank"] = rank
            algorithm_contributions[doc_id]["bm25_score"] = item["score"]

        # Process semantic ranks
        for item in semantic_results:
            doc_id = item["id"]
            rank = item["rank"]
            score_contrib = 1.0 / (rrf_k + rank)
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + score_contrib
            if doc_id not in algorithm_contributions:
                algorithm_contributions[doc_id] = {}
            algorithm_contributions[doc_id]["semantic_rank"] = rank
            algorithm_contributions[doc_id]["semantic_score"] = item["score"]

        # Sort documents descending by RRF score
        sorted_doc_ids = sorted(rrf_scores.keys(), key=lambda d: rrf_scores[d], reverse=True)[
            :top_k
        ]

        fused_results = []
        for rank, doc_id in enumerate(sorted_doc_ids, start=1):
            doc = self.doc_map[doc_id]
            contrib = algorithm_contributions.get(doc_id, {})
            fused_results.append({
                "id": doc["id"],
                "score": round(float(rrf_scores[doc_id]), 6),
                "text": doc["text"],
                "metadata": {
                    **doc.get("metadata", {}),
                    "rrf_details": contrib,
                },
                "rank": rank,
                "algorithm": "hybrid_rrf",
            })

        total_latency_ms = (time.perf_counter() - t0) * 1000

        breakdown = {
            "keyword_results": keyword_results[:top_k],
            "semantic_results": semantic_results[:top_k],
            "keyword_latency_ms": round(kw_latency, 2),
            "semantic_latency_ms": round(sem_latency, 2),
            "total_candidates_evaluated": len(rrf_scores),
        }

        return fused_results, breakdown, total_latency_ms

    def search(
        self,
        query: str,
        top_k: int = 10,
        method: Literal["semantic", "keyword", "both"] = "semantic",
    ) -> Dict[str, Any]:
        """Unified entrypoint for search queries.

        Args:
            query: The user search query.
            top_k: Number of results requested.
            method: 'semantic', 'keyword', or 'both'.

        Returns:
            Dictionary matching the SearchResponse schema.
        """
        query = query.strip()
        if not query:
            return {
                "query": query,
                "method": method,
                "latency_ms": 0.0,
                "total_results": 0,
                "results": [],
                "hybrid_details": None,
            }

        if method == "keyword":
            results, latency = self.search_keyword(query, top_k=top_k)
            return {
                "query": query,
                "method": "keyword",
                "latency_ms": round(latency, 2),
                "total_results": len(results),
                "results": results,
                "hybrid_details": None,
            }
        elif method == "both":
            fused_results, breakdown, latency = self.search_both(query, top_k=top_k)
            return {
                "query": query,
                "method": "both",
                "latency_ms": round(latency, 2),
                "total_results": len(fused_results),
                "results": fused_results,
                "hybrid_details": breakdown,
            }
        else:  # default: semantic
            results, latency = self.search_semantic(query, top_k=top_k)
            return {
                "query": query,
                "method": "semantic",
                "latency_ms": round(latency, 2),
                "total_results": len(results),
                "results": results,
                "hybrid_details": None,
            }
