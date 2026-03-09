"""
nlp.py — Stage 1: Text encoding
Encode review texts and item overviews with sentence-transformers.
See ml/claude/process.md for full design reasoning.
"""

import numpy as np
import pandas as pd
from pathlib import Path
from sentence_transformers import SentenceTransformer

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    PROCESSED_DIR,
    EMBEDDING_MODEL,
)

BATCH_SIZE = 64  # sentences per forward pass; tune down if you hit memory limits


# ── Model ──────────────────────────────────────────────────────────────────────

def load_model() -> SentenceTransformer:
    print(f"Loading embedding model: {EMBEDDING_MODEL}...")
    # Downloads ~80 MB on first run, then cached in ~/.cache/huggingface/
    return SentenceTransformer(EMBEDDING_MODEL)


# ── Overviews ──────────────────────────────────────────────────────────────────

def encode_overviews(model: SentenceTransformer) -> None:
    catalog = pd.read_parquet(PROCESSED_DIR / "catalog.parquet")
    catalog = catalog[["tmdb_id", "overview"]].drop_duplicates(subset="tmdb_id")
    catalog["overview"] = catalog["overview"].fillna("").str.strip()

    texts    = catalog["overview"].tolist()
    tmdb_ids = catalog["tmdb_id"].tolist()

    print(f"Encoding {len(texts)} item overviews...")
    embeddings = model.encode(
        texts,
        batch_size=BATCH_SIZE,
        show_progress_bar=True,
        normalize_embeddings=True,  # unit vectors → cosine sim == dot product (faster at query time)
        convert_to_numpy=True,
    ).astype(np.float32)

    np.save(PROCESSED_DIR / "overview_embeddings.npy", embeddings)
    pd.DataFrame({"tmdb_id": tmdb_ids}).to_parquet(
        PROCESSED_DIR / "overview_index.parquet", index=False
    )
    print(f"  overview_embeddings.npy  shape={embeddings.shape}")


# ── Reviews ────────────────────────────────────────────────────────────────────

def encode_reviews(model: SentenceTransformer) -> None:
    watch_logs = pd.read_parquet(PROCESSED_DIR / "watch_logs.parquet")

    if "review" not in watch_logs.columns:
        print("  No review column in watch_logs — skipping.")
        return

    has_text = watch_logs["review"].notna() & (watch_logs["review"].str.strip() != "")
    reviews  = watch_logs[has_text][["user_id", "tmdb_id", "review"]].copy()

    if reviews.empty:
        print("  No review texts found — skipping.")
        return

    texts = reviews["review"].tolist()
    print(f"Encoding {len(texts)} review texts...")
    embeddings = model.encode(
        texts,
        batch_size=BATCH_SIZE,
        show_progress_bar=True,
        normalize_embeddings=True,
        convert_to_numpy=True,
    ).astype(np.float32)

    np.save(PROCESSED_DIR / "review_embeddings.npy", embeddings)
    reviews[["user_id", "tmdb_id"]].reset_index(drop=True).to_parquet(  # drop "review" col, only keep index
        PROCESSED_DIR / "review_index.parquet", index=False
    )
    print(f"  review_embeddings.npy    shape={embeddings.shape}")


# ── Entry point ────────────────────────────────────────────────────────────────

def run():
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    model = load_model()
    encode_overviews(model)
    encode_reviews(model)
    print("\nNLP encoding complete.")


if __name__ == "__main__":
    run()
