/**
 * Supabase Client Loader.
 * Uses lazy-initialization to ensure the server starts up even if
 * environment variables are missing, throwing a clear error on first use.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger.js";
import { config } from "../config.js";

let supabaseInstance: SupabaseClient<any, any> | null = null;

export function getSupabaseClient(): SupabaseClient<any, any> {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        "Supabase credentials are not fully configured. Please define SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }

    logger.info(`Initializing Supabase Client using Service Role Key (RLS bypass enabled) targeting schema "${config.supabaseSchema}"...`);
    
    supabaseInstance = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: config.supabaseSchema,
      },
      auth: {
        persistSession: false, // For backend server usage
      },
    });
  }
  
  return supabaseInstance;
}

export function isSupabaseConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}
