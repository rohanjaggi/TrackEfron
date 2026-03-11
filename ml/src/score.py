"""
score.py — Stage 2 (inference): Weighted scoring
Takes ~200 candidates from retrieve.py, assigns each a float score.
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
    SCORE_WEIGHTS, NEG_PENALTY_WEIGHT,
    RELEASE_RECENCY_HALFLIFE,
)

ASPECT_COLS = [
    "plot_rating", "acting_rating", "cinematography_rating",
    "pacing_rating", "soundtrack_rating", "casting_rating",
]

# ── Artifact loading ───────────────────────────────────────────────────────────
# Static artifacts (item vectors, embeddings) are loaded once — they only change
# on a full retrain. user_profiles and aspect_profiles are loaded fresh on every
# call so recommendations update immediately after a profile refresh.

_static: dict | None = None


def _load_artifacts() -> dict:
    global _static
    if _static is None:
        item_vectors = np.load(PROCESSED_DIR / "item_vectors.npy")
        faiss.normalize_L2(item_vectors)          # unit vectors → dot == cosine

        item_index  = pd.read_parquet(PROCESSED_DIR / "item_index.parquet")
        catalog     = pd.read_parquet(PROCESSED_DIR / "catalog.parquet")
        catalog_map = catalog.drop_duplicates(subset=["tmdb_id"], keep="last").set_index("tmdb_id")

        svd_emb = np.load(PROCESSED_DIR / "svd_embeddings.npy")
        svd_idx = pd.read_parquet(PROCESSED_DIR / "svd_index.parquet")
        faiss.normalize_L2(svd_emb)
        tmdb_to_svd = dict(zip(svd_idx["tmdb_id"].tolist(), range(len(svd_idx))))

        ov_emb = np.load(PROCESSED_DIR / "overview_embeddings.npy")
        ov_idx = pd.read_parquet(PROCESSED_DIR / "overview_index.parquet")
        tmdb_to_ov = dict(zip(ov_idx["tmdb_id"].tolist(), range(len(ov_idx))))

        tmdb_to_row = dict(zip(item_index["tmdb_id"].tolist(), range(len(item_index))))

        _static = {
            "item_vectors": item_vectors,
            "catalog_map":  catalog_map,
            "svd_emb":      svd_emb,
            "tmdb_to_svd":  tmdb_to_svd,
            "ov_emb":       ov_emb,
            "tmdb_to_ov":   tmdb_to_ov,
            "tmdb_to_row":  tmdb_to_row,
        }

    # Always reload — updated by features.py + ingest.py on every refresh
    user_profiles = joblib.load(MODELS_DIR / "user_profiles.pkl")
    watch_logs    = pd.read_parquet(PROCESSED_DIR / "watch_logs.parquet")
    available     = [c for c in ASPECT_COLS if c in watch_logs.columns]
    if available:
        aspect_profiles = (
            watch_logs.groupby("tmdb_id")[available]
            .mean()
            .reindex(columns=ASPECT_COLS, fill_value=0.0)
        )
    else:
        aspect_profiles = pd.DataFrame(columns=ASPECT_COLS)

    return {**_static, "user_profiles": user_profiles, "aspect_profiles": aspect_profiles}


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


# ── Signal functions ───────────────────────────────────────────────────────────

def _content_sim(taste_unit: np.ndarray, item_vec: np.ndarray) -> float:
    """Cosine similarity — both unit vectors so dot product suffices."""
    return float(np.dot(taste_unit, item_vec))


def _aspect_alignment(user_weights: np.ndarray, tmdb_id: int, aspect_profiles: pd.DataFrame) -> float:
    """
    Cosine similarity between user's 6-dim aspect weight vector and item's
    mean aspect profile (mean of sub-ratings across all reviewers for that item).
    Returns 0 if item has no aspect data yet.
    """
    if tmdb_id not in aspect_profiles.index:
        return 0.0
    item_aspects = aspect_profiles.loc[tmdb_id].to_numpy(dtype=np.float32) / 5.0
    item_norm = np.linalg.norm(item_aspects)
    user_norm = np.linalg.norm(user_weights)
    if item_norm == 0 or user_norm == 0:
        return 0.0
    return float(np.dot(user_weights / user_norm, item_aspects / item_norm))


def _review_text_sim(
    voice_vector: np.ndarray,
    tmdb_id: int,
    ov_emb: np.ndarray,
    tmdb_to_ov: dict,
) -> float:
    """
    Cosine similarity between user's pooled review embedding and item's
    overview embedding. Returns 0 if user has no reviews or item has no overview.
    """
    if not np.any(voice_vector) or tmdb_id not in tmdb_to_ov:
        return 0.0
    v_norm = np.linalg.norm(voice_vector)
    if v_norm == 0:
        return 0.0
    ov = ov_emb[tmdb_to_ov[tmdb_id]]    # already unit-normalised by nlp.py
    return float(np.dot(voice_vector / v_norm, ov))


def _collab_signal(
    liked_ids: list[int],
    tmdb_id: int,
    media_type: str,
    svd_emb: np.ndarray,
    tmdb_to_svd: dict,
    catalog_map: pd.DataFrame,
) -> float:
    """
    Hybrid collaborative signal:
    1. Movies with SVD data: cosine(mean SVD of liked movies, candidate SVD)
    2. Fallback (post-2019 movies + all TV): fraction of liked items whose
       TMDB recommendations contain this candidate.
    Returns 0 if insufficient signal.
    """
    if not liked_ids:
        return 0.0

    # Try SVD first for movies that have MovieLens coverage
    if media_type == "movie" and tmdb_id in tmdb_to_svd:
        liked_svd = [svd_emb[tmdb_to_svd[lid]] for lid in liked_ids if lid in tmdb_to_svd]
        if liked_svd:
            user_collab = np.mean(liked_svd, axis=0).astype(np.float32)
            n = np.linalg.norm(user_collab)
            if n > 0:
                return float(np.dot(user_collab / n, svd_emb[tmdb_to_svd[tmdb_id]]))

    # Fallback: TMDB recommendation graph (works for both movies and TV)
    hits = sum(
        1 for lid in liked_ids
        if lid in catalog_map.index
        and tmdb_id in [int(r) for r in _as_list(catalog_map.loc[lid].get("tmdb_rec_ids"))]
    )
    return hits / len(liked_ids)


def _quality_prior(tmdb_id: int, catalog_map: pd.DataFrame) -> float:
    """
    Normalised quality score in [0, 1]: norm_vote_avg × norm_log_vote_count.
    Mirrors quality_prior_vec from features.py for consistency.
    """
    if tmdb_id not in catalog_map.index:
        return 0.0
    row      = catalog_map.loc[tmdb_id]
    vote_avg = row.get("average_rating")
    vote_cnt = row.get("num_votes")
    if pd.isna(vote_avg) or vote_avg is None:
        vote_avg = row.get("vote_average")
    if pd.isna(vote_cnt) or vote_cnt is None:
        vote_cnt = row.get("vote_count")
    if vote_avg is None or pd.isna(vote_avg):
        return 0.0
    norm_avg = float(vote_avg) / 10.0
    norm_log = float(np.log1p(vote_cnt or 0)) / np.log1p(3_000_000)
    return min(norm_avg * min(norm_log, 1.0), 1.0)


def _release_recency(tmdb_id: int, catalog_map: pd.DataFrame) -> float:
    """
    Soft bias toward newer content. Exponential decay on release year:
    score = 0.5 ^ (days_since_release / RELEASE_RECENCY_HALFLIFE)
    Returns 0.5 (neutral) if release date is unknown.
    """
    if tmdb_id not in catalog_map.index:
        return 0.5
    row = catalog_map.loc[tmdb_id]
    rd = row.get("release_date")
    if rd is None or pd.isna(rd):
        return 0.5
    try:
        release = date.fromisoformat(str(rd)[:10])
        days = max((date.today() - release).days, 0)
        return float(0.5 ** (days / RELEASE_RECENCY_HALFLIFE))
    except (ValueError, TypeError):
        return 0.5


def _negative_penalty(
    tmdb_id: int,
    soft_neg_ids: list[int],
    catalog_map: pd.DataFrame,
) -> float:
    """
    Fraction of the candidate's genres that also appear in the user's
    soft-negative items. [0, 1] — higher means more genre overlap with disliked content.
    """
    if not soft_neg_ids or tmdb_id not in catalog_map.index:
        return 0.0
    neg_genres: set[str] = set()
    for nid in soft_neg_ids:
        if nid in catalog_map.index:
            neg_genres.update(_as_list(catalog_map.loc[nid].get("genres")))
    if not neg_genres:
        return 0.0
    candidate_genres = set(_as_list(catalog_map.loc[tmdb_id].get("genres")))
    if not candidate_genres:
        return 0.0
    return len(neg_genres & candidate_genres) / len(candidate_genres)


# ── Main scoring function ──────────────────────────────────────────────────────

def score(user_id: str, candidates: list[int]) -> list[tuple[int, float]]:
    """
    Score each candidate for the given user using the α–ζ weighted formula.

    Parameters
    ----------
    user_id    : Supabase user UUID string
    candidates : list of tmdb_id integers from retrieve.py

    Returns
    -------
    List of (tmdb_id, score) tuples sorted descending by score.
    """
    art     = _load_artifacts()
    profile = art["user_profiles"].get(user_id)

    if profile is None:
        # Unknown user: rank purely by quality prior
        scored = [(tid, _quality_prior(tid, art["catalog_map"])) for tid in candidates]
        return sorted(scored, key=lambda x: x[1], reverse=True)

    w            = SCORE_WEIGHTS
    taste        = profile["taste_vector"]
    aspect_w     = profile["aspect_weights"]      # (6,) recency-decayed mean sub-ratings
    voice        = profile["voice_vector"]         # (384,) pooled review embedding
    liked_ids    = profile["hard_positive_ids"] + profile["soft_positive_ids"]
    soft_neg_ids = profile["soft_negative_ids"]

    # Unit-normalise taste vector for dot-product cosine
    taste_norm = np.linalg.norm(taste)
    taste_unit = (taste / taste_norm).astype(np.float32) if taste_norm > 0 else taste.astype(np.float32)

    results: list[tuple[int, float]] = []

    for tmdb_id in candidates:
        # Items from SVD stream may not be in item_index (outside the local catalog).
        # content_sim and aspect_alignment require the item vector; skip those signals
        # but still compute collab_signal (SVD dot product) and quality_prior.
        if tmdb_id in art["tmdb_to_row"]:
            item_vec  = art["item_vectors"][art["tmdb_to_row"][tmdb_id]]
            s_content = _content_sim(taste_unit, item_vec)
            s_aspect  = _aspect_alignment(aspect_w, tmdb_id, art["aspect_profiles"])
        else:
            s_content = 0.0
            s_aspect  = 0.0

        media_type = "movie"
        if tmdb_id in art["catalog_map"].index:
            mt = art["catalog_map"].loc[tmdb_id].get("media_type")
            if mt:
                media_type = str(mt)
        s_review  = _review_text_sim(voice, tmdb_id, art["ov_emb"], art["tmdb_to_ov"])
        s_collab  = _collab_signal(
            liked_ids, tmdb_id, media_type,
            art["svd_emb"], art["tmdb_to_svd"], art["catalog_map"],
        )
        s_quality  = _quality_prior(tmdb_id, art["catalog_map"])
        s_recency  = _release_recency(tmdb_id, art["catalog_map"])
        s_neg      = _negative_penalty(tmdb_id, soft_neg_ids, art["catalog_map"])

        final = (
            w["content_sim"]      * s_content
            + w["aspect_align"]   * s_aspect
            + w["review_text"]    * s_review
            + w["collab_signal"]  * s_collab
            + w["quality_prior"]  * s_quality
            + w["release_recency"] * s_recency
            - NEG_PENALTY_WEIGHT  * s_neg
        )
        results.append((tmdb_id, final))

    return sorted(results, key=lambda x: x[1], reverse=True)


if __name__ == "__main__":
    from retrieve import retrieve
    art     = _load_artifacts()
    user_id = next(iter(art["user_profiles"]))
    candidates = retrieve(user_id)
    scored     = score(user_id, candidates)
    print(f"Top 20 scores for {user_id}:")
    for tid, s in scored[:20]:
        print(f"  tmdb_id={tid}  score={s:.4f}")
