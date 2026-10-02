import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PUBLIC_BASE_URL: z.url().default('http://localhost:3000'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('127.0.0.1'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ENCRYPTION_KEY: z.string().regex(/^[a-f0-9]{64}$/i),
  STORAGE_ROOT: z.string().default('./data/media'),
  ENABLE_DEMO: z.enum(['true', 'false']).default('true'),
  ALLOW_UNSCANNED_FILES: z.enum(['true', 'false']).default('false'),
  CLAMSCAN_PATH: z.string().optional(),
});
export const config = schema.parse(process.env);
if (config.NODE_ENV === 'production' && !config.PUBLIC_BASE_URL.startsWith('https://'))
  throw new Error('Production requires HTTPS PUBLIC_BASE_URL');
