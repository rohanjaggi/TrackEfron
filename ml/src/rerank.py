"""
rerank.py — Stage 3 (inference): Diversity, novelty, recency → top 20
Takes scored candidates from score.py and reshapes the final list.
See .claude/process.md for full design reasoning.
"""

import numpy as np
import pandas as pd
import faiss
import joblib
from datetime import date
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    PROCESSED_DIR, MODELS_DIR,
    MMR_LAMBDA, NOVELTY_BOOST, RECENCY_HALFLIFE,
    FINAL_RECS,
)

RERANK_POOL      = 50        # scored candidates to consider
BLOCKBUSTER_VOTES = 50_000   # vote_count threshold above which novelty boost is suppressed

# ── Artifact loading ───────────────────────────────────────────────────────────
# Static artifacts (item vectors) are loaded once — they only change on a full
# retrain. user_profiles and watch_logs are loaded fresh on every call so
# recommendations update immediately after a profile refresh.

_static: dict | None = None


def _load_artifacts() -> dict:
    global _static
    if _static is None:
        item_vectors = np.load(PROCESSED_DIR / "item_vectors.npy")
        faiss.normalize_L2(item_vectors)

        item_index  = pd.read_parquet(PROCESSED_DIR / "item_index.parquet")
        catalog     = pd.read_parquet(PROCESSED_DIR / "catalog.parquet")
        catalog_map = catalog.drop_duplicates(subset=["tmdb_id"], keep="last").set_index("tmdb_id")
        tmdb_to_row = dict(zip(item_index["tmdb_id"].tolist(), range(len(item_index))))

        _static = {
            "item_vectors": item_vectors,
            "catalog_map":  catalog_map,
            "tmdb_to_row":  tmdb_to_row,
        }

    # Always reload — updated by features.py + ingest.py on every refresh
    user_profiles = joblib.load(MODELS_DIR / "user_profiles.pkl")
    watch_logs    = pd.read_parquet(PROCESSED_DIR / "watch_logs.parquet")
    return {**_static, "user_profiles": user_profiles, "watch_logs": watch_logs}


def reset_cache() -> None:
    """Force static artifact reload (e.g., after a full retrain)."""
    global _static
    _static = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _as_list(val) -> list:
    if val is None:
        return []
    if hasattr(val, "tolist"):
        return val.tolist()
    return list(val)


# ── Boost functions ────────────────────────────────────────────────────────────

def _novelty_boost(tmdb_id: int, catalog_map: pd.DataFrame) -> float:
    """
    Return NOVELTY_BOOST for items with vote_count below BLOCKBUSTER_VOTES.
    Prevents the final list from being all Dark Knight / Inception / Parasite.
    Items outside the catalog get no boost (we know nothing about their popularity).
    """
    if tmdb_id not in catalog_map.index:
        return 0.0
    row = catalog_map.loc[tmdb_id]
    vote_cnt = row.get("num_votes") or row.get("vote_count") or 0
    if pd.isna(vote_cnt):
        vote_cnt = 0
    return NOVELTY_BOOST if float(vote_cnt) < BLOCKBUSTER_VOTES else 0.0


def _get_recent_liked_genres(
    user_id: str,
    watch_logs: pd.DataFrame,
    catalog_map: pd.DataFrame,
) -> set[str]:
    """
    Collect genres from items the user rated >= 3.0 within the last RECENCY_HALFLIFE days.
    Used as a proxy for current taste direction.
    """
    user_logs = watch_logs[watch_logs["user_id"] == user_id]
    today     = date.today()
    recent_genres: set[str] = set()

    for _, row in user_logs.iterrows():
        try:
            if float(row.get("rating") or 0) < 3.0:
                continue
        except (ValueError, TypeError):
            continue

        watched_str = row.get("watched_date")
        if not watched_str or pd.isna(watched_str):
            continue
        try:
            watched = date.fromisoformat(str(watched_str)[:10])
            if (today - watched).days > RECENCY_HALFLIFE:
                continue
        except (ValueError, TypeError):
            continue

        tid = int(row["tmdb_id"])
        if tid in catalog_map.index:
            recent_genres.update(_as_list(catalog_map.loc[tid].get("genres")))

    return recent_genres


def _recency_boost(
    tmdb_id: int,
    recent_genres: set[str],
    catalog_map: pd.DataFrame,
) -> float:
    """
    Small boost proportional to genre overlap between the candidate and items
    the user rated well in the last RECENCY_HALFLIFE days.
    Captures taste drift — if the user just went through a Westerns phase, more
    Westerns are surfaced before the taste decays out of the profile.
    """
    if not recent_genres or tmdb_id not in catalog_map.index:
        return 0.0
    candidate_genres = set(_as_list(catalog_map.loc[tmdb_id].get("genres")))
    if not candidate_genres:
        return 0.0
    overlap = len(recent_genres & candidate_genres) / len(candidate_genres)
    return NOVELTY_BOOST * overlap


# ── MMR selection ──────────────────────────────────────────────────────────────

def _mmr_select(
    pool: list[tuple[int, float]],
    item_vectors: np.ndarray,
    tmdb_to_row: dict,
    top_n: int = FINAL_RECS,
) -> list[int]:
    """
    Greedy Maximal Marginal Relevance selection.

    At each step, pick the item maximising:
        MMR_LAMBDA × relevance_score(i)
        - (1 - MMR_LAMBDA) × max_j∈selected  cosine(i, j)

    MMR_LAMBDA=0.6 means relevance still dominates but diversity is rewarded.
    Items without an item vector (SVD-sourced) have zero similarity to all
    selected items — they can only lose selection to items with higher relevance.
    """
    scores      = {tid: s for tid, s in pool}
    remaining   = [tid for tid, _ in pool]
    selected: list[int]       = []
    selected_vecs: list[np.ndarray] = []

    while len(selected) < top_n and remaining:
        best_tid, best_mmr = None, -float("inf")

        for tid in remaining:
            relevance = scores[tid]
            if not selected_vecs:
                redundancy = 0.0
            elif tid in tmdb_to_row:
                iv = item_vectors[tmdb_to_row[tid]]
                redundancy = max(float(np.dot(iv, sv)) for sv in selected_vecs)
            else:
                redundancy = 0.0

            mmr_score = MMR_LAMBDA * relevance - (1 - MMR_LAMBDA) * redundancy
            if mmr_score > best_mmr:
                best_mmr = mmr_score
                best_tid = tid

        selected.append(best_tid)
        if best_tid in tmdb_to_row:
            selected_vecs.append(item_vectors[tmdb_to_row[best_tid]])
        remaining.remove(best_tid)

    return selected


# ── Main reranking function ────────────────────────────────────────────────────

def rerank(user_id: str, scored: list[tuple[int, float]], top_n: int = FINAL_RECS) -> list[int]:
    """
    Reshape scored candidates into a diverse, novel, recency-aware list.

    Parameters
    ----------
    user_id : Supabase user UUID string
    scored  : list of (tmdb_id, score) from score.py, sorted descending
    top_n   : number of results to return (default FINAL_RECS)

    Returns
    -------
    Ordered list of up to top_n tmdb_id integers.
    """
    art = _load_artifacts()

    # Step 1: Confidence cutoff
    # Keep only positive-score items when any exist; fall back to all if everything is zero.
    positive = [(tid, s) for tid, s in scored if s > 0]
    pool = (positive if positive else scored)[:RERANK_POOL]

    if not pool:
        return []
    if len(pool) <= top_n:
        return [tid for tid, _ in pool]

    # Steps 3 & 4: Apply novelty + recency boosts to pre-MMR scores
    recent_genres: set[str] = set()
    if art["user_profiles"].get(user_id) is not None:
        recent_genres = _get_recent_liked_genres(user_id, art["watch_logs"], art["catalog_map"])

    adjusted: list[tuple[int, float]] = []
    for tid, s in pool:
        boost = (
            _novelty_boost(tid, art["catalog_map"])
            + _recency_boost(tid, recent_genres, art["catalog_map"])
        )
        adjusted.append((tid, s + boost))
    adjusted.sort(key=lambda x: x[1], reverse=True)

    # Step 2: MMR diversity — greedily select top_n items
    return _mmr_select(adjusted, art["item_vectors"], art["tmdb_to_row"], top_n=top_n)


if __name__ == "__main__":
    from retrieve import retrieve
    from score import score as score_fn
    art     = _load_artifacts()
    user_id = next(iter(art["user_profiles"]))
    candidates = retrieve(user_id)
    scored     = score_fn(user_id, candidates)
    final      = rerank(user_id, scored)
    print(f"Final {len(final)} recommendations for {user_id}:")
    for i, tid in enumerate(final, 1):
        print(f"  {i:2d}. tmdb_id={tid}")
