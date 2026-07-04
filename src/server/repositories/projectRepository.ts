/**
 * Project and Multi-Table Architectural Memory Repositories.
 * Abstracts Supabase operations into simple, strongly typed functions targeting the isolated schema.
 */

import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { logger } from "../lib/logger.js";

// --- Data Interfaces ---

export interface Project {
  id?: string;
  name: string;
  description: string;
  repositoryUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GithubRepository {
  id?: string;
  projectId: string;
  owner: string;
  repoName: string;
  branch?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ArchitectureComponent {
  id?: string;
  projectId: string;
  componentName: string;
  description: string;
  techStack?: string[];
  designPatterns?: string[];
  filePaths?: string[];
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectTask {
  id?: string;
  projectId: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "done" | "backlog";
  priority: "low" | "medium" | "high" | "critical";
  assignedTo?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectBug {
  id?: string;
  projectId: string;
  title: string;
  description: string;
  filePath?: string;
  lineNumber?: number;
  status: "open" | "investigating" | "resolved" | "closed";
  severity: "low" | "medium" | "high" | "critical";
  reproductionSteps?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ArchitecturalDecision {
  id?: string;
  projectId: string;
  title: string;
  context: string;
  decision: string;
  consequences: string;
  impact: "low" | "medium" | "high" | "critical";
  createdAt?: string;
  updatedAt?: string;
}

export interface SystemPrompt {
  id?: string;
  name: string;
  purpose: string;
  promptText: string;
  version?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Conversation {
  id?: string;
  projectId: string;
  title: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssistantMemory {
  id?: string;
  projectId?: string;
  conversationId?: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt?: string;
}

export interface RepoFile {
  id?: string;
  projectId: string;
  path: string;
  name: string;
  size: number;
  sha: string;
  downloadUrl?: string;
  content?: string;
  summary?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Epic {
  id?: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Milestone {
  id?: string;
  projectId: string;
  title: string;
  description: string;
  dueDate?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Feature {
  id?: string;
  projectId: string;
  epicId?: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  engineeringGoal?: string;
  backendTasks?: string[];
  frontendTasks?: string[];
  databaseTasks?: string[];
  securityConsiderations?: string[];
  testingChecklist?: string[];
  deploymentChecklist?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Subtask {
  id?: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BugReport {
  id?: string;
  projectId: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  priority: "low" | "medium" | "high" | "critical";
  affectedFiles?: string[];
  suspectedCause?: string;
  status: "open" | "investigating" | "resolved" | "closed";
  createdAt?: string;
  updatedAt?: string;
}

export interface TechnicalDebt {
  id?: string;
  projectId: string;
  title: string;
  description: string;
  debtType: string;
  impact: string;
  estimatedEffort: string;
  recommendation: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoadmapItem {
  id?: string;
  projectId: string;
  featureId?: string;
  title: string;
  description: string;
  status: string;
  orderIndex?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface EngineeringNote {
  id?: string;
  projectId: string;
  title: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ArchitectureDecision {
  id?: string;
  projectId: string;
  title: string;
  context: string;
  decision: string;
  consequences: string;
  alternativesConsidered?: string;
  impact: "low" | "medium" | "high" | "critical";
  createdAt?: string;
  updatedAt?: string;
}

export interface Release {
  id?: string;
  projectId: string;
  version: string;
  title: string;
  description: string;
  releaseDate?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RealityCheck {
  id?: string;
  projectId: string;
  featureId?: string;
  repositorySnapshot: Record<string, any>;
  verificationStatus: "not_started" | "in_progress" | "implemented" | "verified" | "broken";
  repositoryFiles: string[];
  mismatchReport: Record<string, any>;
  verifiedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// --- Repository Implementation ---

export class ProjectRepository {
  public getClient() {
    return getSupabaseClient();
  }

  // === Projects ===

  async getAllProjects(): Promise<Project[]> {
    if (!isSupabaseConfigured()) {
      logger.warn("Supabase not configured. Returning empty list of projects.");
      return [];
    }

    try {
      logger.info("Fetching all projects from Supabase projects table...");
      const { data, error } = await this.getClient()
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        repositoryUrl: row.repository_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch projects:", err.message || err);
      throw err;
    }
  }

  async createProject(project: Project): Promise<Project> {
    if (!isSupabaseConfigured()) {
      throw new Error("Cannot create project. Supabase is not configured.");
    }

    try {
      logger.info(`Creating project "${project.name}" in Supabase...`);
      const { data, error } = await this.getClient()
        .from("projects")
        .insert({
          name: project.name,
          description: project.description,
          repository_url: project.repositoryUrl,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        repositoryUrl: data.repository_url,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error(`Failed to create project:`, err.message || err);
      throw err;
    }
  }

  // === Repositories ===

  async getRepositoriesByProject(projectId: string): Promise<GithubRepository[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("repositories")
        .select("*")
        .eq("project_id", projectId);

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        owner: row.owner,
        repoName: row.repo_name,
        branch: row.branch,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch repositories:", err.message || err);
      throw err;
    }
  }

  async addRepository(repo: GithubRepository): Promise<GithubRepository> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("repositories")
        .insert({
          project_id: repo.projectId,
          owner: repo.owner,
          repo_name: repo.repoName,
          branch: repo.branch || "main",
          is_active: repo.isActive !== false
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        projectId: data.project_id,
        owner: data.owner,
        repoName: data.repo_name,
        branch: data.branch,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to add repository:", err.message || err);
      throw err;
    }
  }

  // === Architecture Components ===

  async getArchitectureByProject(projectId: string): Promise<ArchitectureComponent[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("architecture")
        .select("*")
        .eq("project_id", projectId);

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        componentName: row.component_name,
        description: row.description,
        techStack: row.tech_stack,
        designPatterns: row.design_patterns,
        filePaths: row.file_paths,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch architecture components:", err.message || err);
      throw err;
    }
  }

  async addArchitecture(arch: ArchitectureComponent): Promise<ArchitectureComponent> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("architecture")
        .insert({
          project_id: arch.projectId,
          component_name: arch.componentName,
          description: arch.description,
          tech_stack: arch.techStack || [],
          design_patterns: arch.designPatterns || [],
          file_paths: arch.filePaths || [],
          metadata: arch.metadata || {}
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        projectId: data.project_id,
        componentName: data.component_name,
        description: data.description,
        techStack: data.tech_stack,
        designPatterns: data.design_patterns,
        filePaths: data.file_paths,
        metadata: data.metadata,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to add architecture component:", err.message || err);
      throw err;
    }
  }

  // === Tasks ===

  async getTasksByProject(projectId: string): Promise<ProjectTask[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
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
      logger.error("Failed to fetch tasks:", err.message || err);
      throw err;
    }
  }

  async addTask(task: ProjectTask): Promise<ProjectTask> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("tasks")
        .insert({
          project_id: task.projectId,
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
      logger.error("Failed to add task:", err.message || err);
      throw err;
    }
  }

  async updateTaskStatus(taskId: string, status: ProjectTask["status"]): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { error } = await this.getClient()
        .from("tasks")
        .update({ status })
        .eq("id", taskId);

      if (error) throw error;
    } catch (err: any) {
      logger.error(`Failed to update task status for task ${taskId}:`, err.message || err);
      throw err;
    }
  }

  // === Bugs ===

  async getBugsByProject(projectId: string): Promise<ProjectBug[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("bugs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        description: row.description,
        filePath: row.file_path,
        lineNumber: row.line_number,
        status: row.status,
        severity: row.severity,
        reproductionSteps: row.reproduction_steps,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch bugs:", err.message || err);
      throw err;
    }
  }

  async addBug(bug: ProjectBug): Promise<ProjectBug> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("bugs")
        .insert({
          project_id: bug.projectId,
          title: bug.title,
          description: bug.description,
          file_path: bug.filePath,
          line_number: bug.lineNumber,
          status: bug.status || "open",
          severity: bug.severity || "medium",
          reproduction_steps: bug.reproductionSteps
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        projectId: data.project_id,
        title: data.title,
        description: data.description,
        filePath: data.file_path,
        lineNumber: data.line_number,
        status: data.status,
        severity: data.severity,
        reproductionSteps: data.reproduction_steps,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to add bug:", err.message || err);
      throw err;
    }
  }

  async updateBugStatus(bugId: string, status: ProjectBug["status"]): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { error } = await this.getClient()
        .from("bugs")
        .update({ status })
        .eq("id", bugId);

      if (error) throw error;
    } catch (err: any) {
      logger.error(`Failed to update bug status for bug ${bugId}:`, err.message || err);
      throw err;
    }
  }

  // === Decisions (ADR) ===

  async getDecisionsByProject(projectId: string): Promise<ArchitecturalDecision[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("decisions")
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
        impact: row.impact,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch decisions:", err.message || err);
      throw err;
    }
  }

  async addDecision(decision: ArchitecturalDecision): Promise<ArchitecturalDecision> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("decisions")
        .insert({
          project_id: decision.projectId,
          title: decision.title,
          context: decision.context,
          decision: decision.decision,
          consequences: decision.consequences,
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
        impact: data.impact,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to add decision:", err.message || err);
      throw err;
    }
  }

  // === System Prompts ===

  async getPrompts(): Promise<SystemPrompt[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("prompts")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        purpose: row.purpose,
        promptText: row.prompt_text,
        version: row.version,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch prompts:", err.message || err);
      throw err;
    }
  }

  async addPrompt(prompt: SystemPrompt): Promise<SystemPrompt> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("prompts")
        .insert({
          name: prompt.name,
          purpose: prompt.purpose,
          prompt_text: prompt.promptText,
          version: prompt.version || 1,
          is_active: prompt.isActive !== false
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        name: data.name,
        purpose: data.purpose,
        promptText: data.prompt_text,
        version: data.version,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to add prompt:", err.message || err);
      throw err;
    }
  }

  // === Conversations ===

  async getConversations(projectId: string): Promise<Conversation[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await this.getClient()
        .from("conversations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch conversations:", err.message || err);
      throw err;
    }
  }

  async createConversation(projectId: string, title?: string, metadata: Record<string, any> = {}): Promise<Conversation> {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    try {
      const { data, error } = await this.getClient()
        .from("conversations")
        .insert({
          project_id: projectId,
          title: title || "New Conversation",
          metadata: metadata
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        projectId: data.project_id,
        title: data.title,
        metadata: data.metadata,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to create conversation:", err.message || err);
      throw err;
    }
  }

  // === Assistant Memories (Messages) ===

  async getMemoriesByProjectId(projectId: string): Promise<AssistantMemory[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      logger.info(`Fetching conversational memories for project ${projectId}...`);
      const { data, error } = await this.getClient()
        .from("assistant_memories")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        conversationId: row.conversation_id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch memories by project ID:", err.message || err);
      throw err;
    }
  }

  async getMemoriesByConversationId(conversationId: string): Promise<AssistantMemory[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      logger.info(`Fetching conversational memories for conversation thread ${conversationId}...`);
      const { data, error } = await this.getClient()
        .from("assistant_memories")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        conversationId: row.conversation_id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch memories by conversation ID:", err.message || err);
      throw err;
    }
  }

  async getConversationByTelegramChatId(chatId: string): Promise<Conversation | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data, error } = await this.getClient()
        .from("conversations")
        .select("*")
        .eq("metadata->>telegram_chat_id", chatId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        projectId: data.project_id,
        title: data.title,
        metadata: data.metadata,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error("Failed to fetch conversation by Telegram chat ID:", err.message || err);
      throw err;
    }
  }

  async clearMemoriesByConversationId(conversationId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    try {
      logger.info(`Deleting conversational history for conversation thread ${conversationId}...`);
      const { error } = await this.getClient()
        .from("assistant_memories")
        .delete()
        .eq("conversation_id", conversationId);

      if (error) throw error;
    } catch (err: any) {
      logger.error("Failed to clear memories by conversation ID:", err.message || err);
      throw err;
    }
  }

  async saveMemory(memory: AssistantMemory): Promise<AssistantMemory> {
    if (!isSupabaseConfigured()) {
      throw new Error("Cannot save memory. Supabase is not configured.");
    }

    try {
      logger.info(`Saving agent memory statement...`);
      const { data, error } = await this.getClient()
        .from("assistant_memories")
        .insert({
          project_id: memory.projectId,
          conversation_id: memory.conversationId,
          role: memory.role,
          content: memory.content,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        projectId: data.project_id,
        conversationId: data.conversation_id,
        role: data.role,
        content: data.content,
        createdAt: data.created_at
      };
    } catch (err: any) {
      logger.error("Failed to save memory record:", err.message || err);
      throw err;
    }
  }

  // === Repo Files Metadata Cache ===

  async getRepoFilesByProject(projectId: string): Promise<RepoFile[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      logger.info(`Fetching cached repo files for project ${projectId}...`);
      const { data, error } = await this.getClient()
        .from("repo_files")
        .select("*")
        .eq("project_id", projectId);

      if (error) {
        if (error.code === "PGRST116" || error.message?.includes("does not exist")) {
          logger.warn("repo_files table does not exist in database yet. Falling back to empty array.");
          return [];
        }
        throw error;
      }

      return (data || []).map(row => ({
        id: row.id,
        projectId: row.project_id,
        path: row.path,
        name: row.name,
        size: row.size,
        sha: row.sha,
        downloadUrl: row.download_url,
        content: row.content,
        summary: row.summary,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err: any) {
      logger.error("Failed to fetch repo files:", err.message || err);
      return []; // Return empty on schema issues
    }
  }

  async getRepoFileByPath(projectId: string, path: string): Promise<RepoFile | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data, error } = await this.getClient()
        .from("repo_files")
        .select("*")
        .eq("project_id", projectId)
        .eq("path", path)
        .maybeSingle();

      if (error) {
        if (error.message?.includes("does not exist")) {
          return null;
        }
        throw error;
      }
      if (!data) return null;

      return {
        id: data.id,
        projectId: data.project_id,
        path: data.path,
        name: data.name,
        size: data.size,
        sha: data.sha,
        downloadUrl: data.download_url,
        content: data.content,
        summary: data.summary,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error(`Failed to fetch repo file by path (${path}):`, err.message || err);
      return null;
    }
  }

  async saveRepoFile(file: RepoFile): Promise<RepoFile | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data, error } = await this.getClient()
        .from("repo_files")
        .upsert({
          project_id: file.projectId,
          path: file.path,
          name: file.name,
          size: file.size,
          sha: file.sha,
          download_url: file.downloadUrl,
          content: file.content,
          summary: file.summary
        }, { onConflict: "project_id,path" })
        .select()
        .single();

      if (error) {
        if (error.message?.includes("does not exist")) {
          logger.warn("repo_files table not found, skipping saveRepoFile.");
          return null;
        }
        throw error;
      }

      return {
        id: data.id,
        projectId: data.project_id,
        path: data.path,
        name: data.name,
        size: data.size,
        sha: data.sha,
        downloadUrl: data.download_url,
        content: data.content,
        summary: data.summary,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (err: any) {
      logger.error(`Failed to save repo file metadata (${file.path}):`, err.message || err);
      return null;
    }
  }

  async saveRepoFiles(files: RepoFile[]): Promise<void> {
    if (!isSupabaseConfigured() || files.length === 0) return;
    try {
      logger.info(`Bulk upserting ${files.length} repo files to database...`);
      // Process in chunks of 50 to avoid payload size constraints
      const chunkSize = 50;
      for (let i = 0; i < files.length; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize).map(f => ({
          project_id: f.projectId,
          path: f.path,
          name: f.name,
          size: f.size,
          sha: f.sha,
          download_url: f.downloadUrl,
          content: f.content,
          summary: f.summary
        }));

        const { error } = await this.getClient()
          .from("repo_files")
          .upsert(chunk, { onConflict: "project_id,path" });

        if (error) {
          if (error.message?.includes("does not exist")) {
            logger.warn("repo_files table not found, skipping bulk upsert.");
            return;
          }
          throw error;
        }
      }
    } catch (err: any) {
      logger.error("Failed to bulk save repo files:", err.message || err);
    }
  }

  async clearRepoFiles(projectId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    try {
      logger.info(`Clearing cached repo files for project ${projectId}...`);
      const { error } = await this.getClient()
        .from("repo_files")
        .delete()
        .eq("project_id", projectId);

      if (error) {
        if (error.message?.includes("does not exist")) {
          return;
        }
        throw error;
      }
    } catch (err: any) {
      logger.error("Failed to clear repo files:", err.message || err);
    }
  }
}

export const projectRepository = new ProjectRepository();
