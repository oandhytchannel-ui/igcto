import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { Epic } from "./projectRepository.js";
import { logger } from "../lib/logger.js";

export class EpicRepository {
  private getClient() {
    return getSupabaseClient();
  }

  async getEpicsByProject(projectId: string): Promise<Epic[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("epics")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        description: row.description,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch epics:", err.message || err);
      return [];
    }
  }

  async createEpic(epic: Epic): Promise<Epic> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("epics")
        .insert({
          project_id: epic.projectId,
          title: epic.title,
          description: epic.description,
          status: epic.status || "planned"
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        projectId: data.project_id,
        title: data.title,
        description: data.description,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to create epic:", err.message || err);
      throw err;
    }
  }

  async updateEpicStatus(epicId: string, status: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { error } = await this.getClient()
        .from("epics")
        .update({ status })
        .eq("id", epicId);

      if (error) throw error;
    } catch (err: any) {
      logger.error(`Failed to update epic status for epic ${epicId}:`, err.message || err);
      throw err;
    }
  }
}

export const epicRepository = new EpicRepository();
