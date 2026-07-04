/**
 * Central Express Application Setup.
 * Compiles all middlewares, routing tables, and static asset fallback pipelines.
 */

import express from "express";
import path from "path";
import { apiRouter } from "./routes/api.js";
import { requestLogger } from "./middleware/loggerMiddleware.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./lib/logger.js";

export async function createApp() {
  const app = express();

  // 1. Centralized Request Logging Middleware
  app.use(requestLogger);

  // 2. Global JSON Body Parsing Middleware
  app.use(express.json());

  // 3. Mount Backend API Routing Modules
  app.use("/api", apiRouter);

  // 4. Vite Bundler Setup for HMR / Production static serving
  if (process.env.NODE_ENV !== "production") {
    logger.info("Initializing Vite bundler in DEVELOPMENT middleware mode...");
    
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    logger.info("Initializing static file delivery pipeline for PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");

    // Serve compile-time static assets directly
    app.use(express.static(distPath));

    // Fallback all SPA paths to index.html
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // 5. Centralized Global Exception / Error Interceptor
  app.use(errorHandler);

  return app;
}
