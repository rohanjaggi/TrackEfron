"""
api/routes.py — HTTP route handlers
GET  /recommend/{user_id}        → top-20 tmdb_ids for a user
GET  /recommend/{user_id}/items  → top-20 {tmdb_id, media_type} dicts for a user
POST /refresh-profile            → fast update: fetch user data + rebuild profiles only (~seconds)
POST /retrain                    → full retrain: ingest (MovieLens seeded) + nlp + features + SVD/FAISS (~minutes)
GET  /health                     → liveness check
"""

import subprocess
import sys
import threading
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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
def get_recommendations_with_types(user_id: str, limit: int = 20) -> RecommendItemsResponse:
    """
    Return personalised recommendations with media_type for each.
    Accepts ?limit=N (default 20, max 50) to return more candidates for AI enrichment.
    """
    top_n = min(max(limit, 1), 50)
    try:
        items = recommend_with_types(user_id, top_n=top_n)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return RecommendItemsResponse(user_id=user_id, items=items, count=len(items))


def _run_refresh() -> None:
    ml_dir = Path(__file__).parent.parent
    python = sys.executable
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
            error_detail = f"{script} failed:\n{result.stderr[-2000:]}"
            print(f"[refresh-profile ERROR] {error_detail}", flush=True)
            return
        print(f"[refresh-profile] {script} OK", flush=True)
    score.reset_cache()
    retrieve.reset_cache()
    rerank.reset_cache()
    print("[refresh-profile] Done — caches reset.", flush=True)


@router.post("/refresh-profile", response_model=RetrainResponse)
def refresh_profile() -> RetrainResponse:
    """
    Kick off a background profile refresh and return immediately (202-style).
    Fetches the latest watch_logs/watchlist from Supabase, then rebuilds profiles.
    Runs in a daemon thread so the HTTP response is not held open by slow scripts.
    """
    t = threading.Thread(target=_run_refresh, daemon=True)
    t.start()
    return RetrainResponse(status="ok", message="Refresh started.")


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
