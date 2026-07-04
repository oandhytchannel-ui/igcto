import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { BugReport } from "./projectRepository.js";
import { logger } from "../lib/logger.js";

export class BugReportRepository {
  private getClient() {
    return getSupabaseClient();
  }

  async getBugReportsByProject(projectId: string): Promise<BugReport[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("bug_reports")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        description: row.description,
        severity: row.severity,
        priority: row.priority,
        affectedFiles: row.affected_files || [],
        suspectedCause: row.suspected_cause,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch bug reports:", err.message || err);
      return [];
    }
  }

  async createBugReport(bug: BugReport): Promise<BugReport> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("bug_reports")
        .insert({
          project_id: bug.projectId,
          title: bug.title,
          description: bug.description,
          severity: bug.severity || "medium",
          priority: bug.priority || "medium",
          affected_files: bug.affectedFiles || [],
          suspected_cause: bug.suspectedCause,
          status: bug.status || "open"
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        projectId: data.project_id,
        title: data.title,
        description: data.description,
        severity: data.severity,
        priority: data.priority,
        affectedFiles: data.affected_files,
        suspectedCause: data.suspected_cause,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to create bug report:", err.message || err);
      throw err;
    }
  }

  async updateBugReportStatus(bugId: string, status: BugReport["status"]): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { error } = await this.getClient()
        .from("bug_reports")
        .update({ status })
        .eq("id", bugId);

      if (error) throw error;
    } catch (err: any) {
      logger.error(`Failed to update bug report ${bugId}:`, err.message || err);
      throw err;
    }
  }
}

export const bugReportRepository = new BugReportRepository();
