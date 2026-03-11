"""
recommend.py — Inference orchestrator
Wires retrieve → score → rerank into a single call for a given user_id.
See .claude/process.md for full design reasoning.
"""

from pathlib import Path
import pickle
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from config  import MODELS_DIR
from retrieve import retrieve
from score   import score
from rerank  import rerank


def recommend(user_id: str) -> list[int]:
    """
    Generate top-20 personalised recommendations for a user.

    Parameters
    ----------
    user_id : Supabase user UUID string

    Returns
    -------
    Ordered list of up to 20 tmdb_id integers (index 0 = top pick).
    Returns an empty list if no candidates can be generated.
    """
    candidates = retrieve(user_id)
    if not candidates:
        return []

    scored = score(user_id, candidates)
    return rerank(user_id, scored)


def recommend_with_types(user_id: str) -> list[dict]:
    """
    Same as recommend() but returns [{tmdb_id, media_type}] so the web API
    can call the correct TMDB detail endpoint without guessing.
    Falls back to media_type="movie" for any ID not found in catalog_map.
    """
    tmdb_ids = recommend(user_id)
    catalog_path = MODELS_DIR / "catalog_map.pkl"
    if not catalog_path.exists():
        return [{"tmdb_id": t, "media_type": "movie"} for t in tmdb_ids]
    with open(catalog_path, "rb") as f:
        catalog_map = pickle.load(f)
    return [
        {"tmdb_id": t, "media_type": catalog_map.get(t, {}).get("media_type", "movie")}
        for t in tmdb_ids
    ]


if __name__ == "__main__":
    import joblib
    from config import MODELS_DIR

    user_profiles = joblib.load(MODELS_DIR / "user_profiles.pkl")
    user_id = next(iter(user_profiles))

    recs = recommend(user_id)
    print(f"Top {len(recs)} recommendations for {user_id}:")
    for i, tid in enumerate(recs, 1):
        print(f"  {i:2d}. tmdb_id={tid}")
