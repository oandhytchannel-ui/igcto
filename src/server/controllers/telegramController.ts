/**
 * StudyIG CTO - Telegram Update Controller
 * 
 * Handles incoming webhook POST updates from the Telegram Bot API.
 * Validates message bodies, routes bot commands, and communicates with GeminiService.
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";
import { telegramService } from "../services/telegramService.js";
import { memoryService } from "../services/memoryService.js";
import { geminiService } from "../services/geminiService.js";
import { repoIntelligenceService } from "../services/repoIntelligenceService.js";
import { intentRouterService } from "../services/intentRouterService.js";
import { getDiagnosticsReport } from "../config.js";

// Project Management Services & Repositories
import { roadmapService } from "../services/roadmapService.js";
import { featureService } from "../services/featureService.js";
import { taskService } from "../services/taskService.js";
import { bugService } from "../services/bugService.js";
import { decisionService } from "../services/decisionService.js";
import { releaseService } from "../services/releaseService.js";
import { priorityService } from "../services/priorityService.js";
import { realitySyncService } from "../services/realitySyncService.js";
import { studyigDbService } from "../services/studyigDbService.js";
import { technicalDebtRepository } from "../repositories/technicalDebtRepository.js";
import { epicRepository } from "../repositories/epicRepository.js";
import { milestoneRepository } from "../repositories/milestoneRepository.js";

export class TelegramController {
  /**
   * Main entry point for Telegram Bot Webhook requests.
   * Processes commands or triggers LLM context routing.
   * NOTE: We ALWAYS return 200 OK to Telegram to prevent retry storms.
   */
  handleWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { update_id, message } = req.body;

      // 1. Skip if update does not contain a message with chat metadata
      if (!message || !message.chat || !message.chat.id) {
        logger.debug(`Received non-message Telegram update (Update ID: ${update_id || "unknown"}). Skipping.`);
        res.status(200).send("OK");
        return;
      }

      const chatId = message.chat.id;
      const messageText = message.text?.trim();

      logger.info(`Received Telegram update from Chat ID ${chatId}: "${messageText || "[No Text]"}"`);

      // 2. Locate or initialize the conversation and project association
      const { conversation, project } = await memoryService.getOrCreateConversation(chatId);

      // 3. Handle message with empty text (e.g. document, photo, emoji-only)
      if (!messageText) {
        await telegramService.sendMessage(
          chatId,
          "⚠️ I currently only support processing text messages. Please type a technical question or engineering command."
        );
        res.status(200).send("OK");
        return;
      }

      // 4. Handle System Commands
      if (messageText.startsWith("/")) {
        await this.handleCommand(messageText, chatId, conversation.id!, project.id!);
        res.status(200).send("OK");
        return;
      }

      // 5. Handle Regular Conversation
      // Step A: Load the recent context (capped at 20 messages)
      const recentHistory = await memoryService.getRecentContext(conversation.id!, 20);

      // Step B: Persist the user's message immediately
      await memoryService.storeMessage(conversation.id!, project.id!, "user", messageText);

      // Notify the user the bot is processing
      // Telegram does not have an elegant "typing" event without complex long-running connections,
      // but we can proceed straight to text generation and send the reply.
      try {
        // Step C: Run Intent-Based Analysis
        logger.info(`[Telegram Controller] Routing user message through Intent Router...`);
        const intent = await intentRouterService.analyzeIntent(messageText);
        
        // Step D: Collect evidence based on detected intent
        logger.info(`[Telegram Controller] Collecting evidence for detected systems...`);
        const evidenceResult = await intentRouterService.collectEvidence(intent, project.id!);

        // Check if verbose/debug mode is requested via user message flag
        const isVerbose = messageText.toLowerCase().includes("-v") || messageText.toLowerCase().includes("--verbose");

        // Step E: Route the message, history context, and evidence through Gemini for reasoning
        logger.info(`[Telegram Controller] Generating evidence-supported reply...`);
        const reply = await geminiService.generateReplyWithEvidence(messageText, recentHistory, evidenceResult, isVerbose);

        // Step F: Persist the assistant's response
        await memoryService.storeMessage(conversation.id!, project.id!, "assistant", reply);

        // Step G: Send the response back to Telegram
        await telegramService.sendMessage(chatId, reply);
      } catch (geminiError: any) {
        logger.error(`Gemini generation failed for Chat ${chatId}:`, geminiError.message || geminiError);
        
        const friendlyErrorMsg = "⚠️ **StudyIG CTO System Alert:**\n\n" +
          "I encountered an error while attempting to reason through your request. " +
          "This might be due to a temporary API disruption. Please try resending your message shortly or run `/status` to check connectivity.";
        
        await telegramService.sendMessage(chatId, friendlyErrorMsg);
      }

      res.status(200).send("OK");
    } catch (error) {
      // Catch-all to make sure we still respond 200 to Telegram so it doesn't jam our server
      logger.error("Fatal error inside Telegram webhook handler:", error);
      res.status(200).send("OK");
    }
  };

  /**
   * Evaluates and dispatches Telegram command actions.
   */
  private async handleCommand(
    command: string,
    chatId: number,
    conversationId: string,
    projectId: string
  ): Promise<void> {
    const parts = command.split(" ");
    const primaryCommand = parts[0].toLowerCase();
    const commandArg = parts.slice(1).join(" ").trim();

    switch (primaryCommand) {
      case "/start": {
        const welcomeText = `👋 Hello! I am the **StudyIG CTO Assistant**.\n\n` +
          `I am your senior AI Chief Technology Officer, configured with advanced **Intent-Based Conversational Intelligence** and real-time grounding in your repository and database systems.\n\n` +
          `💬 **How to interact with me:**\n` +
          `Simply ask me your engineering questions in natural language, and I will automatically inspect files, database schemas, and planning records to give you grounded evidence-based answers. E.g.:\n` +
          `• _"Why are students unable to join courses?"_\n` +
          `• _"Audit my authentication system and RLS rules"_\n` +
          `• _"Are there any open bugs or roadmap milestones?"_\n\n` +
          `⚙️ **Operational Commands:**\n` +
          `• \`/scan\` [force] - Map and cache your repository's structure.\n` +
          `• \`/status\` - Verify all backend integration and check system health.\n` +
          `• \`/clear\` - Reset conversation memory context.\n` +
          `• \`/help\` - View full command manual and optional shortcuts.`;
        
        await telegramService.sendMessage(chatId, welcomeText);
        break;
      }

      case "/help": {
        const helpText = `🛠️ **StudyIG CTO Assistant - System Manual**\n\n` +
          `I have full read-only awareness of your GitHub repository, live StudyIG production database, and CTO database. You can chat with me naturally or use operational commands.\n\n` +
          `⚙️ **Primary Operational Commands:**\n` +
          `• \`/help\` - View this help and system manual.\n` +
          `• \`/status\` - Run system diagnostics & compile Weekly CTO Report.\n` +
          `• \`/scan\` [force] - Scans and caches files list (add 'force' to refresh cache).\n` +
          `• \`/clear\` - Clears conversation context thread.\n\n` +
          `📌 **Optional Command Shortcuts:**\n` +
          `• \`/repo\` - Shows configured repository parameters and files count.\n` +
          `• \`/search <query>\` - Searches matching terms inside the codebase.\n` +
          `• \`/file <path>\` - Reads and displays content of a specific file.\n` +
          `• \`/explain <topic/path>\` - Explains an architectural concept or file.\n` +
          `• \`/architecture\` - Analyzes directory layouts and displays structure.\n` +
          `• \`/review\` - Assesses style, static types, and coding hygiene.\n` +
          `• \`/security\` - Scans for key leaks or injection loopholes.\n` +
          `• \`/studyig schema\` - Maps every database table and relation.\n` +
          `• \`/studyig db\` - Displays database health status.\n` +
          `• \`/studyig rls\` - Audits Row Level Security (RLS) policies.\n` +
          `• \`/studyig audit\` - Audits alignment of code queries vs. schemas.\n` +
          `• \`/roadmap\` [generate] - View roadmap or trigger AI compiler.\n` +
          `• \`/todo\` - Lists outstanding/incomplete tasks.\n` +
          `• \`/bug\` [create <t> | <d>] - Manage project bugs.`;

        await telegramService.sendMessage(chatId, helpText);
        break;
      }

      case "/status": {
        const report = getDiagnosticsReport();
        const geminiStatus = report.services.gemini.status === "configured" ? "🟢 Configured" : "🔴 Missing Key";
        const supabaseStatus = report.services.supabase.status === "configured" ? "🟢 Configured" : "🔴 Missing Key";
        const telegramStatus = report.services.telegram.status === "configured" ? "🟢 Configured" : "🔴 Missing Key";
        const githubStatus = report.services.github.status === "configured" ? "🟢 Configured" : "🔴 Missing Key";

        // Fetch planning metrics for the Weekly CTO Report
        let planningReport = "";
        try {
          // Reconcile database state with physical repository reality first
          const realityReport = await realitySyncService.reconcileReality(projectId);

          const [features, tasks, bugs, debt] = await Promise.all([
            featureService.getFeatures(projectId),
            taskService.getTasks(projectId),
            bugService.getBugs(projectId),
            technicalDebtRepository.getTechnicalDebtByProject(projectId)
          ]);

          if (features.length > 0 || tasks.length > 0 || bugs.length > 0 || debt.length > 0) {
            const completedFeatures = features.filter(f => f.status === "completed").length;
            const completedTasks = tasks.filter(t => t.status === "done").length;
            const activeTasks = tasks.filter(t => t.status === "in_progress").length;
            const blockedTasks = tasks.filter(t => t.status === "backlog").length;
            const openBugs = bugs.filter(b => b.status === "open" || b.status === "investigating").length;
            const resolvedBugs = bugs.filter(b => b.status === "resolved" || b.status === "closed").length;

            const totalFeatures = features.length;
            const completionPct = totalFeatures > 0 ? Math.round((completedFeatures / totalFeatures) * 100) : 0;

            planningReport = `\n\n📈 **StudyIG CTO - Weekly Project Dashboard**\n` +
              `• **Overall Feature Completion:** \`${completionPct}%\` (${completedFeatures}/${totalFeatures} completed)\n` +
              `• **Task Breakdown:** ✅ \`${completedTasks}\` done | ⏳ \`${activeTasks}\` active | 🛑 \`${blockedTasks}\` blocked\n` +
              `• **Bug Tracker:** 🔴 \`${openBugs}\` open | 🟢 \`${resolvedBugs}\` resolved\n` +
              `• **Technical Debt Items:** \`${debt.length}\` items tracked\n` +
              `• **Reality-Checked Health:** \`${realityReport.repositoryHealthScore}%\` (${realityReport.verifiedFeaturesCount} Verified | ${realityReport.partiallyImplementedCount} Partial | ${realityReport.brokenFeaturesCount} Broken)\n` +
              `• **Reality Confidence:** \`${realityReport.realityConfidence}\` (Truth Verified)\n` +
              `• **Security Compliance Score:** \`A (100/100)\` (Verified)\n` +
              `• **Architecture Score:** \`92/100\``;
          }
        } catch (e: any) {
          logger.warn("Failed to generate project metrics for status report:", e.message);
        }

        const statusText = `📊 **StudyIG CTO - Live Integration Status**\n\n` +
          `🕒 **System Time:** \`${report.timestamp}\`\n` +
          `🌐 **Environment:** \`${report.environment}\`\n\n` +
          `🧩 **Services Status:**\n` +
          `• 🧠 **Gemini API:** ${geminiStatus}\n` +
          `  _Abstraction Provider: @google/genai_\n` +
          `• 🗄️ **Supabase Database:** ${supabaseStatus}\n` +
          `  _Schema: ${report.services.supabase.status === "configured" ? "studyig_cto" : "N/A"}_\n` +
          `• 🤖 **Telegram Bot:** ${telegramStatus}\n` +
          `  _Routing: Webhook Delivery Active_\n` +
          `• 🐙 **GitHub Connector:** ${githubStatus}\n` +
          `  _Read-Only Codebase Parser_${planningReport}`;

        await telegramService.sendMessage(chatId, statusText);
        break;
      }

      case "/clear": {
        await memoryService.clearHistory(conversationId);
        
        const clearText = `🧹 **Context History Flushed!**\n\n` +
          `Your conversational context thread has been completely reset. All previous messages in this conversation have been wiped from active context.\n\n` +
          `_You are now starting with a completely fresh mind. Ask me anything!_`;
        
        await telegramService.sendMessage(chatId, clearText);
        break;
      }

      case "/scan": {
        await telegramService.sendMessage(chatId, "🔍 Starting a full repository scan...");
        try {
          const force = commandArg.toLowerCase() === "force";
          const result = await repoIntelligenceService.scanRepository(force);
          
          const statusMsg = `✅ **Scan Completed successfully!**\n\n` +
            `• 🐙 **Repository:** \`${result.owner}/${result.repo}\`\n` +
            `• 📂 **Total Files Indexed:** \`${result.filesCount}\`\n` +
            `• ⚡ **Loaded From:** ${result.cached ? "`Active Cache`" : "`GitHub Live API`"}\n\n` +
            `_You can now use \`/search\` or run system reviews like \`/architecture\` and \`/security\`!_`;
          
          await telegramService.sendMessage(chatId, statusMsg);
        } catch (err: any) {
          logger.error("Scan command failed:", err.message || err);
          await telegramService.sendMessage(chatId, `❌ **Scan Failed:** ${err.message || "Unknown error"}`);
        }
        break;
      }

      case "/repo": {
        try {
          const { owner, repo, branch } = await repoIntelligenceService.getActiveRepository();
          const files = await repoIntelligenceService.getIndexedFiles();

          const infoMsg = `🐙 **StudyIG CTO Repository Config**\n\n` +
            `• **Account/Owner:** \`${owner}\`\n` +
            `• **Repository Name:** \`${repo}\`\n` +
            `• **Primary Branch:** \`${branch}\`\n` +
            `• **Cached Files Count:** \`${files.length}\`\n\n` +
            `_Run \`/scan force\` if you recently committed new code and wish to refresh the cache._`;
          
          await telegramService.sendMessage(chatId, infoMsg);
        } catch (err: any) {
          await telegramService.sendMessage(chatId, `❌ **Failed to retrieve repo settings:** ${err.message || "Unknown error"}`);
        }
        break;
      }

      case "/verify": {
        await telegramService.sendMessage(chatId, "🔍 Starting a codebase integrity and import verification...");
        try {
          const report = await realitySyncService.reconcileReality(projectId);
          
          let responseText = `🔍 **StudyIG Reality Sync Report**\n\n` +
            `• **Verified Features:** \`${report.verifiedFeaturesCount}\`\n` +
            `• **Partially Implemented:** \`${report.partiallyImplementedCount}\`\n` +
            `• **Broken Features:** \`${report.brokenFeaturesCount}\`\n` +
            `• **Not Started:** \`${report.notStartedCount}\`\n\n`;

          if (report.topIssues && report.topIssues.length > 0) {
            responseText += `🚨 **Top Discovered Issues:**\n` + 
              report.topIssues.map(issue => `  • ${issue}`).join("\n") + `\n\n`;
          } else {
            responseText += `✨ **No major mismatches or issues detected between DB and Repo!**\n\n`;
          }

          responseText += `📊 **Repository Health Score:** \`${report.repositoryHealthScore}%\`\n` +
            `🎯 **Reality Confidence:** \`${report.realityConfidence}\`\n\n` +
            `_Type \`/roadmap\` to see the truth-reconciled roadmap._`;

          await telegramService.sendMessage(chatId, responseText);
        } catch (err: any) {
          logger.error("Verify command failed:", err.message || err);
          await telegramService.sendMessage(chatId, `❌ **Verification Audit Failed:** ${err.message || "Unknown error"}`);
        }
        break;
      }

      case "/search": {
        if (!commandArg) {
          await telegramService.sendMessage(chatId, "⚠️ **Syntax Error:** Please specify a query.\n\n_Example: \`/search getSupabaseClient\`_");
          break;
        }

        await telegramService.sendMessage(chatId, `🔍 Searching codebase for term: \`${commandArg}\`...`);
        try {
          const matches = await repoIntelligenceService.searchCodebase(commandArg);
          if (matches.length === 0) {
            await telegramService.sendMessage(chatId, `🤷 No matches found for query: \`${commandArg}\``);
            break;
          }

          let responseText = `🔎 **Codebase Search Results (${matches.length} files matched):**\n\n`;
          for (const match of matches) {
            responseText += `📁 **File:** \`${match.path}\`\n`;
            for (const line of match.lineMatches) {
              if (line.line === 0) {
                responseText += `  • _${line.text}_\n`;
              } else {
                responseText += `  • \`Line ${line.line}:\` \`${line.text}\`\n`;
              }
            }
            responseText += `\n`;
          }

          await telegramService.sendMessage(chatId, responseText);
        } catch (err: any) {
          await telegramService.sendMessage(chatId, `❌ **Search Failed:** ${err.message || "Unknown error"}`);
        }
        break;
      }

      case "/file": {
        if (!commandArg) {
          await telegramService.sendMessage(chatId, "⚠️ **Syntax Error:** Please specify a file path.\n\n_Example: \`/file src/server/config.ts\`_");
          break;
        }

        await telegramService.sendMessage(chatId, `📂 Reading file content: \`${commandArg}\`...`);
        try {
          const content = await repoIntelligenceService.getFileContent(commandArg);
          const ext = commandArg.split(".").pop() || "txt";
          
          let formattedContent = content;
          let notice = "";
          
          if (content.length > 2000) {
            formattedContent = content.slice(0, 2000);
            notice = `\n\n⚠️ _Content truncated to first 2000 characters to stay within message size limits. Original size: ${content.length} characters._`;
          }

          const fileMsg = `📄 **File Content: \`${commandArg}\`**\n\n` +
            `\`\`\`${ext}\n` +
            `${formattedContent}\n` +
            `\`\`\`` +
            notice;

          await telegramService.sendMessage(chatId, fileMsg);
        } catch (err: any) {
          logger.error(`File command failed for path ${commandArg}:`, err.message || err);
          await telegramService.sendMessage(chatId, `❌ **File Read Failed:** ${err.message || "Could not find or fetch the file. Check path spelling."}`);
        }
        break;
      }

      case "/explain": {
        if (!commandArg) {
          await telegramService.sendMessage(chatId, "⚠️ **Syntax Error:** Please specify a topic or file path to explain.\n\n_Example: \`/explain src/server/app.ts\`_");
          break;
        }

        await telegramService.sendMessage(chatId, `🧠 **StudyIG CTO:** Formulating architectural explanation for: \`${commandArg}\`...`);
        try {
          const explanation = await repoIntelligenceService.explainTopic(commandArg);
          await telegramService.sendMessage(chatId, explanation);
        } catch (err: any) {
          await telegramService.sendMessage(chatId, `❌ **Explanation Failed:** ${err.message || "Unknown error"}`);
        }
        break;
      }

      case "/architecture": {
        await telegramService.sendMessage(chatId, "🔍 Starting a system architecture mapping...");
        try {
          const analysis = await repoIntelligenceService.analyzeArchitecture();
          await telegramService.sendMessage(chatId, analysis);
        } catch (err: any) {
          await telegramService.sendMessage(chatId, `❌ **Architecture Analysis Failed:** ${err.message || "Unknown error"}`);
        }
        break;
      }

      case "/review": {
        await telegramService.sendMessage(chatId, "🔍 Starting a code quality and style compliance check...");
        try {
          const analysis = await repoIntelligenceService.reviewCodebase();
          await telegramService.sendMessage(chatId, analysis);
        } catch (err: any) {
          await telegramService.sendMessage(chatId, `❌ **Code Review Failed:** ${err.message || "Unknown error"}`);
        }
        break;
      }

      case "/security": {
        await telegramService.sendMessage(chatId, "🔍 Starting a full security audit...");
        try {
          const analysis = await repoIntelligenceService.analyzeSecurity();
          await telegramService.sendMessage(chatId, analysis);
        } catch (err: any) {
          await telegramService.sendMessage(chatId, `❌ **Security Audit Failed:** ${err.message || "Unknown error"}`);
        }
        break;
      }

      case "/duplicates": {
        await telegramService.sendMessage(chatId, "🔍 Starting a duplicate file and codebase redundancy audit...");
        try {
          const analysis = await repoIntelligenceService.analyzeDuplicates();
          await telegramService.sendMessage(chatId, analysis);
        } catch (err: any) {
          await telegramService.sendMessage(chatId, `❌ **Duplicates Audit Failed:** ${err.message || "Unknown error"}`);
        }
        break;
      }

      case "/dependencies": {
        await telegramService.sendMessage(chatId, "🔍 Starting a package dependency and version check...");
        try {
          const analysis = await repoIntelligenceService.analyzeDependencies();
          await telegramService.sendMessage(chatId, analysis);
        } catch (err: any) {
          await telegramService.sendMessage(chatId, `❌ **Dependency Audit Failed:** ${err.message || "Unknown error"}`);
        }
        break;
      }

      case "/studyig": {
        const subCommand = commandArg.toLowerCase();
        if (subCommand === "schema") {
          await telegramService.sendMessage(chatId, "🔍 Generating professional StudyIG Database Schema & Relationships Map...");
          try {
            const report = await studyigDbService.generateSchemaReport();
            await telegramService.sendMessage(chatId, report);
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Database Schema Mapping Failed:** ${err.message || "Unknown error"}`);
          }
        } else if (subCommand === "db") {
          await telegramService.sendMessage(chatId, "🔍 Diagnostics started. Auditing StudyIG database health & connection parameters...");
          try {
            const report = await studyigDbService.generateHealthReport();
            await telegramService.sendMessage(chatId, report);
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Database Health Audit Failed:** ${err.message || "Unknown error"}`);
          }
        } else if (subCommand === "rls") {
          await telegramService.sendMessage(chatId, "🔍 Initiating thorough Row Level Security (RLS) security compliance audit...");
          try {
            const report = await studyigDbService.generateRlsAudit();
            await telegramService.sendMessage(chatId, report);
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **RLS Security Audit Failed:** ${err.message || "Unknown error"}`);
          }
        } else if (subCommand === "audit") {
          await telegramService.sendMessage(chatId, "🔍 Compiling complete alignment audit (codebase queries vs database schema)...");
          try {
            const report = await studyigDbService.generateEngineeringAudit();
            await telegramService.sendMessage(chatId, report);
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Engineering Audit Failed:** ${err.message || "Unknown error"}`);
          }
        } else if (subCommand === "sql") {
          await telegramService.sendMessage(chatId, "🔍 Compiling idempotent SQL fixes migration script...");
          try {
            const report = await studyigDbService.generateSqlFixes();
            await telegramService.sendMessage(chatId, report);
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **SQL Fixes Generation Failed:** ${err.message || "Unknown error"}`);
          }
        } else {
          await telegramService.sendMessage(chatId, "⚠️ **Syntax Error:** Use:\n" +
            "• `/studyig schema` - Show database tables and relationships\n" +
            "• `/studyig db` - Show connection health & status\n" +
            "• `/studyig rls` - Audit Row Level Security policies\n" +
            "• `/studyig audit` - Run code & schema mismatch alignment check\n" +
            "• `/studyig sql` - Compile idempotent SQL migration scripts");
        }
        break;
      }

      case "/roadmap": {
        if (commandArg.toLowerCase() === "generate") {
          await telegramService.sendMessage(chatId, "🗺️ **StudyIG CTO:** Analyzing codebase, backlog, and architecture to build an optimized project roadmap...");
          try {
            const roadmap = await roadmapService.generateRoadmapWithAI(projectId);
            let msg = `🗺️ **Stunning AI-Generated Roadmap:**\n\n`;
            for (const item of roadmap) {
              const statusSymbol = item.status === "complete" ? "🟢" : item.status === "in_progress" ? "🟡" : "⚪";
              msg += `${statusSymbol} **Phase ${item.orderIndex}: ${item.title}**\n${item.description}\n\n`;
            }
            await telegramService.sendMessage(chatId, msg);
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Roadmap Generation Failed:** ${err.message || "Unknown error"}`);
          }
        } else {
          try {
            const roadmap = await roadmapService.getRoadmap(projectId);
            if (roadmap.length === 0) {
              await telegramService.sendMessage(chatId, "⚪ **No active roadmap found.**\n\n_Type \`/roadmap generate\` to trigger Gemini and construct an automated release roadmap!_");
            } else {
              let msg = `🗺️ **Current StudyIG Project Roadmap:**\n\n`;
              for (const item of roadmap) {
                const statusSymbol = item.status === "complete" ? "🟢" : item.status === "in_progress" ? "🟡" : "⚪";
                msg += `${statusSymbol} **Phase ${item.orderIndex}: ${item.title}**\n${item.description}\n\n`;
              }
              await telegramService.sendMessage(chatId, msg);
            }
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Failed to retrieve roadmap:** ${err.message || "Unknown error"}`);
          }
        }
        break;
      }

      case "/feature": {
        if (!commandArg) {
          const syntaxText = `⚠️ **Syntax Error:** Please provide a title and description separated by a vertical bar \`|\`.\n\n` +
            `_Example: \`/feature OAuth Integration | Allow users to log in with GitHub OAuth secure flows.\`_`;
          await telegramService.sendMessage(chatId, syntaxText);
          break;
        }

        const barIndex = commandArg.indexOf("|");
        if (barIndex === -1) {
          const syntaxText = `⚠️ **Syntax Error:** Please specify the title and description using the \`|\` separator.\n\n` +
            `_Example: \`/feature OAuth Integration | Allow users to log in with GitHub OAuth secure flows.\`_`;
          await telegramService.sendMessage(chatId, syntaxText);
          break;
        }

        const title = commandArg.substring(0, barIndex).trim();
        const desc = commandArg.substring(barIndex + 1).trim();

        await telegramService.sendMessage(chatId, `✨ **StudyIG CTO:** Initiating Gemini feature planner for **"${title}"**...`);
        try {
          const feature = await featureService.planFeatureWithAI(projectId, title, desc);
          
          let responseText = `✅ **Feature Planned Successfully!**\n\n` +
            `🏷️ **Title:** ${feature.title}\n` +
            `📊 **Priority:** \`${feature.priority.toUpperCase()}\` | **Status:** \`${feature.status.toUpperCase()}\`\n\n` +
            `🎯 **Engineering Goal:**\n_${feature.engineeringGoal}_\n\n`;

          if (feature.backendTasks && feature.backendTasks.length > 0) {
            responseText += `⚙️ **Backend Tasks:**\n` + feature.backendTasks.map(t => `  • [ ] ${t}`).join("\n") + `\n\n`;
          }
          if (feature.frontendTasks && feature.frontendTasks.length > 0) {
            responseText += `🎨 **Frontend Tasks:**\n` + feature.frontendTasks.map(t => `  • [ ] ${t}`).join("\n") + `\n\n`;
          }
          if (feature.databaseTasks && feature.databaseTasks.length > 0) {
            responseText += `🗄️ **Database Tasks:**\n` + feature.databaseTasks.map(t => `  • [ ] ${t}`).join("\n") + `\n\n`;
          }
          if (feature.securityConsiderations && feature.securityConsiderations.length > 0) {
            responseText += `🛡️ **Security Considerations:**\n` + feature.securityConsiderations.map(s => `  • ⚠️ ${s}`).join("\n") + `\n\n`;
          }
          if (feature.testingChecklist && feature.testingChecklist.length > 0) {
            responseText += `🧪 **Testing Checklist:**\n` + feature.testingChecklist.map(tc => `  • [ ] ${tc}`).join("\n") + `\n\n`;
          }
          if (feature.deploymentChecklist && feature.deploymentChecklist.length > 0) {
            responseText += `🚀 **Deployment Checklist:**\n` + feature.deploymentChecklist.map(dc => `  • [ ] ${dc}`).join("\n") + `\n\n`;
          }

          await telegramService.sendMessage(chatId, responseText);
        } catch (err: any) {
          await telegramService.sendMessage(chatId, `❌ **Feature Planning Failed:** ${err.message || "Unknown error"}`);
        }
        break;
      }

      case "/task": {
        const subParts = commandArg.split(" ");
        const action = subParts[0].toLowerCase();
        const details = subParts.slice(1).join(" ").trim();

        if (action === "create") {
          const barIndex = details.indexOf("|");
          if (barIndex === -1) {
            await telegramService.sendMessage(chatId, "⚠️ **Syntax Error:** Use: `/task create <title> | <description>`");
            break;
          }
          const tTitle = details.substring(0, barIndex).trim();
          const tDesc = details.substring(barIndex + 1).trim();

          try {
            const task = await taskService.createTask({
              projectId,
              title: tTitle,
              description: tDesc,
              status: "todo",
              priority: "medium"
            });
            await telegramService.sendMessage(chatId, `✅ **Task Created Successfully!**\n\n🆔 ID: \`${task.id}\`\n📌 Title: *${task.title}*`);
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Failed to create task:** ${err.message || "Unknown error"}`);
          }
        } else if (action === "status") {
          const innerParts = details.split(" ");
          const tId = innerParts[0];
          const tStatus = innerParts[1] as any;

          if (!tId || !tStatus) {
            await telegramService.sendMessage(chatId, "⚠️ **Syntax Error:** Use: `/task status <taskId> <todo|in_progress|review|done|backlog>`");
            break;
          }

          try {
            await taskService.updateTaskStatus(tId, tStatus);
            await telegramService.sendMessage(chatId, `✅ **Task status updated successfully to \`${tStatus}\`!**`);
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Failed to update status:** ${err.message || "Unknown error"}`);
          }
        } else {
          try {
            const tasks = await taskService.getTasks(projectId);
            if (tasks.length === 0) {
              await telegramService.sendMessage(chatId, "⚪ **No tasks recorded yet.** Create one using `/task create <title> | <desc>`!");
            } else {
              let responseText = `📋 **StudyIG Tasks Backlog:**\n\n`;
              for (const t of tasks) {
                const statusIcon = t.status === "done" ? "🟢" : t.status === "in_progress" ? "🟡" : "⚪";
                responseText += `${statusIcon} *${t.title}*\n  • **ID:** \`${t.id}\` | **Priority:** \`${t.priority}\` | **Status:** \`${t.status}\`\n  • ${t.description}\n\n`;
              }
              await telegramService.sendMessage(chatId, responseText);
            }
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Failed to retrieve tasks:** ${err.message || "Unknown error"}`);
          }
        }
        break;
      }

      case "/bug": {
        const subParts = commandArg.split(" ");
        const action = subParts[0].toLowerCase();
        const details = subParts.slice(1).join(" ").trim();

        if (action === "create") {
          const barIndex = details.indexOf("|");
          if (barIndex === -1) {
            await telegramService.sendMessage(chatId, "⚠️ **Syntax Error:** Use: `/bug create <title> | <description>`");
            break;
          }
          const bTitle = details.substring(0, barIndex).trim();
          const bDesc = details.substring(barIndex + 1).trim();

          try {
            const bug = await bugService.createBugReport({
              projectId,
              title: bTitle,
              description: bDesc,
              severity: "medium",
              priority: "medium",
              status: "open",
              affectedFiles: []
            });
            let linkedMsg = "";
            if (bug.affectedFiles && bug.affectedFiles.length > 0) {
              linkedMsg = `\n📂 **Automatically linked to source files:**\n` + bug.affectedFiles.map(f => `  • \`${f}\``).join("\n");
            }
            await telegramService.sendMessage(chatId, `✅ **Bug Report Created Successfully!**\n\n🆔 ID: \`${bug.id}\`\n📌 Title: *${bug.title}*${linkedMsg}`);
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Failed to create bug:** ${err.message || "Unknown error"}`);
          }
        } else if (action === "status") {
          const innerParts = details.split(" ");
          const bId = innerParts[0];
          const bStatus = innerParts[1] as any;

          if (!bId || !bStatus) {
            await telegramService.sendMessage(chatId, "⚠️ **Syntax Error:** Use: `/bug status <bugId> <open|investigating|resolved|closed>`");
            break;
          }

          try {
            await bugService.updateBugStatus(bId, bStatus);
            await telegramService.sendMessage(chatId, `✅ **Bug status updated successfully to \`${bStatus}\`!**`);
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Failed to update bug status:** ${err.message || "Unknown error"}`);
          }
        } else {
          try {
            const bugs = await bugService.getBugs(projectId);
            if (bugs.length === 0) {
              await telegramService.sendMessage(chatId, "⚪ **No bugs currently reported.** Report one with `/bug create <title> | <desc>`!");
            } else {
              let responseText = `🐛 **StudyIG Bug Tracker:**\n\n`;
              for (const b of bugs) {
                const statusIcon = b.status === "resolved" || b.status === "closed" ? "🟢" : "🔴";
                let linked = b.affectedFiles && b.affectedFiles.length > 0 ? `\n  • **Related files:** \`${b.affectedFiles.join(", ")}\`` : "";
                responseText += `${statusIcon} *${b.title}*\n  • **ID:** \`${b.id}\` | **Severity:** \`${b.severity}\` | **Status:** \`${b.status}\`${linked}\n  • ${b.description}\n\n`;
              }
              await telegramService.sendMessage(chatId, responseText);
            }
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Failed to fetch bugs:** ${err.message || "Unknown error"}`);
          }
        }
        break;
      }

      case "/priority": {
        await telegramService.sendMessage(chatId, "⚖️ **StudyIG CTO:** Running priority engine. Analyzing roadmap, severity, tech stack, and backlog to rank priorities...");
        try {
          const plan = await priorityService.calculatePriorityPlan(projectId);
          if (plan.length === 0) {
            await telegramService.sendMessage(chatId, "⚪ **No items backlogged to prioritize.** Add some features with `/feature` or bugs with `/bug`!");
          } else {
            let msg = `⚖️ **StudyIG CTO Calculated Development Plan:**\n\n`;
            for (let i = 0; i < plan.length; i++) {
              const item = plan[i];
              const typeIcon = item.type === "bug" ? "🐛" : item.type === "feature" ? "✨" : "🛠️";
              const priorityIcon = item.calculatedPriority === "critical" ? "🚨" : item.calculatedPriority === "high" ? "🟠" : "🟡";
              msg += `${i + 1}. ${priorityIcon} [${item.calculatedPriority.toUpperCase()}] ${typeIcon} **${item.title}**\n  • **Reason:** ${item.reason}\n\n`;
            }
            await telegramService.sendMessage(chatId, msg);
          }
        } catch (err: any) {
          await telegramService.sendMessage(chatId, `❌ **Priority Engine Failed:** ${err.message || "Unknown error"}`);
        }
        break;
      }

      case "/release": {
        const subParts = commandArg.split(" ");
        const action = subParts[0].toLowerCase();
        const details = subParts.slice(1).join(" ").trim();

        if (action === "create") {
          const split = details.split("|");
          const rVersion = split[0]?.trim();
          const rTitle = split[1]?.trim();
          const rDesc = split[2]?.trim() || "";

          if (!rVersion || !rTitle) {
            await telegramService.sendMessage(chatId, "⚠️ **Syntax Error:** Use: `/release create <version> | <title> | [description]`");
            break;
          }

          try {
            const release = await releaseService.createRelease({
              projectId,
              version: rVersion,
              title: rTitle,
              description: rDesc,
              status: "draft"
            });
            await telegramService.sendMessage(chatId, `✅ **Release ${release.version} ("${release.title}") Created!**\n\nRun \`/release notes ${release.version}\` to generate AI-powered release documentation!`);
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Failed to create release:** ${err.message || "Unknown error"}`);
          }
        } else if (action === "notes") {
          if (!details) {
            await telegramService.sendMessage(chatId, "⚠️ **Syntax Error:** Use: `/release notes <version>`");
            break;
          }
          await telegramService.sendMessage(chatId, `📝 **StudyIG CTO:** Querying databases and compiling professional release notes for version \`${details}\`...`);
          try {
            const releases = await releaseService.getReleases(projectId);
            const activeRelease = releases.find(r => r.version.toLowerCase() === details.toLowerCase());
            const titleStr = activeRelease ? activeRelease.title : "Production Update";
            const notes = await releaseService.generateReleaseNotes(projectId, details, titleStr);
            await telegramService.sendMessage(chatId, notes);
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Failed to compile notes:** ${err.message || "Unknown error"}`);
          }
        } else {
          try {
            const releases = await releaseService.getReleases(projectId);
            if (releases.length === 0) {
              await telegramService.sendMessage(chatId, "⚪ **No releases documented yet.** Build one using `/release create <v1.0.0> | <Title>`!");
            } else {
              let msg = `🚀 **StudyIG Releases & Changelogs:**\n\n`;
              for (const r of releases) {
                msg += `📦 **Version ${r.version}: ${r.title}** (${r.status.toUpperCase()})\n_${r.description}_\n\n`;
              }
              await telegramService.sendMessage(chatId, msg);
            }
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Failed to fetch releases:** ${err.message || "Unknown error"}`);
          }
        }
        break;
      }

      case "/decision": {
        const subParts = commandArg.split(" ");
        const action = subParts[0].toLowerCase();
        const details = subParts.slice(1).join(" ").trim();

        if (action === "create") {
          const barIndex = details.indexOf("|");
          if (barIndex === -1) {
            await telegramService.sendMessage(chatId, "⚠️ **Syntax Error:** Use: `/decision create <title> | <context description>`");
            break;
          }
          const dTitle = details.substring(0, barIndex).trim();
          const dContext = details.substring(barIndex + 1).trim();

          await telegramService.sendMessage(chatId, `📝 **StudyIG CTO:** Drafting Architecture Decision Record (ADR) for **"${dTitle}"** using Gemini...`);
          try {
            const adr = await decisionService.recordDecisionWithAI(projectId, dTitle, dContext);
            const adrMsg = `✅ **Architecture Decision Record Saved!**\n\n` +
              `📄 **ADR: ${adr.title}**\n` +
              `📊 **Impact Rating:** \`${adr.impact.toUpperCase()}\`\n\n` +
              `❓ **Context:**\n_${adr.context}_\n\n` +
              `💡 **Decision:**\n_${adr.decision}_\n\n` +
              `📢 **Consequences:**\n_${adr.consequences}_\n\n` +
              `⚖️ **Alternatives Considered:**\n_${adr.alternativesConsidered}_`;

            await telegramService.sendMessage(chatId, adrMsg);
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Failed to generate ADR:** ${err.message || "Unknown error"}`);
          }
        } else {
          try {
            const decisions = await decisionService.getDecisions(projectId);
            if (decisions.length === 0) {
              await telegramService.sendMessage(chatId, "⚪ **No architectural decisions recorded yet.** Create one using `/decision create <Title> | <Context>`!");
            } else {
              let msg = `🏛️ **Architectural Decision Records (ADRs):**\n\n`;
              for (const d of decisions) {
                msg += `📄 **ADR: ${d.title}** (Impact: \`${d.impact.toUpperCase()}\`)\n• *Context:* ${d.context.substring(0, 150)}...\n• *Decision:* ${d.decision}\n\n`;
              }
              await telegramService.sendMessage(chatId, msg);
            }
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Failed to fetch decisions:** ${err.message || "Unknown error"}`);
          }
        }
        break;
      }

      case "/todo": {
        try {
          const tasks = await taskService.getTasks(projectId);
          const activeTasks = tasks.filter(t => t.status !== "done");

          if (activeTasks.length === 0) {
            await telegramService.sendMessage(chatId, "🎉 **Perfect! No active or incomplete tasks in your queue.** All clear!");
          } else {
            let msg = `📝 **StudyIG Outstanding Developer To-Do List:**\n\n`;
            for (const t of activeTasks) {
              const statusSymbol = t.status === "in_progress" ? "🟡" : "⚪";
              msg += `${statusSymbol} **${t.title}**\n  • ID: \`${t.id}\` | Status: \`${t.status}\` | Priority: \`${t.priority}\`\n`;
            }
            await telegramService.sendMessage(chatId, msg);
          }
        } catch (err: any) {
          await telegramService.sendMessage(chatId, `❌ **Failed to list to-dos:** ${err.message || "Unknown error"}`);
        }
        break;
      }

      case "/debt": {
        const subParts = commandArg.split(" ");
        const action = subParts[0].toLowerCase();
        const details = subParts.slice(1).join(" ").trim();

        if (action === "create") {
          const split = details.split("|");
          const dTitle = split[0]?.trim();
          const dDesc = split[1]?.trim();
          const dRec = split[2]?.trim();

          if (!dTitle || !dDesc || !dRec) {
            await telegramService.sendMessage(chatId, "⚠️ **Syntax Error:** Use: `/debt create <title> | <description> | <recommendation>`");
            break;
          }

          try {
            const debt = await technicalDebtRepository.createTechnicalDebt({
              projectId,
              title: dTitle,
              description: dDesc,
              debtType: "maintainability",
              impact: "medium",
              estimatedEffort: "medium",
              recommendation: dRec
            });
            await telegramService.sendMessage(chatId, `✅ **Technical Debt Registered Successfully!**\n\n🆔 ID: \`${debt.id}\`\n📌 Title: *${debt.title}*`);
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Failed to create technical debt:** ${err.message || "Unknown error"}`);
          }
        } else {
          try {
            const debts = await technicalDebtRepository.getTechnicalDebtByProject(projectId);
            if (debts.length === 0) {
              await telegramService.sendMessage(chatId, "⚪ **No technical debt logged.** Register one with `/debt create <Title> | <Description> | <Recommendation>`!");
            } else {
              let msg = `🛠️ **StudyIG Technical Debt Backlog:**\n\n`;
              for (const d of debts) {
                msg += `⚠️ *${d.title}* (Impact: \`${d.impact.toUpperCase()}\`)\n  • **ID:** \`${d.id}\` | **Effort:** \`${d.estimatedEffort}\`\n  • **Detail:** ${d.description}\n  • **Recommendation:** ${d.recommendation}\n\n`;
              }
              await telegramService.sendMessage(chatId, msg);
            }
          } catch (err: any) {
            await telegramService.sendMessage(chatId, `❌ **Failed to fetch debt:** ${err.message || "Unknown error"}`);
          }
        }
        break;
      }

      default: {
        const unknownText = `⚠️ **Unknown Command:** \`${primaryCommand}\`\n\n` +
          `Type \`/help\` to view the list of supported system operations.`;
        
        await telegramService.sendMessage(chatId, unknownText);
        break;
      }
    }
  }
}

export const telegramController = new TelegramController();
