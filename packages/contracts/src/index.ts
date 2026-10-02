import { z } from 'zod';
export const loginSchema = z.object({
  email: z.email().max(190),
  password: z.string().min(1).max(200),
});
export const userSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email().max(190),
  password: z.string().min(12).max(200),
  role: z.enum(['admin', 'supervisor', 'agent']),
});
export const accountSchema = z.object({
  name: z.string().min(1).max(100),
  mode: z.enum(['demo', 'meta']),
  phoneNumberId: z
    .string()
    .regex(/^\d{4,80}$/)
    .optional(),
  wabaId: z
    .string()
    .regex(/^\d{4,80}$/)
    .optional(),
  graphVersion: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .optional(),
  accessToken: z.string().min(20).max(5000).optional(),
  appSecret: z.string().min(16).max(200).optional(),
  verifyToken: z.string().min(24).max(200).optional(),
});
export const conversationSchema = z.object({
  name: z.string().min(1).max(100),
  waId: z.string().regex(/^\d{6,20}$/),
  accountId: z.string().uuid(),
});
export const transferSchema = z.object({
  userId: z.string().uuid(),
  mode: z.enum(['full', 'future', 'from', 'last']),
  fromSequence: z.number().int().positive().optional(),
  count: z.number().int().min(1).max(100).optional(),
  includeNotes: z.boolean().default(false),
  summary: z.string().max(4000).default(''),
  reason: z.string().max(500).default(''),
  version: z.number().int().positive(),
});
export const messageSchema = z.object({
  body: z.string().min(1).max(4096),
  direction: z.enum(['outgoing', 'note', 'incoming']).default('outgoing'),
  fileId: z.string().uuid().optional(),
  template: z
    .object({
      name: z.string().regex(/^[a-z0-9_]+$/),
      language: z.string().regex(/^[a-z]{2}(?:_[A-Z]{2})?$/),
    })
    .optional(),
});
