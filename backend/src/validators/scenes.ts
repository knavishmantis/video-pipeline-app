import { z } from 'zod';

export const createSceneSchema = z.object({
  script_line: z.string().max(10000),
  direction: z.string().max(10000).optional().default(''),
  clipper_notes: z.string().max(10000).nullable().optional(),
  editor_notes: z.string().max(10000).nullable().optional(),
  scene_order: z.number().int().min(0).optional(),
});

export const updateSceneSchema = z.object({
  script_line: z.string().max(10000).optional(),
  direction: z.string().max(10000).optional(),
  clipper_notes: z.string().max(10000).nullable().optional(),
  editor_notes: z.string().max(10000).nullable().optional(),
  scene_order: z.number().int().min(0).optional(),
  image_url: z.string().max(1000).nullable().optional(),
});

export const bulkCreateScenesSchema = z.object({
  scenes: z.array(z.object({
    script_line: z.string().max(10000),
    direction: z.string().max(10000).optional().default(''),
    clipper_notes: z.string().max(10000).nullable().optional(),
    editor_notes: z.string().max(10000).nullable().optional(),
    scene_order: z.number().int().min(0).optional(),
  })).min(1).max(200),
});

export const reorderScenesSchema = z.object({
  scene_ids: z.array(z.number().int().positive()).min(1).max(200),
});
