"""
api/main.py — FastAPI application entry point
Run with: uvicorn api.main:app --reload  (from the ml/ directory)
"""

from fastapi import FastAPI
from api.routes import router

app = FastAPI(
    title="TrackEfron Recommendation API",
    description="Two-stage retrieve → rerank personalised movie/TV recommendations.",
    version="1.0.0",
)

app.include_router(router)
