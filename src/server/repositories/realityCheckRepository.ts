import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { RealityCheck } from "./projectRepository.js";
import { logger } from "../lib/logger.js";

export class RealityCheckRepository {
  private getClient() {
    return getSupabaseClient();
  }

  async getRealityChecksByProject(projectId: string): Promise<RealityCheck[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("reality_checks")
        .select("*")
        .eq("project_id", projectId)
        .order("verified_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        featureId: row.feature_id,
        repositorySnapshot: row.repository_snapshot || {},
        verificationStatus: row.verification_status as any,
        repositoryFiles: row.repository_files || [],
        mismatchReport: row.mismatch_report || {},
        verifiedAt: row.verified_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch reality checks:", err.message || err);
      return [];
    }
  }

  async getRealityCheckByFeature(featureId: string): Promise<RealityCheck | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data, error } = await this.getClient()
        .from("reality_checks")
        .select("*")
        .eq("feature_id", featureId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        projectId: data.project_id,
        featureId: data.feature_id,
        repositorySnapshot: data.repository_snapshot || {},
        verificationStatus: data.verification_status as any,
        repositoryFiles: data.repository_files || [],
        mismatchReport: data.mismatch_report || {},
        verifiedAt: data.verified_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error(`Failed to fetch reality check for feature ${featureId}:`, err.message || err);
      return null;
    }
  }

  async saveRealityCheck(realityCheck: RealityCheck): Promise<RealityCheck> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      // If we have an ID, or we can look up by feature_id to upsert
      let existing: RealityCheck | null = null;
      if (realityCheck.featureId) {
        existing = await this.getRealityCheckByFeature(realityCheck.featureId);
      }

      const payload = {
        project_id: realityCheck.projectId,
        feature_id: realityCheck.featureId || null,
        repository_snapshot: realityCheck.repositorySnapshot || {},
        verification_status: realityCheck.verificationStatus || "not_started",
        repository_files: realityCheck.repositoryFiles || [],
        mismatch_report: realityCheck.mismatchReport || {},
        verified_at: new Date().toISOString()
      };

      let result;
      if (existing && existing.id) {
        const { data, error } = await this.getClient()
          .from("reality_checks")
          .update(payload)
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await this.getClient()
          .from("reality_checks")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      return {
        id: result.id,
        projectId: result.project_id,
        featureId: result.feature_id,
        repositorySnapshot: result.repository_snapshot,
        verificationStatus: result.verification_status as any,
        repositoryFiles: result.repository_files,
        mismatchReport: result.mismatch_report,
        verifiedAt: result.verified_at,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to save reality check:", err.message || err);
      throw err;
    }
  }
}

export const realityCheckRepository = new RealityCheckRepository();
