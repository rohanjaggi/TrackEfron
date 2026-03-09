from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv()

# ── Paths ─────────────────────────────────────────────────────────────
ROOT          = Path(__file__).parent
DATA_DIR      = ROOT / "data"
RAW_DIR       = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
CACHE_DIR     = DATA_DIR / "cache" / "tmdb"
MOVIELENS_DIR = RAW_DIR / "movielens"
IMDB_DIR      = RAW_DIR / "imdb"
MODELS_DIR    = ROOT / "models"

# ── Credentials ───────────────────────────────────────────────────────
SUPABASE_URL  = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TMDB_API_KEY  = os.environ["TMDB_API_KEY"]

# ── Scoring weights (α–ζ) — tune via discovered_via feedback over time ─
SCORE_WEIGHTS = {
    "content_sim":   0.35,
    "aspect_align":  0.25,
    "review_text":   0.15,
    "collab_signal": 0.15,
    "quality_prior": 0.10,
}
NEG_PENALTY_WEIGHT = 0.20

# ── Reranker ──────────────────────────────────────────────────────────
MMR_LAMBDA          = 0.6   # 0 = max diversity, 1 = max relevance
NOVELTY_BOOST       = 0.05
RECENCY_HALFLIFE    = 60    # days, for exponential decay on old reviews

# ── Candidate generation ──────────────────────────────────────────────
CANDIDATE_POOL_SIZE = 200
FINAL_RECS          = 20

# ── Cold start thresholds ─────────────────────────────────────────────
COLD_THRESHOLD = 5    # < 5 reviews
WARM_THRESHOLD = 15   # 5–15 reviews, full = 15+

# ── Embeddings ────────────────────────────────────────────────────────
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
EMBEDDING_DIM   = 384

# ── MovieLens SVD ─────────────────────────────────────────────────────
SVD_N_FACTORS = 100
SVD_N_EPOCHS  = 20