"""
features.py — Stage 2: Feature engineering
Build item vectors and user profiles from all available signals.
See .claude/process.md for full design reasoning.
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from datetime import date

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    PROCESSED_DIR, MODELS_DIR,
    EMBEDDING_DIM, SVD_N_FACTORS,
    RECENCY_HALFLIFE, COLD_THRESHOLD, WARM_THRESHOLD,
)

CAST_HASH_DIM = 256   # width of the cast/director multi-hot hash vector

ASPECT_COLS = [
    "plot_rating", "acting_rating", "cinematography_rating",
    "pacing_rating", "soundtrack_rating", "casting_rating",
]

# Rating bucket thresholds (scale: 1–5 stars)
HARD_POS  = 4.0
SOFT_POS  = 3.0
SOFT_NEG  = 2.0
# hard_negative = anything below SOFT_NEG


# ── Helpers ────────────────────────────────────────────────────────────────────

def _to_list(val) -> list:
    """Normalise numpy arrays and None to a plain Python list."""
    if val is None:
        return []
    if isinstance(val, np.ndarray):
        return val.tolist()
    return list(val)


def _recency_decay(watched_date_str, today: date) -> float:
    """
    Exponential decay weight based on days since watch date.
    weight = 0.5 ^ (days / halflife)   [halflife = RECENCY_HALFLIFE days]
    Returns 1.0 if date is missing or unparseable.
    """
    if not watched_date_str or pd.isna(watched_date_str):
        return 1.0
    try:
        watched = date.fromisoformat(str(watched_date_str)[:10])
        days = (today - watched).days
        return float(0.5 ** (days / RECENCY_HALFLIFE))
    except (ValueError, TypeError):
        return 1.0


def _engagement_multiplier(row: pd.Series) -> float:
    """
    Per-item engagement weight on top of the base rating signal.
    - rewatchability "yes"  → 1.2×
    - times_watched > 1     → log(times_watched) additional boost
    watch_duration is free text in this schema so completion ratio is skipped.
    """
    mult = 1.0
    if str(row.get("rewatchability", "")).strip().lower() == "yes":
        mult *= 1.2
    try:
        tw = int(row.get("times_watched", 1) or 1)
    except (ValueError, TypeError):
        tw = 1
    if tw > 1:
        mult *= float(np.log(tw) + 1.0)
    return mult


# ── Genre vocabulary ───────────────────────────────────────────────────────────

def build_genre_vocab(catalog: pd.DataFrame) -> list[str]:
    genres: set[str] = set()
    for val in catalog["genres"]:
        genres.update(_to_list(val))
    return sorted(genres)


def genre_multihot(genres, vocab_index: dict, vocab_size: int) -> np.ndarray:
    vec = np.zeros(vocab_size, dtype=np.float32)
    for g in _to_list(genres):
        if g in vocab_index:
            vec[vocab_index[g]] = 1.0
    return vec


# ── Cast/director hash ─────────────────────────────────────────────────────────

def cast_multihot(cast_ids, director_ids) -> np.ndarray:
    vec = np.zeros(CAST_HASH_DIM, dtype=np.float32)
    for pid in _to_list(cast_ids) + _to_list(director_ids):
        vec[abs(hash(int(pid))) % CAST_HASH_DIM] = 1.0
    return vec


# ── Quality prior ──────────────────────────────────────────────────────────────

def quality_prior_vec(row: pd.Series) -> np.ndarray:
    """
    [normalized_vote_avg, normalized_log_vote_count]
    Prefers IMDb values; falls back to TMDB. Returns zeros if neither available.
    """
    vote_avg = row.get("average_rating") if not pd.isna(row.get("average_rating", float("nan"))) else row.get("vote_average")
    vote_cnt = row.get("num_votes")      if not pd.isna(row.get("num_votes", float("nan")))      else row.get("vote_count")

    if vote_avg is None or pd.isna(vote_avg):
        return np.zeros(2, dtype=np.float32)

    norm_avg = float(vote_avg) / 10.0
    norm_log = float(np.log1p(vote_cnt or 0)) / np.log1p(3_000_000)
    return np.array([norm_avg, min(norm_log, 1.0)], dtype=np.float32)


# ── Item vectors ───────────────────────────────────────────────────────────────

def build_item_vectors(
    catalog: pd.DataFrame,
) -> tuple[np.ndarray, pd.DataFrame, list[str]]:
    """
    Build one float32 item vector per catalog row by concatenating:
        genres (multi-hot)  |  cast hash  |  overview embedding  |  SVD  |  quality prior

    Returns
    -------
    vectors      : float32 array (N, D)
    index_df     : DataFrame with tmdb_id + media_type per row (positional alignment)
    genre_vocab  : list of genre strings (saved to disk for consistent encoding later)
    """
    # Overview embeddings (from nlp.py)
    ov_emb = np.load(PROCESSED_DIR / "overview_embeddings.npy")
    ov_idx = pd.read_parquet(PROCESSED_DIR / "overview_index.parquet")
    ov_map = dict(zip(ov_idx["tmdb_id"].tolist(), range(len(ov_idx))))

    # SVD embeddings (from train.py — may not exist on first run)
    svd_path = PROCESSED_DIR / "svd_embeddings.npy"
    if svd_path.exists():
        svd_emb = np.load(svd_path)
        svd_idx = pd.read_parquet(PROCESSED_DIR / "svd_index.parquet")
        svd_map = dict(zip(svd_idx["tmdb_id"].tolist(), range(len(svd_idx))))
        print(f"  SVD embeddings loaded: {svd_emb.shape}")
    else:
        svd_emb = None
        svd_map = {}
        print("  SVD embeddings not found — using zeros (run train.py to populate)")

    genre_vocab  = build_genre_vocab(catalog)
    vocab_index  = {g: i for i, g in enumerate(genre_vocab)}
    vocab_size   = len(genre_vocab)
    print(f"  Genre vocabulary: {vocab_size} genres")

    vectors   = []
    index_rows = []

    for _, row in catalog.iterrows():
        tmdb_id = int(row["tmdb_id"])

        g_vec = genre_multihot(row.get("genres"), vocab_index, vocab_size)
        c_vec = cast_multihot(row.get("cast_ids"), row.get("director_ids"))
        o_vec = ov_emb[ov_map[tmdb_id]] if tmdb_id in ov_map else np.zeros(EMBEDDING_DIM, dtype=np.float32)
        s_vec = svd_emb[svd_map[tmdb_id]] if (svd_emb is not None and tmdb_id in svd_map) else np.zeros(SVD_N_FACTORS, dtype=np.float32)
        q_vec = quality_prior_vec(row)

        vectors.append(np.concatenate([g_vec, c_vec, o_vec, s_vec, q_vec]))
        index_rows.append({"tmdb_id": tmdb_id, "media_type": row["media_type"]})

    return np.array(vectors, dtype=np.float32), pd.DataFrame(index_rows), genre_vocab


# ── User profiles ──────────────────────────────────────────────────────────────

def build_user_profiles(
    watch_logs: pd.DataFrame,
    watchlist: pd.DataFrame,
    item_vectors: np.ndarray,
    item_index: pd.DataFrame,
    review_embeddings: np.ndarray | None,
    review_index: pd.DataFrame | None,
) -> dict:
    """
    Build one profile dict per user_id from their watch_logs.

    Profile keys
    ------------
    aspect_weights   : np.ndarray (6,) — recency-decayed weighted avg of sub-ratings
    taste_vector     : np.ndarray (D,) — weighted mean of item vectors for liked items
    voice_vector     : np.ndarray (384,) — mean-pooled review embeddings
    watchlist_vector : np.ndarray (D,) — mean item vector of watchlisted items
    cold_state       : str — "cold" | "warming" | "full"
    hard_positive_ids: list[int]
    soft_positive_ids: list[int]
    soft_negative_ids: list[int]
    hard_negative_ids: list[int]
    watched_ids      : list[int] — all tmdb_ids in watch_logs (filter in retrieve.py)
    """
    item_map  = dict(zip(item_index["tmdb_id"].tolist(), range(len(item_index))))
    item_dim  = item_vectors.shape[1]
    today     = date.today()
    profiles  = {}

    for user_id, group in watch_logs.groupby("user_id"):
        n_reviews  = len(group)
        cold_state = (
            "cold"    if n_reviews < COLD_THRESHOLD  else
            "warming" if n_reviews < WARM_THRESHOLD  else
            "full"
        )

        # ── Rating buckets ─────────────────────────────────────────────────
        ratings = group.set_index("tmdb_id")["rating"]
        hard_pos  = ratings[ratings >= HARD_POS].index.tolist()
        soft_pos  = ratings[(ratings >= SOFT_POS) & (ratings < HARD_POS)].index.tolist()
        soft_neg  = ratings[(ratings >= SOFT_NEG) & (ratings < SOFT_POS)].index.tolist()
        hard_neg  = ratings[ratings < SOFT_NEG].index.tolist()

        # ── Per-row contribution weights (rating × recency × engagement) ───
        weights = np.array([
            float(row["rating"])
            * _recency_decay(row.get("watched_date"), today)
            * _engagement_multiplier(row)
            for _, row in group.iterrows()
        ], dtype=np.float32)
        weight_sum = weights.sum() or 1.0

        # ── Aspect weights [6 dims] ────────────────────────────────────────
        aspect_mat = group[ASPECT_COLS].to_numpy(dtype=np.float32)  # (N, 6)
        aspect_mat = np.where(np.isnan(aspect_mat), 0.0, aspect_mat)
        # Count non-zero weights per aspect for proper normalisation
        valid_mask = ~np.isnan(group[ASPECT_COLS].to_numpy())       # (N, 6)
        aspect_weights_denom = (weights[:, None] * valid_mask).sum(axis=0)
        aspect_weights_denom = np.where(aspect_weights_denom == 0, 1.0, aspect_weights_denom)
        aspect_weights = (weights[:, None] * aspect_mat).sum(axis=0) / aspect_weights_denom

        # ── Taste vector — weighted mean of liked item vectors ─────────────
        liked_ids = hard_pos + soft_pos
        liked_vecs, liked_w = [], []
        for i, row_data in group[group["tmdb_id"].isin(liked_ids)].iterrows():
            tid = int(row_data["tmdb_id"])
            if tid in item_map:
                liked_vecs.append(item_vectors[item_map[tid]])
                liked_w.append(float(row_data["rating"]))
        if liked_vecs:
            liked_w_arr = np.array(liked_w, dtype=np.float32)
            taste_vector = (np.array(liked_vecs) * liked_w_arr[:, None]).sum(axis=0) / liked_w_arr.sum()
        else:
            taste_vector = np.zeros(item_dim, dtype=np.float32)

        # ── Voice vector — mean-pooled review embeddings ───────────────────
        if review_embeddings is not None and review_index is not None:
            user_rows = review_index[review_index["user_id"] == user_id].index.tolist()
            if user_rows:
                voice_vector = review_embeddings[user_rows].mean(axis=0)
            else:
                voice_vector = np.zeros(EMBEDDING_DIM, dtype=np.float32)
        else:
            voice_vector = np.zeros(EMBEDDING_DIM, dtype=np.float32)

        # ── Watchlist interest vector ──────────────────────────────────────
        if not watchlist.empty and "user_id" in watchlist.columns:
            wl_ids = watchlist[watchlist["user_id"] == user_id]["tmdb_id"].tolist()
            wl_vecs = [item_vectors[item_map[int(tid)]] for tid in wl_ids if int(tid) in item_map]
            watchlist_vector = np.array(wl_vecs).mean(axis=0) if wl_vecs else np.zeros(item_dim, dtype=np.float32)
        else:
            watchlist_vector = np.zeros(item_dim, dtype=np.float32)

        profiles[user_id] = {
            "aspect_weights":    aspect_weights.astype(np.float32),
            "taste_vector":      taste_vector.astype(np.float32),
            "voice_vector":      voice_vector.astype(np.float32),
            "watchlist_vector":  watchlist_vector.astype(np.float32),
            "cold_state":        cold_state,
            "hard_positive_ids": [int(x) for x in hard_pos],
            "soft_positive_ids": [int(x) for x in soft_pos],
            "soft_negative_ids": [int(x) for x in soft_neg],
            "hard_negative_ids": [int(x) for x in hard_neg],
            "watched_ids":       [int(x) for x in group["tmdb_id"].tolist()],
        }

    return profiles


# ── Entry point ────────────────────────────────────────────────────────────────

def run():
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    catalog    = pd.read_parquet(PROCESSED_DIR / "catalog.parquet")
    watch_logs = pd.read_parquet(PROCESSED_DIR / "watch_logs.parquet")
    watchlist  = pd.read_parquet(PROCESSED_DIR / "watchlist.parquet")

    # Load review embeddings if they exist
    rev_emb_path = PROCESSED_DIR / "review_embeddings.npy"
    rev_idx_path = PROCESSED_DIR / "review_index.parquet"
    if rev_emb_path.exists() and rev_idx_path.exists():
        review_embeddings = np.load(rev_emb_path)
        review_index      = pd.read_parquet(rev_idx_path)
    else:
        review_embeddings = None
        review_index      = None

    # Item vectors
    print("Building item vectors...")
    item_vectors, item_index, genre_vocab = build_item_vectors(catalog)
    np.save(PROCESSED_DIR / "item_vectors.npy", item_vectors)
    item_index.to_parquet(PROCESSED_DIR / "item_index.parquet", index=False)
    joblib.dump(genre_vocab, MODELS_DIR / "genre_vocab.pkl")
    print(f"  item_vectors.npy  shape={item_vectors.shape}")

    # User profiles
    print("Building user profiles...")
    profiles = build_user_profiles(
        watch_logs, watchlist,
        item_vectors, item_index,
        review_embeddings, review_index,
    )
    joblib.dump(profiles, MODELS_DIR / "user_profiles.pkl")
    print(f"  user_profiles.pkl  {len(profiles)} user(s)")

    # Build catalog_map.pkl for recommend_with_types()
    import pickle
    cat_map = {int(row["tmdb_id"]): {"media_type": row.get("media_type", "movie")}
               for _, row in catalog.iterrows()}
    with open(MODELS_DIR / "catalog_map.pkl", "wb") as f:
        pickle.dump(cat_map, f)

    print("\nFeature engineering complete.")


def run_profiles_only() -> None:
    """
    Smart refresh: incrementally expand catalog with new items, re-encode
    new reviews, then rebuild user_profiles.pkl.

    Steps:
    1. Find tmdb_ids in watch_logs/watchlist that are NOT in the existing catalog
    2. Fetch TMDB metadata for those new items, append to catalog.parquet
    3. Build item vectors for new items, append to item_vectors.npy + item_index.parquet
    4. Re-encode ALL reviews (fast — typically <20 texts) so new reviews are included
    5. Rebuild user_profiles.pkl with the expanded catalog
    """
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    watch_logs = pd.read_parquet(PROCESSED_DIR / "watch_logs.parquet")
    watchlist  = pd.read_parquet(PROCESSED_DIR / "watchlist.parquet")
    catalog    = pd.read_parquet(PROCESSED_DIR / "catalog.parquet")
    _nlp_model = None  # lazy-loaded sentence-transformers model

    # ── Step 1: Find new items not in catalog ─────────────────────────────
    existing_ids = set(catalog["tmdb_id"].tolist())
    new_pairs: list[tuple[int, str]] = []
    for df in (watch_logs, watchlist):
        if df.empty or "tmdb_id" not in df.columns:
            continue
        for _, row in df[["tmdb_id", "media_type"]].drop_duplicates().iterrows():
            tid = int(row["tmdb_id"])
            if tid not in existing_ids:
                new_pairs.append((tid, str(row["media_type"])))
                existing_ids.add(tid)  # dedup within the loop

    # ── Step 2: Fetch TMDB metadata + append to catalog ───────────────────
    if new_pairs:
        print(f"  Found {len(new_pairs)} new item(s) not in catalog — fetching TMDB metadata...")
        from ingest import _fetch_item_metadata, load_imdb_ratings
        new_rows = [_fetch_item_metadata(tid, mt) for tid, mt in new_pairs]
        new_tmdb_df = pd.DataFrame(new_rows)

        # Merge with IMDb ratings if available
        imdb_path = PROCESSED_DIR / "imdb_ratings.parquet"
        if imdb_path.exists():
            imdb_df = pd.read_parquet(imdb_path)
            new_catalog = new_tmdb_df.merge(
                imdb_df[["imdb_id", "average_rating", "num_votes"]],
                on="imdb_id", how="left",
            )
        else:
            new_catalog = new_tmdb_df.copy()
            if "average_rating" not in new_catalog.columns:
                new_catalog["average_rating"] = np.nan
            if "num_votes" not in new_catalog.columns:
                new_catalog["num_votes"] = np.nan

        catalog = pd.concat([catalog, new_catalog], ignore_index=True)
        catalog = catalog.drop_duplicates(subset=["tmdb_id"], keep="last").reset_index(drop=True)
        catalog.to_parquet(PROCESSED_DIR / "catalog.parquet", index=False)
        print(f"  Catalog expanded: {len(catalog)} items")

        # ── Step 3: Build item vectors for new items, append ──────────────
        # Encode overviews for new items
        ov_emb = np.load(PROCESSED_DIR / "overview_embeddings.npy")
        ov_idx = pd.read_parquet(PROCESSED_DIR / "overview_index.parquet")
        existing_ov_ids = set(ov_idx["tmdb_id"].tolist())
        new_ov_texts, new_ov_ids = [], []
        for _, row in new_catalog.iterrows():
            tid = int(row["tmdb_id"])
            if tid not in existing_ov_ids:
                new_ov_texts.append(str(row.get("overview") or ""))
                new_ov_ids.append(tid)

        if new_ov_texts:
            try:
                from sentence_transformers import SentenceTransformer
                from config import EMBEDDING_MODEL
                _nlp_model = SentenceTransformer(EMBEDDING_MODEL)
                new_ov_emb = _nlp_model.encode(
                    new_ov_texts, normalize_embeddings=True, convert_to_numpy=True,
                ).astype(np.float32)
                ov_emb = np.vstack([ov_emb, new_ov_emb])
                ov_idx = pd.concat([ov_idx, pd.DataFrame({"tmdb_id": new_ov_ids})], ignore_index=True)
                np.save(PROCESSED_DIR / "overview_embeddings.npy", ov_emb)
                ov_idx.to_parquet(PROCESSED_DIR / "overview_index.parquet", index=False)
                print(f"  Overview embeddings: {ov_emb.shape[0]} items")
            except ImportError:
                print("  sentence_transformers not available — new items will use zero overview vectors.")

        # Rebuild ALL item vectors (genre vocab may have expanded with new genres)
        print("  Rebuilding item vectors with expanded catalog...")
        item_vectors, item_index, genre_vocab = build_item_vectors(catalog)
        np.save(PROCESSED_DIR / "item_vectors.npy", item_vectors)
        item_index.to_parquet(PROCESSED_DIR / "item_index.parquet", index=False)
        joblib.dump(genre_vocab, MODELS_DIR / "genre_vocab.pkl")
        print(f"  item_vectors.npy  shape={item_vectors.shape}")

        # Rebuild FAISS index with expanded item vectors
        import faiss
        faiss.normalize_L2(item_vectors)
        faiss_index = faiss.IndexFlatIP(item_vectors.shape[1])
        faiss_index.add(item_vectors)
        faiss.write_index(faiss_index, str(MODELS_DIR / "faiss_content.index"))
        print(f"  FAISS index rebuilt: {faiss_index.ntotal} vectors")
    else:
        print("  No new items — catalog unchanged.")
        item_vectors = np.load(PROCESSED_DIR / "item_vectors.npy")
        item_index   = pd.read_parquet(PROCESSED_DIR / "item_index.parquet")

    # ── Step 4: Re-encode reviews (fast for <50 reviews) ──────────────────
    rev_emb_path = PROCESSED_DIR / "review_embeddings.npy"
    rev_idx_path = PROCESSED_DIR / "review_index.parquet"

    if "review" in watch_logs.columns:
        has_text = watch_logs["review"].notna() & (watch_logs["review"].str.strip() != "")
        reviews  = watch_logs[has_text][["user_id", "tmdb_id", "review"]].copy()
        if not reviews.empty:
            # Check if review count changed
            old_count = 0
            if rev_emb_path.exists() and rev_idx_path.exists():
                old_idx = pd.read_parquet(rev_idx_path)
                old_count = len(old_idx)
            if len(reviews) != old_count:
                print(f"  Re-encoding {len(reviews)} reviews (was {old_count})...")
                try:
                    if _nlp_model is None:
                        from sentence_transformers import SentenceTransformer
                        from config import EMBEDDING_MODEL
                        _nlp_model = SentenceTransformer(EMBEDDING_MODEL)
                    review_embeddings = _nlp_model.encode(
                        reviews["review"].tolist(),
                        normalize_embeddings=True, convert_to_numpy=True,
                    ).astype(np.float32)
                    np.save(rev_emb_path, review_embeddings)
                    reviews[["user_id", "tmdb_id"]].reset_index(drop=True).to_parquet(
                        rev_idx_path, index=False,
                    )
                    review_index = reviews[["user_id", "tmdb_id"]].reset_index(drop=True)
                except ImportError:
                    print("  sentence_transformers not available — keeping existing review embeddings.")
                    review_embeddings = np.load(rev_emb_path) if rev_emb_path.exists() else None
                    review_index = pd.read_parquet(rev_idx_path) if rev_idx_path.exists() else None
            else:
                review_embeddings = np.load(rev_emb_path)
                review_index = pd.read_parquet(rev_idx_path)
        else:
            review_embeddings = None
            review_index = None
    else:
        review_embeddings = np.load(rev_emb_path) if rev_emb_path.exists() else None
        review_index = pd.read_parquet(rev_idx_path) if rev_idx_path.exists() else None

    # ── Step 5: Rebuild user profiles ─────────────────────────────────────
    print("Building user profiles...")
    profiles = build_user_profiles(
        watch_logs, watchlist,
        item_vectors, item_index,
        review_embeddings, review_index,
    )
    joblib.dump(profiles, MODELS_DIR / "user_profiles.pkl")
    print(f"  user_profiles.pkl  {len(profiles)} user(s)")

    # Build catalog_map.pkl for recommend_with_types() — maps tmdb_id → {media_type, ...}
    import pickle
    cat_map = {int(row["tmdb_id"]): {"media_type": row.get("media_type", "movie")}
               for _, row in catalog.iterrows()}
    with open(MODELS_DIR / "catalog_map.pkl", "wb") as f:
        pickle.dump(cat_map, f)

    print("\nRefresh complete.")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--profiles-only", action="store_true",
                        help="Skip item vector rebuild — only update user_profiles.pkl")
    args = parser.parse_args()
    if args.profiles_only:
        run_profiles_only()
    else:
        run()
