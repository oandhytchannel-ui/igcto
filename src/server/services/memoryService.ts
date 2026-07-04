/**
 * StudyIG CTO - Reusable Memory Service
 * 
 * Manages conversation lookups, context fetching, message persistence,
 * and history resets using the project repository inside the isolated schema.
 */

import { projectRepository, Conversation, AssistantMemory, Project } from "../repositories/projectRepository.js";
import { logger } from "../lib/logger.js";

export class MemoryService {
  /**
   * Retrieves or creates a conversation associated with a specific Telegram Chat ID.
   * Automatically provisions a default project workspace if none exists yet.
   */
  async getOrCreateConversation(chatId: string): Promise<{ conversation: Conversation; project: Project }> {
    // 1. Look for an existing conversation mapping to this Telegram chat ID
    let conversation = await projectRepository.getConversationByTelegramChatId(chatId);
    let project: Project;

    if (conversation) {
      // Fetch associated project details
      const projects = await projectRepository.getAllProjects();
      const existingProject = projects.find(p => p.id === conversation!.projectId);
      if (existingProject) {
        project = existingProject;
      } else {
        project = await this.ensureDefaultProject();
        // Correct project association if it was broken
        conversation.projectId = project.id!;
      }
      return { conversation, project };
    }

    // 2. Provision default project if it is a new conversation thread
    project = await this.ensureDefaultProject();

    // 3. Create a new conversation mapping with the chat ID stored in metadata
    logger.info(`Creating a new conversation thread for Telegram Chat ID ${chatId}...`);
    conversation = await projectRepository.createConversation(
      project.id!,
      `Telegram Chat ${chatId}`,
      { telegram_chat_id: chatId.toString() }
    );

    return { conversation, project };
  }

  /**
   * Ensures at least one project exists in the database.
   */
  private async ensureDefaultProject(): Promise<Project> {
    const projects = await projectRepository.getAllProjects();
    if (projects.length > 0) {
      return projects[0]; // Reuse existing workspace
    }

    logger.info("No projects found in database. Initializing Default Project workspace...");
    return await projectRepository.createProject({
      name: "StudyIG Core",
      description: "Default Workspace for the StudyIG CTO Assistant integrations"
    });
  }

  /**
   * Retrieves the last N messages of a conversation.
   */
  async getRecentContext(conversationId: string, limit: number = 20): Promise<AssistantMemory[]> {
    logger.info(`Loading context history (limit: ${limit}) for conversation ${conversationId}`);
    const allMemories = await projectRepository.getMemoriesByConversationId(conversationId);
    
    // Grabs the last N records (already ordered ascending by database query)
    if (allMemories.length <= limit) {
      return allMemories;
    }
    return allMemories.slice(-limit);
  }

  /**
   * Stores a conversational message.
   */
  async storeMessage(
    conversationId: string,
    projectId: string,
    role: "user" | "assistant" | "system",
    content: string
  ): Promise<AssistantMemory> {
    return await projectRepository.saveMemory({
      conversationId,
      projectId,
      role,
      content
    });
  }

  /**
   * Clears all memories for a conversation thread.
   */
  async clearHistory(conversationId: string): Promise<void> {
    await projectRepository.clearMemoriesByConversationId(conversationId);
  }
}

export const memoryService = new MemoryService();
