import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

function isValidHttpUrl(value: string): boolean {
  if (!value || value.includes('YOUR_PROJECT_REF')) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function createSafeSupabaseClient(): SupabaseClient<Database> | null {
  if (
    !isValidHttpUrl(supabaseUrl) ||
    !supabaseAnonKey ||
    supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY')
  ) {
    return null;
  }

  try {
    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    return null;
  }
}

export const supabase: SupabaseClient<Database> | null =
  createSafeSupabaseClient();
export const isSupabaseConfigured = supabase !== null;
