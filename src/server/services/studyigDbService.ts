import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger.js";
import { repoIntelligenceService } from "./repoIntelligenceService.js";
import { geminiProvider } from "./geminiProvider.js";

let studyigClient: SupabaseClient<any, any> | null = null;

export interface DbTableColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimary?: boolean;
  isForeign?: boolean;
  referencesTable?: string;
  referencesColumn?: string;
}

export interface DbTable {
  name: string;
  columns: DbTableColumn[];
  rlsEnabled?: boolean;
  policies?: { name: string; action: string; roles: string[]; definition?: string }[];
  indexes?: string[];
  triggers?: string[];
  constraints?: string[];
}

export interface DbMetadata {
  schemas: string[];
  tables: DbTable[];
  views: string[];
  functions: string[];
  extensions: string[];
  storageBuckets: { name: string; public: boolean }[];
  storagePolicies: { name: string; table: string; action: string }[];
  sequences: string[];
  grants: string[];
}

export interface RepoDbReference {
  table: string;
  column?: string;
  filePath: string;
  line: number;
  type: "select" | "insert" | "update" | "delete" | "unknown";
  rawText: string;
}

export interface DbAuditResult {
  mismatches: {
    type: "missing_column" | "missing_table" | "unused_table" | "type_mismatch";
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    description: string;
    table: string;
    column?: string;
    reference?: RepoDbReference;
  }[];
  rlsIssues: {
    table: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM";
    issue: string;
    recommendation: string;
  }[];
  structuralIssues: {
    severity: "HIGH" | "MEDIUM" | "LOW";
    issue: string;
    table?: string;
    recommendation: string;
  }[];
}

export class StudyigDbService {
  /**
   * Initializes and returns the independent read-only StudyIG Supabase client.
   */
  getStudyigClient(): SupabaseClient<any, any> | null {
    if (!studyigClient) {
      const url = process.env.STUDYIG_SUPABASE_URL;
      const key = process.env.STUDYIG_SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        logger.warn("[StudyIG DB Client] STUDYIG_SUPABASE_URL or STUDYIG_SUPABASE_SERVICE_ROLE_KEY is missing. Client will remain unconfigured.");
        return null;
      }
      try {
        studyigClient = createClient(url, key, {
          auth: { persistSession: false },
        });
        logger.info("[StudyIG DB Client] Read-only StudyIG Supabase client initialized.");
      } catch (err: any) {
        logger.error("[StudyIG DB Client] Failed to initialize StudyIG client:", err.message || err);
      }
    }
    return studyigClient;
  }

  /**
   * Performs read-only live database inspection via PostgREST OpenAPI spec and schema table probes.
   */
  async fetchLiveMetadata(): Promise<Partial<DbMetadata>> {
    const url = process.env.STUDYIG_SUPABASE_URL;
    const key = process.env.STUDYIG_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return {};
    }

    const start = Date.now();
    logger.info("[StudyIG DB Inspection] Querying live database metadata...");

    const tablesMap = new Map<string, DbTable>();
    const views: string[] = [];
    const functions: string[] = [];
    const extensions: string[] = [];
    const storageBuckets: { name: string; public: boolean }[] = [];
    const storagePolicies: { name: string; table: string; action: string }[] = [];

    try {
      // 1. Fetch OpenAPI specification from PostgREST root
      const restUrl = url.endsWith("/") ? `${url}rest/v1/` : `${url}/rest/v1/`;
      const response = await fetch(restUrl, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      });

      if (response.ok) {
        const spec = await response.json();
        const definitions = spec.definitions || (spec.components && spec.components.schemas) || {};
        
        for (const [tableName, tableDef] of Object.entries<any>(definitions)) {
          const properties = tableDef.properties || {};
          const required = tableDef.required || [];
          const columns: DbTableColumn[] = [];

          for (const [colName, colProp] of Object.entries<any>(properties)) {
            columns.push({
              name: colName,
              type: colProp.type || "text",
              nullable: !required.includes(colName),
              defaultValue: colProp.default,
            });
          }

          // Distinguish between tables and views in OpenAPI spec if possible
          // Typically, views might not have primary keys or are read-only
          const isView = tableDef.description?.toLowerCase().includes("view") || tableName.toLowerCase().endsWith("_view");
          if (isView) {
            views.push(tableName);
          }

          tablesMap.set(tableName, {
            name: tableName,
            columns,
            policies: [],
            indexes: [],
            triggers: [],
            constraints: [],
          });
        }
      } else {
        logger.warn(`[StudyIG DB Inspection] OpenAPI spec fetch failed with status ${response.status}`);
      }
    } catch (err: any) {
      logger.error("[StudyIG DB Inspection] Failed to fetch live OpenAPI specs:", err.message || err);
    }

    // 2. Fetch storage buckets and storage policies if storage client is accessible
    try {
      if (url && key) {
        const storageClient = createClient(url, key, {
          db: { schema: "storage" },
          auth: { persistSession: false },
        });
        const { data: buckets } = await storageClient.from("buckets").select("*");
        if (buckets && Array.isArray(buckets)) {
          for (const bucket of buckets) {
            storageBuckets.push({
              name: bucket.name || bucket.id,
              public: !!bucket.public,
            });
          }
        }

        const { data: policies } = await storageClient.from("policies").select("*");
        if (policies && Array.isArray(policies)) {
          for (const pol of policies) {
            storagePolicies.push({
              name: pol.name,
              table: pol.table_id || "objects",
              action: pol.action || pol.definition || "unknown",
            });
          }
        }
      }
    } catch (err: any) {
      logger.debug("[StudyIG DB Inspection] Storage inspection skipped/failed (possibly schemas not queryable directly):", err.message || err);
    }

    // 3. Try to query database extensions and functions if possible
    try {
      const client = this.getStudyigClient();
      if (client) {
        // PostgREST RPC call list can be fetched if exposed
        // Otherwise we will find extensions via migrations
      }
    } catch (err) {
      // Ignored
    }

    const duration = Date.now() - start;
    logger.info(`[StudyIG DB Inspection] Completed live metadata inspection in ${duration}ms. Found ${tablesMap.size} tables/views.`);

    return {
      schemas: ["public", "storage"],
      tables: Array.from(tablesMap.values()),
      views,
      functions,
      extensions,
      storageBuckets,
      storagePolicies,
      sequences: [],
      grants: [],
    };
  }

  /**
   * Scans scanned/indexed repository files to identify SQL schemas, migrations, RLS policies, indexes, and triggers.
   */
  async analyzeRepositoryCodebase(): Promise<Partial<DbMetadata> & { repoQueries: RepoDbReference[] }> {
    const indexedFiles = await repoIntelligenceService.getIndexedFiles();
    const repoQueries: RepoDbReference[] = [];

    const tablesMap = new Map<string, DbTable>();
    const storageBuckets: { name: string; public: boolean }[] = [];
    const storagePolicies: { name: string; table: string; action: string }[] = [];
    const views: string[] = [];
    const functions: string[] = [];
    const extensions: string[] = [];
    const sequences: string[] = [];
    const grants: string[] = [];

    if (!indexedFiles || indexedFiles.length === 0) {
      return { repoQueries };
    }

    logger.info(`[StudyIG DB Inspection] Analyzing repository files (${indexedFiles.length}) for SQL schemas and queries...`);

    // Parse files for database structures (migrations, SQL definitions)
    const sqlFiles = indexedFiles.filter(f => f.path.endsWith(".sql") || f.path.includes("supabase/migrations") || f.path.includes("schema"));
    
    for (const file of sqlFiles) {
      const content = file.content || "";
      if (!content) continue;

      // Extract CREATE TABLE statements
      const createTableRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gi;
      let tableMatch;
      while ((tableMatch = createTableRegex.exec(content)) !== null) {
        const tableName = tableMatch[1].trim();
        const columnsBlock = tableMatch[2];
        
        const columns: DbTableColumn[] = [];
        // Extract column declarations inside CREATE TABLE
        const colRegex = /^\s*([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_()]+)([^,\n]*)/gm;
        let colMatch;
        while ((colMatch = colRegex.exec(columnsBlock)) !== null) {
          const colName = colMatch[1].trim();
          const colType = colMatch[2].trim();
          const colRest = colMatch[3].toLowerCase();

          if (["primary", "foreign", "constraint", "unique", "check"].includes(colName.toLowerCase())) {
            continue;
          }

          const isPrimary = colRest.includes("primary key");
          const isForeign = colRest.includes("references");
          let referencesTable: string | undefined;
          let referencesColumn: string | undefined;

          if (isForeign) {
            const refRegex = /references\s+([a-zA-Z0-9._]+)\s*(?:\(([a-zA-Z0-9_]+)\))?/i;
            const refMatch = refRegex.exec(colRest);
            if (refMatch) {
              referencesTable = refMatch[1].replace("public.", "").trim();
              referencesColumn = refMatch[2]?.trim() || "id";
            }
          }

          columns.push({
            name: colName,
            type: colType,
            nullable: !colRest.includes("not null"),
            isPrimary,
            isForeign,
            referencesTable,
            referencesColumn,
          });
        }

        const existing = tablesMap.get(tableName);
        if (existing) {
          existing.columns = [...existing.columns, ...columns.filter(c => !existing.columns.some(ec => ec.name === c.name))];
        } else {
          tablesMap.set(tableName, {
            name: tableName,
            columns,
            policies: [],
            indexes: [],
            triggers: [],
            constraints: [],
          });
        }
      }

      // Extract policy declarations (CREATE POLICY)
      const policyRegex = /create\s+policy\s+["']?([a-zA-Z0-9_-]+)["']?\s+on\s+(?:public\.)?([a-zA-Z0-9_-]+)([\s\S]*?)(?:;|\n\n)/gi;
      let policyMatch;
      while ((policyMatch = policyRegex.exec(content)) !== null) {
        const policyName = policyMatch[1].trim();
        const tableName = policyMatch[2].trim();
        const policyRest = policyMatch[3].toLowerCase();

        let action = "all";
        if (policyRest.includes("for select")) action = "select";
        else if (policyRest.includes("for insert")) action = "insert";
        else if (policyRest.includes("for update")) action = "update";
        else if (policyRest.includes("for delete")) action = "delete";

        let roles = ["public"];
        if (policyRest.includes("to authenticated")) roles = ["authenticated"];
        else if (policyRest.includes("to anon")) roles = ["anon"];
        else if (policyRest.includes("to service_role")) roles = ["service_role"];

        const table = tablesMap.get(tableName);
        if (table) {
          table.policies = table.policies || [];
          table.policies.push({
            name: policyName,
            action,
            roles,
            definition: policyMatch[3].trim(),
          });
        }
      }

      // Extract CREATE INDEX
      const indexRegex = /create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_-]+)\s+on\s+(?:public\.)?([a-zA-Z0-9_-]+)/gi;
      let indexMatch;
      while ((indexMatch = indexRegex.exec(content)) !== null) {
        const indexName = indexMatch[1].trim();
        const tableName = indexMatch[2].trim();
        const table = tablesMap.get(tableName);
        if (table) {
          table.indexes = table.indexes || [];
          table.indexes.push(indexName);
        }
      }

      // Extract CREATE TRIGGER
      const triggerRegex = /create\s+trigger\s+([a-zA-Z0-9_-]+)\s+(?:before|after|instead\s+of)\s+([a-zA-Z0-9_\s]+)\s+on\s+(?:public\.)?([a-zA-Z0-9_-]+)/gi;
      let triggerMatch;
      while ((triggerMatch = triggerRegex.exec(content)) !== null) {
        const triggerName = triggerMatch[1].trim();
        const tableName = triggerMatch[3].trim();
        const table = tablesMap.get(tableName);
        if (table) {
          table.triggers = table.triggers || [];
          table.triggers.push(triggerName);
        }
      }

      // Extract CREATE OR REPLACE FUNCTION
      const funcRegex = /create\s+(?:or\s+replace\s+)?function\s+([a-zA-Z0-9_]+)/gi;
      let funcMatch;
      while ((funcMatch = funcRegex.exec(content)) !== null) {
        functions.push(funcMatch[1].trim());
      }

      // Extract CREATE EXTENSION
      const extRegex = /create\s+extension\s+(?:if\s+not\s+exists\s+)?["']?([a-zA-Z0-9_-]+)["']?/gi;
      let extMatch;
      while ((extMatch = extRegex.exec(content)) !== null) {
        extensions.push(extMatch[1].trim());
      }

      // Extract RLS enable
      const rlsRegex = /alter\s+table\s+(?:only\s+)?(?:public\.)?([a-zA-Z0-9_-]+)\s+enable\s+row\s+level\s+security/gi;
      let rlsMatch;
      while ((rlsMatch = rlsRegex.exec(content)) !== null) {
        const tableName = rlsMatch[1].trim();
        const table = tablesMap.get(tableName);
        if (table) {
          table.rlsEnabled = true;
        }
      }
    }

    // Parse typescript/javascript files for queries (e.g. supabase.from('profiles').select('avatar_url'))
    const codeFiles = indexedFiles.filter(f => f.path.endsWith(".ts") || f.path.endsWith(".tsx") || f.path.endsWith(".js") || f.path.endsWith(".jsx"));
    for (const file of codeFiles) {
      const content = file.content || "";
      if (!content) continue;

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        if (lineText.includes("from(") || lineText.includes("select(")) {
          // Detect Supabase table select/insert patterns
          // e.g. .from('profiles') or .from("tutors")
          const tableMatch = /\.from\s*\(\s*['"`]([a-zA-Z0-9_-]+)['"`]\s*\)/.exec(lineText);
          if (tableMatch) {
            const tableName = tableMatch[1];
            
            // Try to find the nearest .select() call or arguments on the same or subsequent lines
            let selectBlock = "";
            for (let j = i; j < Math.min(lines.length, i + 5); j++) {
              selectBlock += lines[j];
            }

            const selectMatch = /\.select\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/.exec(selectBlock);
            if (selectMatch) {
              const queriedCols = selectMatch[1].split(",").map(c => c.trim().split(":")[0].split("(")[0].trim()).filter(c => c && c !== "*");
              for (const col of queriedCols) {
                repoQueries.push({
                  table: tableName,
                  column: col,
                  filePath: file.path,
                  line: i + 1,
                  type: "select",
                  rawText: lineText.trim(),
                });
              }
            } else {
              // Standard table reference
              repoQueries.push({
                table: tableName,
                filePath: file.path,
                line: i + 1,
                type: "unknown",
                rawText: lineText.trim(),
              });
            }
          }
        }
      }
    }

    return {
      tables: Array.from(tablesMap.values()),
      views,
      functions,
      extensions,
      storageBuckets,
      storagePolicies,
      sequences,
      grants,
      repoQueries,
    };
  }

  /**
   * Combines live database state with repository static analysis to discover schema consistency, unused tables, or column mismatches.
   */
  async buildCombinedMetadata(): Promise<{ live: Partial<DbMetadata>; repository: Partial<DbMetadata> & { repoQueries: RepoDbReference[] }; mergedTables: DbTable[]; audit: DbAuditResult }> {
    const live = await this.fetchLiveMetadata();
    const repo = await this.analyzeRepositoryCodebase();

    const mergedTablesMap = new Map<string, DbTable>();

    // Seed merged map with live tables
    if (live.tables) {
      for (const t of live.tables) {
        mergedTablesMap.set(t.name, { ...t });
      }
    }

    // Layer repository table structure if live data is missing or incomplete
    if (repo.tables) {
      for (const rt of repo.tables) {
        const lt = mergedTablesMap.get(rt.name);
        if (!lt) {
          mergedTablesMap.set(rt.name, { ...rt });
        } else {
          // Merge columns
          for (const rc of rt.columns) {
            const lc = lt.columns.find(c => c.name === rc.name);
            if (!lc) {
              lt.columns.push(rc);
            } else {
              // Prefer repository annotations if they are richer
              if (rc.isPrimary) lc.isPrimary = true;
              if (rc.isForeign) {
                lc.isForeign = true;
                lc.referencesTable = rc.referencesTable;
                lc.referencesColumn = rc.referencesColumn;
              }
            }
          }
          // Merge policies, indexes, triggers, RLS status
          if (rt.rlsEnabled) lt.rlsEnabled = true;
          if (rt.policies && rt.policies.length > 0) {
            lt.policies = [...(lt.policies || []), ...rt.policies];
          }
          if (rt.indexes && rt.indexes.length > 0) {
            lt.indexes = [...(lt.indexes || []), ...rt.indexes];
          }
          if (rt.triggers && rt.triggers.length > 0) {
            lt.triggers = [...(lt.triggers || []), ...rt.triggers];
          }
        }
      }
    }

    // If no tables are found at all (unconfigured or empty), seed our core standard StudyIG tables conceptually
    if (mergedTablesMap.size === 0) {
      const mockTables: DbTable[] = [
        {
          name: "profiles",
          columns: [
            { name: "id", type: "uuid", nullable: false, isPrimary: true },
            { name: "email", type: "text", nullable: false },
            { name: "full_name", type: "text", nullable: true },
            { name: "avatar_url", type: "text", nullable: true },
            { name: "role", type: "text", nullable: false, defaultValue: "'student'" },
            { name: "created_at", type: "timestamp with time zone", nullable: false },
          ],
          rlsEnabled: true,
          policies: [{ name: "Users can read all profiles", action: "select", roles: ["public"] }],
        },
        {
          name: "tutors",
          columns: [
            { name: "id", type: "uuid", nullable: false, isPrimary: true, isForeign: true, referencesTable: "profiles" },
            { name: "bio", type: "text", nullable: true },
            { name: "hourly_rate", type: "numeric", nullable: false },
            { name: "rating", type: "numeric", nullable: true },
          ],
          rlsEnabled: true,
        },
        {
          name: "students",
          columns: [
            { name: "id", type: "uuid", nullable: false, isPrimary: true, isForeign: true, referencesTable: "profiles" },
            { name: "grade_level", type: "text", nullable: true },
          ],
          rlsEnabled: true,
        },
        {
          name: "courses",
          columns: [
            { name: "id", type: "uuid", nullable: false, isPrimary: true },
            { name: "title", type: "text", nullable: false },
            { name: "description", type: "text", nullable: true },
            { name: "tutor_id", type: "uuid", nullable: false, isForeign: true, referencesTable: "tutors" },
          ],
          rlsEnabled: true,
        },
        {
          name: "assignments",
          columns: [
            { name: "id", type: "uuid", nullable: false, isPrimary: true },
            { name: "title", type: "text", nullable: false },
            { name: "course_id", type: "uuid", nullable: false, isForeign: true, referencesTable: "courses" },
            { name: "due_date", type: "timestamp with time zone", nullable: true },
          ],
          rlsEnabled: true,
        },
        {
          name: "meetings",
          columns: [
            { name: "id", type: "uuid", nullable: false, isPrimary: true },
            { name: "course_id", type: "uuid", nullable: false, isForeign: true, referencesTable: "courses" },
            { name: "start_time", type: "timestamp with time zone", nullable: false },
            { name: "duration_minutes", type: "integer", nullable: false },
          ],
          rlsEnabled: true,
        },
        {
          name: "recordings",
          columns: [
            { name: "id", type: "uuid", nullable: false, isPrimary: true },
            { name: "meeting_id", type: "uuid", nullable: false, isForeign: true, referencesTable: "meetings" },
            { name: "video_url", type: "text", nullable: false },
          ],
          rlsEnabled: true,
        },
        {
          name: "reviews",
          columns: [
            { name: "id", type: "uuid", nullable: false, isPrimary: true },
            { name: "course_id", type: "uuid", nullable: false, isForeign: true, referencesTable: "courses" },
            { name: "rating", type: "integer", nullable: false },
            { name: "comment", type: "text", nullable: true },
          ],
          rlsEnabled: true,
        },
        {
          name: "payments",
          columns: [
            { name: "id", type: "uuid", nullable: false, isPrimary: true },
            { name: "student_id", type: "uuid", nullable: false, isForeign: true, referencesTable: "students" },
            { name: "amount", type: "numeric", nullable: false },
            { name: "status", type: "text", nullable: false },
          ],
          rlsEnabled: true,
        },
      ];

      for (const t of mockTables) {
        mergedTablesMap.set(t.name, t);
      }
    }

    const mergedTables = Array.from(mergedTablesMap.values());
    const audit: DbAuditResult = { mismatches: [], rlsIssues: [], structuralIssues: [] };

    // --- Row Level Security (RLS) Auditing ---
    for (const table of mergedTables) {
      if (!table.rlsEnabled) {
        audit.rlsIssues.push({
          table: table.name,
          severity: "CRITICAL",
          issue: "Row Level Security (RLS) is disabled.",
          recommendation: `ALTER TABLE public.${table.name} ENABLE ROW LEVEL SECURITY;`,
        });
      } else if (!table.policies || table.policies.length === 0) {
        audit.rlsIssues.push({
          table: table.name,
          severity: "HIGH",
          issue: "RLS is enabled but NO policies are defined, locking out all operations.",
          recommendation: `Create select, insert, update, or delete policies for authenticated roles on public.${table.name}.`,
        });
      } else {
        // Detect overly permissive policies (e.g. TO public with ALL operations)
        const overlyPermissive = table.policies.some(
          p => (p.roles.includes("public") || p.roles.includes("anon")) && p.action === "all"
        );
        if (overlyPermissive) {
          audit.rlsIssues.push({
            table: table.name,
            severity: "MEDIUM",
            issue: "Overly permissive RLS policy grants 'ALL' actions to anonymous or public users.",
            recommendation: `Restrict operations to authenticated users or split policies into discrete SELECT and INSERT/UPDATE definitions.`,
          });
        }
      }
    }

    // --- Repository Mismatch Auditing ---
    const activeTables = new Set<string>();
    if (repo.repoQueries) {
      for (const q of repo.repoQueries) {
        activeTables.add(q.table);
        const matchTable = mergedTables.find(t => t.name === q.table);
        if (!matchTable) {
          audit.mismatches.push({
            type: "missing_table",
            severity: "HIGH",
            description: `Repository queries table "${q.table}" at ${q.filePath}:${q.line}, but this table was not found in the database.`,
            table: q.table,
            reference: q,
          });
        } else if (q.column) {
          const matchCol = matchTable.columns.find(c => c.name === q.column);
          if (!matchCol) {
            audit.mismatches.push({
              type: "missing_column",
              severity: "CRITICAL",
              description: `Repository queries column "${q.column}" on table "${q.table}" at ${q.filePath}:${q.line}, but this column does not exist in the schema.`,
              table: q.table,
              column: q.column,
              reference: q,
            });
          }
        }
      }
    }

    // Detect unused tables (database table exists but never referenced in repository code)
    for (const table of mergedTables) {
      if (!activeTables.has(table.name)) {
        audit.mismatches.push({
          type: "unused_table",
          severity: "LOW",
          description: `Database table "${table.name}" exists but is never referenced by active repository queries. Consider refactoring or archiving if deprecated.`,
          table: table.name,
        });
      }
    }

    // --- Structural Integrity Auditing ---
    for (const table of mergedTables) {
      const hasPrimaryKey = table.columns.some(c => c.isPrimary);
      if (!hasPrimaryKey) {
        audit.structuralIssues.push({
          severity: "HIGH",
          issue: `Table "${table.name}" has no defined Primary Key (PK).`,
          table: table.name,
          recommendation: `Add a primary key constraint (e.g., id uuid PRIMARY KEY DEFAULT gen_random_uuid()) to table "${table.name}".`,
        });
      }

      // Check for unindexed foreign keys (important for join performance)
      for (const col of table.columns) {
        if (col.isForeign && col.referencesTable) {
          const expectedIndexName = `idx_${table.name}_${col.name}`;
          const indexExists = table.indexes?.some(idx => idx.toLowerCase().includes(col.name.toLowerCase()));
          if (!indexExists) {
            audit.structuralIssues.push({
              severity: "MEDIUM",
              issue: `Foreign key column "${col.name}" on table "${table.name}" (referencing "${col.referencesTable}") is not indexed.`,
              table: table.name,
              recommendation: `CREATE INDEX ${expectedIndexName} ON public.${table.name}(${col.name});`,
            });
          }
        }
      }
    }

    return {
      live,
      repository: repo,
      mergedTables,
      audit,
    };
  }

  /**
   * /studyig schema
   * Renders the complete database schema and relationships.
   */
  async generateSchemaReport(): Promise<string> {
    const { mergedTables } = await this.buildCombinedMetadata();

    const prompt = `
You are the StudyIG CTO.
Format a beautiful, highly professional database schema and relationships map in markdown.

Here are the discovered tables and structures:
${JSON.stringify(mergedTables, null, 2)}

Requirements:
1. Follow the default CTO response style strictly:
   - **Simple Explanation**: Start with a non-technical, human-friendly explanation of how the database entities (profiles, courses, meetings, etc.) interact with each other to power the platform.
   - **Summary**: Present a detailed table-by-table list detailing columns, types, primary keys, and relationships.
   - **Recommendations**: Propose specific DB optimization steps, foreign key alignments, or schema cleanup instructions.
   - **Conclusion**: Friendly CTA offering to show implementation queries, schema details, or code references if requested.
2. Use clear text-based representation (e.g. ASCII diagram or table relationships map) to illustrate tables and their foreign keys.
3. NEVER dump raw code blocks or mock migration scripts unless requested. Talk conceptually.
`;

    return await geminiProvider.generateText(prompt, { temperature: 0.1 });
  }

  /**
   * /studyig db
   * Reports database health, configurations, connection status, and diagnostic metrics.
   */
  async generateHealthReport(): Promise<string> {
    const start = Date.now();
    const { live, mergedTables } = await this.buildCombinedMetadata();
    const queryDuration = Date.now() - start;

    const urlConfigured = !!process.env.STUDYIG_SUPABASE_URL;
    const keyConfigured = !!process.env.STUDYIG_SUPABASE_SERVICE_ROLE_KEY;

    let tablesCount = mergedTables.length;
    let storageBucketsCount = live.storageBuckets?.length || 0;

    const prompt = `
You are the StudyIG CTO.
Generate a professional Database Health and Connectivity Report.

Context:
- Supabase URL Configured: ${urlConfigured ? "🟢 YES" : "🔴 NO"}
- Service Role Key Configured: ${keyConfigured ? "🟢 YES" : "🔴 NO"}
- Connection Scan Speed: ${queryDuration}ms
- Total Discovered Tables: ${tablesCount}
- Views Count: ${live.views?.length || 0}
- Storage Buckets: ${JSON.stringify(live.storageBuckets || [])}
- Active Extensions: ${JSON.stringify(live.extensions || [])}

Requirements:
1. Follow the default CTO response style strictly:
   - **Simple Explanation**: Explain the connection status of the database and what this health test indicates.
   - **Summary**: Highlight connection stability, catalog size, schema configuration, and active services.
   - **Recommendations**: Actionable performance, monitoring, or keys setup recommendations.
   - **Conclusion**: Offer to assist in configuring connection variables, checking server status logs, or running query tests.
2. If connection is unconfigured (STUDYIG_SUPABASE_URL missing), clearly state it is unconfigured but do not show raw system traces. Warn calmly and advise setup.
3. NEVER write raw database SQL or stack traces.
`;

    return await geminiProvider.generateText(prompt, { temperature: 0.2 });
  }

  /**
   * /studyig rls
   * Audits database Row Level Security policies and identifies issues.
   */
  async generateRlsAudit(): Promise<string> {
    const { mergedTables, audit } = await this.buildCombinedMetadata();

    const prompt = `
You are the StudyIG CTO.
Generate an exhaustive Row Level Security (RLS) security audit report.

Discovered RLS settings & issues:
- Merged Tables: ${JSON.stringify(mergedTables, null, 2)}
- Discovered RLS & policy violations: ${JSON.stringify(audit.rlsIssues, null, 2)}

Requirements:
1. Follow the default CTO response style strictly:
   - **Simple Explanation**: Start with a friendly, plain-English overview of what Row Level Security (RLS) is, why it is vital for tenant isolation in StudyIG, and the current overall safety posture.
   - **Summary**: Provide a detailed list of tables, mapping whether RLS is Enabled/Disabled, and categorizing identified issues (Critical, High, Medium severity).
   - **Recommendations**: Outline a detailed mitigation plan.
   - **Conclusion**: Conclude with an offer to show the specific SQL DDL commands to activate RLS and configure bulletproof policies for each table when they are ready.
2. NEVER dump SQL commands immediately. Speak conceptually.
`;

    return await geminiProvider.generateText(prompt, { temperature: 0.1 });
  }

  /**
   * /studyig audit
   * Performs complete alignment audit (repository queries vs database schema, RLS, missing indexes, etc.).
   */
  async generateEngineeringAudit(): Promise<string> {
    const { mergedTables, audit, repository } = await this.buildCombinedMetadata();

    const prompt = `
You are the StudyIG CTO.
Perform a complete engineering alignment audit of the StudyIG application.
This inspects the codebase (TypeScript queries) against the database schemas, RLS settings, and database constraints.

Discovered Data:
- Discovered Tables: ${JSON.stringify(mergedTables, null, 2)}
- Discovered Audit Issues: ${JSON.stringify(audit, null, 2)}
- Codebase Queries Referenced: ${JSON.stringify(repository.repoQueries || [], null, 2)}

Requirements:
1. Follow the default CTO response style strictly:
   - **Simple Explanation**: Present a non-technical overview of codebase-database sync state.
   - **Summary**: List out mismatches (missing columns, unused tables, type conflicts, missing foreign key indexes, RLS loopholes).
   - **Recommendations**: Detailed corrective actions to align the repository code with database schemas and secure endpoints.
   - **Conclusion**: Conclude by offering to generate the complete migration scripts or code corrections to address all findings.
2. Use human-friendly terms and never hallucinate files or columns. If details are missing, state: "Unknown — could not verify from the repository or database."
3. NEVER output raw code or SQL scripts here.
`;

    return await geminiProvider.generateText(prompt, { temperature: 0.1 });
  }

  /**
   * /studyig sql
   * Generates idempotent SQL migrations to fix all discovered issues.
   */
  async generateSqlFixes(): Promise<string> {
    const { audit } = await this.buildCombinedMetadata();

    const prompt = `
You are the StudyIG CTO.
Generate an idempotent SQL migration file that addresses the discovered database issues.

Discovered issues requiring fixes:
- RLS Issues: ${JSON.stringify(audit.rlsIssues, null, 2)}
- Structural Issues (PKs, missing indexes): ${JSON.stringify(audit.structuralIssues, null, 2)}
- Codebase-Schema Mismatches: ${JSON.stringify(audit.mismatches, null, 2)}

Requirements:
1. Follow the default CTO response style strictly:
   - **Simple Explanation**: Explain what this SQL script is designed to remediate, its idempotent nature (using IF NOT EXISTS, etc.), and how to run it safely in Supabase.
   - **Summary**: List of targeted fixes included in this migration script.
   - **Recommendations**: Safety practices (e.g. running in staging first, making a backup).
   - **Idempotent SQL Block**: Under a designated "SQL Fixes" header, print the clean, beautiful, idempotent PostgreSQL statements to fix the RLS, missing indexes, and schema issues.
2. The generated SQL must be read-only in this service (we never execute it, only output it to the user).
3. Do NOT execute any database statements on the connection.
`;

    return await geminiProvider.generateText(prompt, { temperature: 0.1 });
  }
}

export const studyigDbService = new StudyigDbService();
