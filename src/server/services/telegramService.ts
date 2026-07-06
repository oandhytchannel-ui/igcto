/**
 * StudyIG CTO - Telegram Bot Integration Service
 * 
 * Manages message dispatch and registers webhook integrations with
 * the official Telegram API.
 */

import { logger } from "../lib/logger.js";
import { config } from "../config.js";

/**
 * Splits a long text into multiple chunks safely under the limit.
 * Keeps lines together and handles code blocks across chunks.
 */
function splitMessage(text: string, limit = 3500): string[] {
  if (text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  const lines = text.split("\n");
  let currentChunk: string[] = [];
  let currentLength = 0;
  let inCodeBlock = false;
  let codeBlockLanguage = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isCodeBlockDelimiter = line.trim().startsWith("```");
    const lineLengthWithNewline = line.length + (currentChunk.length > 0 ? 1 : 0);

    if (currentLength + lineLengthWithNewline > limit) {
      if (currentChunk.length > 0) {
        if (inCodeBlock) {
          currentChunk.push("```");
        }
        chunks.push(currentChunk.join("\n"));
        currentChunk = [];
        currentLength = 0;

        if (inCodeBlock) {
          currentChunk.push("```" + codeBlockLanguage);
          currentLength = currentChunk[0].length;
        }
      } else {
        // Force split extremely long line
        let remainingLine = line;
        while (remainingLine.length > 0) {
          const sliceLen = Math.min(remainingLine.length, limit - (inCodeBlock ? 10 : 0));
          const slice = remainingLine.slice(0, sliceLen);
          remainingLine = remainingLine.slice(sliceLen);

          if (inCodeBlock) {
            chunks.push("```" + codeBlockLanguage + "\n" + slice + "\n```");
          } else {
            chunks.push(slice);
          }
        }
        continue;
      }
    }

    if (isCodeBlockDelimiter) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) {
        codeBlockLanguage = line.trim().slice(3).trim();
      } else {
        codeBlockLanguage = "";
      }
    }

    currentChunk.push(line);
    currentLength += lineLengthWithNewline;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n"));
  }

  return chunks;
}

/**
 * Safely cleans and escapes markdown characters outside of code blocks.
 * Prevents Telegram parse failures due to unclosed symbols or snake_case underscores.
 */
function cleanMarkdown(text: string): string {
  // Split by code blocks first to protect them
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    // If it's a code block, keep as is
    if (index % 2 === 1) {
      return part;
    }

    // Split by inline code to protect them
    const subParts = part.split(/(`[^`\n]+`)/g);
    return subParts.map((subPart, subIndex) => {
      // If it's inline code, keep as is
      if (subIndex % 2 === 1) {
        return subPart;
      }

      let cleaned = subPart;

      // Escape underscores that are surrounded by word characters (snake_case)
      cleaned = cleaned.replace(/(\w)_(\w)/g, "$1\\_$2");

      const protectedBlocks: string[] = [];
      const placeholder = (t: string) => {
        protectedBlocks.push(t);
        return `\x00${protectedBlocks.length - 1}\x00`;
      };

      // Protect markdown links
      cleaned = cleaned.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (match) => placeholder(match));

      // Protect bold formatting
      cleaned = cleaned.replace(/\*\*([^\*\s][^\*]*?[^\*\s]|[^\*\s])\*\*/g, (match) => placeholder(match));

      // Protect italic formatting
      cleaned = cleaned.replace(/_([^_ \t\r\n][^_]*?[^_ \t\r\n]|[^_ \t\r\n])_/g, (match) => placeholder(match));

      // Escape remaining loose special markdown chars
      cleaned = cleaned.replace(/[*_\[\]]/g, "\\$&");

      // Restore protected formatting
      cleaned = cleaned.replace(/\x00(\d+)\x00/g, (_, id) => protectedBlocks[parseInt(id, 10)]);

      return cleaned;
    }).join("");
  }).join("");
}

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
   * Splits long responses, cleans and escapes markdown,
   * and employs a fallback retry without "parse_mode" in case formatting fails.
   */
  async sendMessage(chatId: string | number, text: string): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      logger.warn("Cannot send Telegram message: TELEGRAM_BOT_TOKEN is not defined.");
      return false;
    }

    // Centrally translate and replace raw exceptions/error messages to hide them from Telegram users
    let sanitizedText = text;
    if (text.includes("Request Entity Too Large") || text.includes("too large")) {
      sanitizedText = "The report was too large to send in one message. I've automatically split it into multiple parts.";
    } else if (text.includes("PGRST106") || text.includes("PGRST")) {
      sanitizedText = "I couldn't access the project database because of a configuration issue. Please check the database configuration and try again.";
    } else if (text.includes("503 UNAVAILABLE") || text.includes("503") || text.includes("UNAVAILABLE") || text.includes("experienced unusually high demand")) {
      sanitizedText = "Gemini is currently experiencing high demand. I'll automatically retry a few times before asking you to try again later.";
    }

    try {
      const chunks = splitMessage(sanitizedText);
      logger.info(`[Telegram Send Log] Dispatching message to Chat ${chatId}. Total Chunks: ${chunks.length}`);

      let allSucceeded = true;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const cleanedChunk = cleanMarkdown(chunk);

        logger.info(`[Telegram Send Log] Dispatching chunk ${i + 1}/${chunks.length} using Markdown parsing...`);
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId.toString(),
            text: cleanedChunk,
            parse_mode: "Markdown"
          })
        });

        if (response.ok) {
          continue;
        }

        const errorDetail = await response.text();
        logger.warn(`[Telegram Delivery Warning] Markdown parse failed for chunk ${i + 1}/${chunks.length} (${response.status}). Retrying with plain text fallback... Error detail: ${errorDetail}`);

        const retryResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId.toString(),
            text: chunk
          })
        });

        if (!retryResponse.ok) {
          allSucceeded = false;
          const finalErrorDetail = await retryResponse.text();
          logger.error(`[Telegram Delivery Failure] Failed to deliver chunk ${i + 1}/${chunks.length} to Chat ${chatId} even with plain text fallback. Error detail: ${finalErrorDetail}`);
        } else {
          logger.info(`[Telegram Send Log] Chunk ${i + 1}/${chunks.length} delivered successfully via plain text fallback.`);
        }
      }

      return allSucceeded;
    } catch (error: any) {
      logger.error(`[Telegram Delivery Failure] Unexpected error in telegram communication for Chat ${chatId}:`, error.message || error);
      return false;
    }
  }
}

export const telegramService = new TelegramService();
