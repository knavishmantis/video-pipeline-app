import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.VIDEO_PIPELINE_API_URL || 'http://localhost:3001/api';
const API_TOKEN = process.env.VIDEO_PIPELINE_API_TOKEN || '';

async function apiRequest(method: string, path: string, body?: any): Promise<any> {
  const url = `${API_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}`,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }
  return response.json();
}

const server = new McpServer({
  name: 'video-pipeline',
  version: '1.0.0',
});

// --- Shorts Tools ---

server.tool(
  'list_shorts',
  'List all shorts in the video pipeline, optionally filtered by status',
  {
    status: z.enum(['idea', 'script', 'clipping', 'clips', 'clip_changes', 'editing', 'editing_changes', 'completed', 'uploaded']).optional().describe('Filter by pipeline status'),
  },
  async ({ status }) => {
    const params = status ? `?status=${status}` : '';
    const shorts = await apiRequest('GET', `/shorts${params}`);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(shorts, null, 2) }],
    };
  }
);

server.tool(
  'get_short',
  'Get details of a specific short including assignments and files',
  {
    short_id: z.number().describe('The ID of the short to retrieve'),
  },
  async ({ short_id }) => {
    const short = await apiRequest('GET', `/shorts/${short_id}`);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(short, null, 2) }],
    };
  }
);

server.tool(
  'create_short',
  'Create a new short (video project) in the pipeline',
  {
    title: z.string().describe('Title of the short'),
    description: z.string().optional().describe('Description of the short'),
    idea: z.string().optional().describe('Initial idea for the short'),
  },
  async ({ title, description, idea }) => {
    const short = await apiRequest('POST', '/shorts', { title, description, idea });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(short, null, 2) }],
    };
  }
);

server.tool(
  'update_short',
  'Update a short - can change title, description, idea, script content, or status',
  {
    short_id: z.number().describe('The ID of the short to update'),
    title: z.string().optional().describe('New title'),
    description: z.string().optional().describe('New description'),
    idea: z.string().optional().describe('New idea'),
    script_content: z.string().optional().describe('Main script narration text'),
    status: z.enum(['idea', 'script', 'clipping', 'clips', 'clip_changes', 'editing', 'editing_changes', 'completed', 'uploaded']).optional().describe('New pipeline status'),
  },
  async ({ short_id, ...updates }) => {
    // Filter out undefined values
    const body = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined));
    const short = await apiRequest('PUT', `/shorts/${short_id}`, body);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(short, null, 2) }],
    };
  }
);

// --- Scenes Tools ---

server.tool(
  'list_scenes',
  'List all scenes for a short, ordered by scene_order',
  {
    short_id: z.number().describe('The ID of the short'),
  },
  async ({ short_id }) => {
    const scenes = await apiRequest('GET', `/shorts/${short_id}/scenes`);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(scenes, null, 2) }],
    };
  }
);

server.tool(
  'create_scene',
  'Create a single scene for a short',
  {
    short_id: z.number().describe('The ID of the short'),
    script_line: z.string().describe('The narration text for this scene'),
    direction: z.string().optional().describe('Editing/visual direction for what the clipper/editor should show'),
    clipper_notes: z.string().optional().describe('Detailed instructions for the clipper'),
    editor_notes: z.string().optional().describe('Post-production notes for the editor'),
  },
  async ({ short_id, script_line, direction, clipper_notes, editor_notes }) => {
    const scene = await apiRequest('POST', `/shorts/${short_id}/scenes`, { script_line, direction, clipper_notes, editor_notes });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(scene, null, 2) }],
    };
  }
);

server.tool(
  'update_scene',
  'Update an existing scene - can change script line, direction, or notes',
  {
    short_id: z.number().describe('The ID of the short'),
    scene_id: z.number().describe('The ID of the scene to update'),
    script_line: z.string().optional().describe('Updated narration text'),
    direction: z.string().optional().describe('Updated editing direction'),
    clipper_notes: z.string().optional().describe('Notes for the clipper'),
    editor_notes: z.string().optional().describe('Notes for the editor'),
  },
  async ({ short_id, scene_id, ...updates }) => {
    const body = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined));
    const scene = await apiRequest('PUT', `/shorts/${short_id}/scenes/${scene_id}`, body);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(scene, null, 2) }],
    };
  }
);

server.tool(
  'delete_scene',
  'Delete a scene from a short',
  {
    short_id: z.number().describe('The ID of the short'),
    scene_id: z.number().describe('The ID of the scene to delete'),
  },
  async ({ short_id, scene_id }) => {
    await apiRequest('DELETE', `/shorts/${short_id}/scenes/${scene_id}`);
    return {
      content: [{ type: 'text' as const, text: `Scene ${scene_id} deleted successfully` }],
    };
  }
);

server.tool(
  'bulk_create_scenes',
  'Replace all scenes for a short at once. Deletes existing scenes and creates new ones. This is the main tool for generating an editing script from a main script. Split at phrase boundaries (5-7 words per scene). Include detailed clipper_notes for every scene describing exactly what to record in Flashback.',
  {
    short_id: z.number().describe('The ID of the short'),
    scenes: z.array(z.object({
      script_line: z.string().describe('The narration text for this scene (one phrase, 5-7 words)'),
      direction: z.string().optional().describe('Brief visual direction'),
      clipper_notes: z.string().optional().describe('Detailed instructions for the clipper: what to build, where, what skins/armor, camera angle, shot type'),
      editor_notes: z.string().optional().describe('Post-production notes: SFX, transitions, overlays, timing. Only include when needed.'),
    })).describe('Array of scenes in order.'),
  },
  async ({ short_id, scenes }) => {
    const result = await apiRequest('POST', `/shorts/${short_id}/scenes/bulk`, { scenes });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  'write_script',
  'Write or update the main script content for a short, then optionally generate scenes from it',
  {
    short_id: z.number().describe('The ID of the short'),
    script_content: z.string().describe('The full main script narration text'),
  },
  async ({ short_id, script_content }) => {
    const short = await apiRequest('PUT', `/shorts/${short_id}`, { script_content });
    return {
      content: [{ type: 'text' as const, text: `Script updated for short "${short.title}". Use bulk_create_scenes to create editing directions for each scene.` }],
    };
  }
);

// --- Competitor Ingestion + Cut Analysis (admin) ---

server.tool(
  'start_channel_ingestion',
  'Kick off YouTube → GCS ingestion for a competitor channel (metadata + transcripts + video downloads). Background job; use get_channel_ingestion_status to poll. Display_name becomes the channel key used everywhere. mc_username defaults to display_name.',
  {
    handle: z.string().describe('YouTube handle including @, e.g. "@Mogswamp"'),
    display_name: z.string().describe('Channel key + display, e.g. "Mogswamp"'),
    mc_username: z.string().optional().describe('Minecraft username (defaults to display_name)'),
  },
  async ({ handle, display_name, mc_username }) => {
    const result = await apiRequest('POST', '/competitor-analysis/channels', {
      handle, displayName: display_name, mcUsername: mc_username || display_name,
    });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'get_channel_ingestion_status',
  'Get the latest ingestion job state for a channel (phase, total_videos, done_videos, fail_videos, message). Use this to poll progress of start_channel_ingestion.',
  {
    channel: z.string().describe('Channel name (e.g. "Mogswamp")'),
  },
  async ({ channel }) => {
    const result = await apiRequest('GET', `/competitor-analysis/channels/${encodeURIComponent(channel)}/ingest`);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'analyze_channel_cuts',
  'Run Gemini cut-level analysis on a competitor channel, batching all videos whose cuts have not been analyzed yet. Hard-stops at $20 estimated cost unless approve_over_budget=true. Default model gemini-2.5-flash. Runs as a background job; poll with get_channel_cuts_progress.',
  {
    channel: z.string().describe('Channel name'),
    limit: z.number().optional().describe('Max videos to analyze (for pilots)'),
    model: z.enum(['gemini-2.5-flash', 'gemini-2.5-pro']).optional().describe('Default: gemini-2.5-flash'),
    approve_over_budget: z.boolean().optional().describe('Only needed if estimated cost >$20'),
  },
  async ({ channel, limit, model, approve_over_budget }) => {
    const qs = approve_over_budget ? '?approveOverBudget=true' : '';
    const result = await apiRequest('POST', `/competitor-analysis/channels/${encodeURIComponent(channel)}/analyze-cuts${qs}`, {
      limit, model,
    });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'get_channel_cuts_progress',
  'Get cut-analysis progress for a channel: total videos, how many done/analyzing/failed, total cut count across all analyzed videos.',
  {
    channel: z.string().describe('Channel name'),
  },
  async ({ channel }) => {
    const result = await apiRequest('GET', `/competitor-analysis/channels/${encodeURIComponent(channel)}/cuts-progress`);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'analyze_one_video_cuts',
  'Run Gemini cut-level analysis on ONE specific competitor video (synchronous, typically 15-60s). Good for pilot testing or retrying a single failure.',
  {
    video_id: z.number().describe('The script_engine.videos.id (integer, not YouTube id)'),
    model: z.enum(['gemini-2.5-flash', 'gemini-2.5-pro']).optional(),
  },
  async ({ video_id, model }) => {
    const result = await apiRequest('POST', `/competitor-analysis/videos/${video_id}/analyze-cuts`, { model });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// Shared helper — call the admin /cuts/similar endpoint with script_line + context.
async function queryCutsByText(
  script_line: string,
  short_context: string,
  k: number,
  channel?: string
): Promise<any[]> {
  const r = await apiRequest('POST', '/competitor-analysis/cuts/similar', {
    script_line,
    short_context,
    k,
    channel,
    include_signed_urls: true,
  });
  return (r.suggestions || []).map((s: any) => ({
    cut_id: s.cut_id,
    channel: s.channel,
    youtube_video_id: s.youtube_video_id,
    video_title: s.video_title,
    timestamp: `${formatMs(s.start_ms)}-${formatMs(s.end_ms)}`,
    start_s: Math.floor(s.start_ms / 1000),
    end_s: Math.floor(s.end_ms / 1000),
    clip_type: s.clip_type,
    pov: s.pov,
    editing_effects: s.editing_effects,
    visual_description: s.visual_description,
    transcript_segment: s.transcript_segment,
    why_it_fits: s.why_it_fits,
    adaptation_notes: s.adaptation_notes,
    signed_video_url: s.signed_video_url,
  }));
}

server.tool(
  'suggest_similar_cuts',
  `Retrieve grounded reference cuts from the competitor cut library for one or more EXISTING scenes of a short. Use this to refine clipper_notes AFTER scenes have been created. For brand-new script-to-scenes generation (no scenes yet), use find_similar_cuts_by_text instead.

Every suggestion is anchored to a REAL indexed cut (cut_id + timestamp + video). Technique/composition from the real cut; subject can be adapted via adaptation_notes (e.g. "chicken → dolphin").`,
  {
    short_id: z.number().describe('The short whose existing scenes we want suggestions for'),
    scene_orders: z.array(z.number()).optional().describe('Optional subset of scene_order values. Omit to run for every scene.'),
    k: z.number().optional().describe('How many suggestions per scene. Default 3, max 10.'),
    channel: z.string().optional().describe('Optional filter: e.g. "Mogswamp". Omit to search all indexed channels.'),
  },
  async ({ short_id, scene_orders, k, channel }) => {
    const allScenes: any[] = await apiRequest('GET', `/shorts/${short_id}/scenes`);
    const target = Array.isArray(scene_orders) && scene_orders.length > 0
      ? allScenes.filter(s => scene_orders.includes(s.scene_order))
      : allScenes;
    const finalK = k ?? 3;

    const results = await Promise.all(target.map(async (scene) => {
      const before = allScenes.filter(s => s.scene_order < scene.scene_order).slice(-2);
      const after = allScenes.filter(s => s.scene_order > scene.scene_order).slice(0, 2);
      const shortContext = [
        ...before.map(s => `Before (#${s.scene_order}): ${s.script_line || ''}`),
        ...after.map(s => `After (#${s.scene_order}): ${s.script_line || ''}`),
      ].filter(Boolean).join(' | ');

      try {
        const candidates = await queryCutsByText(scene.script_line || '', shortContext, finalK, channel);
        return {
          scene_order: scene.scene_order,
          scene_id: scene.id,
          script_line: scene.script_line,
          candidates,
        };
      } catch (err: any) {
        return {
          scene_order: scene.scene_order,
          scene_id: scene.id,
          script_line: scene.script_line,
          error: err?.message || 'lookup failed',
          candidates: [],
        };
      }
    }));

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ suggestions: results }, null, 2) }],
    };
  }
);

server.tool(
  'find_similar_cuts_by_text',
  `Search the competitor cut library by raw text — use this during script-to-scenes generation when scenes don't exist yet. Returns grounded cuts you can reference when writing clipper_notes. Cuts with clip_type "pop-culture" or "irl" are strong candidates for source-external treatment (editor sources the clip rather than clipper filming). Each returned cut includes a signed_video_url so you can cite the specific timestamp in the Mogswamp short.`,
  {
    script_line: z.string().describe('The narration fragment you plan to put in this scene'),
    short_context: z.string().optional().describe('1-2 sentences of surrounding context (the short\u2019s topic / what scenes come before and after). Improves retrieval relevance.'),
    k: z.number().optional().describe('How many suggestions to return. Default 3, max 10.'),
    channel: z.string().optional().describe('Optional filter: e.g. "Mogswamp". Omit to search all indexed channels.'),
  },
  async ({ script_line, short_context, k, channel }) => {
    const finalK = k ?? 3;
    const candidates = await queryCutsByText(script_line, short_context || '', finalK, channel);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ candidates }, null, 2) }],
    };
  }
);

function formatMs(ms: number): string {
  const totalS = Math.floor(ms / 1000);
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Video Pipeline MCP server running on stdio');
}

main().catch(console.error);
