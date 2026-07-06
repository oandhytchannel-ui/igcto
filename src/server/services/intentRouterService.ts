import { geminiProvider } from "./geminiProvider.js";
import { studyigDbService } from "./studyigDbService.js";
import { repoIntelligenceService } from "./repoIntelligenceService.js";
import { roadmapRepository } from "../repositories/roadmapRepository.js";
import { bugReportRepository } from "../repositories/bugReportRepository.js";
import { taskRepository } from "../repositories/taskRepository.js";
import { technicalDebtRepository } from "../repositories/technicalDebtRepository.js";
import { releaseRepository } from "../repositories/releaseRepository.js";
import { architectureDecisionRepository } from "../repositories/architectureDecisionRepository.js";
import { logger } from "../lib/logger.js";
import { config } from "../config.js";

export interface IntentAnalysis {
  requiresRepositoryInspection: boolean;
  requiresStudyigDbInspection: boolean;
  requiresRlsInspection: boolean;
  requiresAlignmentAudit: boolean;
  requiresCtoPlanningDb: boolean;
  keywords: string[];
  focusAreas: string[];
  explanation: string;
}

export interface EvidenceCollectionResult {
  evidenceText: string;
  evidenceUsed: string[];
  unavailable: string[];
  confidenceLevel: "High" | "Medium" | "Low";
  confidenceJustification: string;
  executionPlanLog: string;
}

export class IntentRouterService {
  /**
   * Analyzes the user's incoming message and detects which engineering modules to inspect.
   */
  async analyzeIntent(userMessage: string): Promise<IntentAnalysis> {
    const prompt = `
You are the StudyIG Intent Router. Your task is to analyze the developer's message and determine which engineering sub-systems or inspection tools need to be queried to gather evidence before answering.

Respond ONLY with a JSON object matching this structure:
{
  "requiresRepositoryInspection": boolean, // true if they mention code, imports, files, routes, functions, API structures, etc.
  "requiresStudyigDbInspection": boolean,   // true if they mention profiles, students, tutors, courses, payments, DB health, columns, tables, data schemas, etc.
  "requiresRlsInspection": boolean,         // true if they mention row level security, policies, access control, security, permissions, etc.
  "requiresAlignmentAudit": boolean,        // true if they mention alignment, mismatches, missing columns/tables, system readiness, or "broken" features.
  "requiresCtoPlanningDb": boolean,         // true if they mention roadmap, tasks, epics, milestones, bugs, backlog, technical debt, decisions, or planned releases.
  "keywords": string[],                     // specific table names, environment variables, APIs, or keywords (e.g. ["profiles", "STUDYIG_SUPABASE_URL", "auth"]).
  "focusAreas": string[],                   // system focus areas (e.g. ["authentication", "payments", "tutors", "courses", "meetings"]).
  "explanation": string                     // brief 1-sentence explanation of why these systems are relevant.
}

Examples:
- "Why are students unable to join courses?" -> requiresRepositoryInspection: true, requiresStudyigDbInspection: true, requiresRlsInspection: true, requiresAlignmentAudit: true
- "Is the payment system production ready?" -> requiresRepositoryInspection: true, requiresStudyigDbInspection: true, requiresRlsInspection: true, requiresAlignmentAudit: true, focusAreas: ["payments"]
- "What is our planned roadmap?" -> requiresCtoPlanningDb: true
- "Audit my authentication system" -> requiresRepositoryInspection: true, requiresStudyigDbInspection: true, requiresRlsInspection: true, focusAreas: ["authentication"]

User Message: "${userMessage.replace(/"/g, '\\"')}"
`;

    try {
      logger.info("[Intent Router] Analyzing user prompt intent...");
      const result = await geminiProvider.generateStructuredJSON<IntentAnalysis>(prompt, { temperature: 0.1 });
      logger.info(`[Intent Router] Detected Intent: db=${result.requiresStudyigDbInspection}, repo=${result.requiresRepositoryInspection}, rls=${result.requiresRlsInspection}, cto=${result.requiresCtoPlanningDb}`);
      return result;
    } catch (err: any) {
      logger.error("[Intent Router] Intent parsing failed, falling back to all-inspections default:", err.message || err);
      return {
        requiresRepositoryInspection: true,
        requiresStudyigDbInspection: true,
        requiresRlsInspection: true,
        requiresAlignmentAudit: true,
        requiresCtoPlanningDb: true,
        keywords: [],
        focusAreas: [],
        explanation: "Fallback to comprehensive diagnostic inspections.",
      };
    }
  }

  /**
   * Dispatches and collects grounding evidence across all selected modules concurrently.
   * Tracks start, completion, execution times, failures, and skipped items.
   */
  async collectEvidence(intent: IntentAnalysis, projectId: string): Promise<EvidenceCollectionResult> {
    const evidenceChunks: string[] = [];
    const promises: Promise<void>[] = [];
    
    // Tracking lists for evidence summary & confidence assessment
    const evidenceUsed: string[] = [];
    const unavailable: string[] = [];
    const planLines: string[] = [];

    // Always include Environment Config check
    evidenceUsed.push("Environment Configuration");

    // Pre-populate standard mock / unavailable components as required by Phase 8 spec
    unavailable.push("Runtime Logs");
    unavailable.push("Deployment Logs");

    // Define Boolean flags for task planning
    const repoNeeded = intent.requiresRepositoryInspection || intent.requiresAlignmentAudit;
    const dbNeeded = intent.requiresStudyigDbInspection || intent.requiresRlsInspection || intent.requiresAlignmentAudit;
    const rlsNeeded = intent.requiresRlsInspection || intent.requiresAlignmentAudit;
    const ctoNeeded = intent.requiresCtoPlanningDb;

    logger.info("[Planner] Constructing internal execution plan...");
    planLines.push("Execution Plan");
    planLines.push(repoNeeded ? "✓ Inspect repository" : "• Inspect repository (Skipped)");
    planLines.push(dbNeeded ? "✓ Inspect StudyIG database" : "• Inspect StudyIG database (Skipped)");
    planLines.push(rlsNeeded ? "✓ Inspect RLS" : "• Inspect RLS (Skipped)");
    planLines.push(repoNeeded ? "✓ Inspect relevant API routes" : "• Inspect relevant API routes (Skipped)");
    planLines.push("✓ Inspect deployment configuration");
    planLines.push("✓ Generate findings");
    planLines.push("✓ Explain root cause");

    // 1. Module: GitHub Repository
    if (repoNeeded) {
      promises.push(
        (async () => {
          const moduleName = "GitHub Repository Inspection";
          logger.info(`[Planner] Start: ${moduleName}`);
          const start = Date.now();
          try {
            const indexedFiles = await repoIntelligenceService.getIndexedFiles();
            const duration = Date.now() - start;
            logger.info(`[Planner] Completion: ${moduleName} in ${duration}ms`);

            if (indexedFiles && indexedFiles.length > 0) {
              evidenceUsed.push("Repository");
              evidenceUsed.push("API Routes"); // Verified paths are accessible

              evidenceChunks.push(`### 📂 GitHub Codebase Files (${indexedFiles.length} files scanned)`);
              
              const keywordsAndAreas = [...intent.keywords, ...intent.focusAreas].map(k => k.toLowerCase());
              const relevantFiles = indexedFiles.filter(file => {
                const pathLower = file.path.toLowerCase();
                return keywordsAndAreas.some(kw => pathLower.includes(kw) || file.name.toLowerCase().includes(kw));
              });

              if (relevantFiles.length > 0) {
                evidenceChunks.push(`#### Relevant Codebase Files:\n` + 
                  relevantFiles.slice(0, 10).map(f => `- \`${f.path}\` (${f.size} bytes)${f.summary ? `: ${f.summary}` : ""}`).join("\n")
                );

                const configFiles = relevantFiles.filter(f => f.path.includes("config") || f.path.includes("route") || f.path.includes("controller") || f.path.includes("service"));
                for (const file of configFiles.slice(0, 3)) {
                  if (file.content) {
                    evidenceChunks.push(`#### File Content Preview (\`${file.path}\`):\n\`\`\`typescript\n${file.content.slice(0, 1500)}\n\`\`\``);
                  }
                }
              } else {
                evidenceChunks.push(`- Total files found: ${indexedFiles.length}. (No highly matching files for keywords: ${keywordsAndAreas.join(", ")} found, showing top files instead)`);
                evidenceChunks.push(indexedFiles.slice(0, 10).map(f => `- \`${f.path}\` (${f.size} bytes)`).join("\n"));
              }
            } else {
              unavailable.push("Repository Files Index");
              evidenceChunks.push("### 📂 GitHub Codebase\n- **Status**: No repository files indexed yet. Recommend running `/scan` first.");
            }
          } catch (err: any) {
            const duration = Date.now() - start;
            logger.error(`[Planner] Failure: ${moduleName} failed in ${duration}ms: ${err.message || err}`);
            unavailable.push("Repository");
            evidenceChunks.push(`### 📂 GitHub Codebase\n- **Status**: Failed to inspect: ${err.message || err}`);
          }
        })()
      );
    } else {
      logger.info(`[Planner] Skipped: GitHub Repository Inspection`);
    }

    // 2. Module: StudyIG Production Database
    if (dbNeeded) {
      promises.push(
        (async () => {
          const moduleName = "StudyIG Production Database Inspection";
          logger.info(`[Planner] Start: ${moduleName}`);
          const start = Date.now();
          try {
            const hasUrl = config.hasStudyigSupabaseUrl;
            const hasKey = config.hasStudyigSupabaseKey;
            
            if (hasUrl && hasKey) {
              const { mergedTables, audit, live } = await studyigDbService.buildCombinedMetadata();
              const duration = Date.now() - start;
              logger.info(`[Planner] Completion: ${moduleName} in ${duration}ms`);

              evidenceUsed.push("StudyIG Database");
              if (rlsNeeded) {
                evidenceUsed.push("RLS Policies");
              }

              evidenceChunks.push(`### 🛢️ StudyIG Production Database`);
              evidenceChunks.push(`- **Catalog Size**: ${mergedTables.length} tables, ${live.views?.length || 0} views.`);
              
              const tableSummary = mergedTables.map(t => {
                const pk = t.columns.find(c => c.isPrimary)?.name || "none";
                const fkCount = t.columns.filter(c => c.isForeign).length;
                return `- \`${t.name}\`: ${t.columns.length} columns (PK: \`${pk}\`, FKs: ${fkCount}), RLS: ${t.rlsEnabled ? "🟢 Enabled" : "🔴 Disabled"}`;
              }).join("\n");
              
              evidenceChunks.push(`#### Tables Inventory:\n${tableSummary}`);

              const keywordsAndAreas = [...intent.keywords, ...intent.focusAreas].map(k => k.toLowerCase());
              const matchedTables = mergedTables.filter(t => keywordsAndAreas.some(kw => t.name.toLowerCase().includes(kw)));
              if (matchedTables.length > 0) {
                evidenceChunks.push(`#### Focus Tables Schema Details:`);
                for (const t of matchedTables) {
                  const cols = t.columns.map(c => `  - \`${c.name}\` (${c.type})${c.nullable ? "" : " NOT NULL"}${c.isPrimary ? " [PK]" : ""}${c.isForeign ? ` [FK -> ${c.referencesTable}.${c.referencesColumn}]` : ""}`).join("\n");
                  evidenceChunks.push(`- \`${t.name}\` schema:\n${cols}\n- **RLS Policies**: ${JSON.stringify(t.policies || [])}`);
                }
              }

              if (intent.requiresRlsInspection && audit.rlsIssues.length > 0) {
                evidenceChunks.push(`#### Row Level Security (RLS) Violations:\n` +
                  audit.rlsIssues.map(i => `- **[${i.severity}]** \`${i.table}\`: ${i.issue}\n  Recommendation: \`${i.recommendation}\``).join("\n")
                );
              }

              if (intent.requiresAlignmentAudit && audit.mismatches.length > 0) {
                evidenceChunks.push(`#### Code & Schema Mismatches:\n` +
                  audit.mismatches.map(m => `- **[${m.severity}]** \`${m.table}\`${m.column ? `.\`${m.column}\`` : ""}: ${m.description}`).join("\n")
                );
              }
            } else {
              const duration = Date.now() - start;
              logger.warn(`[Planner] Skipped: ${moduleName} due to missing database credentials.`);
              unavailable.push("StudyIG Database");
              if (rlsNeeded) {
                unavailable.push("RLS Policies");
              }
              evidenceChunks.push(`### 🛢️ StudyIG Production Database\n- **Status**: Live database credentials not configured in environmental parameters.`);
            }
          } catch (err: any) {
            const duration = Date.now() - start;
            logger.error(`[Planner] Failure: ${moduleName} failed in ${duration}ms: ${err.message || err}`);
            unavailable.push("StudyIG Database");
            if (rlsNeeded) {
              unavailable.push("RLS Policies");
            }
            evidenceChunks.push(`### 🛢️ StudyIG Production Database\n- **Status**: Failed to fetch live metadata: ${err.message || err}`);
          }
        })()
      );
    } else {
      logger.info(`[Planner] Skipped: StudyIG Production Database Inspection`);
    }

    // 3. Module: CTO Planning Database
    if (ctoNeeded) {
      promises.push(
        (async () => {
          const moduleName = "CTO Planning Database Inspection";
          logger.info(`[Planner] Start: ${moduleName}`);
          const start = Date.now();
          try {
            const [roadmap, bugs, tasks, techDebt, releases, decisions] = await Promise.all([
              roadmapRepository.getRoadmapByProject(projectId).catch(() => []),
              bugReportRepository.getBugReportsByProject(projectId).catch(() => []),
              taskRepository.getTasksByProject(projectId).catch(() => []),
              technicalDebtRepository.getTechnicalDebtByProject(projectId).catch(() => []),
              releaseRepository.getReleasesByProject(projectId).catch(() => []),
              architectureDecisionRepository.getArchitectureDecisionsByProject(projectId).catch(() => []),
            ]);
            const duration = Date.now() - start;
            logger.info(`[Planner] Completion: ${moduleName} in ${duration}ms`);

            evidenceUsed.push("CTO Database / Planner");

            evidenceChunks.push(`### 📊 CTO Planning Database (studyig_cto)`);
            evidenceChunks.push(`- **Inventory**: Roadmap items (${roadmap.length}), active Bugs (${bugs.length}), Tasks (${tasks.length}), Technical Debt (${techDebt.length}), Releases (${releases.length}), Architecture Decisions (${decisions.length})`);

            if (roadmap.length > 0) {
              evidenceChunks.push(`#### Planned Roadmap Milestones:\n` + 
                roadmap.slice(0, 5).map(r => `- **${r.title}** (${r.status}): ${r.description}`).join("\n")
              );
            }
            if (bugs.length > 0) {
              evidenceChunks.push(`#### Current Open Bugs:\n` +
                bugs.slice(0, 5).map(b => `- **[${b.severity}]** ${b.title} (${b.status}): ${b.description}`).join("\n")
              );
            }
            if (techDebt.length > 0) {
              evidenceChunks.push(`#### Active Technical Debt:\n` +
                techDebt.slice(0, 5).map(t => `- **[${t.impact}]** ${t.title}: ${t.description}`).join("\n")
              );
            }
            if (decisions.length > 0) {
              evidenceChunks.push(`#### Architectural Decisions:\n` +
                decisions.slice(0, 5).map(d => `- **${d.title}**: Approved Decision: ${d.decision}`).join("\n")
              );
            }
          } catch (err: any) {
            const duration = Date.now() - start;
            logger.error(`[Planner] Failure: ${moduleName} failed in ${duration}ms: ${err.message || err}`);
            unavailable.push("CTO Database / Planner");
            evidenceChunks.push(`### 📊 CTO Planning Database\n- **Status**: Failed to inspect planning tables: ${err.message || err}`);
          }
        })()
      );
    } else {
      logger.info(`[Planner] Skipped: CTO Planning Database Inspection`);
    }

    // 4. Always Execute: System Environment configuration check
    promises.push(
      (async () => {
        const moduleName = "System Environment Configuration Inspection";
        logger.info(`[Planner] Start: ${moduleName}`);
        const start = Date.now();
        
        evidenceChunks.push(`### ⚙️ System Environment Configuration`);
        evidenceChunks.push(`- **TELEGRAM_BOT_TOKEN**: ${config.hasTelegramToken ? "🟢 Configured" : "🔴 Missing"}`);
        evidenceChunks.push(`- **GITHUB_TOKEN**: ${config.hasGithubToken ? "🟢 Configured" : "🔴 Missing"}`);
        evidenceChunks.push(`- **STUDYIG_SUPABASE_URL**: ${config.hasStudyigSupabaseUrl ? "🟢 Configured" : "🔴 Missing"}`);
        evidenceChunks.push(`- **STUDYIG_SUPABASE_SERVICE_ROLE_KEY**: ${config.hasStudyigSupabaseKey ? "🟢 Configured" : "🔴 Missing"}`);
        
        const duration = Date.now() - start;
        logger.info(`[Planner] Completion: ${moduleName} in ${duration}ms`);
      })()
    );

    // Concurrently execute all scheduled evidence inspection promises
    await Promise.all(promises);

    // Enforce default diagnostic states
    if (repoNeeded && !evidenceUsed.includes("Repository")) {
      evidenceChunks.push(`### 📂 GitHub Codebase\n- **Verification**: Unable to verify from available project data.`);
    }
    if (dbNeeded && !evidenceUsed.includes("StudyIG Database")) {
      evidenceChunks.push(`### 🛢️ StudyIG Production Database\n- **Verification**: Unable to verify from available project data.`);
    }

    // Determine confidence level strictly based on verified evidence
    let confidenceLevel: "High" | "Medium" | "Low" = "Medium";
    let confidenceJustification = "";

    const verifiedRepo = evidenceUsed.includes("Repository");
    const verifiedDb = evidenceUsed.includes("StudyIG Database");

    if (verifiedRepo && verifiedDb) {
      confidenceLevel = "High";
      confidenceJustification = "Repository codebase structure and production database schemas both confirm system state.";
    } else if (verifiedRepo && !verifiedDb) {
      confidenceLevel = "Medium";
      confidenceJustification = "Repository confirms implementation state, but production database or live verification is currently unavailable.";
    } else {
      confidenceLevel = "Low";
      confidenceJustification = "Unable to inspect production database or verified repository details. Findings are based on conceptual heuristics.";
    }

    return {
      evidenceText: evidenceChunks.join("\n\n"),
      evidenceUsed,
      unavailable,
      confidenceLevel,
      confidenceJustification,
      executionPlanLog: planLines.join("\n"),
    };
  }
}

export const intentRouterService = new IntentRouterService();
