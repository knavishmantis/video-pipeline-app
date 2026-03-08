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
  },
  async ({ short_id, script_line, direction }) => {
    const scene = await apiRequest('POST', `/shorts/${short_id}/scenes`, { script_line, direction });
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
  'Replace all scenes for a short at once. Deletes existing scenes and creates new ones. This is the main tool for generating an editing script from a main script.',
  {
    short_id: z.number().describe('The ID of the short'),
    scenes: z.array(z.object({
      script_line: z.string().describe('The narration text for this scene'),
      direction: z.string().optional().describe('Editing/visual direction'),
    })).describe('Array of scenes in order. Each scene has a script_line (narration) and direction (what to show).'),
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

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Video Pipeline MCP server running on stdio');
}

main().catch(console.error);
