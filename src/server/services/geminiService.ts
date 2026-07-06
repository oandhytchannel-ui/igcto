/**
 * StudyIG CTO - Centralized Gemini AI Service
 * 
 * Formulates structured prompts, manages system instructions, and routes
 * requests to the abstracted AI provider interface.
 */

import { geminiProvider } from "./geminiProvider.js";
import { AssistantMemory } from "../repositories/projectRepository.js";
import { EvidenceCollectionResult } from "./intentRouterService.js";
import { logger } from "../lib/logger.js";

export class GeminiService {
  private systemInstruction = `You are StudyIG CTO, the expert Chief Technology Officer, senior software architect, technical planner, engineering mentor, and project manager for StudyIG. Your primary responsibility is helping build StudyIG successfully.

Conversational Senior CTO Intelligence Rules:
1. Speak and write like a real, experienced CTO. Keep explanations clear, practical, mentoring, and highly concise. Avoid being a simple generic code-dumping bot.
2. STRICT CODE LIMITATION: Unless the developer explicitly asks for code, DO NOT output: source code, SQL, TypeScript, Express routes, or implementation snippets. Instead, explain everything in elegant, professional natural language, utilizing simple engineering terms, and assume the developer wants guidance rather than code.
3. ENGINEERING REASONING: Every recommendation you make must clearly explain:
   - WHY it is needed.
   - WHICH repository evidence supports it.
   - WHICH project goals it advances.
   - ANY potential risks, security loopholes, or engineering trade-offs.

AI TRUTH & RECONCILIATION RULES:
1. NEVER assume repository state or fabricate completed work. The GitHub repository is the absolute single source of truth.
2. If any planning database information conflicts with the actual repository state (the files list, code, or packages present in the codebase), the repository ALWAYS wins.
3. Never mark a feature as completed or verified without clear, direct codebase evidence.
4. If a file or implementation cannot be verified in the codebase, explicitly state your uncertainty and suggest running a scan or verifying paths.

Formulating Responses:
- Format your answers elegantly in clean Markdown.
- Use precise display-oriented headings and spacing.
- Be decisive, mentoring, practical, and grounded in the current codebase.
- **STRICT CODE LIMITATION**: Never dump raw code or implementation snippets unless explicitly requested. Describe changes conceptually first.`;

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

  /**
   * Generates an engineering reply based on evidence collected from the Intent Router and active inspections.
   */
  async generateReplyWithEvidence(
    userMessage: string,
    history: AssistantMemory[],
    evidenceResult: EvidenceCollectionResult,
    isVerbose: boolean
  ): Promise<string> {
    try {
      logger.info("Assembling evidence-grounded structured prompt for GeminiService...");

      // 1. Build the full chat transcript from history
      let conversationTranscript = "";
      for (const msg of history) {
        const roleLabel = msg.role === "user" ? "Developer" : msg.role === "system" ? "System" : "StudyIG CTO";
        conversationTranscript += `[${roleLabel}]: ${msg.content}\n\n`;
      }

      // Add the latest user input to the transcript
      conversationTranscript += `[Developer]: ${userMessage}\n\n[StudyIG CTO]:`;

      // 2. Format deterministic evidence chunks
      const evidenceListText = evidenceResult.evidenceUsed.map(item => `✓ ${item}`).join("\n");
      const unavailableListText = evidenceResult.unavailable.map(item => `• ${item}`).join("\n");
      const confidenceBlockText = `**${evidenceResult.confidenceLevel} Confidence**\n${evidenceResult.confidenceJustification}`;

      // 3. Construct an augmented system prompt integrating the grounded evidence and strict layout constraint
      const augmentedPrompt = `
${this.systemInstruction}

=========================================
🚨 [CRITICAL GROUND TRUTH EVIDENCE] 🚨
You MUST strictly base your engineering answer on the live evidence retrieved below. Do NOT make assumptions, guess, or hallucinate components, columns, or files.
If a detail or column is missing or unverified, explicitly say "Unknown — could not verify from the repository or database" or "Unable to verify from available project data."
=========================================

${evidenceResult.evidenceText}

=========================================
🚨 [STRICT SECURITY CONTROLS] 🚨
- Secrets, credentials, keys, or raw configurations MUST NEVER be exposed in your response. Redact any mentioned secrets.
- SQL queries and database commands must never execute automatically. All database recommendations must be purely read-only advisory.
- Explicit approval from the developer is required for any system changes or destructive actions.
=========================================

🚨 [STRICT RESPONDING LAYOUT REQUIREMENT] 🚨
Your final response MUST follow exactly this markdown header structure:

### Summary
[Brief, high-level, human-friendly summary in plain English]

### Evidence Used
${evidenceListText}
${unavailableListText}

### Confidence Report
${confidenceBlockText}

### Root Cause
[An objective, evidence-supported analysis of the underlying root cause of the issue. If unavailable, state "Unable to verify from available project data." Do not guess.]

### Impact
[Analysis of the technical or business impact of this issue in plain English]

### Recommendation
[Step-by-step actionable recommendation to resolve or verify. Conceptual and logical explanations only; do NOT output source code or SQL unless explicitly requested in the latest message.]

### Next Steps
[Next troubleshooting or verification instructions]

---

--- Conversation History ---

${conversationTranscript}
`;

      logger.info("Invoking Gemini provider generateText with structured format constraints...");
      let reply = await geminiProvider.generateText(augmentedPrompt, {
        temperature: 0.1, // Minimum temperature for highly deterministic, evidence-grounded outputs
      });

      // 4. If verbose/debug mode is active, append the Execution Plan log nicely
      if (isVerbose) {
        reply += `\n\n---\n\n<details>\n<summary>🛠️ Verbose System Execution Plan</summary>\n\n\`\`\`\n${evidenceResult.executionPlanLog}\n\`\`\`\n</details>`;
      }

      return reply;
    } catch (error: any) {
      logger.error("GeminiService reply generation with evidence failed:", error.message || error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
