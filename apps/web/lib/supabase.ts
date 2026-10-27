import { createClient } from '@supabase/supabase-js';
import { config } from './config';
export const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
