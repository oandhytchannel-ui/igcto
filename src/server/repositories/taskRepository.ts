import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { ProjectTask } from "./projectRepository.js";
import { logger } from "../lib/logger.js";

export interface ExtendedProjectTask extends ProjectTask {
  epicId?: string;
  milestoneId?: string;
  featureId?: string;
}

export class TaskRepository {
  private getClient() {
    return getSupabaseClient();
  }

  async getTasksByProject(projectId: string, filters?: { epicId?: string; milestoneId?: string; featureId?: string }): Promise<ExtendedProjectTask[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      let query = this.getClient()
        .from("tasks")
        .select("*")
        .eq("project_id", projectId);

      if (filters?.epicId) {
        query = query.eq("epic_id", filters.epicId);
      }
      if (filters?.milestoneId) {
        query = query.eq("milestone_id", filters.milestoneId);
      }
      if (filters?.featureId) {
        query = query.eq("feature_id", filters.featureId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        epicId: row.epic_id,
        milestoneId: row.milestone_id,
        featureId: row.feature_id,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        assignedTo: row.assigned_to,
        dueDate: row.due_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch extended tasks:", err.message || err);
      return [];
    }
  }

  async createTask(task: ExtendedProjectTask): Promise<ExtendedProjectTask> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("tasks")
        .insert({
          project_id: task.projectId,
          epic_id: task.epicId,
          milestone_id: task.milestoneId,
          feature_id: task.featureId,
          title: task.title,
          description: task.description,
          status: task.status || "todo",
          priority: task.priority || "medium",
          assigned_to: task.assignedTo,
          due_date: task.dueDate
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        projectId: data.project_id,
        epicId: data.epic_id,
        milestoneId: data.milestone_id,
        featureId: data.feature_id,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        assignedTo: data.assigned_to,
        dueDate: data.due_date,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to create extended task:", err.message || err);
      throw err;
    }
  }

  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { error } = await this.getClient()
        .from("tasks")
        .update({ status })
        .eq("id", taskId);

      if (error) throw error;
    } catch (err: any) {
      logger.error(`Failed to update task status ${taskId}:`, err.message || err);
      throw err;
    }
  }
}

export const taskRepository = new TaskRepository();
