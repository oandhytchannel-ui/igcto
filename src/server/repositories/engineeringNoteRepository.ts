import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { EngineeringNote } from "./projectRepository.js";
import { logger } from "../lib/logger.js";

export class EngineeringNoteRepository {
  private getClient() {
    return getSupabaseClient();
  }

  async getEngineeringNotesByProject(projectId: string): Promise<EngineeringNote[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("engineering_notes")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch engineering notes:", err.message || err);
      return [];
    }
  }

  async createEngineeringNote(note: EngineeringNote): Promise<EngineeringNote> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("engineering_notes")
        .insert({
          project_id: note.projectId,
          title: note.title,
          content: note.content
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        projectId: data.project_id,
        title: data.title,
        content: data.content,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to create engineering note:", err.message || err);
      throw err;
    }
  }
}

export const engineeringNoteRepository = new EngineeringNoteRepository();
