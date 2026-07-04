import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { Release } from "./projectRepository.js";
import { logger } from "../lib/logger.js";

export class ReleaseRepository {
  private getClient() {
    return getSupabaseClient();
  }

  async getReleasesByProject(projectId: string): Promise<Release[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("releases")
        .select("*")
        .eq("project_id", projectId)
        .order("release_date", { ascending: false });

      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        version: row.version,
        title: row.title,
        description: row.description,
        releaseDate: row.release_date,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch releases:", err.message || err);
      return [];
    }
  }

  async createRelease(release: Release): Promise<Release> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("releases")
        .insert({
          project_id: release.projectId,
          version: release.version,
          title: release.title,
          description: release.description,
          release_date: release.releaseDate,
          status: release.status || "draft"
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        projectId: data.project_id,
        version: data.version,
        title: data.title,
        description: data.description,
        releaseDate: data.release_date,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to create release:", err.message || err);
      throw err;
    }
  }

  async updateReleaseStatus(releaseId: string, status: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { error } = await this.getClient()
        .from("releases")
        .update({ status })
        .eq("id", releaseId);

      if (error) throw error;
    } catch (err: any) {
      logger.error(`Failed to update release status ${releaseId}:`, err.message || err);
      throw err;
    }
  }
}

export const releaseRepository = new ReleaseRepository();
