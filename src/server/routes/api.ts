/**
 * API Routing Definitions.
 * Sets up API endpoints and mounts them to controllers.
 */

import { Router } from "express";
import { diagnosticsController } from "../controllers/diagnosticsController.js";
import { telegramController } from "../controllers/telegramController.js";
import { telegramService } from "../services/telegramService.js";

export const apiRouter = Router();

// Mount diagnostics endpoint
apiRouter.get("/diagnostics", diagnosticsController.getSystemDiagnostics);

// Mount architecture metadata endpoint
apiRouter.get("/architecture", diagnosticsController.getArchitectureMetadata);

// Mount Telegram Bot Webhook endpoint
apiRouter.post("/telegram/webhook", telegramController.handleWebhook);

// Protected admin endpoint to manually or deploy-time register the Telegram Webhook
apiRouter.post("/telegram/register", async (req, res, next) => {
  const token = req.headers["x-telegram-token"] || req.query.token;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    res.status(500).json({ error: "Server misconfigured: TELEGRAM_BOT_TOKEN is not defined in the environment." });
    return;
  }

  if (!token || token !== botToken) {
    res.status(401).json({ error: "Unauthorized. Missing or invalid Telegram Token." });
    return;
  }
  
  try {
    const success = await telegramService.registerWebhook();
    if (success) {
      res.json({ success: true, message: "Webhook successfully registered with Telegram." });
    } else {
      res.status(500).json({ success: false, message: "Failed to register webhook with Telegram. Check logs." });
    }
  } catch (err: any) {
    next(err);
  }
});

