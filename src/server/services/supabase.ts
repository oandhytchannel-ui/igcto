/**
 * StudyIG CTO - Supabase Memory Service (Phase 1 Refactored)
 *
 * Bridged to use the new repository pattern.
 */

import { isSupabaseConfigured } from "../lib/supabaseClient.js";

export type {
  Project,
  AssistantMemory,
  GithubRepository,
  ArchitectureComponent,
  ProjectTask,
  ProjectBug,
  ArchitecturalDecision,
  SystemPrompt,
  Conversation,
  RepoFile
} from "../repositories/projectRepository.js";
export { projectRepository } from "../repositories/projectRepository.js";

export function isSupabaseAvailable(): boolean {
  return isSupabaseConfigured();
}
