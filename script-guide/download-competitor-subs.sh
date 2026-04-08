#!/bin/bash
# Download subtitles from competitor Minecraft Shorts channels
# Usage: ./download-competitor-subs.sh [max_videos_per_channel]
#
# Requires: yt-dlp, node

set -e

MAX_VIDEOS=${1:-50}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/competitor-data"
mkdir -p "$DATA_DIR"

# Competitor channels — add more as needed
declare -A CHANNELS
CHANNELS=(
  ["camman18"]="@camman18"
  ["mogswamp"]="@MogSwamp"
  ["dashpum4"]="@DashPum4"
  ["kallaway"]="@kallawaymarketing"
)

echo "=== Downloading subtitles from ${#CHANNELS[@]} channels (max $MAX_VIDEOS per channel) ==="

for name in "${!CHANNELS[@]}"; do
  handle="${CHANNELS[$name]}"
  channel_dir="$DATA_DIR/$name"
  mkdir -p "$channel_dir/vtt"

  echo ""
  echo "--- $name ($handle) ---"

  # Download auto-generated subtitles (skip if already downloaded)
  yt-dlp \
    --flat-playlist \
    --print "%(id)s" \
    "https://www.youtube.com/$handle/shorts" 2>/dev/null \
    | head -n "$MAX_VIDEOS" \
    | while read -r video_id; do
      vtt_file="$channel_dir/vtt/$video_id.en.vtt"
      if [ -f "$vtt_file" ]; then
        continue
      fi
      yt-dlp \
        --write-auto-sub \
        --sub-lang en \
        --skip-download \
        --sub-format vtt \
        --no-warnings \
        -o "$channel_dir/vtt/%(id)s.%(ext)s" \
        "https://www.youtube.com/watch?v=$video_id" 2>/dev/null || true
    done

  # Count downloaded
  count=$(ls "$channel_dir/vtt/"*.vtt 2>/dev/null | wc -l)
  echo "  Downloaded $count subtitle files"
done

echo ""
echo "=== Processing VTT files into clean transcripts ==="

# Process all VTT files into clean text per channel
node -e "
const fs = require('fs');
const path = require('path');

const dataDir = '$DATA_DIR';
const channels = fs.readdirSync(dataDir).filter(d =>
  fs.statSync(path.join(dataDir, d)).isDirectory() && d !== 'analysis'
);

for (const channel of channels) {
  const vttDir = path.join(dataDir, channel, 'vtt');
  if (!fs.existsSync(vttDir)) continue;

  const files = fs.readdirSync(vttDir).filter(f => f.endsWith('.vtt'));
  if (files.length === 0) continue;

  let allTranscripts = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(vttDir, file), 'utf-8');
    const videoId = file.replace('.en.vtt', '');
    const lines = raw.split('\n');
    const textLines = [];
    const seen = new Set();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed === 'WEBVTT') continue;
      if (trimmed.startsWith('Kind:') || trimmed.startsWith('Language:')) continue;
      if (/^\d{2}:\d{2}/.test(trimmed)) continue;
      if (/^[\d]+$/.test(trimmed)) continue;
      if (trimmed.startsWith('NOTE')) continue;
      const clean = trimmed.replace(/<[^>]+>/g, '').trim();
      if (!clean) continue;
      if (seen.has(clean)) continue;
      seen.add(clean);
      textLines.push(clean);
    }

    if (textLines.length > 0) {
      allTranscripts.push({
        id: videoId,
        text: textLines.join(' ')
      });
    }
  }

  // Write combined transcript file
  const outFile = path.join(dataDir, channel, channel + '-transcripts.json');
  fs.writeFileSync(outFile, JSON.stringify(allTranscripts, null, 2));
  console.log(channel + ': ' + allTranscripts.length + ' transcripts -> ' + outFile);
}
"

echo ""
echo "=== Done. Transcripts saved to $DATA_DIR/<channel>/<channel>-transcripts.json ==="
echo "Run the analysis script next to extract patterns."
