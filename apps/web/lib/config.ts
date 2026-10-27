// Publishable keys identify the application; row access is enforced by Supabase RLS.
export const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uqlaropgcluedhctzcao.supabase.co',
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_-xqElLWfHPZ_IVMY1yXJkw_H6-2ktYG',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
};
