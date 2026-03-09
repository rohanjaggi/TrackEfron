#!/usr/bin/env bash
# retrain.sh — Full offline retrain pipeline
# Run from the ml/ directory: bash scripts/retrain.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ML_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ML_DIR"

# Activate venv if present
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi

echo "=== TrackEfron retrain pipeline ==="
echo "Working directory: $ML_DIR"
echo

echo "--- Stage 0: Ingest ---"
python3 src/ingest.py

echo
echo "--- Stage 1: NLP encoding ---"
python3 src/nlp.py

echo
echo "--- Stage 2 + 3: Feature engineering + Model training ---"
# train.py calls features.run() internally (two-pass for SVD)
python3 src/train.py

echo
echo "=== Retrain complete ==="
