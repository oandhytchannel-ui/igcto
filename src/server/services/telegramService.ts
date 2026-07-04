/**
 * StudyIG CTO - Telegram Bot Integration Service
 * 
 * Manages message dispatch and registers webhook integrations with
 * the official Telegram API.
 */

import { logger } from "../lib/logger.js";
import { config } from "../config.js";

export class TelegramService {
  isConfigured(): boolean {
    return !!process.env.TELEGRAM_BOT_TOKEN;
  }

  /**
   * Registers the webhook URL with Telegram.
   */
  async registerWebhook(): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      logger.warn("Cannot register Telegram webhook: TELEGRAM_BOT_TOKEN is not configured.");
      return false;
    }

    const appUrl = config.appUrl;
    if (!appUrl || appUrl.includes("localhost") || appUrl.includes("127.0.0.1") || appUrl.includes("0.0.0.0")) {
      logger.info(`Skipping automatic webhook registration because APP_URL (${appUrl}) is a local loopback address.`);
      return false;
    }

    // Clean any trailing slash from appUrl
    const normalizedBase = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
    const webhookUrl = `${normalizedBase}/api/telegram/webhook`;

    try {
      logger.info(`Registering Telegram Webhook targeting: ${webhookUrl}`);
      const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl })
      });

      const result = await response.json() as any;
      if (result.ok) {
        logger.info(`Telegram Webhook successfully configured: ${result.description}`);
        return true;
      } else {
        logger.warn(`Telegram Webhook registration rejected: ${result.description}`);
        return false;
      }
    } catch (error: any) {
      logger.error("Failed to register Telegram Webhook:", error.message || error);
      return false;
    }
  }

  /**
   * Sends a message to a specific Telegram chat.
   * Employs a fallback retry without "parse_mode" in case custom formatting fails to render.
   */
  async sendMessage(chatId: string | number, text: string): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      logger.warn("Cannot send Telegram message: TELEGRAM_BOT_TOKEN is not defined.");
      return false;
    }

    try {
      logger.info(`Sending Telegram message to Chat ${chatId} (Attempt 1: Markdown)...`);
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId.toString(),
          text,
          parse_mode: "Markdown"
        })
      });

      if (response.ok) {
        return true;
      }

      // If Markdown formatting fails (often due to mismatched asterisks/backticks), fallback to plain text
      const errorDetail = await response.text();
      logger.warn(`Telegram Markdown delivery rejected (${response.status}). Retrying as plain text... Response: ${errorDetail}`);

      const retryResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId.toString(),
          text
        })
      });

      return retryResponse.ok;
    } catch (error: any) {
      logger.error(`Error communicating with Telegram Bot API for Chat ${chatId}:`, error.message || error);
      return false;
    }
  }
}

export const telegramService = new TelegramService();
