/**
 * Diagnostics and Architecture Request Controller.
 * Decouples router definition from actual request-response handlers.
 */

import { Request, Response, NextFunction } from "express";
import { getDiagnosticsReport } from "../config.js";
import { geminiProvider } from "../services/geminiProvider.js";

export class DiagnosticsController {
  /**
   * Retrieves active diagnostics status for configured system services.
   */
  getSystemDiagnostics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = getDiagnosticsReport();
      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Returns current high-level architecture parameters and tech stack info.
   */
  getArchitectureMetadata = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const geminiMeta = geminiProvider.getProviderMetadata();
      
      res.json({
        success: true,
        data: {
          appName: "StudyIG CTO",
          phase: 1,
          techStack: [
            { name: "Node.js & Express", description: "Backend application and middleware server" },
            { name: "Vite & React", description: "Frontend user interface and dashboard" },
            { name: "TypeScript", description: "Strict static typing across client and server" },
            { name: "Gemini API", description: `Advanced AI model: ${geminiMeta.modelName} (via ${geminiMeta.providerName} abstraction)` },
            { name: "Supabase", description: "Persistent storage and long-term agent memory" },
            { name: "Telegram Bot API", description: "Conversational mobile interaction interface" },
            { name: "GitHub API", description: "Remote repository indexing and analysis source (Read-Only)" }
          ],
          folders: [
            { path: "/src/server", purpose: "Backend logic, configuration, and app assembly" },
            { path: "/src/server/controllers", purpose: "Decoupled request / response handling logic" },
            { path: "/src/server/middleware", purpose: "Validation, centralized logging, error interception" },
            { path: "/src/server/services", purpose: "SDK and API service providers (Gemini, Telegram, Github)" },
            { path: "/src/server/repositories", purpose: "Supabase persistence data access layer (DAL)" },
            { path: "/src/server/lib", purpose: "Utility modules, logger, and core SDK wrapper instantiations" },
            { path: "/src/components", purpose: "Modular React dashboard layout components" }
          ]
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

export const diagnosticsController = new DiagnosticsController();
