import { createClient } from '@supabase/supabase-js';

// Public client for reading approved entries and submitting new entries
export const getSupabaseClient = () => {
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

// Admin client with service role for full access (approve/reject/delete)
export const getSupabaseAdminClient = () => {
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase admin environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export type GuestbookEntry = {
  id?: number;
  record: number;
  name: string;
  website: string;
  referred_by: string;
  from_location: string;
  comments: string; // TODO: Encrypt this field when private_message is true
  private_message: boolean;
  flagged: boolean;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
  updated_at?: string;
};

export type GuestbookConfig = {
  id: number;
  max_links: number;
  max_comment_length: number;
  max_field_length: number;
  banned_terms: string[];
  require_moderation: boolean;
  updated_at?: string;
};
