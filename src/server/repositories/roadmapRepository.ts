import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { RoadmapItem } from "./projectRepository.js";
import { logger } from "../lib/logger.js";

export class RoadmapRepository {
  private getClient() {
    return getSupabaseClient();
  }

  async getRoadmapByProject(projectId: string): Promise<RoadmapItem[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("roadmap_items")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        featureId: row.feature_id,
        title: row.title,
        description: row.description,
        status: row.status,
        orderIndex: row.order_index,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch roadmap:", err.message || err);
      return [];
    }
  }

  async createRoadmapItem(item: RoadmapItem): Promise<RoadmapItem> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("roadmap_items")
        .insert({
          project_id: item.projectId,
          feature_id: item.featureId,
          title: item.title,
          description: item.description,
          status: item.status || "planned",
          order_index: item.orderIndex || 0
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        projectId: data.project_id,
        featureId: data.feature_id,
        title: data.title,
        description: data.description,
        status: data.status,
        orderIndex: data.order_index,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to create roadmap item:", err.message || err);
      throw err;
    }
  }

  async updateRoadmapItemStatus(itemId: string, status: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { error } = await this.getClient()
        .from("roadmap_items")
        .update({ status })
        .eq("id", itemId);

      if (error) throw error;
    } catch (err: any) {
      logger.error(`Failed to update roadmap item status ${itemId}:`, err.message || err);
      throw err;
    }
  }
}

export const roadmapRepository = new RoadmapRepository();
