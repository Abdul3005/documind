"""PyTorch + SentenceTransformers embedding engine for dense semantic search.

Computes, caches, and loads 384-dimensional normalized embeddings using
`sentence-transformers/all-MiniLM-L6-v2` with dynamic device selection (CUDA/MPS/CPU).
"""

import argparse
import os
import sys
import time
from typing import Any, Dict, List, Optional, Union

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import numpy as np
import torch
from sentence_transformers import SentenceTransformer

DEFAULT_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384


def resolve_device(requested_device: Optional[str] = None) -> torch.device:
    """Detects and returns the best available PyTorch compute device."""
    if requested_device:
        return torch.device(requested_device)

    if torch.cuda.is_available():
        device = torch.device("cuda")
        device_name = torch.cuda.get_device_name(0)
        print(f"[Device] Utilizing NVIDIA CUDA GPU: {device_name}")
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = torch.device("mps")
        print("[Device] Utilizing Apple Silicon Metal Performance Shaders (MPS)")
    else:
        device = torch.device("cpu")
        print("[Device] Utilizing Host CPU for PyTorch execution")

    return device


class EmbeddingEngine:
    """Production embedding generator and persistence manager using SentenceTransformers."""

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL_NAME,
        device: Optional[str] = None,
        cache_dir: Optional[str] = None,
    ):
        self.model_name = model_name
        self.device = resolve_device(device)
        self.cache_dir = cache_dir

        print(f"[*] Loading SentenceTransformer model: {self.model_name} on {self.device}...")
        start_t = time.time()
        self.model = SentenceTransformer(
            model_name_or_path=self.model_name,
            device=str(self.device),
            cache_folder=self.cache_dir,
        )
        if hasattr(self.model, "get_embedding_dimension"):
            self.embedding_dim = self.model.get_embedding_dimension()
        elif hasattr(self.model, "get_sentence_embedding_dimension"):
            self.embedding_dim = self.model.get_sentence_embedding_dimension()
        else:
            self.embedding_dim = EMBEDDING_DIM
        load_time = time.time() - start_t
        print(f"[OK] Model loaded in {load_time:.2f}s (Embedding Dimension: {self.embedding_dim})")

    def encode_documents(
        self,
        texts: List[str],
        batch_size: int = 64,
        show_progress_bar: bool = True,
        normalize_embeddings: bool = True,
    ) -> torch.Tensor:
        """Encodes a list of document strings into a 2D PyTorch Tensor (N, D).

        Args:
            texts: List of document text strings.
            batch_size: Batch size for model inference.
            show_progress_bar: Whether to display progress bar.
            normalize_embeddings: When True, applies L2 normalization for fast dot-product cosine similarity.

        Returns:
            torch.Tensor of shape (len(texts), embedding_dim) on self.device.
        """
        if not texts:
            return torch.empty((0, self.embedding_dim), device=self.device)

        print(
            f"[*] Encoding {len(texts):,} documents (batch_size={batch_size}, device={self.device})..."
        )
        start_t = time.time()

        # sentence-transformers encode supports convert_to_tensor=True
        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=show_progress_bar,
            convert_to_tensor=True,
            normalize_embeddings=normalize_embeddings,
            device=str(self.device),
        )

        elapsed = time.time() - start_t
        docs_per_sec = len(texts) / elapsed if elapsed > 0 else 0
        print(
            f"[OK] Encoded {len(texts):,} documents in {elapsed:.2f}s ({docs_per_sec:.1f} docs/sec)."
        )
        return embeddings

    def encode_query(
        self,
        query: str,
        normalize_embeddings: bool = True,
    ) -> torch.Tensor:
        """Encodes a single search query string into a 1D or 2D normalized tensor.

        Args:
            query: User search query string.
            normalize_embeddings: Whether to normalize vector to unit length.

        Returns:
            torch.Tensor of shape (1, embedding_dim) on self.device.
        """
        if not query or not query.strip():
            raise ValueError("Query string must not be empty.")

        embedding = self.model.encode(
            query.strip(),
            convert_to_tensor=True,
            normalize_embeddings=normalize_embeddings,
            device=str(self.device),
        )
        if embedding.dim() == 1:
            embedding = embedding.unsqueeze(0)
        return embedding

    @staticmethod
    def save_embeddings(embeddings: torch.Tensor, filepath: str) -> None:
        """Saves PyTorch embeddings tensor to disk (.pt format)."""
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        # Detach to CPU for portable storage
        tensor_to_save = embeddings.detach().cpu()
        torch.save(tensor_to_save, filepath)
        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        print(f"[OK] Saved embeddings matrix {list(embeddings.shape)} to {filepath} ({size_mb:.2f} MB)")

    def load_embeddings(self, filepath: str) -> torch.Tensor:
        """Loads precomputed PyTorch embeddings tensor from disk to self.device."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Embeddings cache file not found at: {filepath}")

        start_t = time.time()
        # Load tensor and map to current compute device
        embeddings = torch.load(filepath, map_location=self.device, weights_only=True)
        elapsed = time.time() - start_t
        print(
            f"[OK] Loaded embeddings {list(embeddings.shape)} into {self.device} memory in {elapsed * 1000:.1f} ms"
        )
        return embeddings

    def get_or_compute_embeddings(
        self,
        documents: List[Dict[str, Any]],
        filepath: str = "data/embeddings.pt",
        batch_size: int = 64,
        force_recompute: bool = False,
    ) -> torch.Tensor:
        """Retrieves cached embeddings if valid; computes, caches, and returns them otherwise."""
        if not force_recompute and os.path.exists(filepath):
            try:
                cached = self.load_embeddings(filepath)
                if cached.shape[0] == len(documents):
                    return cached
                print(
                    f"[!] Cached embeddings size {cached.shape[0]} does not match document count {len(documents)}. Recomputing..."
                )
            except Exception as e:
                print(f"[!] Failed to load existing embeddings cache ({e}). Recomputing...")

        texts = [doc["text"] for doc in documents]
        embeddings = self.encode_documents(texts, batch_size=batch_size, show_progress_bar=True)
        self.save_embeddings(embeddings, filepath)
        return embeddings


if __name__ == "__main__":
    from src.dataset import get_or_create_dataset

    parser = argparse.ArgumentParser(description="Precompute dense vector embeddings for documents.")
    parser.add_argument("--data", type=str, default="data/documents_10k.json", help="Path to documents JSON")
    parser.add_argument("--output", type=str, default="data/embeddings.pt", help="Path to save embeddings .pt")
    parser.add_argument("--batch-size", type=int, default=64, help="Embedding generation batch size")
    parser.add_argument("--force", action="store_true", help="Force recomputation of embeddings")
    args = parser.parse_args()

    docs = get_or_create_dataset(args.data)
    engine = EmbeddingEngine()
    engine.get_or_compute_embeddings(
        documents=docs,
        filepath=args.output,
        batch_size=args.batch_size,
        force_recompute=args.force,
    )
