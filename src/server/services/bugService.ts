import { bugReportRepository } from "../repositories/bugReportRepository.js";
import { BugReport } from "../repositories/projectRepository.js";
import { projectRepository } from "../repositories/projectRepository.js";
import { logger } from "../lib/logger.js";

export class BugService {
  async getBugs(projectId: string): Promise<BugReport[]> {
    return bugReportRepository.getBugReportsByProject(projectId);
  }

  async createBugReport(bug: BugReport): Promise<BugReport> {
    // Automatically relate bugs to repository files if possible
    try {
      if (bug.projectId && (!bug.affectedFiles || bug.affectedFiles.length === 0)) {
        logger.info("Attempting to automatically relate bug to cached repo files...");
        const files = await projectRepository.getClient()
          .from("repo_files")
          .select("*")
          .eq("project_id", bug.projectId);

        if (!files.error && files.data) {
          const textToMatch = `${bug.title} ${bug.description}`.toLowerCase();
          const matchedFiles: string[] = [];
          for (const file of files.data) {
            if (file.path && textToMatch.includes(file.path.toLowerCase())) {
              matchedFiles.push(file.path);
            } else if (file.name && textToMatch.includes(file.name.toLowerCase())) {
              matchedFiles.push(file.path);
            }
          }

          if (matchedFiles.length > 0) {
            bug.affectedFiles = Array.from(new Set(matchedFiles)).slice(0, 5);
            logger.info(`Automatically linked bug to files: ${bug.affectedFiles.join(", ")}`);
          }
        }
      }
    } catch (err: any) {
      logger.error("Failed to automatically link repo files to bug:", err.message || err);
    }

    return bugReportRepository.createBugReport(bug);
  }

  async updateBugStatus(bugId: string, status: BugReport["status"]): Promise<void> {
    return bugReportRepository.updateBugReportStatus(bugId, status);
  }
}

export const bugService = new BugService();
