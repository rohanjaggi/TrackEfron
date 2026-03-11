#!/usr/bin/env bash
# download_data.sh — One-time download of MovieLens 25M and IMDb datasets
# Run from the ml/ directory: bash scripts/download_data.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ML_DIR="$(dirname "$SCRIPT_DIR")"
RAW_DIR="$ML_DIR/data/raw"

mkdir -p "$RAW_DIR/movielens"
mkdir -p "$RAW_DIR/imdb"

# ── MovieLens 25M ──────────────────────────────────────────────────────────────
if [ ! -f "$RAW_DIR/movielens/ratings.csv" ]; then
    echo "Downloading MovieLens 25M (~250 MB)..."
    curl -L -o "$RAW_DIR/ml-25m.zip" \
        "https://files.grouplens.org/datasets/movielens/ml-25m.zip"
    unzip -j "$RAW_DIR/ml-25m.zip" "ml-25m/ratings.csv" "ml-25m/links.csv" \
        -d "$RAW_DIR/movielens"
    rm "$RAW_DIR/ml-25m.zip"
    echo "  MovieLens done."
else
    echo "MovieLens already present — skipping."
fi

# ── IMDb datasets ──────────────────────────────────────────────────────────────
if [ ! -f "$RAW_DIR/imdb/title.ratings.tsv" ]; then
    echo "Downloading IMDb title.ratings (~30 MB)..."
    curl -L -o "$RAW_DIR/imdb/title.ratings.tsv.gz" \
        "https://datasets.imdbws.com/title.ratings.tsv.gz"
    gunzip "$RAW_DIR/imdb/title.ratings.tsv.gz"
    echo "  title.ratings.tsv done."
else
    echo "IMDb title.ratings already present — skipping."
fi

if [ ! -f "$RAW_DIR/imdb/title.basics.tsv" ]; then
    echo "Downloading IMDb title.basics (~700 MB uncompressed)..."
    curl -L -o "$RAW_DIR/imdb/title.basics.tsv.gz" \
        "https://datasets.imdbws.com/title.basics.tsv.gz"
    gunzip "$RAW_DIR/imdb/title.basics.tsv.gz"
    echo "  title.basics.tsv done."
else
    echo "IMDb title.basics already present — skipping."
fi

echo
echo "=== Data download complete ==="
echo "Next step: bash scripts/retrain.sh"
