import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function readEnv(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().replace(/^["']|["']$/g, '').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const supabaseUrl = readEnv(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

/**
 * Null-safe Supabase client. When the environment variables are absent the
 * client is `null`, so guest/offline mode keeps working with zero crashes.
 */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseConfigured = supabase !== null;
