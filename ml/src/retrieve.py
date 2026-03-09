"""
retrieve.py — Stage 1 (inference): Candidate generation
Four streams → ~200 deduplicated, filtered candidates per user.
See .claude/process.md for full design reasoning.
"""

import numpy as np
import pandas as pd
import faiss
import joblib
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    PROCESSED_DIR, MODELS_DIR,
    COLD_THRESHOLD, WARM_THRESHOLD,
    CANDIDATE_POOL_SIZE,
)

def _as_list(val) -> list:
    """Normalise numpy arrays / None from parquet to a plain Python list."""
    if val is None:
        return []
    if hasattr(val, "tolist"):
        return val.tolist()
    return list(val)


# Stream sizes
STREAM1_TOP = 100   # content similarity
STREAM2_TOP = 50    # collaborative (cold/warming) or 30 (full)
STREAM3_TOP = 30    # watchlist similarity
STREAM4_TOP = 20    # popularity fallback

# ── Artifact loading ───────────────────────────────────────────────────────────
# Static artifacts (item vectors, FAISS index, SVD) are loaded once — they only
# change on a full retrain. user_profiles is loaded fresh on every call so
# recommendations update immediately after a profile refresh.

_static: dict | None = None


def _load_artifacts() -> dict:
    global _static
    if _static is None:
        item_vectors = np.load(PROCESSED_DIR / "item_vectors.npy")
        faiss.normalize_L2(item_vectors)       # ensure unit vectors

        item_index  = pd.read_parquet(PROCESSED_DIR / "item_index.parquet")
        catalog     = pd.read_parquet(PROCESSED_DIR / "catalog.parquet")
        faiss_index = faiss.read_index(str(MODELS_DIR / "faiss_content.index"))

        svd_emb = np.load(PROCESSED_DIR / "svd_embeddings.npy")
        svd_idx = pd.read_parquet(PROCESSED_DIR / "svd_index.parquet")
        faiss.normalize_L2(svd_emb)

        tmdb_to_row = dict(zip(item_index["tmdb_id"].tolist(), range(len(item_index))))
        tmdb_to_svd = dict(zip(svd_idx["tmdb_id"].tolist(), range(len(svd_idx))))
        catalog_map = catalog.set_index("tmdb_id")

        _static = {
            "item_vectors": item_vectors,
            "item_index":   item_index,
            "catalog":      catalog,
            "catalog_map":  catalog_map,
            "faiss_index":  faiss_index,
            "svd_emb":      svd_emb,
            "svd_idx":      svd_idx,
            "tmdb_to_row":  tmdb_to_row,
            "tmdb_to_svd":  tmdb_to_svd,
        }

    # Always reload — updated by features.py on every refresh
    user_profiles = joblib.load(MODELS_DIR / "user_profiles.pkl")
    return {**_static, "user_profiles": user_profiles}


def reset_cache() -> None:
    """Force static artifact reload (e.g., after a full retrain)."""
    global _static
    _static = None


# ── Hard filters ───────────────────────────────────────────────────────────────

def _blocked_person_ids(profile: dict, catalog_map: pd.DataFrame) -> set[int]:
    """
    Return the set of TMDB person IDs that appear in >= 2 of the user's
    negatively-rated items. Items featuring these people will be filtered out.
    """
    neg_ids = profile["soft_negative_ids"] + profile["hard_negative_ids"]
    person_count: dict[int, int] = {}

    for tmdb_id in neg_ids:
        if tmdb_id not in catalog_map.index:
            continue
        row = catalog_map.loc[tmdb_id]
        people = _as_list(row.get("cast_ids")) + _as_list(row.get("director_ids"))
        for pid in people:
            pid = int(pid)
            person_count[pid] = person_count.get(pid, 0) + 1

    return {pid for pid, count in person_count.items() if count >= 2}


def _apply_hard_filters(
    candidates: list[int],
    profile: dict,
    catalog_map: pd.DataFrame,
    blocked_people: set[int],
) -> list[int]:
    """
    Remove:
    1. Items the user has already watched
    2. Items the user rated < 2.0 (hard negatives — permanent rejections)
    3. Items featuring people the user consistently dislikes
    """
    watched  = set(profile["watched_ids"])
    hard_neg = set(profile["hard_negative_ids"])

    filtered = []
    for tmdb_id in candidates:
        if tmdb_id in watched or tmdb_id in hard_neg:
            continue
        if blocked_people and tmdb_id in catalog_map.index:
            row     = catalog_map.loc[tmdb_id]
            people  = set(int(p) for p in _as_list(row.get("cast_ids")) + _as_list(row.get("director_ids")))
            if people & blocked_people:
                continue
        filtered.append(tmdb_id)

    return filtered


# ── Stream 1: Content similarity ───────────────────────────────────────────────

def _stream1_content(profile: dict, art: dict, n: int) -> list[int]:
    """
    cosine(user taste_vector, all item vectors) → top n.
    The taste_vector is the weighted mean of item vectors for liked items,
    built in features.py. It points in the direction of the user's preferred
    content in the joint feature space.
    """
    taste = profile["taste_vector"].reshape(1, -1).astype(np.float32)
    faiss.normalize_L2(taste)

    _, indices = art["faiss_index"].search(taste, n)
    tmdb_ids = art["item_index"]["tmdb_id"].tolist()
    return [tmdb_ids[i] for i in indices[0] if i >= 0]


# ── Stream 2: Collaborative signal ────────────────────────────────────────────

def _stream2_collab(profile: dict, art: dict, n: int) -> list[int]:
    """
    cold/warming users:
      movies → nearest neighbors in MovieLens SVD embedding space
      TV     → pre-cached TMDB recommendation IDs from catalog
    full users:
      same, but n is smaller (own data has taken over; collab fills gaps only)

    For SVD nearest-neighbor search: average the SVD embeddings of the user's
    liked items to form a "collab taste vector", then search the SVD index.
    """
    candidates: list[int] = []
    liked_ids = profile["hard_positive_ids"] + profile["soft_positive_ids"]

    # ── Movies: SVD nearest neighbors ────────────────────────────────────
    liked_svd_rows = [
        art["svd_emb"][art["tmdb_to_svd"][tid]]
        for tid in liked_ids
        if tid in art["tmdb_to_svd"]
    ]
    if liked_svd_rows:
        query = np.mean(liked_svd_rows, axis=0, keepdims=True).astype(np.float32)
        faiss.normalize_L2(query)

        # Build a temporary flat SVD index if not already cached
        if "svd_faiss" not in art:
            svd_index = faiss.IndexFlatIP(art["svd_emb"].shape[1])
            svd_copy = art["svd_emb"].copy()
            faiss.normalize_L2(svd_copy)
            svd_index.add(svd_copy)
            art["svd_faiss"] = svd_index  # cache for this request lifetime

        _, indices = art["svd_faiss"].search(query, n)
        svd_tmdb_ids = art["svd_idx"]["tmdb_id"].tolist()
        candidates += [svd_tmdb_ids[i] for i in indices[0] if i >= 0]

    # ── TV: TMDB pre-cached recommendation IDs ────────────────────────────
    for tid in liked_ids:
        if tid not in art["catalog_map"].index:
            continue
        row = art["catalog_map"].loc[tid]
        if row.get("media_type") == "tv":
            raw = row.get("tv_rec_ids")
            rec_ids = _as_list(raw)
            candidates += [int(r) for r in rec_ids[:n]]

    return candidates[:n]


# ── Stream 3: Watchlist similarity ────────────────────────────────────────────

def _stream3_watchlist(profile: dict, art: dict, n: int) -> list[int]:
    """
    cosine(watchlist_interest_vector, all item vectors) → top n.
    Zero watchlist → empty stream (returns nothing, other streams fill pool).
    """
    wv = profile["watchlist_vector"]
    if not np.any(wv):
        return []

    query = wv.reshape(1, -1).astype(np.float32)
    faiss.normalize_L2(query)

    _, indices = art["faiss_index"].search(query, n)
    tmdb_ids = art["item_index"]["tmdb_id"].tolist()
    return [tmdb_ids[i] for i in indices[0] if i >= 0]


# ── Stream 4: Popularity fallback ─────────────────────────────────────────────

def _stream4_popularity(art: dict, n: int) -> list[int]:
    """
    Globally high quality items: sort by vote_avg × log1p(vote_count).
    IMDb values preferred; falls back to TMDB.
    """
    cat = art["catalog"].copy()

    vote_avg = cat["average_rating"].fillna(cat["vote_average"]).fillna(0)
    vote_cnt = cat["num_votes"].fillna(cat["vote_count"]).fillna(0)
    cat["_pop_score"] = vote_avg * np.log1p(vote_cnt)

    top = cat.nlargest(n, "_pop_score")
    return top["tmdb_id"].tolist()


# ── Main retrieval function ────────────────────────────────────────────────────

def retrieve(user_id: str) -> list[int]:
    """
    Run all four streams, merge, deduplicate, apply hard filters, and return
    up to CANDIDATE_POOL_SIZE tmdb_ids for scoring.

    Parameters
    ----------
    user_id : Supabase user UUID string

    Returns
    -------
    List of tmdb_id integers (candidates for score.py)
    """
    art     = _load_artifacts()
    profile = art["user_profiles"].get(user_id)

    if profile is None:
        # Unknown user — cold start: return popularity fallback only
        return _stream4_popularity(art, CANDIDATE_POOL_SIZE)

    cold_state = profile["cold_state"]
    stream2_n  = STREAM2_TOP if cold_state in ("cold", "warming") else 30

    # Run all four streams
    s1 = _stream1_content(profile, art, STREAM1_TOP)
    s2 = _stream2_collab(profile, art, stream2_n)
    s3 = _stream3_watchlist(profile, art, STREAM3_TOP)
    s4 = _stream4_popularity(art, STREAM4_TOP)

    # Merge preserving stream priority order (s1 most trusted)
    seen: set[int] = set()
    merged: list[int] = []
    for tid in s1 + s2 + s3 + s4:
        if tid not in seen:
            seen.add(tid)
            merged.append(tid)

    # Hard filters
    blocked = _blocked_person_ids(profile, art["catalog_map"])
    filtered = _apply_hard_filters(merged, profile, art["catalog_map"], blocked)

    return filtered[:CANDIDATE_POOL_SIZE]


if __name__ == "__main__":
    art = _load_artifacts()
    user_id = next(iter(art["user_profiles"]))
    candidates = retrieve(user_id)
    print(f"Candidates for {user_id}: {len(candidates)}")
    print(candidates[:20])
