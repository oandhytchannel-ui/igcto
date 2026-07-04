/**
 * API Routing Definitions.
 * Sets up API endpoints and mounts them to controllers.
 */

import { Router } from "express";
import { diagnosticsController } from "../controllers/diagnosticsController.js";
import { telegramController } from "../controllers/telegramController.js";
import { telegramService } from "../services/telegramService.js";
import { config } from "../config.js";

export const apiRouter = Router();

// Mount diagnostics endpoint
apiRouter.get("/diagnostics", diagnosticsController.getSystemDiagnostics);

// Mount architecture metadata endpoint
apiRouter.get("/architecture", diagnosticsController.getArchitectureMetadata);

// Mount Telegram Bot Webhook endpoint
apiRouter.post("/telegram/webhook", telegramController.handleWebhook);

// Protected admin endpoint to manually register the Telegram Webhook
apiRouter.post("/admin/register-webhook", async (req, res, next) => {
  const adminSecret = process.env.ADMIN_SECRET;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    res.status(500).json({ error: "Server misconfigured: TELEGRAM_BOT_TOKEN is not defined in the environment." });
    return;
  }

  if (!adminSecret) {
    res.status(500).json({ error: "Server misconfigured: ADMIN_SECRET is not defined in the environment." });
    return;
  }

  // Retrieve the secret securely from headers or request body, avoiding query parameters
  const requestSecret = req.headers["x-admin-secret"] || (req.body && req.body.adminSecret);

  if (!requestSecret || requestSecret !== adminSecret) {
    res.status(401).json({ error: "Unauthorized. Missing or invalid ADMIN_SECRET." });
    return;
  }
  
  try {
    const success = await telegramService.registerWebhook();
    
    // Resolve the targeting webhook URL for transparency
    const normalizedBase = config.appUrl.endsWith("/") ? config.appUrl.slice(0, -1) : config.appUrl;
    const webhookUrl = `${normalizedBase}/api/telegram/webhook`;

    if (success) {
      res.json({ 
        success: true, 
        message: "Webhook successfully registered with Telegram.", 
        targetUrl: webhookUrl 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: "Failed to register webhook with Telegram. Check logs and ensure APP_URL / VERCEL_URL is valid.",
        targetUrl: webhookUrl
      });
    }
  } catch (err: any) {
    next(err);
  }
});

