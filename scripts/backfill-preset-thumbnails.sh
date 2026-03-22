#!/bin/bash
# Generate thumbnails for existing preset clips that don't have one.
# Extracts a frame at 50% duration using ffmpeg, uploads PNG to GCS,
# then updates the DB record via the API.
#
# Usage: AUTH_TOKEN="your-token" ./scripts/backfill-preset-thumbnails.sh

set -euo pipefail

PRESETS_DIR="${HOME}/Downloads/presets"
BUCKET="gs://knavishmantis-video-pipeline-prod"
API_URL="https://video-pipeline-backend-z6wgzk4hva-uc.a.run.app/api"
THUMB_DIR=$(mktemp -d)

if [ -z "${AUTH_TOKEN:-}" ]; then
  echo "ERROR: Set AUTH_TOKEN env var. See upload-presets-to-prod.sh for instructions."
  exit 1
fi

# Get all presets from the API
echo "Fetching presets..."
PRESETS_JSON=$(curl -s -H "Authorization: Bearer ${AUTH_TOKEN}" "${API_URL}/preset-clips")

# Parse each preset
echo "$PRESETS_JSON" | python3 -c "
import json, sys
presets = json.load(sys.stdin)
for p in presets:
    has_thumb = '1' if p.get('thumbnail_path') else '0'
    print(f\"{p['id']}|{p['name']}|{has_thumb}\")
" | while IFS='|' read -r ID NAME HAS_THUMB; do
  if [ "$HAS_THUMB" = "1" ]; then
    echo "SKIP: ${NAME} (already has thumbnail)"
    continue
  fi

  # Try to find the matching local file
  # Convert name back to filename: "Magenta Nodding Nametag" -> "magenta-nodding-nametag.mp4"
  FILENAME=$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-').mp4
  LOCAL_FILE="${PRESETS_DIR}/${FILENAME}"

  if [ ! -f "$LOCAL_FILE" ]; then
    echo "SKIP: ${NAME} (no local file: ${FILENAME})"
    continue
  fi

  echo "Generating thumbnail for: ${NAME}..."

  # Get video duration and extract frame at 50%
  DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$LOCAL_FILE" 2>/dev/null)
  MIDPOINT=$(python3 -c "print(float('${DURATION}') / 2)")

  THUMB_FILE="${THUMB_DIR}/${FILENAME%.mp4}-thumb.png"
  ffmpeg -y -ss "$MIDPOINT" -i "$LOCAL_FILE" -frames:v 1 -q:v 2 "$THUMB_FILE" 2>/dev/null

  if [ ! -f "$THUMB_FILE" ]; then
    echo "  FAIL: Could not generate thumbnail"
    continue
  fi

  THUMB_SIZE=$(stat --format="%s" "$THUMB_FILE" 2>/dev/null || stat -f%z "$THUMB_FILE" 2>/dev/null)
  echo "  Thumbnail: $(numfmt --to=iec ${THUMB_SIZE})"

  # Upload thumbnail to GCS
  BUCKET_PATH="preset-clips/$(date +%s%N | cut -c1-13)-$(basename "$THUMB_FILE")"
  gsutil -q cp "$THUMB_FILE" "${BUCKET}/${BUCKET_PATH}"

  # Update DB record with thumbnail_path
  curl -s -X PUT "${API_URL}/preset-clips/${ID}" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"thumbnail_path\": \"${BUCKET_PATH}\"}" > /dev/null

  echo "  Done"
done

rm -rf "$THUMB_DIR"
echo ""
echo "Backfill complete."
