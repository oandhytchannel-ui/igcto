import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { Subtask } from "./projectRepository.js";
import { logger } from "../lib/logger.js";

export class SubtaskRepository {
  private getClient() {
    return getSupabaseClient();
  }

  async getSubtasksByTask(taskId: string): Promise<Subtask[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("subtasks")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        taskId: row.task_id,
        title: row.title,
        isCompleted: row.is_completed,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch subtasks:", err.message || err);
      return [];
    }
  }

  async createSubtask(subtask: Subtask): Promise<Subtask> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("subtasks")
        .insert({
          task_id: subtask.taskId,
          title: subtask.title,
          is_completed: subtask.isCompleted || false
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        taskId: data.task_id,
        title: data.title,
        isCompleted: data.is_completed,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to create subtask:", err.message || err);
      throw err;
    }
  }

  async updateSubtaskCompletion(subtaskId: string, isCompleted: boolean): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { error } = await this.getClient()
        .from("subtasks")
        .update({ is_completed: isCompleted })
        .eq("id", subtaskId);

      if (error) throw error;
    } catch (err: any) {
      logger.error(`Failed to update subtask ${subtaskId}:`, err.message || err);
      throw err;
    }
  }
}

export const subtaskRepository = new SubtaskRepository();
