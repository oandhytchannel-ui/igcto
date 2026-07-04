import { taskRepository, ExtendedProjectTask } from "../repositories/taskRepository.js";
import { subtaskRepository } from "../repositories/subtaskRepository.js";
import { Subtask } from "../repositories/projectRepository.js";

export class TaskService {
  async getTasks(projectId: string, filters?: { epicId?: string; milestoneId?: string; featureId?: string }): Promise<ExtendedProjectTask[]> {
    return taskRepository.getTasksByProject(projectId, filters);
  }

  async createTask(task: ExtendedProjectTask): Promise<ExtendedProjectTask> {
    return taskRepository.createTask(task);
  }

  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    return taskRepository.updateTaskStatus(taskId, status);
  }

  async getSubtasks(taskId: string): Promise<Subtask[]> {
    return subtaskRepository.getSubtasksByTask(taskId);
  }

  async createSubtask(subtask: Subtask): Promise<Subtask> {
    return subtaskRepository.createSubtask(subtask);
  }

  async updateSubtaskCompletion(subtaskId: string, isCompleted: boolean): Promise<void> {
    return subtaskRepository.updateSubtaskCompletion(subtaskId, isCompleted);
  }
}

export const taskService = new TaskService();
