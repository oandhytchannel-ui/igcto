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
  RepoFile,
  RealityCheck
} from "../repositories/projectRepository.js";
export { projectRepository } from "../repositories/projectRepository.js";
export { realityCheckRepository } from "../repositories/realityCheckRepository.js";

export function isSupabaseAvailable(): boolean {
  return isSupabaseConfigured();
}
