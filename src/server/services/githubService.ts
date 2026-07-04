/**
 * GitHub Integration Service.
 * Read-only interface for indexing and parsing GitHub repositories.
 */

import { logger } from "../lib/logger.js";

export class GithubService {
  isConfigured(): boolean {
    return !!process.env.GITHUB_TOKEN;
  }

  /**
   * Fetches the contents of a specific directory or file path within a repository (Read-Only).
   */
  async fetchRepoPath(owner: string, repo: string, path: string = ""): Promise<any> {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "StudyIG-CTO-Assistant"
    };

    if (token) {
      headers.Authorization = `token ${token}`;
    }

    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      logger.info(`Sending GitHub GET request to ${owner}/${repo}/contents/${path} (Read-Only)`);
      
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`GitHub API returned error status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      logger.error(`Failed to read from GitHub repo ${owner}/${repo}:`, error.message || error);
      throw error;
    }
  }
}

export const githubService = new GithubService();
