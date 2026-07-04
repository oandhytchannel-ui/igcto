import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { TechnicalDebt } from "./projectRepository.js";
import { logger } from "../lib/logger.js";

export class TechnicalDebtRepository {
  private getClient() {
    return getSupabaseClient();
  }

  async getTechnicalDebtByProject(projectId: string): Promise<TechnicalDebt[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("technical_debt")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        description: row.description,
        debtType: row.debt_type,
        impact: row.impact,
        estimatedEffort: row.estimated_effort,
        recommendation: row.recommendation,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch technical debt:", err.message || err);
      return [];
    }
  }

  async createTechnicalDebt(debt: TechnicalDebt): Promise<TechnicalDebt> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("technical_debt")
        .insert({
          project_id: debt.projectId,
          title: debt.title,
          description: debt.description,
          debt_type: debt.debtType || "maintainability",
          impact: debt.impact || "medium",
          estimated_effort: debt.estimatedEffort || "medium",
          recommendation: debt.recommendation
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        projectId: data.project_id,
        title: data.title,
        description: data.description,
        debtType: data.debt_type,
        impact: data.impact,
        estimatedEffort: data.estimated_effort,
        recommendation: data.recommendation,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to create technical debt:", err.message || err);
      throw err;
    }
  }
}

export const technicalDebtRepository = new TechnicalDebtRepository();
