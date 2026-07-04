/**
 * StudyIG CTO - Telegram Bot Service (Phase 1 Refactored)
 *
 * Bridged to use the new modular TelegramService implementation.
 */

import { telegramService } from "./telegramService.js";

export function isTelegramAvailable(): boolean {
  return telegramService.isConfigured();
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  return telegramService.sendMessage(chatId, text);
}

