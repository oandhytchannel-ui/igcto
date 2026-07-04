import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { ArchitectureDecision } from "./projectRepository.js";
import { logger } from "../lib/logger.js";

export class ArchitectureDecisionRepository {
  private getClient() {
    return getSupabaseClient();
  }

  async getArchitectureDecisionsByProject(projectId: string): Promise<ArchitectureDecision[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("architecture_decisions")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        context: row.context,
        decision: row.decision,
        consequences: row.consequences,
        alternativesConsidered: row.alternatives_considered,
        impact: row.impact,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch architecture decisions:", err.message || err);
      return [];
    }
  }

  async createArchitectureDecision(decision: ArchitectureDecision): Promise<ArchitectureDecision> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("architecture_decisions")
        .insert({
          project_id: decision.projectId,
          title: decision.title,
          context: decision.context,
          decision: decision.decision,
          consequences: decision.consequences,
          alternatives_considered: decision.alternativesConsidered || "",
          impact: decision.impact || "medium"
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        projectId: data.project_id,
        title: data.title,
        context: data.context,
        decision: data.decision,
        consequences: data.consequences,
        alternativesConsidered: data.alternatives_considered,
        impact: data.impact,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to create architecture decision:", err.message || err);
      throw err;
    }
  }
}

export const architectureDecisionRepository = new ArchitectureDecisionRepository();
