/**
 * API Routing Definitions.
 * Sets up API endpoints and mounts them to controllers.
 */

import { Router } from "express";
import { diagnosticsController } from "../controllers/diagnosticsController.js";
import { telegramController } from "../controllers/telegramController.js";

export const apiRouter = Router();

// Mount diagnostics endpoint
apiRouter.get("/diagnostics", diagnosticsController.getSystemDiagnostics);

// Mount architecture metadata endpoint
apiRouter.get("/architecture", diagnosticsController.getArchitectureMetadata);

// Mount Telegram Bot Webhook endpoint
apiRouter.post("/telegram/webhook", telegramController.handleWebhook);

