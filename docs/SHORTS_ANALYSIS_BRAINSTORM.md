# Shorts Analysis Tool - Brainstorming

## Goal
Fetch scripts from popular Minecraft shorts creators, display randomly, guess percentile, learn what makes scripts good/bad.

## Option 1: YouTube Auto-Captions (Recommended)
**Pros:**
- Free, already available for most videos
- Fast (no processing needed)
- Accurate for popular channels
- YouTube Data API v3 can fetch captions

**Cons:**
- Not all videos have captions
- May need cleanup (timestamps, formatting)
- Quality varies

**Implementation:**
- Use YouTube Data API v3 `captions.list()` and `captions.download()`
- Parse SRT/VTT format to extract text
- Store in database with video metadata

## Option 2: AI Transcription (Vertex AI Speech-to-Text)
**Pros:**
- Works for all videos (even without captions)
- High accuracy
- Can extract audio from video first

**Cons:**
- Costs money (~$0.006 per 15 seconds)
- Slower processing
- Requires downloading video/audio first

**Implementation:**
- Use `yt-dlp` to download audio
- Upload to GCP Storage
- Use Vertex AI Speech-to-Text API
- Store transcript in database

## Option 3: Hybrid Approach
**Best of both worlds:**
1. Try YouTube captions first (free, fast)
2. Fallback to AI transcription if no captions
3. Cache results to avoid re-processing

## Data Fetching Options

### A. YouTube Data API v3
- Search for Minecraft shorts creators
- Get channel videos
- Fetch captions
- **Rate limits:** 10,000 units/day (free tier)
- **Cost:** Free

### B. yt-dlp (Command-line tool)
- Download video metadata
- Extract captions if available
- More flexible, no API limits
- **Cost:** Free
- **Setup:** Install as npm package or system tool

### C. Third-party APIs
- RapidAPI YouTube alternatives
- More expensive, less reliable

## Database Schema Additions

```sql
CREATE TABLE analyzed_shorts (
  id SERIAL PRIMARY KEY,
  youtube_video_id VARCHAR(20) UNIQUE,
  channel_name VARCHAR(255),
  channel_id VARCHAR(50),
  title TEXT,
  transcript TEXT,
  transcript_source VARCHAR(20), -- 'youtube_captions' | 'ai_transcription'
  views INTEGER,
  likes INTEGER,
  published_at TIMESTAMP,
  percentile_score DECIMAL(5,2), -- Calculated from views/engagement
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Implementation Plan

### Phase 1: Data Collection
1. Create script to fetch popular Minecraft shorts channels
2. For each channel, get recent shorts (last 100 videos)
3. Try to fetch YouTube captions
4. Store video metadata + transcript in database

### Phase 2: Percentile Calculation
1. Calculate percentile based on views/engagement for each channel
2. Store percentile_score in database
3. Use this as "ground truth" for the guessing game

### Phase 3: Guessing Game UI
1. Random short selector (shows transcript only, no percentile)
2. User guesses percentile (0-100 slider or input)
3. Show actual percentile + difference
4. Track accuracy over time
5. Show patterns: "You're good at identifying high-percentile hooks"

### Phase 4: Learning Features
1. Compare high vs low percentile scripts
2. Highlight common patterns (hook structure, pacing, etc.)
3. Use your existing Vertex AI grading system to analyze patterns

## Quick Start Recommendation

**Start with YouTube captions:**
1. Use YouTube Data API to find popular Minecraft shorts channels
2. Fetch captions via API (free, fast)
3. Store in new `analyzed_shorts` table
4. Build simple UI: random transcript → guess percentile → reveal answer

**If captions missing:**
- Fallback to yt-dlp to download audio
- Use Vertex AI Speech-to-Text (you already have GCP setup)

## Code Structure

```
backend/src/
  services/
    youtubeApi.ts          # YouTube Data API client
    transcription.ts       # Caption extraction + AI fallback
  controllers/
    analyzedShorts.ts      # CRUD for analyzed shorts
  scripts/
    fetchShorts.ts         # Script to populate database
```

## Key Libraries Needed

```json
{
  "googleapis": "^126.0.0",  // YouTube Data API
  "yt-dlp-wrap": "^2.0.0",   // Download videos/audio
  "@google-cloud/speech": "^5.0.0"  // Speech-to-Text (if needed)
}
```


