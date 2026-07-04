/**
 * StudyIG CTO - GitHub Repository Intelligence Service
 * 
 * Provides read-only recursive scanning (using Git Trees API),
 * on-demand file reading, codebase search, and advanced AI-assisted audits.
 */

import { projectRepository, RepoFile, Project, GithubRepository } from "../repositories/projectRepository.js";
import { logger } from "../lib/logger.js";
import { geminiProvider } from "./geminiProvider.js";

// Memory fallback cache in case repo_files database table is not yet provisioned
const memoryCache = new Map<string, RepoFile[]>();

export class RepoIntelligenceService {
  /**
   * Identifies the primary repository configuration for the default project.
   */
  async getActiveRepository(projectId?: string): Promise<{ owner: string; repo: string; branch: string; projectId: string }> {
    let targetProjectId = projectId;
    
    if (!targetProjectId) {
      const projects = await projectRepository.getAllProjects();
      if (projects.length === 0) {
        // Create default project
        const defaultProj = await projectRepository.createProject({
          name: "StudyIG Core",
          description: "Default Workspace for the StudyIG CTO Assistant integrations"
        });
        targetProjectId = defaultProj.id!;
      } else {
        targetProjectId = projects[0].id!;
      }
    }

    // Check if there is an active repo configured in the database
    const repos = await projectRepository.getRepositoriesByProject(targetProjectId);
    const activeRepo = repos.find(r => r.isActive);
    
    if (activeRepo) {
      return {
        owner: activeRepo.owner,
        repo: activeRepo.repoName,
        branch: activeRepo.branch || "main",
        projectId: targetProjectId
      };
    }

    // Fallback to environment variables
    const owner = process.env.GITHUB_OWNER || "studyig";
    const repo = process.env.GITHUB_REPO || "studyig-app";
    const branch = "main"; // default branch

    // Auto-register in database for consistency if Supabase is configured
    try {
      await projectRepository.addRepository({
        projectId: targetProjectId,
        owner,
        repoName: repo,
        branch,
        isActive: true
      });
    } catch (err: any) {
      logger.warn(`Could not auto-register fallback repository configuration: ${err.message || err}`);
    }

    return { owner, repo, branch, projectId: targetProjectId };
  }

  /**
   * Recursively scans the GitHub repository utilizing the Git Trees API.
   * Leverages a double-layer cache (Supabase DB + local memory fallback).
   */
  async scanRepository(forceRefresh: boolean = false): Promise<{ filesCount: number; cached: boolean; owner: string; repo: string }> {
    const { owner, repo, branch, projectId } = await this.getActiveRepository();
    
    if (!process.env.GITHUB_TOKEN) {
      throw new Error("GITHUB_TOKEN is not defined in the environment. Cannot perform read-only scanning.");
    }

    // 1. Check cache first unless forceRefresh is requested
    if (!forceRefresh) {
      const cachedDbFiles = await projectRepository.getRepoFilesByProject(projectId);
      if (cachedDbFiles.length > 0) {
        logger.info(`Loaded ${cachedDbFiles.length} file metadata entries from database cache.`);
        return { filesCount: cachedDbFiles.length, cached: true, owner, repo };
      }

      const cachedMemoryFiles = memoryCache.get(projectId);
      if (cachedMemoryFiles && cachedMemoryFiles.length > 0) {
        logger.info(`Loaded ${cachedMemoryFiles.length} file metadata entries from memory cache.`);
        return { filesCount: cachedMemoryFiles.length, cached: true, owner, repo };
      }
    }

    logger.info(`Executing live recursive scan on GitHub repository ${owner}/${repo} on branch [${branch}]...`);
    
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "StudyIG-CTO-Assistant",
      Authorization: `token ${process.env.GITHUB_TOKEN}`
    };

    // Call the Git Trees API recursively
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=true`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub Git Trees API returned error status: ${response.status} (${response.statusText})`);
    }

    const data = await response.json() as any;
    if (!data.tree || !Array.isArray(data.tree)) {
      throw new Error("Invalid structure returned from GitHub Git Trees API");
    }

    // Filter and process files (exclude binary types, node_modules, .git, images, package-lock.json)
    const ignoredPatterns = [
      "node_modules/",
      "dist/",
      "build/",
      ".git/",
      ".next/",
      ".cache/",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".ico",
      ".svg",
      ".woff",
      ".woff2",
      ".ttf",
      ".pdf"
    ];

    const scannedFiles: RepoFile[] = [];

    for (const entry of data.tree) {
      // Only keep blobs (files) and skip ignored folders/files
      if (entry.type !== "blob") continue;

      const shouldIgnore = ignoredPatterns.some(pattern => entry.path.startsWith(pattern) || entry.path.includes("/" + pattern) || entry.path.endsWith(pattern));
      if (shouldIgnore) continue;

      scannedFiles.push({
        projectId,
        path: entry.path,
        name: entry.path.split("/").pop() || entry.path,
        size: entry.size || 0,
        sha: entry.sha,
        downloadUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${entry.path}`
      });
    }

    logger.info(`Successfully scanned ${scannedFiles.length} text files. Writing to cache layers...`);

    // Write to DB cache
    await projectRepository.clearRepoFiles(projectId);
    await projectRepository.saveRepoFiles(scannedFiles);

    // Write to memory cache fallback
    memoryCache.set(projectId, scannedFiles);

    return {
      filesCount: scannedFiles.length,
      cached: false,
      owner,
      repo
    };
  }

  /**
   * Retrieves all file metadata logs from active cache.
   */
  async getIndexedFiles(): Promise<RepoFile[]> {
    const { projectId } = await this.getActiveRepository();
    
    // Attempt DB fetch
    const dbFiles = await projectRepository.getRepoFilesByProject(projectId);
    if (dbFiles.length > 0) return dbFiles;

    // Fallback memory
    return memoryCache.get(projectId) || [];
  }

  /**
   * Reads a file content on demand. Uses cached content if available,
   * otherwise fetches live raw file content from GitHub and caches it.
   */
  async getFileContent(filePath: string): Promise<string> {
    const { owner, repo, branch, projectId } = await this.getActiveRepository();
    
    // 1. Check database for existing cached content
    const cachedFile = await projectRepository.getRepoFileByPath(projectId, filePath);
    if (cachedFile && cachedFile.content) {
      logger.info(`File cache hit for: ${filePath}`);
      return cachedFile.content;
    }

    // 2. Fetch live raw content from raw.githubusercontent.com
    logger.info(`File cache miss. Fetching raw content for: ${filePath}`);
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      "User-Agent": "StudyIG-CTO-Assistant"
    };
    if (token) {
      headers.Authorization = `token ${token}`;
    }

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    const response = await fetch(rawUrl, { headers });

    if (!response.ok) {
      throw new Error(`Failed to download raw file content from GitHub: ${response.statusText} (${response.status})`);
    }

    const content = await response.text();

    // 3. Cache the file content in the database if the metadata entry exists
    if (cachedFile) {
      cachedFile.content = content;
      await projectRepository.saveRepoFile(cachedFile);
    } else {
      // Create metadata record + content
      await projectRepository.saveRepoFile({
        projectId,
        path: filePath,
        name: filePath.split("/").pop() || filePath,
        size: Buffer.byteLength(content),
        sha: "live-fetched",
        downloadUrl: rawUrl,
        content
      });
    }

    // Update memory cache as well
    const memList = memoryCache.get(projectId) || [];
    const existingIndex = memList.findIndex(f => f.path === filePath);
    if (existingIndex >= 0) {
      memList[existingIndex].content = content;
    } else {
      memList.push({
        projectId,
        path: filePath,
        name: filePath.split("/").pop() || filePath,
        size: Buffer.byteLength(content),
        sha: "live-fetched",
        downloadUrl: rawUrl,
        content
      });
    }
    memoryCache.set(projectId, memList);

    return content;
  }

  /**
   * Performs high-speed text search across scanned file contents (or file paths if contents are not loaded).
   */
  async searchCodebase(query: string): Promise<{ path: string; lineMatches: { line: number; text: string }[] }[]> {
    const files = await this.getIndexedFiles();
    const results: { path: string; lineMatches: { line: number; text: string }[] }[] = [];
    const regex = new RegExp(query, "i");

    // We can search over filenames first
    for (const file of files) {
      // Check if file content is already cached, search it
      if (file.content) {
        const lines = file.content.split("\n");
        const matches: { line: number; text: string }[] = [];
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            matches.push({
              line: i + 1,
              text: lines[i].trim().slice(0, 150) // Limit display size
            });
          }
        }
        if (matches.length > 0) {
          results.push({ path: file.path, lineMatches: matches });
        }
      } else if (regex.test(file.path)) {
        // If content is not loaded but the path matches, register a filename hit
        results.push({
          path: file.path,
          lineMatches: [{ line: 0, text: "[Matches file path]" }]
        });
      }
    }

    return results.slice(0, 30); // Cap results to avoid spamming the user
  }

  /**
   * Generates a fully compiled dependency audit from the package.json.
   */
  async analyzeDependencies(): Promise<string> {
    try {
      const files = await this.getIndexedFiles();
      const packageJsonFile = files.find(f => f.path === "package.json" || f.path.endsWith("/package.json"));
      
      if (!packageJsonFile) {
        return "❌ **Dependency Analysis Alert:** `package.json` was not found in the indexed repository paths.";
      }

      const content = await this.getFileContent(packageJsonFile.path);
      const pkg = JSON.parse(content);

      const dependencies = pkg.dependencies || {};
      const devDependencies = pkg.devDependencies || {};

      const prompt = `You are StudyIG CTO. Analyze the following dependency declarations from our project's \`package.json\`.
Identify potential version conflicts, deprecated libraries, suggest modern replacements, and audit for size bloat.

package.json dependencies:
${JSON.stringify(dependencies, null, 2)}

package.json devDependencies:
${JSON.stringify(devDependencies, null, 2)}

Provide a beautiful, highly professional CTO dependency report in clear Markdown format. Specify:
1. Direct Production Dependencies Summary
2. Developer Tooling Summary
3. Key Risks/Security Alerts (e.g. outdated frameworks, missing critical lockings)
4. Key Recommendations (e.g. migrate to newer versions, delete unused tooling)`;

      return await geminiProvider.generateText(prompt, { temperature: 0.2 });
    } catch (error: any) {
      logger.error("Dependency analysis failed:", error.message || error);
      return `❌ **Dependency Analysis Failed:** ${error.message || "Unknown Error"}`;
    }
  }

  /**
   * Analyzes the high-level codebase layout and returns architectural findings.
   */
  async analyzeArchitecture(): Promise<string> {
    try {
      const files = await this.getIndexedFiles();
      if (files.length === 0) {
        return "❌ **Architecture Analysis Alert:** No codebase index is available. Please run `/scan` first.";
      }

      // Group paths to build a scannable structure
      const filePaths = files.map(f => f.path);
      const pathsSummary = filePaths.slice(0, 100).join("\n") + (filePaths.length > 100 ? `\n...and ${filePaths.length - 100} more files` : "");

      const prompt = `You are StudyIG CTO, a system architect. Review the following list of directory files from our indexed repository.
Analyze the structural layout, folders patterns, entrypoints, and tech stack choices.

File paths:
${pathsSummary}

Provide a structured Architectural Assessment in Markdown. Include:
1. **Identified Tech Stack**: (Frontend libraries, Backend engine, database tools, configurations)
2. **Structural Evaluation**: Review our separation of concerns, routing pattern, or components folder layout.
3. **Core Recommendations**: Suggest steps to scale this directory layout or implement architectural best practices.
4. **Interactive Component Map**: Formulate a text-based ASCII structure showing the high-level data flow.`;

      return await geminiProvider.generateText(prompt, { temperature: 0.2 });
    } catch (error: any) {
      logger.error("Architecture analysis failed:", error.message || error);
      return `❌ **Architecture Analysis Failed:** ${error.message || "Unknown Error"}`;
    }
  }

  /**
   * Performs an automated security audit of the repository files.
   */
  async analyzeSecurity(): Promise<string> {
    try {
      const files = await this.getIndexedFiles();
      if (files.length === 0) {
        return "❌ **Security Audit Alert:** Repository is not indexed yet. Please run `/scan` to cache file lists.";
      }

      // Look for files likely containing security logic or database/API connections
      const sensitiveExtensions = [".ts", ".js", ".env", "Dockerfile", ".yml", ".json", ".sql"];
      const filesToCheck = files.filter(f => {
        const isSymmetric = sensitiveExtensions.some(ext => f.path.endsWith(ext));
        const hasKeyword = ["auth", "config", "server", "middleware", "route", "db", "api"].some(kw => f.path.toLowerCase().includes(kw));
        return isSymmetric && hasKeyword;
      }).slice(0, 10); // Check top 10 sensitive files to avoid token limits

      let filesPayload = "";
      for (const f of filesToCheck) {
        try {
          const content = await this.getFileContent(f.path);
          filesPayload += `### File: ${f.path}\n\`\`\`\n${content.slice(0, 1500)}\n\`\`\`\n\n`; // Slice to stay safe from limits
        } catch {
          // skip failed files
        }
      }

      const prompt = `You are StudyIG CTO, an elite AppSec engineer. Perform a static security audit of the following sensitive project code snippets.
Audit for:
- Exposed credentials or placeholder secrets.
- Missing authentication / authorization on API paths.
- Injection vulnerabilities (SQLi, shell executions).
- Broken access controls or weak cryptographic choices.

Snippets:
${filesPayload || "No sensitive files loaded yet. Analyze based on file paths: " + files.map(f => f.path).slice(0, 50).join("\n")}

Provide a formal CTO Security Audit Report in Markdown. Format with:
1. **Executive Vulnerability Summary** (Categorize threats: High, Medium, Low)
2. **Detailed Finding Explanations & Line References**
3. **Remediation Plans** (Clear code refactoring examples)
4. **General Security Hardening Guidelines**`;

      return await geminiProvider.generateText(prompt, { temperature: 0.2 });
    } catch (error: any) {
      logger.error("Security audit failed:", error.message || error);
      return `❌ **Security Audit Failed:** ${error.message || "Unknown Error"}`;
    }
  }

  /**
   * Audits files looking for identical size hashes, duplicate imports, or overlapping modules.
   */
  async analyzeDuplicates(): Promise<string> {
    try {
      const files = await this.getIndexedFiles();
      if (files.length === 0) {
        return "❌ **Duplicate Code Audit Alert:** No codebase index is available. Please run `/scan` first.";
      }

      // 1. Identify identical file hashes (SHA)
      const shaMap = new Map<string, RepoFile[]>();
      for (const file of files) {
        if (!file.sha || file.sha === "live-fetched") continue;
        const list = shaMap.get(file.sha) || [];
        list.push(file);
        shaMap.set(file.sha, list);
      }

      const hashDuplicates: { sha: string; paths: string[] }[] = [];
      for (const [sha, list] of shaMap.entries()) {
        if (list.length > 1) {
          hashDuplicates.push({ sha, paths: list.map(f => f.path) });
        }
      }

      // 2. Format findings for Gemini to analyze
      let duplicateReportPayload = "--- Hash-Identical Duplicate Files ---\n";
      if (hashDuplicates.length === 0) {
        duplicateReportPayload += "None found.\n";
      } else {
        hashDuplicates.forEach(dup => {
          duplicateReportPayload += `- SHA Hash: ${dup.sha}\n  Files:\n` + dup.paths.map(p => `    - ${p}`).join("\n") + "\n";
        });
      }

      // Add file paths list for structural similarity parsing
      const pathList = files.map(f => f.path).slice(0, 100).join("\n");

      const prompt = `You are StudyIG CTO. Review the following codebase analysis metrics regarding duplicated files or highly similar components.

${duplicateReportPayload}

File layout tree (top files):
${pathList}

Formulate a CTO Refactoring & Code Quality Report in Markdown focusing on dry-principles:
1. **Identified Redundancy Hotspots**: Point out duplicate files (from the SHA list) or potential copy-paste components.
2. **Maintenance Impact**: Explain why this structural redundancy slows down developer velocity.
3. **Refactoring Roadmap**: Step-by-step refactoring guidelines to unify duplicate logic into generic helper methods or reusable layout widgets.`;

      return await geminiProvider.generateText(prompt, { temperature: 0.2 });
    } catch (error: any) {
      logger.error("Duplicate audit failed:", error.message || error);
      return `❌ **Duplicate Audit Failed:** ${error.message || "Unknown Error"}`;
    }
  }

  /**
   * General review of specific or random code snippets for quality, architecture and styling standards.
   */
  async reviewCodebase(): Promise<string> {
    try {
      const files = await this.getIndexedFiles();
      if (files.length === 0) {
        return "❌ **Codebase Review Alert:** Codebase is not scanned yet. Run `/scan` first.";
      }

      // Pick top 3-4 files likely representing business logic (app.ts, controllers, or services)
      const targetFiles = files.filter(f => {
        const pathLower = f.path.toLowerCase();
        return (pathLower.includes("app.ts") || pathLower.includes("controller") || pathLower.includes("service") || pathLower.includes("route"))
          && !pathLower.includes("node_modules");
      }).slice(0, 4);

      let reviewPayload = "";
      for (const f of targetFiles) {
        try {
          const content = await this.getFileContent(f.path);
          reviewPayload += `### File: ${f.path}\n\`\`\`\n${content.slice(0, 1200)}\n\`\`\`\n\n`;
        } catch {
          // skip failed files
        }
      }

      const prompt = `You are StudyIG CTO. Perform a code-quality and styling-conventions review of these core codebase snippets.
Audit for:
- Static typing correctness and strict TypeScript parameters.
- DRY principles.
- Clean error handling (try/catch blocks, logging completeness).
- Modular design and file-structure hygiene.

Snippets:
${reviewPayload || "Analyze general structure based on file paths:\n" + files.map(f => f.path).slice(0, 50).join("\n")}

Format your response as a professional, thorough CTO Code Quality Review in Markdown:
1. **Review Score & Grade** (A to F scale based on clean coding standards)
2. **Strengths identified** (What is built well)
3. **Code Quality Opportunities** (Specific recommendations for refactoring)
4. **Style Guidelines Compliance** (TypeScript type safety, logging elegance)`;

      return await geminiProvider.generateText(prompt, { temperature: 0.2 });
    } catch (error: any) {
      logger.error("Codebase review failed:", error.message || error);
      return `❌ **Codebase Review Failed:** ${error.message || "Unknown Error"}`;
    }
  }

  /**
   * Generates a conversational explanation about a specific topic, module or file in our codebase.
   */
  async explainTopic(topic: string): Promise<string> {
    try {
      const files = await this.getIndexedFiles();
      if (files.length === 0) {
        return "❌ **Explanation Alert:** Codebase is not scanned yet. Please run `/scan` first to let me understand the structure.";
      }

      // Match file path to find a specific file if they queried a file path
      const directMatch = files.find(f => f.path.toLowerCase() === topic.trim().toLowerCase() || f.name.toLowerCase() === topic.trim().toLowerCase());
      
      let directContent = "";
      if (directMatch) {
        logger.info(`Found exact file match for explain: ${directMatch.path}`);
        const content = await this.getFileContent(directMatch.path);
        directContent = `\nDirect match file contents of ${directMatch.path}:\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\`\n`;
      }

      const filePathsSummary = files.map(f => f.path).slice(0, 120).join("\n");

      const prompt = `You are StudyIG CTO. The developer asked for an explanation about: "${topic}".
Answer the question based on our repository file structure listed below, or explain the exact file matching their query.

File paths list:
${filePathsSummary}
${directContent}

Provide a comprehensive, elite architectural answer in Markdown. Keep it practical, clear, and focused on enabling developers to build successfully.`;

      return await geminiProvider.generateText(prompt, { temperature: 0.2 });
    } catch (error: any) {
      logger.error("Explain topic failed:", error.message || error);
      return `❌ **Explain failed:** ${error.message || "Unknown Error"}`;
    }
  }
}

export const repoIntelligenceService = new RepoIntelligenceService();
