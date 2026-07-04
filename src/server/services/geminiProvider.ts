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
    } catch (error: any) {
      logger.error("Gemini text generation failed:", error.message || error);
      throw error;
    }
  }

  async generateStructuredJSON<T>(prompt: string, options?: AIModelOptions): Promise<T> {
    try {
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
    } catch (error: any) {
      logger.error("Gemini structured generation failed:", error.message || error);
      throw error;
    }
  }
}

// Single active instance of our default AI provider
export const geminiProvider = new GeminiProvider();
