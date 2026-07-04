import { roadmapRepository } from "../repositories/roadmapRepository.js";
import { featureRepository } from "../repositories/featureRepository.js";
import { bugReportRepository } from "../repositories/bugReportRepository.js";
import { technicalDebtRepository } from "../repositories/technicalDebtRepository.js";
import { projectRepository, RoadmapItem } from "../repositories/projectRepository.js";
import { geminiProvider } from "./geminiProvider.js";
import { logger } from "../lib/logger.js";
import { realitySyncService } from "./realitySyncService.js";

export class RoadmapService {
  async getRoadmap(projectId: string): Promise<RoadmapItem[]> {
    return roadmapRepository.getRoadmapByProject(projectId);
  }

  async generateRoadmapWithAI(projectId: string): Promise<RoadmapItem[]> {
    logger.info("Gathering project state to generate intelligent roadmap via Gemini...");
    try {
      // Reconcile database state with physical repository reality first
      await realitySyncService.reconcileReality(projectId);

      const [features, bugs, debt, filesResult] = await Promise.all([
        featureRepository.getFeaturesByProject(projectId),
        bugReportRepository.getBugReportsByProject(projectId),
        technicalDebtRepository.getTechnicalDebtByProject(projectId),
        projectRepository.getClient().from("repo_files").select("*").eq("project_id", projectId)
      ]);

      const files = filesResult.data || [];

      const prompt = `You are StudyIG's expert CTO and Agile Product Manager.
Analyze the current project state and construct a structured roadmap comprising 3-5 sequential phases/milestone items.

Project State:
- Features: ${JSON.stringify(features.map(f => ({ id: f.id, title: f.title, status: f.status })), null, 2)}
- Bugs: ${JSON.stringify(bugs.map(b => ({ id: b.id, title: b.title, status: b.status })), null, 2)}
- Technical Debt: ${JSON.stringify(debt.map(d => ({ id: d.id, title: d.title, type: d.debtType })), null, 2)}
- Code Files Count: ${files.length}

Generate a sequence of roadmap milestones/items. Each item should have a clear title, detailed description, status ('planned', 'in_progress', or 'completed'), and order index.
Respond ONLY with a JSON array:
[
  {
    "featureId": "associated feature UUID (optional, leave null if not applicable)",
    "title": "Roadmap Item Title (e.g., Phase 1: Core Authentication & Security)",
    "description": "Explanatory breakdown of what this phase entails and what features/fixes are included.",
    "status": "planned" | "in_progress" | "complete",
    "orderIndex": 1
  }
]
`;

      const response = await geminiProvider.generateStructuredJSON<any[]>(prompt);
      
      // Delete old roadmap items first for this project to regenerate cleanly
      await projectRepository.getClient().from("roadmap_items").delete().eq("project_id", projectId);

      const createdItems: RoadmapItem[] = [];
      for (const item of response) {
        const created = await roadmapRepository.createRoadmapItem({
          projectId,
          featureId: item.featureId || undefined,
          title: item.title,
          description: item.description,
          status: item.status || "planned",
          orderIndex: item.orderIndex || 0
        });
        createdItems.push(created);
      }

      return createdItems;
    } catch (err: any) {
      logger.error("AI Roadmap Generation failed:", err.message || err);
      return roadmapRepository.getRoadmapByProject(projectId);
    }
  }
}

export const roadmapService = new RoadmapService();
