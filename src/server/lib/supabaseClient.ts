/**
 * Supabase Client Loader.
 * Uses lazy-initialization to ensure the server starts up even if
 * environment variables are missing, throwing a clear error on first use.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger.js";
import { config } from "../config.js";

let supabaseInstance: SupabaseClient<any, any> | null = null;

function wrapQueryBuilder(qb: any, relation: string): any {
  return new Proxy(qb, {
    get(target, prop, receiver) {
      if (prop === "then") {
        const originalThen = target.then;
        return function(onfulfilled?: any, onrejected?: any) {
          const queryStart = Date.now();
          return originalThen.call(target,
            (value: any) => {
              const duration = Date.now() - queryStart;
              logger.info(`[Supabase Query Log] table: "${relation}" | status: SUCCESS | duration: ${duration}ms`);
              if (onfulfilled) return onfulfilled(value);
              return value;
            },
            (reason: any) => {
              const duration = Date.now() - queryStart;
              logger.error(`[Supabase Query Log] table: "${relation}" | status: FAILED | duration: ${duration}ms | error: ${reason?.message || reason}`);
              if (onrejected) return onrejected(reason);
              throw reason;
            }
          );
        };
      }
      
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return function(...args: any[]) {
          const result = value.apply(target, args);
          if (result && typeof result === "object" && typeof result.then === "function") {
            return wrapQueryBuilder(result, relation);
          }
          return result;
        };
      }
      return value;
    }
  });
}

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
    
    const client = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: config.supabaseSchema,
      },
      auth: {
        persistSession: false, // For backend server usage
      },
    });

    supabaseInstance = new Proxy(client, {
      get(target, prop, receiver) {
        if (prop === "from") {
          return function(relation: string) {
            const queryBuilder = (client as any).from(relation);
            return wrapQueryBuilder(queryBuilder, relation);
          };
        }
        return Reflect.get(target, prop, receiver);
      }
    });
  }
  
  return supabaseInstance;
}

export function isSupabaseConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}
