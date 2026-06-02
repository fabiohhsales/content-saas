import { createServiceSupabaseClient } from '@content-saas/supabase';
import { getEnv } from './env.js';

const env = getEnv();

if (!env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required');
}

export const supabase = createServiceSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
