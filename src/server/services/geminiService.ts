/**
 * StudyIG CTO - Centralized Gemini AI Service
 * 
 * Formulates structured prompts, manages system instructions, and routes
 * requests to the abstracted AI provider interface.
 */

import { geminiProvider } from "./geminiProvider.js";
import { AssistantMemory } from "../repositories/projectRepository.js";
import { logger } from "../lib/logger.js";

export class GeminiService {
  private systemInstruction = `You are StudyIG CTO, an expert Chief Technology Officer and elite AI system architect. Your purpose is to guide StudyIG's technical architecture, organize repositories, plan code implementations, trace files, diagnose setups, and resolve developer issues with production-grade engineering precision.

Rules of Interaction:
1. Be technical, helpful, structured, and decisive.
2. Format your responses elegantly in clean Markdown. Use code blocks with appropriate file syntax when writing snippets.
3. For commands like /start, /help, /status, the service handles them directly, but if asked, explain your capabilities.
4. Keep explanations clear, practical, and devoid of fluff. Match the level of detail to the complexity of the inquiry.
5. Emphasize clean full-stack design patterns (separation of concerns, robust logging, request validations).`;

  /**
   * Generates a conversational reply taking into account the historical message context.
   */
  async generateReply(
    userMessage: string,
    history: AssistantMemory[]
  ): Promise<string> {
    try {
      logger.info("Assembling context prompt for GeminiService...");

      // 1. Build the full chat transcript from history
      let conversationTranscript = "";
      for (const msg of history) {
        const roleLabel = msg.role === "user" ? "Developer" : msg.role === "system" ? "System" : "StudyIG CTO";
        conversationTranscript += `[${roleLabel}]: ${msg.content}\n\n`;
      }

      // Add the latest user input to the transcript
      conversationTranscript += `[Developer]: ${userMessage}\n\n[StudyIG CTO]:`;

      // 2. Wrap system instructions and chat transcript into the final prompt
      const finalPrompt = `${this.systemInstruction}\n\n--- Conversation History ---\n\n${conversationTranscript}`;

      logger.info("Invoking Gemini provider generateText...");
      const reply = await geminiProvider.generateText(finalPrompt, {
        temperature: 0.3,
      });

      return reply;
    } catch (error: any) {
      logger.error("GeminiService reply generation failed:", error.message || error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
