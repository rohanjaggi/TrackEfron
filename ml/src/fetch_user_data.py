"""
fetch_user_data.py — Pull latest watch_logs + watchlist from Supabase.

Used by the refresh-profile endpoint instead of the full ingest.py so that
the catalog (built from MovieLens during full retrain) is NOT overwritten.
Only the user's personal data is updated; item vectors stay intact.
"""

import pandas as pd
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import SUPABASE_URL, SUPABASE_KEY, PROCESSED_DIR
from ingest import _supabase_client, _fetch_all_rows


def run() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    print("Fetching latest user data from Supabase...")
    client = _supabase_client()

    watch_rows    = _fetch_all_rows(client, "watch_logs")
    watchlist_rows = _fetch_all_rows(client, "watchlist")

    watch_df     = pd.DataFrame(watch_rows)     if watch_rows     else pd.DataFrame()
    watchlist_df = pd.DataFrame(watchlist_rows) if watchlist_rows else pd.DataFrame()

    watch_df.to_parquet(PROCESSED_DIR / "watch_logs.parquet", index=False)
    watchlist_df.to_parquet(PROCESSED_DIR / "watchlist.parquet", index=False)

    print(f"  watch_logs: {len(watch_df)} rows")
    print(f"  watchlist:  {len(watchlist_df)} rows")
    print("User data updated.")


if __name__ == "__main__":
    run()
