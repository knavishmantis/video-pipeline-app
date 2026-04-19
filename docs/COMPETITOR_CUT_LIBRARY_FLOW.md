# Mogswamp Reference Library — End-to-End Flow

Mermaid diagrams. View on GitHub (renders natively), or paste into
<https://mermaid.live>. To render locally from a terminal:
`npx -p @mermaid-js/mermaid-cli mmdc -i docs/COMPETITOR_CUT_LIBRARY_FLOW.md -o /tmp/flow.png`.

---

## 1. Build phase (happens once — already done for Mogswamp)

```mermaid
flowchart TD
  A([You pick a channel, e.g. @Mogswamp]) --> B[Python script: agents/1_idea/youtube/download.py]
  B -->|yt-dlp from home IP| C[Download each Short as MP4]
  C --> D[Upload to gs://knavishmantis-script-engine/videos/mogswamp/]
  C --> E[Write metadata to script_engine.videos<br/>title, views, duration, gcs_path]

  E --> F[Trigger POST /channels/Mogswamp/analyze-cuts<br/>via admin UI / MCP / curl]
  D --> F

  F --> G[For each video:]
  G --> H[Gemini 2.5 Flash reads the MP4 from GCS]
  H --> I{40–50 cut objects<br/>JSON array}
  I --> J[text-embedding-005<br/>embeds each cut description]
  J --> K[(script_engine.competitor_cuts<br/>6,381 rows: visual, pov, clip_type,<br/>minecraft_elements, editing_effects,<br/>music_change, embedding vector)]

  style K fill:#ffd700,stroke:#333,color:#000
```

---

## 2. Query phase (happens every time you click "Similar cuts from Mogswamp")

```mermaid
flowchart TD
  U([You click ▸ Similar cuts<br/>on a scene in SceneEditor]) --> F1[SimilarCutsPanel.tsx]
  F1 -->|POST /shorts/:id/scenes/:id/similar-cuts| B1[scenesRouter handler]

  B1 --> Q1[Query main app DB:<br/>target scene + 2 before + 2 after<br/>= narrative context]
  Q1 --> EMB[text-embedding-005<br/>embed script_line + context]

  EMB --> CACHE{In-memory cache<br/>of all 6,381 embeddings<br/>1h TTL}
  CACHE -->|first call| LOAD[Load from Postgres<br/>~100MB, <1s]
  CACHE -->|subsequent| SCAN
  LOAD --> SCAN[Brute-force cosine similarity<br/>O 6,381 · <50ms]

  SCAN --> TOP20[Top 20 candidates]
  TOP20 --> RERANK[Gemini 2.5 Flash re-rank<br/>with adaptation_notes contract]
  RERANK --> PICK5[5 picks with why_it_fits<br/>+ subject swap list]

  PICK5 --> VERIFY{Each cut_id<br/>in input set?}
  VERIFY -->|no — drop| VERIFY
  VERIFY -->|yes| URLS[Generate signed GCS URLs<br/>append #t=start,end fragment]

  URLS --> RESP[JSON response to frontend]
  RESP --> RENDER[SuggestionCard × 5<br/>autoplaying mp4 previews<br/>+ Adopt pattern button]

  style U fill:#7cc3ff,stroke:#333,color:#000
  style PICK5 fill:#ffd700,stroke:#333,color:#000
  style RENDER fill:#7cc3ff,stroke:#333,color:#000
```

---

## 3. Data model

```mermaid
erDiagram
  videos ||--o{ competitor_cuts : "1 short = 40-50 cuts"
  videos {
    int id PK
    text channel
    text video_id "YouTube id"
    text title
    int duration_sec
    bigint views
    text gcs_path "gs://bucket/videos/mogswamp/X.mp4"
    text cuts_status "done / failed / analyzing"
  }
  competitor_cuts {
    int id PK
    int video_id FK
    int cut_order
    int start_ms
    int end_ms
    text visual_description
    text transcript_segment
    text clip_type
    text pov
    text_array minecraft_elements
    text_array editing_effects
    bool music_change
    real_array embedding "768-dim"
  }
```

---

## Why this design

**Grounding.** Every suggestion points to a *real* indexed cut. The rerank LLM
can only return `cut_id`s from the 20 candidates we hand it — if it invents
one, we drop it. So the user always gets real video they can watch, not
AI-hallucinated shot descriptions.

**Technique-grounded, subject-adaptable.** The reference cut's composition
and editing pattern is immutable (chicken + villagers + cinematic studio).
The `adaptation_notes` array carries the surface swaps to fit your script
(chicken → dolphin). Changing the subject doesn't change the craft.

**Brute force over vector DB.** 6,381 cuts × 768 floats = ~20MB of vectors.
A full cosine scan takes <50ms in Node. Vector DBs (pgvector, pinecone)
would add infra without speedup at this scale.

**Gemini Flash everywhere.** Video analysis + rerank both use
gemini-2.5-flash. ~$0.0002 per user query; ~$0.01 per short ingested.
Pro reserved for calibration only (user's $20 budget cap).
