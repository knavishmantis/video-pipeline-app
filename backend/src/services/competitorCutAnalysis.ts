/**
 * Competitor Cut Analysis — Gemini 2.5 multimodal video analysis.
 *
 * For each competitor short stored in script_engine.videos (with gcs_path set),
 * produces a per-camera-cut breakdown: timestamps, visual description, clip
 * type, POV, tags, editing effects, music-change markers — plus an embedding
 * for similarity search.
 *
 * Writes to script_engine.competitor_cuts. Does NOT touch the main app DB.
 *
 * Design doctrine: suggestions ground *technique* in real indexed cuts; subject
 * swaps are OK via adaptation_notes at retrieval time but are never made up here.
 * See /home/quinncaverly/.claude/projects/.../memory/project_mogswamp_reference_library.md
 */
import { GoogleAuth } from 'google-auth-library';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

const LOCATION = 'us-central1';
const DEFAULT_INGEST_MODEL = 'gemini-2.5-flash';
const EMBEDDING_MODEL = 'text-embedding-005';
const EMBEDDING_DIM = 768;

// ── Types ──────────────────────────────────────────────────────────────

export interface CutRecord {
  cut_order: number;
  start_ms: number;
  end_ms: number;
  transcript_segment: string;
  visual_description: string;
  clip_type: string;
  pov: string;
  setting_tags: string[];
  minecraft_elements: string[];
  editing_effects: string[];
  music_change: boolean;
  music_description: string | null;
}

export interface StoredCut extends CutRecord {
  id: number;
  competitor_video_id: number;
  channel: string;
  youtube_video_id: string;
  video_title: string | null;
  video_views: number | null;
}

export interface SimilarCutCandidate extends StoredCut {
  similarity: number;
}

export interface RankedSuggestion {
  cut_id: number;
  competitor_video_id: number;
  youtube_video_id: string;
  channel: string;
  video_title: string | null;
  start_ms: number;
  end_ms: number;
  visual_description: string;
  clip_type: string;
  pov: string;
  editing_effects: string[];
  transcript_segment: string;
  why_it_fits: string;
  adaptation_notes: string[];
}

// ── Auth + endpoints ───────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('Failed to get GCP access token');
  return token.token;
}

function getGenerateEndpoint(model: string): string {
  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) throw new Error('GCP_PROJECT_ID not set');
  return `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${model}:generateContent`;
}

function getEmbeddingEndpoint(): string {
  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) throw new Error('GCP_PROJECT_ID not set');
  return `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${EMBEDDING_MODEL}:predict`;
}

// ── Schema setup ───────────────────────────────────────────────────────

export async function ensureCompetitorCutTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS competitor_cuts (
      id SERIAL PRIMARY KEY,
      video_id INTEGER NOT NULL,
      cut_order INTEGER NOT NULL,
      start_ms INTEGER NOT NULL,
      end_ms INTEGER NOT NULL,
      transcript_segment TEXT,
      visual_description TEXT NOT NULL,
      clip_type TEXT,
      pov TEXT,
      setting_tags TEXT[] DEFAULT '{}',
      minecraft_elements TEXT[] DEFAULT '{}',
      editing_effects TEXT[] DEFAULT '{}',
      music_change BOOLEAN DEFAULT FALSE,
      music_description TEXT,
      embedding REAL[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(video_id, cut_order)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cuts_video ON competitor_cuts(video_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cuts_clip_type ON competitor_cuts(clip_type)`);

  // Analysis job tracking on the videos table — flag + error columns
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'cuts_status') THEN
        ALTER TABLE videos ADD COLUMN cuts_status TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'cuts_analyzed_at') THEN
        ALTER TABLE videos ADD COLUMN cuts_analyzed_at TIMESTAMPTZ;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'cuts_error') THEN
        ALTER TABLE videos ADD COLUMN cuts_error TEXT;
      END IF;
    END $$;
  `);
}

// ── Prompt ─────────────────────────────────────────────────────────────

const INGESTION_PROMPT = `You are analyzing a Minecraft YouTube Short to catalog EVERY camera cut for a
reference library used by another creator who wants to learn this channel's clipping craft.

Output a JSON array of cut objects, one per camera cut (every time the camera
changes — typically 40-50 cuts in a 30-60s short).

Each cut object MUST include:
- cut_order: 0-indexed integer
- start_ms, end_ms: integers (inclusive start, exclusive end)
- transcript_segment: the exact narration spoken during this cut, or "" if no narration
- visual_description: 1-2 sentences describing WHAT IS ON SCREEN. Include POV, biome/location,
  mobs/items/blocks visible, what the player is doing.
- clip_type: one of [talking-head, studio, build, gameplay, timelapse, inventory, menu, character-skin, pop-culture, screen-capture]
- pov: one of [first-person, third-person, top-down, screen-capture, irl]
- setting_tags: array of biome/dimension/structure tags using Minecraft-accurate names
  (plains, nether_fortress, end_city, superflat_studio, etc.)
- minecraft_elements: array of canonical Minecraft names for mobs/items/blocks/mechanics
  ACTUALLY VISIBLE on screen (e.g. "enderman", "diamond_sword", "enchanting_table").
  Do NOT invent elements. If unsure, omit.
- editing_effects: array from [zoom-in, zoom-out, shake, flash, freeze, text-overlay,
  slow-mo, speed-ramp, color-pop, vignette, split-screen]. Empty array if none.
- music_change: true ONLY if the BACKGROUND music audibly switches to a new track on this cut
  (not just volume/intensity changes).
- music_description: short description of the new track if music_change=true, else null.

HARD RULES:
- Every cut must have start_ms < end_ms.
- Cuts must be contiguous: cut[n].end_ms == cut[n+1].start_ms.
- cut_order must start at 0 and increment by 1.
- Do NOT invent Minecraft elements you can't actually see on screen.
- Do NOT merge two visually distinct cuts. When in doubt, split.
- If the screen is briefly black or a transition frame (<150ms), merge it with the adjacent cut.
- Return ONLY the JSON array. No prose, no markdown.`;

// ── Gemini video analysis ──────────────────────────────────────────────

export async function analyzeVideoCuts(params: {
  gcsUri: string;
  model?: string;
}): Promise<CutRecord[]> {
  const { gcsUri, model = DEFAULT_INGEST_MODEL } = params;
  const token = await getAccessToken();

  const response = await fetch(getGenerateEndpoint(model), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { fileData: { fileUri: gcsUri, mimeType: 'video/mp4' } },
          { text: INGESTION_PROMPT },
        ],
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 32768,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vertex AI analyze error ${response.status}: ${errText.substring(0, 500)}`);
  }

  const data = await response.json() as any;
  const candidate = data?.candidates?.[0];
  if (!candidate?.content?.parts?.length) {
    throw new Error(`Vertex AI returned no content (finishReason: ${candidate?.finishReason || 'unknown'})`);
  }

  const parts = candidate.content.parts;
  const textPart = parts.find((p: any) => p.text && !p.thought) || parts[parts.length - 1];
  const text: string = textPart?.text ?? '';
  if (!text.trim()) throw new Error('Vertex AI returned empty text');

  const jsonText = text.trim().replace(/^```json\n?/s, '').replace(/\n?```\s*$/s, '').trim();
  const cuts = JSON.parse(jsonText) as CutRecord[];

  validateCuts(cuts);
  return cuts;
}

function validateCuts(cuts: CutRecord[]): void {
  if (!Array.isArray(cuts) || cuts.length === 0) throw new Error('analyzeVideoCuts returned empty array');
  for (let i = 0; i < cuts.length; i++) {
    const c = cuts[i];
    if (c.cut_order !== i) throw new Error(`cut_order out of sequence at index ${i}: got ${c.cut_order}`);
    if (!(c.start_ms < c.end_ms)) throw new Error(`cut ${i}: start_ms (${c.start_ms}) must be < end_ms (${c.end_ms})`);
    if (i > 0 && cuts[i - 1].end_ms !== c.start_ms) {
      logger.warn('Non-contiguous cut boundary', { cut_order: i, prev_end: cuts[i - 1].end_ms, start: c.start_ms });
    }
    if (!c.visual_description?.trim()) throw new Error(`cut ${i}: visual_description required`);
  }
}

// ── Embeddings ─────────────────────────────────────────────────────────

export async function embedText(text: string): Promise<number[]> {
  const token = await getAccessToken();
  const body = {
    instances: [{ content: text.slice(0, 8000), task_type: 'SEMANTIC_SIMILARITY' }],
  };
  const response = await fetch(getEmbeddingEndpoint(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${errText.substring(0, 300)}`);
  }
  const data = await response.json() as any;
  const values = data?.predictions?.[0]?.embeddings?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIM) {
    throw new Error(`Unexpected embedding shape: length=${values?.length}`);
  }
  return values;
}

export function embeddingText(cut: CutRecord): string {
  const parts = [
    cut.visual_description,
    cut.transcript_segment ? `Narration: ${cut.transcript_segment}` : '',
    cut.clip_type ? `Type: ${cut.clip_type}` : '',
    cut.pov ? `POV: ${cut.pov}` : '',
    cut.minecraft_elements.length ? `Elements: ${cut.minecraft_elements.join(', ')}` : '',
    cut.setting_tags.length ? `Setting: ${cut.setting_tags.join(', ')}` : '',
    cut.editing_effects.length ? `Effects: ${cut.editing_effects.join(', ')}` : '',
  ].filter(Boolean);
  return parts.join('. ');
}

// ── Ingestion orchestrator ─────────────────────────────────────────────

export async function ingestOneVideo(pool: Pool, videoId: number, opts: { model?: string } = {}): Promise<{ cut_count: number }> {
  const { rows } = await pool.query(
    'SELECT id, channel, video_id, gcs_path FROM videos WHERE id = $1',
    [videoId]
  );
  const video = rows[0];
  if (!video) throw new Error(`video ${videoId} not found`);
  if (!video.gcs_path) throw new Error(`video ${videoId} has no gcs_path`);

  await pool.query(
    `UPDATE videos SET cuts_status = 'analyzing', cuts_error = NULL WHERE id = $1`,
    [videoId]
  );

  try {
    const gcsUri = video.gcs_path.startsWith('gs://')
      ? video.gcs_path
      : `gs://${process.env.SCRIPT_ENGINE_GCS_BUCKET || 'knavishmantis-script-engine'}/${video.gcs_path}`;

    const cuts = await analyzeVideoCuts({ gcsUri, model: opts.model });

    // Embed in parallel but bounded
    const embeddings: number[][] = [];
    const BATCH = 8;
    for (let i = 0; i < cuts.length; i += BATCH) {
      const slice = cuts.slice(i, i + BATCH);
      const vecs = await Promise.all(slice.map(c => embedText(embeddingText(c))));
      embeddings.push(...vecs);
    }

    // Replace any existing cuts for this video (idempotent)
    await pool.query('DELETE FROM competitor_cuts WHERE video_id = $1', [videoId]);

    for (let i = 0; i < cuts.length; i++) {
      const c = cuts[i];
      await pool.query(
        `INSERT INTO competitor_cuts (
          video_id, cut_order, start_ms, end_ms, transcript_segment,
          visual_description, clip_type, pov, setting_tags,
          minecraft_elements, editing_effects, music_change, music_description, embedding
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          videoId, c.cut_order, c.start_ms, c.end_ms, c.transcript_segment || '',
          c.visual_description, c.clip_type || null, c.pov || null,
          c.setting_tags || [], c.minecraft_elements || [], c.editing_effects || [],
          !!c.music_change, c.music_description || null, embeddings[i],
        ]
      );
    }

    await pool.query(
      `UPDATE videos SET cuts_status = 'done', cuts_analyzed_at = NOW(), cuts_error = NULL WHERE id = $1`,
      [videoId]
    );

    logger.info('Ingested competitor cuts', { videoId, channel: video.channel, cut_count: cuts.length });
    return { cut_count: cuts.length };
  } catch (err: any) {
    await pool.query(
      `UPDATE videos SET cuts_status = 'failed', cuts_error = $2 WHERE id = $1`,
      [videoId, (err?.message || String(err)).substring(0, 2000)]
    );
    throw err;
  }
}

// ── Similarity search (brute-force cosine) ─────────────────────────────

type CutCacheEntry = {
  cut: StoredCut;
  vec: number[];
  norm: number;
};

let cutCache: { entries: CutCacheEntry[]; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

export function invalidateCutCache(): void {
  cutCache = null;
}

async function loadCutCache(pool: Pool): Promise<CutCacheEntry[]> {
  if (cutCache && Date.now() - cutCache.loadedAt < CACHE_TTL_MS) {
    return cutCache.entries;
  }
  const { rows } = await pool.query(`
    SELECT
      c.id, c.video_id, c.cut_order, c.start_ms, c.end_ms,
      c.transcript_segment, c.visual_description, c.clip_type, c.pov,
      c.setting_tags, c.minecraft_elements, c.editing_effects,
      c.music_change, c.music_description, c.embedding,
      v.channel, v.video_id AS youtube_video_id, v.title AS video_title, v.views AS video_views
    FROM competitor_cuts c
    JOIN videos v ON v.id = c.video_id
    WHERE c.embedding IS NOT NULL
  `);
  const entries: CutCacheEntry[] = rows.map((r: any) => {
    const vec: number[] = r.embedding;
    let n = 0;
    for (let i = 0; i < vec.length; i++) n += vec[i] * vec[i];
    return {
      cut: {
        id: r.id,
        competitor_video_id: r.video_id,
        channel: r.channel,
        youtube_video_id: r.youtube_video_id,
        video_title: r.video_title,
        video_views: r.video_views ? Number(r.video_views) : null,
        cut_order: r.cut_order,
        start_ms: r.start_ms,
        end_ms: r.end_ms,
        transcript_segment: r.transcript_segment || '',
        visual_description: r.visual_description,
        clip_type: r.clip_type || '',
        pov: r.pov || '',
        setting_tags: r.setting_tags || [],
        minecraft_elements: r.minecraft_elements || [],
        editing_effects: r.editing_effects || [],
        music_change: !!r.music_change,
        music_description: r.music_description,
      },
      vec,
      norm: Math.sqrt(n),
    };
  });
  cutCache = { entries, loadedAt: Date.now() };
  logger.info('Loaded competitor cut cache', { count: entries.length });
  return entries;
}

function cosineSim(a: number[], b: number[], normA: number, normB: number): number {
  if (normA === 0 || normB === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot / (normA * normB);
}

export async function searchSimilarCuts(
  pool: Pool,
  params: { queryText: string; k: number; channel?: string }
): Promise<SimilarCutCandidate[]> {
  const { queryText, k, channel } = params;
  const queryVec = await embedText(queryText);
  let queryNorm = 0;
  for (const v of queryVec) queryNorm += v * v;
  queryNorm = Math.sqrt(queryNorm);

  const entries = await loadCutCache(pool);
  const filtered = channel ? entries.filter(e => e.cut.channel === channel) : entries;

  const scored: SimilarCutCandidate[] = filtered.map(e => ({
    ...e.cut,
    similarity: cosineSim(queryVec, e.vec, queryNorm, e.norm),
  }));
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}

// ── Re-rank with adaptation_notes (the grounded-but-adaptable step) ────

const RERANK_PROMPT_TEMPLATE = (
  scriptLine: string,
  shortContext: string,
  candidates: SimilarCutCandidate[]
) => `You are helping a Minecraft YouTube Shorts creator pick reference cuts from
a competitor's catalog to inform how they film ONE specific scene.

TARGET SCENE:
  Script line (narration): ${scriptLine || '(none yet)'}
  Short context (surrounding scenes): ${shortContext || '(none provided)'}

CANDIDATE CUTS (these are REAL cuts that actually exist in our reference library —
you may ONLY return cut_ids from this list):

${candidates.map(c =>
`  cut_id: ${c.id}
  from: ${c.channel} / ${c.youtube_video_id}${c.video_title ? ` — ${c.video_title}` : ''}
  timestamp: ${formatTime(c.start_ms)}-${formatTime(c.end_ms)}
  clip_type: ${c.clip_type}
  pov: ${c.pov}
  visual: ${c.visual_description}
  narration: ${c.transcript_segment || '(silent)'}
  elements: ${c.minecraft_elements.join(', ') || '(none)'}
  setting: ${c.setting_tags.join(', ') || '(none)'}
  effects: ${c.editing_effects.join(', ') || '(none)'}
  similarity: ${c.similarity.toFixed(3)}
`).join('\n')}

YOUR JOB:
Pick the 5 BEST-FIT cuts for this target scene. Rank them. For each, output:
  - cut_id: MUST be one of the cut_ids above. Never invent.
  - why_it_fits: one sentence on what technique/composition/editing pattern to borrow.
  - adaptation_notes: array of subject swaps needed to adapt the reference to the target scene
    (e.g. ["chicken → dolphin", "diamond_sword → netherite_axe"]). Empty array if none needed.

GROUNDING RULES — READ CAREFULLY:
- The *technique/composition/editing pattern* comes from the real cut. Don't propose techniques
  or Minecraft mechanics that aren't visible in the referenced cut.
- Subject swaps (chicken ↔ dolphin, sword ↔ axe, biome ↔ biome) are FINE — list them in adaptation_notes.
- Do NOT add new elements or structural changes to the composition. Only note subject substitutions.
- If none of the candidates are a good fit, return fewer than 5 — quality over quantity.

Return ONLY a JSON array of objects: [{cut_id, why_it_fits, adaptation_notes}, ...]`;

function formatTime(ms: number): string {
  const totalS = Math.floor(ms / 1000);
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export async function rerankCandidates(params: {
  scriptLine: string;
  shortContext: string;
  candidates: SimilarCutCandidate[];
  finalK?: number;
}): Promise<RankedSuggestion[]> {
  const { scriptLine, shortContext, candidates, finalK = 5 } = params;
  if (candidates.length === 0) return [];

  const token = await getAccessToken();
  const prompt = RERANK_PROMPT_TEMPLATE(scriptLine, shortContext, candidates);

  const response = await fetch(getGenerateEndpoint('gemini-2.5-flash'), {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: 'application/json' },
    }),
  });
  if (!response.ok) {
    throw new Error(`Rerank error ${response.status}: ${(await response.text()).substring(0, 300)}`);
  }
  const data = await response.json() as any;
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const textPart = parts.find((p: any) => p.text && !p.thought) || parts[parts.length - 1];
  const text: string = textPart?.text ?? '';
  const jsonText = text.trim().replace(/^```json\n?/s, '').replace(/\n?```\s*$/s, '').trim();
  const picks = JSON.parse(jsonText) as Array<{ cut_id: number; why_it_fits: string; adaptation_notes: string[] }>;

  const byId = new Map(candidates.map(c => [c.id, c]));
  const result: RankedSuggestion[] = [];
  for (const pick of picks) {
    const c = byId.get(pick.cut_id);
    if (!c) {
      logger.warn('Rerank returned unknown cut_id — skipping', { cut_id: pick.cut_id });
      continue;
    }
    result.push({
      cut_id: c.id,
      competitor_video_id: c.competitor_video_id,
      youtube_video_id: c.youtube_video_id,
      channel: c.channel,
      video_title: c.video_title,
      start_ms: c.start_ms,
      end_ms: c.end_ms,
      visual_description: c.visual_description,
      clip_type: c.clip_type,
      pov: c.pov,
      editing_effects: c.editing_effects,
      transcript_segment: c.transcript_segment,
      why_it_fits: pick.why_it_fits || '',
      adaptation_notes: Array.isArray(pick.adaptation_notes) ? pick.adaptation_notes : [],
    });
    if (result.length >= finalK) break;
  }
  return result;
}

// ── Cost estimation (kept in one place for the $20 guard) ──────────────

// Rough cost model — Vertex AI pricing as of 2026.
// Video input (Flash): ~$0.15/M tokens; assume ~258 tokens/sec low-res.
// Output: ~$0.60/M tokens; assume ~4000 out tokens per short.
// Embeddings: ~$0.0001 per cut.
export function estimateIngestCostUsd(params: {
  shortCount: number;
  avgDurationSec: number;
  avgCutsPerShort: number;
  model?: string;
}): number {
  const { shortCount, avgDurationSec, avgCutsPerShort, model = DEFAULT_INGEST_MODEL } = params;
  const isPro = model.includes('pro');
  const inputPerM = isPro ? 1.25 : 0.15;
  const outputPerM = isPro ? 5.0 : 0.60;
  const inputTokens = shortCount * avgDurationSec * 258;
  const outputTokens = shortCount * 4000;
  const embeddingCost = shortCount * avgCutsPerShort * 0.0001;
  return (inputTokens / 1_000_000) * inputPerM + (outputTokens / 1_000_000) * outputPerM + embeddingCost;
}

export const INGEST_DEFAULTS = {
  model: DEFAULT_INGEST_MODEL,
  embeddingDim: EMBEDDING_DIM,
};
