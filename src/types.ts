/**
 * StudyIG CTO - Shared TypeScript Type Definitions
 */

export interface ServiceStatus {
  status: "configured" | "missing";
  description: string;
}

export interface DiagnosticsReport {
  status: string;
  timestamp: string;
  environment: string;
  services: {
    gemini: ServiceStatus;
    supabase: ServiceStatus;
    telegram: ServiceStatus;
    github: ServiceStatus;
  };
  appUrl: string;
}

export interface TechStackItem {
  name: string;
  description: string;
}

export interface FolderItem {
  path: string;
  purpose: string;
}

export interface ArchitectureInfo {
  appName: string;
  phase: number;
  techStack: TechStackItem[];
  folders: FolderItem[];
}

export interface FileExplainer {
  name: string;
  path: string;
  purpose: string;
  keyHighlights: string[];
  snippet: string;
}
