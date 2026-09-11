"""FastAPI Production Application for Week 2 Semantic Search Engine & Retrieval Benchmark.

Features:
- Async lifespan context manager loading 10,000 documents and embeddings into memory on startup.
- POST /api/v1/search: Semantic (PyTorch Cosine), Keyword (BM25), and Hybrid (RRF) search.
- POST /api/v1/benchmark: On-demand evaluation comparing BM25 vs Vector Search.
- GET /api/v1/health: Real-time health and readiness telemetry.
"""

import os
import sys
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

# Ensure week-02-semantic-search directory is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.schemas import (
    BenchmarkRequest,
    BenchmarkResponse,
    HealthResponse,
    SearchRequest,
    SearchResponse,
)
from src.benchmark import evaluate_benchmark
from src.dataset import get_or_create_dataset
from src.embeddings import DEFAULT_MODEL_NAME, EmbeddingEngine
from src.search_engine import SearchEngine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager that initializes indexes and models into memory on server startup."""
    print("\n" + "=" * 70)
    print("      Starting Week 2 Semantic Search Engine Microservice")
    print("=" * 70)
    t0 = time.time()

    data_path = os.path.join(BASE_DIR, "data", "documents_10k.json")
    embeddings_path = os.path.join(BASE_DIR, "data", "embeddings.pt")

    # 1. Load or generate 10,000+ document dataset
    print(f"[*] Step 1/3: Loading documents from {data_path}...")
    documents = get_or_create_dataset(file_path=data_path, min_count=10000)
    app.state.documents = documents

    # 2. Initialize embedding engine
    print("[*] Step 2/3: Initializing PyTorch SentenceTransformer engine...")
    embedding_engine = EmbeddingEngine(model_name=DEFAULT_MODEL_NAME)
    app.state.embedding_engine = embedding_engine

    # 3. Build/Load Search Engine (BM25 + Dense Vector Matrix)
    print("[*] Step 3/3: Initializing unified SearchEngine (BM25 + Vector)...")
    search_engine = SearchEngine(
        documents=documents,
        embedding_engine=embedding_engine,
        embeddings_cache_path=embeddings_path,
    )
    app.state.search_engine = search_engine
    app.state.startup_time = time.time()

    startup_duration = time.time() - t0
    print(f"[OK] Microservice initialized successfully in {startup_duration:.2f}s.")
    print("=" * 70 + "\n")

    yield

    print("[*] Shutting down Semantic Search Engine service. Freeing memory...")
    if hasattr(app.state, "search_engine"):
        del app.state.search_engine
    if hasattr(app.state, "embedding_engine"):
        del app.state.embedding_engine
    print("[OK] Shutdown complete.")


app = FastAPI(
    title="DocuMind Semantic Search Engine API",
    description=(
        "Production-grade Semantic Search Engine comparing BM25 Keyword Search vs. "
        "PyTorch SentenceTransformers Dense Vector Search on 10,000+ technical documents. "
        "Week 2 of the DigitalSofts AI/ML Engineering Challenge."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Enable Cross-Origin Resource Sharing (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Adds X-Process-Time-Ms header to every HTTP response."""
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time_ms = (time.perf_counter() - start_time) * 1000
    response.headers["X-Process-Time-Ms"] = f"{process_time_ms:.2f}"
    return response


@app.get("/health", response_model=HealthResponse, tags=["Health"])
@app.get("/api/v1/health", response_model=HealthResponse, tags=["Health"])
async def health_check(request: Request) -> HealthResponse:
    """Returns real-time health telemetry, document count, and active PyTorch device."""
    engine: SearchEngine = request.app.state.search_engine
    return HealthResponse(
        status="healthy",
        corpus_size=engine.doc_count,
        embedding_device=str(engine.embedding_engine.device),
        embedding_dimension=engine.embedding_engine.embedding_dim,
        model_name=engine.embedding_engine.model_name,
        timestamp=time.time(),
    )


@app.post("/api/v1/search", response_model=SearchResponse, tags=["Search"])
async def search(payload: SearchRequest, request: Request) -> SearchResponse:
    """Executes high-performance search across 10,000+ documents.

    Supports:
    - `semantic`: Dense vector cosine similarity via PyTorch.
    - `keyword`: BM25 lexical token matching.
    - `both`: Reciprocal Rank Fusion (RRF) hybrid search with separate breakdowns.
    """
    clean_query = payload.query.strip()
    if not clean_query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query cannot be empty or whitespace.",
        )

    engine: SearchEngine = request.app.state.search_engine
    result = engine.search(
        query=clean_query,
        top_k=payload.top_k,
        method=payload.method,
    )
    return SearchResponse(**result)


@app.post("/api/v1/benchmark", response_model=BenchmarkResponse, tags=["Benchmark"])
async def run_benchmark(payload: BenchmarkRequest, request: Request) -> BenchmarkResponse:
    """Executes the comparative benchmark suite evaluating BM25 vs. Vector Search across edge-case scenarios."""
    engine: SearchEngine = request.app.state.search_engine
    report = evaluate_benchmark(
        engine=engine,
        top_k=payload.top_k,
        include_latency_profile=payload.include_latency_profile,
    )
    return BenchmarkResponse(**report)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=False)
