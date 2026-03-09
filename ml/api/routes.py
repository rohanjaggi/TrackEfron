"""
api/routes.py — HTTP route handlers
GET  /recommend/{user_id}        → top-20 tmdb_ids for a user
GET  /recommend/{user_id}/items  → top-20 {tmdb_id, media_type} dicts for a user
POST /refresh-profile            → fast update: fetch user data + rebuild profiles only (~seconds)
POST /retrain                    → full retrain: ingest (MovieLens seeded) + nlp + features + SVD/FAISS (~minutes)
GET  /health                     → liveness check
"""

import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from recommend import recommend, recommend_with_types
import score, retrieve, rerank

router = APIRouter()


class RecommendResponse(BaseModel):
    user_id: str
    recommendations: list[int]
    count: int


class RecommendItemsResponse(BaseModel):
    user_id: str
    items: list[dict]   # [{tmdb_id: int, media_type: str}]
    count: int


class RetrainResponse(BaseModel):
    status: str
    message: str


@router.get("/recommend/{user_id}", response_model=RecommendResponse)
def get_recommendations(user_id: str) -> RecommendResponse:
    """
    Return up to 20 personalised tmdb_id recommendations for the given user.
    Unknown users receive a popularity-based fallback list.
    """
    try:
        recs = recommend(user_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return RecommendResponse(
        user_id=user_id,
        recommendations=recs,
        count=len(recs),
    )


@router.get("/recommend/{user_id}/items", response_model=RecommendItemsResponse)
def get_recommendations_with_types(user_id: str) -> RecommendItemsResponse:
    """
    Return up to 20 personalised recommendations with media_type for each.
    Used by the web frontend so it can fetch TMDB details for the correct media type.
    """
    try:
        items = recommend_with_types(user_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return RecommendItemsResponse(user_id=user_id, items=items, count=len(items))


@router.post("/refresh-profile", response_model=RetrainResponse)
def refresh_profile() -> RetrainResponse:
    """
    Smart profile refresh — completes in seconds.
    Fetches the latest watch_logs/watchlist from Supabase, then:
    - Detects new items not in catalog → fetches TMDB metadata, expands catalog
    - Rebuilds item vectors + FAISS index if catalog expanded
    - Re-encodes review texts if new reviews found
    - Rebuilds user_profiles.pkl
    """
    ml_dir = Path(__file__).parent.parent
    venv_python = ml_dir / ".venv" / "bin" / "python3"
    python = str(venv_python) if venv_python.exists() else "python3"

    for script, extra in [
        ("src/fetch_user_data.py", []),
        ("src/features.py", ["--profiles-only"]),
    ]:
        result = subprocess.run(
            [python, str(ml_dir / script)] + extra,
            capture_output=True,
            text=True,
            cwd=str(ml_dir),
        )
        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"{script} failed:\n{result.stderr[-2000:]}",
            )
    # Refresh may have expanded the catalog, rebuilt item vectors, and FAISS index.
    # Reset static caches so the next request picks up the new artifacts.
    score.reset_cache()
    retrieve.reset_cache()
    rerank.reset_cache()
    return RetrainResponse(status="ok", message="Profile refreshed.")


@router.post("/retrain", response_model=RetrainResponse)
def trigger_retrain() -> RetrainResponse:
    """
    Run the full offline retrain pipeline (blocking).
    Calls scripts/retrain.sh relative to the ml/ root.
    In production, wire this to a background task or job queue.
    """
    script = Path(__file__).parent.parent / "scripts" / "retrain.sh"
    if not script.exists():
        raise HTTPException(status_code=404, detail=f"retrain.sh not found at {script}")

    result = subprocess.run(
        ["bash", str(script)],
        capture_output=True,
        text=True,
        cwd=str(script.parent.parent),
    )
    if result.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"Retrain failed:\n{result.stderr[-2000:]}",
        )
    # Full retrain rebuilds item_vectors, FAISS index, SVD — reset static caches.
    score.reset_cache()
    retrieve.reset_cache()
    rerank.reset_cache()
    return RetrainResponse(status="ok", message="Retrain complete.")


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}
