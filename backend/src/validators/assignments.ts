import { z } from 'zod';

export const createAssignmentSchema = z.object({
  short_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  role: z.enum(['script_writer', 'clipper', 'editor']),
  due_date: z.string().datetime().optional(),
  default_time_range: z.number().int().positive().max(8760), // Max 1 year in hours
  rate: z.number().nonnegative().optional(),
  rate_description: z.string().max(500).optional(),
});

export const updateAssignmentSchema = z.object({
  due_date: z.string().datetime().optional(),
  default_time_range: z.number().int().positive().max(8760).optional(),
  rate: z.number().nonnegative().optional(),
  rate_description: z.string().max(500).optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

