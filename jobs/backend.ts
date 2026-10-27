import {createClient} from '@supabase/supabase-js';
export function backend(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw Error('BACKEND_CONFIGURATION_REQUIRED');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
export function check(error:unknown){if(error)throw Error('DATABASE_OPERATION_FAILED');}
