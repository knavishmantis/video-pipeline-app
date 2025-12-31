import { z } from 'zod';

export const createShortSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  idea: z.string().max(5000, 'Idea must be less than 5000 characters').optional(),
});

export const updateShortSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  idea: z.string().max(5000).optional(),
  script_content: z.string().max(50000).optional(),
  status: z.enum(['idea', 'script', 'clipping', 'clips', 'clip_changes', 'editing', 'editing_changes', 'completed', 'ready_to_upload', 'uploaded']).optional(),
  script_writer_id: z.number().int().positive().nullable().optional(),
});

export type CreateShortInput = z.infer<typeof createShortSchema>;
export type UpdateShortInput = z.infer<typeof updateShortSchema>;

