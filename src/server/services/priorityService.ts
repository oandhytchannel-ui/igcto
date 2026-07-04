import { featureRepository } from "../repositories/featureRepository.js";
import { bugReportRepository } from "../repositories/bugReportRepository.js";
import { technicalDebtRepository } from "../repositories/technicalDebtRepository.js";
import { geminiProvider } from "./geminiProvider.js";
import { logger } from "../lib/logger.js";
import { realitySyncService } from "./realitySyncService.js";

export interface PriorityItem {
  type: "bug" | "feature" | "technical_debt";
  title: string;
  id: string;
  calculatedPriority: "critical" | "high" | "medium" | "low";
  reason: string;
}

export class PriorityService {
  async calculatePriorityPlan(projectId: string): Promise<PriorityItem[]> {
    logger.info("Gathering project metadata to calculate prioritisations...");
    try {
      // Reconcile database state with physical repository reality first
      await realitySyncService.reconcileReality(projectId);

      const [features, bugs, debt] = await Promise.all([
        featureRepository.getFeaturesByProject(projectId),
        bugReportRepository.getBugReportsByProject(projectId),
        technicalDebtRepository.getTechnicalDebtByProject(projectId)
      ]);

      const openBugs = bugs.filter(b => b.status === "open" || b.status === "investigating");
      const incompleteFeatures = features.filter(f => f.status === "planned" || f.status === "in_progress");
      
      const itemsList = [
        ...openBugs.map(b => ({ id: b.id, type: "bug", title: b.title, severity: b.severity, detail: b.description })),
        ...incompleteFeatures.map(f => ({ id: f.id, type: "feature", title: f.title, severity: f.priority, detail: f.description })),
        ...debt.map(d => ({ id: d.id, type: "technical_debt", title: d.title, severity: d.impact, detail: d.description }))
      ];

      if (itemsList.length === 0) {
        return [];
      }

      const prompt = `You are an elite Agile Project Manager and CTO.
Evaluate the following tasks, bugs, and technical debt items for a project and rank them in a clear, prioritized list from highest priority (critical) to lowest (low).
Take into account:
1. Bug severities (bugs that crash or affect critical paths should be first).
2. Features that unlock major engineering goals.
3. Technical debt that hampers speed or security.

Items to evaluate:
${JSON.stringify(itemsList, null, 2)}

Respond ONLY with a JSON array where each element matches this schema:
[
  {
    "type": "bug" | "feature" | "technical_debt",
    "title": "Item Title",
    "id": "item UUID",
    "calculatedPriority": "critical" | "high" | "medium" | "low",
    "reason": "Clear explanation of why this item got this priority rating"
  }
]
`;

      const response = await geminiProvider.generateStructuredJSON<PriorityItem[]>(prompt);
      return response;
    } catch (err: any) {
      logger.error("Failed to calculate prioritization plan:", err.message || err);
      return [];
    }
  }
}

export const priorityService = new PriorityService();
