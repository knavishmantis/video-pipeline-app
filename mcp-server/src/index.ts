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

server.tool(
  'suggest_similar_cuts',
  `Retrieve grounded reference cuts from our Mogswamp (or other competitor) cut library for one or more scenes of a short.
Every suggestion is anchored to a REAL indexed cut (cut_id + timestamp + video). The technique/composition is from the real cut; the subject can be adapted (adaptation_notes returns explicit swaps like "chicken → dolphin"). Use this BEFORE writing clipper_notes from scratch — prefer adapting a real precedent to inventing a shot.`,
  {
    short_id: z.number().describe('The short whose scenes we want suggestions for'),
    scene_orders: z.array(z.number()).optional().describe('Optional subset of scene_order values (0-indexed). Omit to run for every scene.'),
    k: z.number().optional().describe('How many suggestions per scene. Default 5, max 10.'),
    channel: z.string().optional().describe('Optional filter: e.g. "Mogswamp". Omit to search all indexed channels.'),
  },
  async ({ short_id, scene_orders, k, channel }) => {
    const scenes: any[] = await apiRequest('GET', `/shorts/${short_id}/scenes`);
    const target = Array.isArray(scene_orders) && scene_orders.length > 0
      ? scenes.filter(s => scene_orders.includes(s.scene_order))
      : scenes;

    const results = await Promise.all(target.map(async (scene) => {
      try {
        const r = await apiRequest('POST', `/shorts/${short_id}/scenes/${scene.id}/similar-cuts`, {
          k: k ?? 5,
          channel,
        });
        return {
          scene_order: scene.scene_order,
          scene_id: scene.id,
          script_line: scene.script_line,
          candidates: r.suggestions.map((s: any) => ({
            cut_id: s.cut_id,
            channel: s.channel,
            youtube_video_id: s.youtube_video_id,
            video_title: s.video_title,
            timestamp: `${formatMs(s.start_ms)}-${formatMs(s.end_ms)}`,
            clip_type: s.clip_type,
            pov: s.pov,
            editing_effects: s.editing_effects,
            visual_description: s.visual_description,
            transcript_segment: s.transcript_segment,
            why_it_fits: s.why_it_fits,
            adaptation_notes: s.adaptation_notes,
            signed_video_url: s.signed_video_url,
          })),
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
