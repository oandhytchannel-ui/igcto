/**
 * StudyIG CTO - Environment & Configuration Manager (Phase 1)
 *
 * This module safely parses and validates the required environment variables
 * for the StudyIG CTO assistant, providing fallback values or warning states.
 */

import dotenv from "dotenv";

// Load local environment variables (if in development)
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  hasGeminiKey: boolean;
  hasSupabaseUrl: boolean;
  hasSupabaseKey: boolean;
  supabaseSchema: string;
  hasTelegramToken: boolean;
  hasGithubToken: boolean;
  appUrl: string;
  hasStudyigSupabaseUrl: boolean;
  hasStudyigSupabaseKey: boolean;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  hasGeminiKey: !!process.env.GEMINI_API_KEY,
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseSchema: process.env.SUPABASE_SCHEMA || "studyig_cto",
  hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
  hasGithubToken: !!process.env.GITHUB_TOKEN,
  appUrl: process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  hasStudyigSupabaseUrl: !!process.env.STUDYIG_SUPABASE_URL,
  hasStudyigSupabaseKey: !!process.env.STUDYIG_SUPABASE_SERVICE_ROLE_KEY,
};

/**
 * Returns a secure report of environment configurations.
 * Avoids leaking raw secret values to the client interface while confirming their presence.
 */
export function getDiagnosticsReport() {
  return {
    status: "online",
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    services: {
      gemini: {
        status: config.hasGeminiKey ? "configured" : "missing",
        description: "Google Gemini 3.5 AI Integration (Required for planning)",
      },
      supabase: {
        status: (config.hasSupabaseUrl && config.hasSupabaseKey) ? "configured" : "missing",
        description: "Supabase Persistent Memory Database (Required for project memory)",
      },
      telegram: {
        status: config.hasTelegramToken ? "configured" : "missing",
        description: "Telegram Bot API Connector (Required for chat-based interface)",
      },
      github: {
        status: config.hasGithubToken ? "configured" : "missing",
        description: "GitHub API Authenticator (Required for reading repositories)",
      },
      studyigSupabase: {
        status: (config.hasStudyigSupabaseUrl && config.hasStudyigSupabaseKey) ? "configured" : "missing",
        description: "StudyIG Production Database Client (Required for DB Inspection)",
      },
    },
    appUrl: config.appUrl,
  };
}
