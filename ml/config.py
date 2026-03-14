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
    "content_sim":      0.35,
    "aspect_align":     0.10,   # reduced — mostly zeros for single-user (items need other reviewers)
    "review_text":      0.20,   # bumped — rich signal from written reviews
    "collab_signal":    0.20,   # bumped — now includes TMDB recs fallback for post-2019 + TV
    "quality_prior":    0.10,
    "release_recency":  0.05,   # soft bias toward newer content
}
NEG_PENALTY_WEIGHT = 0.20

# ── Release year recency ─────────────────────────────────────────────
RELEASE_RECENCY_HALFLIFE = 3650  # days (10 years): film from 10 yrs ago → 0.5 weight

# ── TV catalog seeding ───────────────────────────────────────────────
TV_SEED_SIZE            = 500    # popular TV shows seeded from TMDB discover
RECENT_MOVIE_SEED_SIZE  = 300    # popular movies released since 2019 (post-MovieLens)

# ── Reranker ──────────────────────────────────────────────────────────
MMR_LAMBDA          = 0.6   # 0 = max diversity, 1 = max relevance
NOVELTY_BOOST       = 0.08  # was 0.05 — stronger boost for non-blockbusters
RECENCY_HALFLIFE    = 60    # days, for exponential decay on old reviews

# ── Candidate generation ──────────────────────────────────────────────
CANDIDATE_POOL_SIZE = 200
FINAL_RECS          = 50

# ── Cold start thresholds ─────────────────────────────────────────────
COLD_THRESHOLD = 5    # < 5 reviews
WARM_THRESHOLD = 15   # 5–15 reviews, full = 15+

# ── Embeddings ────────────────────────────────────────────────────────
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
EMBEDDING_DIM   = 384

# ── MovieLens SVD ─────────────────────────────────────────────────────
SVD_N_FACTORS = 100
SVD_N_EPOCHS  = 20