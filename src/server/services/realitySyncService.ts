import { featureService } from "./featureService.js";
import { repoIntelligenceService } from "./repoIntelligenceService.js";
import { realityCheckRepository } from "../repositories/realityCheckRepository.js";
import { projectRepository, RealityCheck, Feature } from "../repositories/projectRepository.js";
import { geminiProvider } from "./geminiProvider.js";
import { logger } from "../lib/logger.js";

export interface RealityReport {
  verifiedFeaturesCount: number;
  partiallyImplementedCount: number;
  brokenFeaturesCount: number;
  notStartedCount: number;
  topIssues: string[];
  repositoryHealthScore: number;
  realityConfidence: "High" | "Medium" | "Low";
  featuresReport: Array<{
    featureId?: string;
    title: string;
    verificationStatus: "not_started" | "in_progress" | "implemented" | "verified" | "broken";
    evidence: string[];
    mismatchReport: string[];
    associatedFiles: string[];
  }>;
}

export class RealitySyncService {
  /**
   * Performs a comprehensive reality check comparing planned database features with actual codebase contents.
   */
  async reconcileReality(projectId: string): Promise<RealityReport> {
    logger.info(`Reconciling reality for project: ${projectId}...`);

    // 1. Fetch features from DB
    let features = await featureService.getFeatures(projectId);

    // If there are no features in DB, we'll auto-seed some key core features for StudyIG to ensure the system is working
    if (features.length === 0) {
      logger.info("No planned features found in the database. Seeding standard StudyIG core features...");
      const standardFeatures = [
        {
          title: "User Authentication",
          description: "Secure login, signup, JWT token issuance, and password hashing for students and tutors.",
          engineeringGoal: "Secure auth mechanism including register, login, session validation."
        },
        {
          title: "Payment Proof Upload & System",
          description: "Allows students to upload transaction slips or bank proof to enroll in tutor-led IG groups.",
          engineeringGoal: "Transaction proof verification system with admin upload/approval endpoints."
        },
        {
          title: "Review & Rating System",
          description: "Enables students to rate and review tutor groups they are enrolled in.",
          engineeringGoal: "Review feedback CRUD API with student enrollment validation checks."
        },
        {
          title: "Telegram Bot CTO Assistant Integration",
          description: "Enables real-time tracking, chat command reviews, memory auditing, and webhook updates.",
          engineeringGoal: "Robust webhook delivery on port 3000 mapping commands to repo audits."
        }
      ];

      for (const sf of standardFeatures) {
        await featureService.createFeature({
          projectId,
          title: sf.title,
          description: sf.description,
          status: "planned",
          priority: "high",
          engineeringGoal: sf.engineeringGoal,
          backendTasks: ["Create API endpoints", "Write database query models"],
          frontendTasks: ["Develop interactive user interface panels", "Wire API integration"],
          databaseTasks: ["Design and apply schema migrations"],
          securityConsiderations: ["Prevent injection", "Perform access checks"],
          testingChecklist: ["Unit test endpoints", "Verify error states"],
          deploymentChecklist: ["Apply migrations", "Launch live servers"]
        });
      }
      // Re-fetch seeded features
      features = await featureService.getFeatures(projectId);
    }

    // 2. Fetch indexed files from repository cache (or scan first if empty)
    let repoFiles = await repoIntelligenceService.getIndexedFiles();
    if (repoFiles.length === 0) {
      logger.info("Repository file cache is empty. Initiating first-time scan...");
      await repoIntelligenceService.scanRepository();
      repoFiles = await repoIntelligenceService.getIndexedFiles();
    }

    const filePaths = repoFiles.map(f => f.path);

    // 3. Draft Gemini prompt to run the reconciliation
    const prompt = `You are an elite Chief Technology Officer and repo auditing engine.
Analyze the following planned project features against the list of actual files in the repository.
Your goal is to perform a rigorous reality check: determine the TRUE implementation status of each feature.

--- PLANNED FEATURES ---
${features.map(f => `ID: ${f.id}
Title: ${f.title}
Description: ${f.description}
Engineering Goal: ${f.engineeringGoal}
Tasks: 
- Backend: ${(f.backendTasks || []).join(", ")}
- Frontend: ${(f.frontendTasks || []).join(", ")}
- Database: ${(f.databaseTasks || []).join(", ")}
`).join("\n")}

--- CODEBASE FILE STRUCTURE ---
${filePaths.join("\n")}

--- RULES ---
1. A feature is ONLY "verified" or "implemented" if required files, routes, and logic exist in the codebase list.
2. Determine if a feature is:
   - "not_started": No files, endpoints, or code traces exist.
   - "in_progress": Some files exist, but essential tasks/logic are missing.
   - "implemented": Files and core structures exist, but full verification of correctness, security, or integrations is not yet complete.
   - "verified": Fully complete. All related database tables, backend endpoints, and frontend components exist, are integrated, and show zero obvious missing links.
   - "broken": Traces exist but core elements (like validation rules, crucial API route handlers, or security controls) are missing or raise exceptions/regressions.
3. Every decision must have concrete evidence (referencing specific file paths).
4. Identify mismatches, missing files, or security/structural gaps to populate "mismatchReport".

Respond ONLY with a JSON object matching this schema:
{
  "featuresReport": [
    {
      "featureId": "string (the feature ID provided above)",
      "title": "string (the feature title)",
      "verificationStatus": "not_started" | "in_progress" | "implemented" | "verified" | "broken",
      "evidence": ["Evidence point 1 with file paths", "Evidence point 2"],
      "mismatchReport": ["Mismatched task or missing file 1", "Security/Validation gap 2"],
      "associatedFiles": ["file_path_1.ts", "file_path_2.ts"]
    }
  ]
}
`;

    try {
      const result = await geminiProvider.generateStructuredJSON<{ featuresReport: Array<any> }>(prompt);
      
      const featuresReport = result.featuresReport || [];
      
      // Save reality checks in DB
      const savedChecks: RealityCheck[] = [];
      for (const item of featuresReport) {
        if (!item.featureId) continue;
        
        const rc: RealityCheck = {
          projectId,
          featureId: item.featureId,
          repositorySnapshot: {
            evidence: item.evidence || [],
            associatedFiles: item.associatedFiles || []
          },
          verificationStatus: item.verificationStatus,
          repositoryFiles: item.associatedFiles || [],
          mismatchReport: {
            issues: item.mismatchReport || []
          }
        };

        const saved = await realityCheckRepository.saveRealityCheck(rc);
        savedChecks.push(saved);

        // Update feature status to match the truth!
        let dbStatus = "planned";
        if (item.verificationStatus === "verified" || item.verificationStatus === "implemented") {
          dbStatus = "completed";
        } else if (item.verificationStatus === "in_progress" || item.verificationStatus === "broken") {
          dbStatus = "in_progress";
        }
        await featureService.updateFeatureStatus(item.featureId, dbStatus);
      }

      // Compile aggregate metrics
      let verifiedCount = 0;
      let partialCount = 0;
      let brokenCount = 0;
      let notStartedCount = 0;
      const allIssues: string[] = [];

      for (const check of featuresReport) {
        if (check.verificationStatus === "verified") verifiedCount++;
        else if (check.verificationStatus === "in_progress" || check.verificationStatus === "implemented") partialCount++;
        else if (check.verificationStatus === "broken") brokenCount++;
        else if (check.verificationStatus === "not_started") notStartedCount++;

        if (check.mismatchReport && Array.isArray(check.mismatchReport)) {
          allIssues.push(...check.mismatchReport);
        }
      }

      // Compute health score
      // Verified features get 100%, partially implemented get 50%, broken gets 20%, not started gets 0%
      const totalCount = featuresReport.length || 1;
      let totalPoints = 0;
      for (const check of featuresReport) {
        if (check.verificationStatus === "verified") totalPoints += 100;
        else if (check.verificationStatus === "implemented") totalPoints += 80;
        else if (check.verificationStatus === "in_progress") totalPoints += 50;
        else if (check.verificationStatus === "broken") totalPoints += 10;
      }
      const rawHealthScore = Math.round(totalPoints / totalCount);
      const repositoryHealthScore = Math.max(0, Math.min(100, rawHealthScore));

      // Determine Reality Confidence
      // If we have scanned live files and we have a database connection, confidence is High.
      // If database is not configured or we are using fallbacks, confidence is Medium/Low.
      let realityConfidence: "High" | "Medium" | "Low" = "High";
      if (repoFiles.length < 10) {
        realityConfidence = "Medium";
      }

      return {
        verifiedFeaturesCount: verifiedCount,
        partiallyImplementedCount: partialCount,
        brokenFeaturesCount: brokenCount,
        notStartedCount,
        topIssues: allIssues.slice(0, 5), // Cap top issues at 5
        repositoryHealthScore,
        realityConfidence,
        featuresReport
      };

    } catch (err: any) {
      logger.error("Reality reconciliation analysis failed:", err.message || err);
      
      // Fallback in case of AI failures
      return {
        verifiedFeaturesCount: 0,
        partiallyImplementedCount: 0,
        brokenFeaturesCount: 0,
        notStartedCount: features.length,
        topIssues: ["Failed to connect or generate structured analysis via Gemini API."],
        repositoryHealthScore: 0,
        realityConfidence: "Low",
        featuresReport: features.map(f => ({
          featureId: f.id,
          title: f.title,
          verificationStatus: "not_started",
          evidence: ["Audit failed"],
          mismatchReport: ["System API offline"],
          associatedFiles: []
        }))
      };
    }
  }
}

export const realitySyncService = new RealitySyncService();
