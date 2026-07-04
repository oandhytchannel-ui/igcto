/**
 * StudyIG CTO - Main Full-Stack Server Entry Point
 *
 * Boots up the modular Express configuration built in app.ts,
 * listening on the assigned container interface.
 */

import { config } from "./src/server/config.js";
import { createApp } from "./src/server/app.js";
import { logger } from "./src/server/lib/logger.js";
import { telegramService } from "./src/server/services/telegramService.js";

async function startServer() {
  const app = await createApp();
  const HOST = "0.0.0.0";

  app.listen(config.port, HOST, async () => {
    logger.info(`====================================================`);
    logger.info(`🤖 StudyIG CTO server initialized successfully!`);
    logger.info(`📡 Access URI: http://localhost:${config.port}`);
    logger.info(`🌍 Running Mode: ${config.nodeEnv}`);
    logger.info(`📝 Note: Telegram Webhook registration is moved to the /api/telegram/register endpoint or npm run register-webhook script.`);
    logger.info(`====================================================`);
  });
}

// Handle unhandled promise rejections gracefully
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection detected:", { promise, reason });
});

startServer().catch((error) => {
  logger.error("Critical server crash occurred during bootstrap sequence:", error);
});
