import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { Milestone } from "./projectRepository.js";
import { logger } from "../lib/logger.js";

export class MilestoneRepository {
  private getClient() {
    return getSupabaseClient();
  }

  async getMilestonesByProject(projectId: string): Promise<Milestone[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("milestones")
        .select("*")
        .eq("project_id", projectId)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        description: row.description,
        dueDate: row.due_date,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch milestones:", err.message || err);
      return [];
    }
  }

  async createMilestone(milestone: Milestone): Promise<Milestone> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("milestones")
        .insert({
          project_id: milestone.projectId,
          title: milestone.title,
          description: milestone.description,
          due_date: milestone.dueDate,
          status: milestone.status || "active"
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        projectId: data.project_id,
        title: data.title,
        description: data.description,
        dueDate: data.due_date,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to create milestone:", err.message || err);
      throw err;
    }
  }

  async updateMilestoneStatus(milestoneId: string, status: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { error } = await this.getClient()
        .from("milestones")
        .update({ status })
        .eq("id", milestoneId);

      if (error) throw error;
    } catch (err: any) {
      logger.error(`Failed to update milestone status for ${milestoneId}:`, err.message || err);
      throw err;
    }
  }
}

export const milestoneRepository = new MilestoneRepository();
