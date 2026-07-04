import { releaseRepository } from "../repositories/releaseRepository.js";
import { Release } from "../repositories/projectRepository.js";
import { featureRepository } from "../repositories/featureRepository.js";
import { taskRepository } from "../repositories/taskRepository.js";
import { bugReportRepository } from "../repositories/bugReportRepository.js";
import { geminiProvider } from "./geminiProvider.js";
import { logger } from "../lib/logger.js";

export class ReleaseService {
  async getReleases(projectId: string): Promise<Release[]> {
    return releaseRepository.getReleasesByProject(projectId);
  }

  async createRelease(release: Release): Promise<Release> {
    return releaseRepository.createRelease(release);
  }

  async updateReleaseStatus(releaseId: string, status: string): Promise<void> {
    return releaseRepository.updateReleaseStatus(releaseId, status);
  }

  async generateReleaseNotes(projectId: string, version: string, title: string): Promise<string> {
    logger.info(`Generating Release Notes with AI for ${version}...`);
    try {
      const [features, tasks, bugs] = await Promise.all([
        featureRepository.getFeaturesByProject(projectId),
        taskRepository.getTasksByProject(projectId),
        bugReportRepository.getBugReportsByProject(projectId)
      ]);

      const completedFeatures = features.filter(f => f.status === "completed").map(f => f.title);
      const completedTasks = tasks.filter(t => t.status === "done").map(t => t.title);
      const resolvedBugs = bugs.filter(b => b.status === "resolved" || b.status === "closed").map(b => b.title);

      const prompt = `You are StudyIG's Technical CTO. Draft beautiful, highly readable, structured Markdown release notes for version ${version} ("${title}").
Here are the items completed in this release cycle:
- Completed Features: ${completedFeatures.length > 0 ? completedFeatures.join(", ") : "None"}
- Completed Tasks: ${completedTasks.length > 0 ? completedTasks.join(", ") : "None"}
- Resolved Bugs: ${resolvedBugs.length > 0 ? resolvedBugs.join(", ") : "None"}

Please write professional release notes with:
1. Executive Summary: What does this release achieve?
2. Detailed Features Checklist: bullet points of what's new.
3. Bug Fixes & Stability: bullet points of what was resolved.
4. Deployment instructions or verification guidelines.
`;

      const releaseNotes = await geminiProvider.generateText(prompt);
      return releaseNotes;
    } catch (err: any) {
      logger.error(`Failed to generate release notes for version ${version}:`, err.message || err);
      return `Release Notes for version ${version} of ${title}. Documentation is currently pending.`;
    }
  }
}

export const releaseService = new ReleaseService();
