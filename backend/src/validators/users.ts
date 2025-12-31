import { z } from 'zod';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  discord_username: z.string().max(100).optional(),
  roles: z.array(z.enum(['admin', 'script_writer', 'clipper', 'editor'])).min(1, 'At least one role is required'),
  paypal_email: z.string().email().max(255).optional(),
  profile_picture: z.string().max(500).optional(),
  timezone: z.string().max(100).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  discord_username: z.string().max(100).optional(),
  roles: z.array(z.enum(['admin', 'script_writer', 'clipper', 'editor'])).optional(),
  paypal_email: z.string().email().max(255).optional(),
  profile_picture: z.string().max(500).optional(),
  timezone: z.string().max(100).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

