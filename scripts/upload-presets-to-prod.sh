#!/bin/bash
# Upload preset clips from ~/Downloads/presets to prod GCS bucket
# and create database records via the prod API.
#
# Usage:
#   1. Get an auth token by logging into the prod app and copying from browser devtools:
#      Network tab → any /api/ request → Authorization header → copy the Bearer token
#   2. Run: AUTH_TOKEN="your-token" ./scripts/upload-presets-to-prod.sh

set -euo pipefail

PRESETS_DIR="${HOME}/Downloads/presets"
BUCKET="gs://knavishmantis-video-pipeline-prod"
API_URL="https://video-pipeline-backend-z6wgzk4hva-uc.a.run.app/api"

if [ -z "${AUTH_TOKEN:-}" ]; then
  echo "ERROR: Set AUTH_TOKEN env var first."
  echo "  Get it from browser devtools: Network tab → any /api/ request → Authorization: Bearer <token>"
  echo ""
  echo "  Usage: AUTH_TOKEN=\"eyJ...\" ./scripts/upload-presets-to-prod.sh"
  exit 1
fi

# Verify auth works
echo "Verifying auth..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  "${API_URL}/preset-clips")

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: Auth failed (HTTP $HTTP_CODE). Token may be expired."
  exit 1
fi
echo "Auth OK."

# Check what presets already exist
EXISTING=$(curl -s -H "Authorization: Bearer ${AUTH_TOKEN}" "${API_URL}/preset-clips" | python3 -c "import json,sys; [print(x['name']) for x in json.load(sys.stdin)]" 2>/dev/null || true)

UPLOADED=0
SKIPPED=0

for FILE in "${PRESETS_DIR}"/*.mp4; do
  FILENAME=$(basename "$FILE")
  # Derive name: magenta-nodding-nametag.mp4 → "Magenta Nodding Nametag"
  NAME=$(echo "${FILENAME%.*}" | tr '-' ' ' | sed 's/\b\(.\)/\u\1/g')
  FILESIZE=$(stat --format="%s" "$FILE" 2>/dev/null || stat -f%z "$FILE" 2>/dev/null)
  CONTENT_TYPE="video/mp4"

  # Skip if already exists
  if echo "$EXISTING" | grep -qiF "$NAME"; then
    echo "SKIP: ${NAME} (already exists)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  BUCKET_PATH="preset-clips/$(date +%s%N | cut -c1-13)-${FILENAME}"

  echo "Uploading: ${NAME} (${FILENAME}, $(numfmt --to=iec ${FILESIZE}))"

  # 1. Upload to GCS directly with gsutil
  gsutil -q cp "$FILE" "${BUCKET}/${BUCKET_PATH}"

  # 2. Create DB record via API
  curl -s -X POST "${API_URL}/preset-clips" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(cat <<EOF
{
  "name": "${NAME}",
  "description": null,
  "bucket_path": "${BUCKET_PATH}",
  "mime_type": "${CONTENT_TYPE}",
  "file_size": ${FILESIZE}
}
EOF
)" > /dev/null

  echo "  ✓ Done"
  UPLOADED=$((UPLOADED + 1))
done

echo ""
echo "Complete: ${UPLOADED} uploaded, ${SKIPPED} skipped."
