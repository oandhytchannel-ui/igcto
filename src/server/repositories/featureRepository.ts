import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { Feature } from "./projectRepository.js";
import { logger } from "../lib/logger.js";

export class FeatureRepository {
  private getClient() {
    return getSupabaseClient();
  }

  async getFeaturesByProject(projectId: string): Promise<Feature[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("features")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        epicId: row.epic_id,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        engineeringGoal: row.engineering_goal,
        backendTasks: row.backend_tasks || [],
        frontendTasks: row.frontend_tasks || [],
        databaseTasks: row.database_tasks || [],
        securityConsiderations: row.security_considerations || [],
        testingChecklist: row.testing_checklist || [],
        deploymentChecklist: row.deployment_checklist || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch features:", err.message || err);
      return [];
    }
  }

  async createFeature(feature: Feature): Promise<Feature> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("features")
        .insert({
          project_id: feature.projectId,
          epic_id: feature.epicId,
          title: feature.title,
          description: feature.description,
          status: feature.status || "planned",
          priority: feature.priority || "medium",
          engineering_goal: feature.engineeringGoal,
          backend_tasks: feature.backendTasks || [],
          frontend_tasks: feature.frontendTasks || [],
          database_tasks: feature.databaseTasks || [],
          security_considerations: feature.securityConsiderations || [],
          testing_checklist: feature.testingChecklist || [],
          deployment_checklist: feature.deploymentChecklist || []
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        projectId: data.project_id,
        epicId: data.epic_id,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        engineeringGoal: data.engineering_goal,
        backendTasks: data.backend_tasks,
        frontendTasks: data.frontend_tasks,
        databaseTasks: data.database_tasks,
        securityConsiderations: data.security_considerations,
        testingChecklist: data.testing_checklist,
        deploymentChecklist: data.deployment_checklist,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to create feature:", err.message || err);
      throw err;
    }
  }

  async updateFeatureStatus(featureId: string, status: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { error } = await this.getClient()
        .from("features")
        .update({ status })
        .eq("id", featureId);

      if (error) throw error;
    } catch (err: any) {
      logger.error(`Failed to update feature status for ${featureId}:`, err.message || err);
      throw err;
    }
  }
}

export const featureRepository = new FeatureRepository();
