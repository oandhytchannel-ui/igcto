import { createApp } from "../src/server/app.js";

let app: any = null;
let initializationError: any = null;

async function getApp() {
  if (app) return app;
  if (initializationError) throw initializationError;

  try {
    console.log("[Vercel Startup] Initializing Express app via createApp()...");
    app = await createApp();
    console.log("[Vercel Startup] Express app initialized successfully.");
    return app;
  } catch (err: any) {
    console.error("[Vercel Startup Error] Failed to initialize Express application:", err);
    initializationError = err;
    throw err;
  }
}

// Export the Vercel serverless handler
export default async function handler(req: any, res: any) {
  try {
    const activeApp = await getApp();
    return activeApp(req, res);
  } catch (err: any) {
    console.error("[Vercel Request Error] Handled startup error on request:", err);
    res.status(500).json({
      success: false,
      error: "Vercel Serverless Function Startup Failure",
      message: err.message || String(err),
      stack: err.stack || "No stack trace available",
    });
  }
}
