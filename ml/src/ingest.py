"""
ingest.py — Stage 0: Raw data collection
Pull Supabase + TMDB + MovieLens crosswalk + IMDb → write Parquet to PROCESSED_DIR.
"""

import json
import time
import requests
import pandas as pd
import numpy as np
from pathlib import Path
from tqdm import tqdm
from supabase import create_client

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    SUPABASE_URL, SUPABASE_KEY, TMDB_API_KEY,
    RAW_DIR, PROCESSED_DIR, CACHE_DIR, MOVIELENS_DIR, IMDB_DIR,
    TV_SEED_SIZE, RECENT_MOVIE_SEED_SIZE,
)

TMDB_BASE        = "https://api.themoviedb.org/3"
TMDB_RATE_SLEEP  = 0.26       # ~3.8 req/s, stays under TMDB free-tier limit
SUPABASE_PAGE_SIZE = 1000     # PostgREST hard cap; we page to avoid silent truncation


# ── Supabase ───────────────────────────────────────────────────────────────────

def _supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def _fetch_all_rows(client, table: str, columns: str = "*") -> list[dict]:
    rows, lo = [], 0
    while True:
        hi = lo + SUPABASE_PAGE_SIZE - 1
        batch = client.table(table).select(columns).range(lo, hi).execute().data
        rows.extend(batch)
        if len(batch) < SUPABASE_PAGE_SIZE:
            break
        lo += SUPABASE_PAGE_SIZE
    return rows


def fetch_supabase_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    print("Fetching Supabase data...")
    client = _supabase_client()

    watch_rows    = _fetch_all_rows(client, "watch_logs")
    watchlist_rows = _fetch_all_rows(client, "watchlist")

    watch_df     = pd.DataFrame(watch_rows)     if watch_rows     else pd.DataFrame()
    watchlist_df = pd.DataFrame(watchlist_rows) if watchlist_rows else pd.DataFrame()

    print(f"  watch_logs: {len(watch_df)} rows")
    print(f"  watchlist:  {len(watchlist_df)} rows")
    return watch_df, watchlist_df


# ── TMDB ───────────────────────────────────────────────────────────────────────

def _tmdb_get(path: str, params: dict | None = None) -> dict | None:
    # Include non-api_key params in cache key so paginated/filtered requests are cached separately
    cache_suffix = ""
    if params:
        sorted_params = sorted((k, v) for k, v in params.items() if k != "api_key")
        if sorted_params:
            cache_suffix = "_" + "_".join(f"{k}={v}" for k, v in sorted_params)
    cache_file = CACHE_DIR / f"{path.strip('/').replace('/', '_')}{cache_suffix}.json"

    if cache_file.exists():
        with open(cache_file) as f:
            return json.load(f)

    full_params = {"api_key": TMDB_API_KEY}
    if params:
        full_params.update(params)

    time.sleep(TMDB_RATE_SLEEP)

    try:
        resp = requests.get(f"{TMDB_BASE}{path}", params=full_params, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"  TMDB error {path}: {exc}")
        return None

    data = resp.json()
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_file, "w") as f:
        json.dump(data, f)
    return data


def _fetch_item_metadata(tmdb_id: int, media_type: str) -> dict:
    result = {
        "tmdb_id":       tmdb_id,
        "media_type":    media_type,
        "genres":        [],
        "overview":      "",
        "vote_average":  None,
        "vote_count":    None,
        "runtime":       None,
        "release_date":  None,
        "cast_ids":      [],
        "director_ids":  [],
        "imdb_id":       None,
        "tmdb_rec_ids":  [],
    }

    # Base metadata
    base = _tmdb_get(f"/{media_type}/{tmdb_id}")
    if base:
        result["genres"]       = [g["name"] for g in base.get("genres", [])]
        result["overview"]     = base.get("overview", "") or ""
        result["vote_average"] = base.get("vote_average")
        result["vote_count"]   = base.get("vote_count")
        if media_type == "movie":
            result["runtime"]      = base.get("runtime")
            result["release_date"] = base.get("release_date")
        else:
            runtimes = base.get("episode_run_time", [])
            result["runtime"]      = runtimes[0] if runtimes else None
            result["release_date"] = base.get("first_air_date")

    # Credits
    credits = _tmdb_get(f"/{media_type}/{tmdb_id}/credits")
    if credits:
        result["cast_ids"] = [p["id"] for p in credits.get("cast", [])[:10]]
        if media_type == "movie":
            result["director_ids"] = [
                p["id"] for p in credits.get("crew", []) if p.get("job") == "Director"
            ]
        else:
            result["director_ids"] = [
                p["id"] for p in (base or {}).get("created_by", [])
            ]

    # External IDs → IMDb bridge
    ext = _tmdb_get(f"/{media_type}/{tmdb_id}/external_ids")
    if ext:
        result["imdb_id"] = ext.get("imdb_id")

    # TMDB recommendations (collaborative signal proxy for both movies and TV)
    # Movies: fallback for post-2019 titles without MovieLens SVD data
    # TV: primary collaborative signal (no MovieLens coverage)
    recs = _tmdb_get(f"/{media_type}/{tmdb_id}/recommendations")
    if recs:
        result["tmdb_rec_ids"] = [r["id"] for r in recs.get("results", [])[:50]]

    return result


def fetch_tmdb_metadata(tmdb_ids: list[tuple[int, str]]) -> pd.DataFrame:
    print(f"Fetching TMDB metadata for {len(tmdb_ids)} items...")
    records = [_fetch_item_metadata(tid, mt) for tid, mt in tqdm(tmdb_ids, desc="TMDB")]
    return pd.DataFrame(records)


# ── MovieLens crosswalk ────────────────────────────────────────────────────────

def load_movielens_crosswalk() -> pd.DataFrame:
    links_path = MOVIELENS_DIR / "links.csv"
    if not links_path.exists():
        print(f"  WARNING: {links_path} not found. Run scripts/download_data.sh first.")
        return pd.DataFrame(columns=["movieId", "imdbId", "tmdbId"])

    print(f"Loading MovieLens crosswalk from {links_path}...")
    df = pd.read_csv(links_path, dtype={"movieId": int, "imdbId": str, "tmdbId": "Int64"})
    df = df.dropna(subset=["tmdbId"])
    df["tmdbId"] = df["tmdbId"].astype(int)
    print(f"  {len(df)} entries with TMDB IDs")
    return df


def load_movielens_popular_tmdb_ids(top_n: int = 1500) -> list[tuple[int, str]]:
    """
    Return the top-N most-rated MovieLens movies as (tmdb_id, 'movie') pairs.
    Seeds the catalog so recommendations work for a single user without needing
    other TrackEfron users — the system knows about thousands of films upfront.
    Falls back to [] if MovieLens data hasn't been downloaded yet.
    """
    links_path   = MOVIELENS_DIR / "links.csv"
    ratings_path = MOVIELENS_DIR / "ratings.csv"

    if not links_path.exists() or not ratings_path.exists():
        print("  WARNING: MovieLens data not found — catalog will only contain watched items.")
        print("  Run scripts/download_data.sh to enable rich single-user recommendations.")
        return []

    print(f"Loading top {top_n} popular movies from MovieLens...")

    # Rank by number of ratings — most-rated movies are the most widely-known
    ml_ratings = pd.read_csv(ratings_path, usecols=["movieId"], dtype={"movieId": int})
    popular_ml_ids = ml_ratings["movieId"].value_counts().head(top_n).index.tolist()

    links = pd.read_csv(links_path, dtype={"movieId": int, "tmdbId": "Int64"})
    links = links.dropna(subset=["tmdbId"])
    links["tmdbId"] = links["tmdbId"].astype(int)
    link_map = dict(zip(links["movieId"].tolist(), links["tmdbId"].tolist()))

    result = [(int(link_map[ml_id]), "movie") for ml_id in popular_ml_ids if ml_id in link_map]
    print(f"  {len(result)} MovieLens movies mapped to TMDB IDs")
    return result


# ── TMDB discover seeds ───────────────────────────────────────────────────────

def load_tmdb_popular_tv_ids(top_n: int = TV_SEED_SIZE) -> list[tuple[int, str]]:
    """
    Seed the catalog with popular TV shows from TMDB discover endpoint.
    Analogous to MovieLens seeding for movies — ensures the system has a broad
    TV catalog even when the user has only watched a handful of shows.
    """
    print(f"Fetching top {top_n} popular TV shows from TMDB discover...")
    results: list[tuple[int, str]] = []
    page = 1
    while len(results) < top_n:
        data = _tmdb_get(f"/discover/tv", params={
            "sort_by": "vote_count.desc",
            "page": str(page),
        })
        if not data or not data.get("results"):
            break
        for item in data["results"]:
            results.append((int(item["id"]), "tv"))
        if page >= data.get("total_pages", 1):
            break
        page += 1
    result = results[:top_n]
    print(f"  {len(result)} TV shows from TMDB discover")
    return result


def load_tmdb_recent_popular_movies(top_n: int = RECENT_MOVIE_SEED_SIZE) -> list[tuple[int, str]]:
    """
    Seed post-2019 popular movies from TMDB discover. MovieLens 25M was last
    updated ~2019, so newer movies have no SVD embeddings. This ensures the
    catalog contains recent popular films that would otherwise be invisible.
    """
    print(f"Fetching top {top_n} recent popular movies (2019+) from TMDB discover...")
    results: list[tuple[int, str]] = []
    page = 1
    while len(results) < top_n:
        data = _tmdb_get(f"/discover/movie", params={
            "sort_by": "vote_count.desc",
            "primary_release_date.gte": "2019-01-01",
            "page": str(page),
        })
        if not data or not data.get("results"):
            break
        for item in data["results"]:
            results.append((int(item["id"]), "movie"))
        if page >= data.get("total_pages", 1):
            break
        page += 1
    result = results[:top_n]
    print(f"  {len(result)} recent movies from TMDB discover")
    return result


# ── IMDb quality prior ─────────────────────────────────────────────────────────

def load_imdb_ratings() -> pd.DataFrame:
    ratings_path = IMDB_DIR / "title.ratings.tsv"
    basics_path  = IMDB_DIR / "title.basics.tsv"

    if not ratings_path.exists() or not basics_path.exists():
        print(f"  WARNING: IMDb files not found in {IMDB_DIR}. Run scripts/download_data.sh first.")
        return pd.DataFrame(columns=["imdb_id", "average_rating", "num_votes"])

    print("Loading IMDb ratings...")

    basics = pd.read_csv(
        basics_path, sep="\t",
        usecols=["tconst", "titleType"],
        na_values=["\\N"], dtype=str,
    )
    basics = basics[basics["titleType"].isin({"movie", "tvSeries", "tvMiniSeries"})]

    ratings = pd.read_csv(
        ratings_path, sep="\t",
        na_values=["\\N"],
        dtype={"tconst": str, "averageRating": float, "numVotes": int},
    )

    merged = (
        ratings
        .merge(basics[["tconst"]], on="tconst", how="inner")
        .rename(columns={"tconst": "imdb_id", "averageRating": "average_rating", "numVotes": "num_votes"})
    )
    print(f"  {len(merged)} titles (movies + TV series/miniseries)")
    return merged


# ── Catalog assembly ───────────────────────────────────────────────────────────

def _collect_catalog_ids(watch_df: pd.DataFrame, watchlist_df: pd.DataFrame) -> list[tuple[int, str]]:
    pairs: set[tuple[int, str]] = set()

    for df in (watch_df, watchlist_df):
        if not df.empty and "tmdb_id" in df.columns:
            for _, row in df[["tmdb_id", "media_type"]].drop_duplicates().iterrows():
                pairs.add((int(row["tmdb_id"]), str(row["media_type"])))

    return sorted(pairs)


def build_catalog(tmdb_df: pd.DataFrame, imdb_df: pd.DataFrame) -> pd.DataFrame:
    if imdb_df.empty:
        catalog = tmdb_df.copy()
        catalog["average_rating"] = np.nan
        catalog["num_votes"]      = np.nan
        return catalog

    return tmdb_df.merge(
        imdb_df[["imdb_id", "average_rating", "num_votes"]],
        on="imdb_id", how="left",
    )


# ── Entry point ────────────────────────────────────────────────────────────────

def run():
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    watch_df, watchlist_df = fetch_supabase_data()
    watch_df.to_parquet(PROCESSED_DIR / "watch_logs.parquet", index=False)
    watchlist_df.to_parquet(PROCESSED_DIR / "watchlist.parquet", index=False)

    # Seed catalog from multiple sources so the system works for a single user.
    user_ids         = set(_collect_catalog_ids(watch_df, watchlist_df))
    ml_movie_ids     = set(load_movielens_popular_tmdb_ids())
    tv_ids           = set(load_tmdb_popular_tv_ids())
    recent_movie_ids = set(load_tmdb_recent_popular_movies())
    seeded_ids       = ml_movie_ids | tv_ids | recent_movie_ids
    catalog_ids      = sorted(user_ids | seeded_ids)
    print(f"  Catalog: {len(catalog_ids)} items "
          f"({len(user_ids)} user, {len(ml_movie_ids)} MovieLens, "
          f"{len(tv_ids)} TV seed, {len(recent_movie_ids)} recent movies)")

    if not catalog_ids:
        print("  No catalog items found. Exiting.")
        return

    tmdb_df = fetch_tmdb_metadata(catalog_ids)
    tmdb_df.to_parquet(PROCESSED_DIR / "tmdb_metadata.parquet", index=False)

    ml_crosswalk_df = load_movielens_crosswalk()
    ml_crosswalk_df.to_parquet(PROCESSED_DIR / "movielens_crosswalk.parquet", index=False)

    imdb_df = load_imdb_ratings()
    imdb_df.to_parquet(PROCESSED_DIR / "imdb_ratings.parquet", index=False)

    catalog_df = build_catalog(tmdb_df, imdb_df)
    catalog_df.to_parquet(PROCESSED_DIR / "catalog.parquet", index=False)

    print(f"\nIngest complete. Outputs in: {PROCESSED_DIR}")


if __name__ == "__main__":
    run()