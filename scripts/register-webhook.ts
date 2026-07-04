import dotenv from "dotenv";
dotenv.config();

import { telegramService } from "../src/server/services/telegramService.js";
import { logger } from "../src/server/lib/logger.js";

async function run() {
  logger.info("Starting manual Telegram Webhook registration...");
  
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    logger.error("TELEGRAM_BOT_TOKEN is missing in environment variables.");
    process.exit(1);
  }

  const success = await telegramService.registerWebhook();
  if (success) {
    logger.info("Telegram Webhook registered successfully!");
    process.exit(0);
  } else {
    logger.error("Failed to register Telegram Webhook.");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Fatal error running webhook registration script:", err);
  process.exit(1);
});
