/**
 * Google Gemini Provider Implementation.
 * Implements the standard AIProvider interface using the official @google/genai SDK.
 */

import { GoogleGenAI } from "@google/genai";
import { AIProvider, AIModelOptions } from "../lib/aiProvider.js";
import { logger } from "../lib/logger.js";

export class GeminiProvider implements AIProvider {
  private aiClient: GoogleGenAI | null = null;
  private defaultModel = "gemini-2.5-flash"; // Standard recommended fast model

  private getClient(): GoogleGenAI {
    if (!this.aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY environment variable is not defined. Please add it to your secrets or environment configuration."
        );
      }
      this.aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return this.aiClient;
  }

  getProviderMetadata() {
    return {
      providerName: "Google Cloud Gemini",
      modelName: this.defaultModel,
    };
  }

  async generateText(prompt: string, options?: AIModelOptions): Promise<string> {
    try {
      return await withGeminiRetry(async () => {
        logger.info(`Sending prompt request to Gemini (${this.defaultModel})...`);
        const client = this.getClient();
        
        const response = await client.models.generateContent({
          model: this.defaultModel,
          contents: prompt,
          config: {
            temperature: options?.temperature ?? 0.2,
            maxOutputTokens: options?.maxOutputTokens,
          },
        });

        if (!response.text) {
          throw new Error("Received empty text response from Gemini API.");
        }

        return response.text;
      });
    } catch (error: any) {
      logger.error("Gemini text generation failed completely after retries:", error.message || error);
      return "Gemini is currently experiencing unusually high demand. I couldn't finish this analysis right now. Please try again in a few minutes.";
    }
  }

  async generateStructuredJSON<T>(prompt: string, options?: AIModelOptions): Promise<T> {
    try {
      return await withGeminiRetry(async () => {
        logger.info(`Sending structured JSON request to Gemini (${this.defaultModel})...`);
        const client = this.getClient();

        const response = await client.models.generateContent({
          model: this.defaultModel,
          contents: prompt,
          config: {
            temperature: options?.temperature ?? 0.1,
            responseMimeType: "application/json",
            maxOutputTokens: options?.maxOutputTokens,
          },
        });

        if (!response.text) {
          throw new Error("Received empty JSON response from Gemini API.");
        }

        return JSON.parse(response.text) as T;
      });
    } catch (error: any) {
      logger.error("Gemini structured generation failed completely after retries:", error.message || error);
      throw new Error("Gemini is currently experiencing unusually high demand. I couldn't finish this analysis right now. Please try again in a few minutes.");
    }
  }
}

async function withGeminiRetry<T>(
  operation: () => Promise<T>
): Promise<T> {
  const maxAttempts = 4;
  const backoffDelays = [0, 2000, 5000, 10000]; // in ms

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const delay = backoffDelays[attempt - 1];
    if (delay > 0) {
      logger.info(`[Gemini Retry Log] Transient error encountered. Waiting ${delay}ms before attempt ${attempt}/${maxAttempts}...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const startTime = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      logger.info(`[Gemini Success Log] Attempt ${attempt}/${maxAttempts} completed successfully. responseTime: ${duration}ms`);
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const status = error.status || error.statusCode || error.code || "";
      const msg = error.message || "";
      logger.warn(`[Gemini Failure Log] Attempt ${attempt}/${maxAttempts} failed in ${duration}ms. Status: ${status}. Error: ${msg}`);

      const transient = isTransientError(error);
      if (attempt === maxAttempts || !transient) {
        if (!transient) {
          logger.error(`[Gemini Error Log] Non-transient error detected. Aborting retries. Error: ${msg}`);
        } else {
          logger.error(`[Gemini Error Log] All retry attempts exhausted. Error: ${msg}`);
        }
        throw error;
      }
    }
  }

  throw new Error("Gemini operation failed after max retries.");
}

function isTransientError(error: any): boolean {
  const status = Number(error?.status || error?.statusCode || error?.code || 0);
  if ([429, 500, 502, 503, 504].includes(status)) {
    return true;
  }
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("429") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("rate limit") ||
    message.includes("limit exceeded") ||
    message.includes("resource_exhausted") ||
    message.includes("unavailable") ||
    message.includes("bad gateway") ||
    message.includes("gateway timeout") ||
    message.includes("internal server error") ||
    message.includes("overloaded")
  );
}

// Single active instance of our default AI provider
export const geminiProvider = new GeminiProvider();
