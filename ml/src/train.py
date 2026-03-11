"""
train.py — Stage 3: Model training
1. Train truncated SVD on MovieLens 25M → item embeddings indexed by tmdb_id
2. Rebuild item vectors via features.py (now with SVD populated)
3. Build FAISS content index from the updated item vectors
See .claude/process.md for full design reasoning.
"""

import numpy as np
import pandas as pd
import faiss
import joblib
from pathlib import Path
from scipy.sparse import csr_matrix
from scipy.sparse.linalg import svds

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    PROCESSED_DIR, MODELS_DIR, MOVIELENS_DIR,
    SVD_N_FACTORS,
)


# ── SVD ────────────────────────────────────────────────────────────────────────

def train_svd() -> None:
    """
    Train truncated SVD on the MovieLens 25M ratings matrix and save item
    embeddings mapped to tmdb_ids.

    Outputs
    -------
    svd_embeddings.npy    : float32 (N, SVD_N_FACTORS) — one row per item with a tmdb_id
    svd_index.parquet     : tmdb_id per row (positional alignment)
    models/svd_model.pkl  : dict with U, s, Vt, user_ids, movie_ids (for potential user inference)
    """
    print("Loading MovieLens ratings (25M rows)...")
    ratings = pd.read_csv(
        MOVIELENS_DIR / "ratings.csv",
        usecols=["userId", "movieId", "rating"],
        dtype={"userId": np.int32, "movieId": np.int32, "rating": np.float32},
    )
    print(f"  {len(ratings):,} ratings, {ratings['userId'].nunique():,} users, {ratings['movieId'].nunique():,} movies")

    # Map user and movie IDs to contiguous 0-based indices for the sparse matrix
    user_ids  = ratings["userId"].unique()
    movie_ids = ratings["movieId"].unique()
    user_map  = {uid: i for i, uid in enumerate(user_ids)}
    movie_map = {mid: i for i, mid in enumerate(movie_ids)}

    rows = ratings["userId"].map(user_map).to_numpy()
    cols = ratings["movieId"].map(movie_map).to_numpy()
    vals = ratings["rating"].to_numpy()

    print(f"Building sparse matrix ({len(user_ids):,} × {len(movie_ids):,})...")
    matrix = csr_matrix((vals, (rows, cols)), shape=(len(user_ids), len(movie_ids)))

    # Truncated SVD: matrix ≈ U @ diag(s) @ Vt
    # Vt rows are item latent factors; Vt.T gives (n_movies, k) item embedding matrix
    print(f"Running SVD (k={SVD_N_FACTORS})... this takes a few minutes")
    U, s, Vt = svds(matrix, k=SVD_N_FACTORS)

    # svds returns singular values in ascending order — reverse to descending
    idx  = np.argsort(s)[::-1]
    s    = s[idx]
    U    = U[:, idx]
    Vt   = Vt[idx, :]

    # Item embedding = each item's row in Vt scaled by singular values
    # Shape: (n_movies, k)
    item_embeddings = (Vt.T * s).astype(np.float32)

    # L2-normalise so downstream cosine sim == dot product
    norms = np.linalg.norm(item_embeddings, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    item_embeddings /= norms

    # Map MovieLens movieIds → tmdbIds via the crosswalk
    print("Mapping MovieLens IDs → TMDB IDs via crosswalk...")
    crosswalk = pd.read_parquet(PROCESSED_DIR / "movielens_crosswalk.parquet")
    ml_to_tmdb = dict(zip(crosswalk["movieId"].tolist(), crosswalk["tmdbId"].tolist()))

    tmdb_ids_out = []
    embeddings_out = []
    for ml_id, matrix_idx in movie_map.items():
        tmdb_id = ml_to_tmdb.get(ml_id)
        if tmdb_id is not None:
            tmdb_ids_out.append(int(tmdb_id))
            embeddings_out.append(item_embeddings[matrix_idx])

    svd_array = np.array(embeddings_out, dtype=np.float32)
    svd_df    = pd.DataFrame({"tmdb_id": tmdb_ids_out})

    np.save(PROCESSED_DIR / "svd_embeddings.npy", svd_array)
    svd_df.to_parquet(PROCESSED_DIR / "svd_index.parquet", index=False)

    # Save full model for potential user-side inference later
    joblib.dump(
        {"U": U, "s": s, "Vt": Vt, "user_ids": user_ids, "movie_ids": movie_ids},
        MODELS_DIR / "svd_model.pkl",
    )
    print(f"  svd_embeddings.npy  shape={svd_array.shape}  ({len(tmdb_ids_out):,} items mapped to TMDB)")


# ── FAISS index ────────────────────────────────────────────────────────────────

def build_faiss_index() -> None:
    """
    Build a FAISS flat inner-product index over the item vectors produced by
    features.py. Since item vectors are L2-normalised, inner product == cosine
    similarity, so IndexFlatIP gives exact cosine nearest-neighbour search.

    Outputs
    -------
    models/faiss_content.index  : FAISS index file, loadable with faiss.read_index()
    """
    item_vectors = np.load(PROCESSED_DIR / "item_vectors.npy")
    dim = item_vectors.shape[1]

    # Normalise so IP search == cosine search
    faiss.normalize_L2(item_vectors)

    print(f"Building FAISS index  (dim={dim}, n={len(item_vectors)})...")
    index = faiss.IndexFlatIP(dim)
    index.add(item_vectors)

    faiss.write_index(index, str(MODELS_DIR / "faiss_content.index"))
    print(f"  faiss_content.index  {index.ntotal} vectors")


# ── Entry point ────────────────────────────────────────────────────────────────

def run():
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Train SVD → writes svd_embeddings.npy
    train_svd()

    # 2. Rebuild item vectors now that SVD embeddings exist
    print("\nRebuilding item vectors with SVD embeddings...")
    import features
    features.run()

    # 3. Build FAISS index over the updated item vectors
    print()
    build_faiss_index()

    print("\nTraining complete.")


if __name__ == "__main__":
    run()
