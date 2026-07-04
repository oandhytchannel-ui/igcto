import { featureRepository } from "../repositories/featureRepository.js";
import { Feature } from "../repositories/projectRepository.js";
import { geminiProvider } from "./geminiProvider.js";
import { logger } from "../lib/logger.js";

export class FeatureService {
  async getFeatures(projectId: string): Promise<Feature[]> {
    return featureRepository.getFeaturesByProject(projectId);
  }

  async createFeature(feature: Feature): Promise<Feature> {
    return featureRepository.createFeature(feature);
  }

  async updateFeatureStatus(featureId: string, status: string): Promise<void> {
    return featureRepository.updateFeatureStatus(featureId, status);
  }

  async planFeatureWithAI(projectId: string, title: string, description: string): Promise<Feature> {
    logger.info(`Planning feature with AI: "${title}"...`);
    const prompt = `You are an elite system architect planning a feature for StudyIG.
Analyze this feature and provide a detailed engineering spec.
Feature Title: ${title}
Feature Description: ${description}

Respond ONLY with a JSON object matching this schema:
{
  "engineeringGoal": "Short summary of the core engineering goal",
  "priority": "low" | "medium" | "high" | "critical",
  "backendTasks": ["Task 1", "Task 2"],
  "frontendTasks": ["Task 1", "Task 2"],
  "databaseTasks": ["Task 1", "Task 2"],
  "securityConsiderations": ["Security point 1", "Security point 2"],
  "testingChecklist": ["Testing checklist 1", "Testing checklist 2"],
  "deploymentChecklist": ["Deployment checklist 1", "Deployment checklist 2"]
}
`;

    try {
      const parsed = await geminiProvider.generateStructuredJSON<any>(prompt);
      const feature: Feature = {
        projectId,
        title,
        description,
        status: "planned",
        priority: parsed.priority || "medium",
        engineeringGoal: parsed.engineeringGoal || "",
        backendTasks: parsed.backendTasks || [],
        frontendTasks: parsed.frontendTasks || [],
        databaseTasks: parsed.databaseTasks || [],
        securityConsiderations: parsed.securityConsiderations || [],
        testingChecklist: parsed.testingChecklist || [],
        deploymentChecklist: parsed.deploymentChecklist || []
      };

      return await this.createFeature(feature);
    } catch (err: any) {
      logger.error(`AI Feature Planning failed for "${title}":`, err.message || err);
      const fallbackFeature: Feature = {
        projectId,
        title,
        description,
        status: "planned",
        priority: "medium",
        engineeringGoal: "Develop " + title,
        backendTasks: [],
        frontendTasks: [],
        databaseTasks: [],
        securityConsiderations: [],
        testingChecklist: [],
        deploymentChecklist: []
      };
      return await this.createFeature(fallbackFeature);
    }
  }
}

export const featureService = new FeatureService();
