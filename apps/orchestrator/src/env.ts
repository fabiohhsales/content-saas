import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3002),
  SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  INTERNAL_SECRET: z.string().min(1),
  AI_PROVIDER: z.enum(['mock', 'openai', 'anthropic']).default('mock'),
});

export function getEnv() {
  const parsed = EnvSchema.parse(process.env);
  return {
    ...parsed,
    SUPABASE_URL: parsed.SUPABASE_URL ?? parsed.NEXT_PUBLIC_SUPABASE_URL,
  };
}
