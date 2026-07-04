import { architectureDecisionRepository } from "../repositories/architectureDecisionRepository.js";
import { ArchitectureDecision } from "../repositories/projectRepository.js";
import { geminiProvider } from "./geminiProvider.js";
import { logger } from "../lib/logger.js";

export class DecisionService {
  async getDecisions(projectId: string): Promise<ArchitectureDecision[]> {
    return architectureDecisionRepository.getArchitectureDecisionsByProject(projectId);
  }

  async createDecision(decision: ArchitectureDecision): Promise<ArchitectureDecision> {
    return architectureDecisionRepository.createArchitectureDecision(decision);
  }

  async recordDecisionWithAI(projectId: string, title: string, contextDescription: string): Promise<ArchitectureDecision> {
    logger.info(`Recording architecture decision ADR with AI: "${title}"...`);
    const prompt = `You are a legendary systems architect. Draft a formal Architecture Decision Record (ADR) for:
Title: ${title}
Context description: ${contextDescription}

Respond ONLY with a JSON object containing:
{
  "context": "Comprehensive context explaining the environment, problem statement, forces, and constraints.",
  "decision": "The explicit decision and design choice made, in active voice.",
  "consequences": "The clear consequences, trade-offs, and downstream impacts (both positive and negative).",
  "alternativesConsidered": "The architectural alternatives considered and why they were rejected.",
  "impact": "low" | "medium" | "high" | "critical"
}
`;

    try {
      const parsed = await geminiProvider.generateStructuredJSON<any>(prompt);
      const decision: ArchitectureDecision = {
        projectId,
        title,
        context: parsed.context || contextDescription,
        decision: parsed.decision || "Adopt " + title,
        consequences: parsed.consequences || "Requires validation",
        alternativesConsidered: parsed.alternativesConsidered || "No alternatives evaluated.",
        impact: parsed.impact || "medium"
      };

      return await this.createDecision(decision);
    } catch (err: any) {
      logger.error(`AI ADR generation failed for "${title}":`, err.message || err);
      const fallbackDecision: ArchitectureDecision = {
        projectId,
        title,
        context: contextDescription,
        decision: "Adopt " + title,
        consequences: "Documented trade-offs are pending verification.",
        alternativesConsidered: "None documented.",
        impact: "medium"
      };
      return await this.createDecision(fallbackDecision);
    }
  }
}

export const decisionService = new DecisionService();
