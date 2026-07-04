import { FileExplainer } from "../types";

export const fileExplainers: FileExplainer[] = [
  {
    name: "server.ts",
    path: "/server.ts",
    purpose: "The lightweight root bootstrapper. It imports the compiled Express application and listens on Host 0.0.0.0 and Port 3000.",
    keyHighlights: [
      "No direct route or middleware bindings — delegates fully to app.ts.",
      "Handles runtime uncaught exceptions and unhandled promise rejections cleanly.",
      "Ensures clean startup state reporting."
    ],
    snippet: `const app = await createApp();
app.listen(config.port, "0.0.0.0", () => {
  logger.info("🤖 StudyIG CTO server initialized successfully!");
});`
  },
  {
    name: "app.ts",
    path: "/src/server/app.ts",
    purpose: "Assembles Express configurations, middleware pipelines (logger, parser, static files, and exception catchers).",
    keyHighlights: [
      "Injects requestLogger before parsing payloads for complete performance timing.",
      "Integrates Vite middleware dynamically inside development mode.",
      "Appends the errorHandler middleware as the final safety net."
    ],
    snippet: `app.use(requestLogger);
app.use(express.json());
app.use("/api", apiRouter);
app.use(errorHandler);`
  },
  {
    name: "aiProvider.ts",
    path: "/src/server/lib/aiProvider.ts",
    purpose: "Declares the AI Provider abstraction interface, decoupling prompt operations from any specific AI provider SDK.",
    keyHighlights: [
      "Enables swapping Gemini with OpenAI, Anthropic, or local models anytime.",
      "Defines clean methods for generating standard text and structured JSON objects."
    ],
    snippet: `export interface AIProvider {
  generateText(prompt: string, options?: AIModelOptions): Promise<string>;
  generateStructuredJSON<T>(prompt: string, options?: AIModelOptions): Promise<T>;
}`
  },
  {
    name: "geminiProvider.ts",
    path: "/src/server/services/geminiProvider.ts",
    purpose: "Concrete implementation of the AIProvider interface specifically utilizing the official @google/genai SDK.",
    keyHighlights: [
      "Applies lazy loading to prevent crashes if the API key is missing.",
      "Uses gemini-2.5-flash as the default fast reasoning agent.",
      "Provides structured JSON extraction out-of-the-box."
    ],
    snippet: `export class GeminiProvider implements AIProvider {
  async generateText(prompt: string, options?: AIModelOptions): Promise<string> {
    const client = this.getClient();
    const response = await client.models.generateContent({ ... });
    return response.text;
  }
}`
  },
  {
    name: "projectRepository.ts",
    path: "/src/server/repositories/projectRepository.ts",
    purpose: "The Data Access Layer (DAL) encapsulating database communications with Supabase.",
    keyHighlights: [
      "Contains clean database queries for the 'projects' and 'assistant_memories' tables.",
      "Returns graceful defaults if Supabase variables are absent during local setup."
    ],
    snippet: `const { data, error } = await this.getClient()
  .from("projects")
  .select("*")
  .order("created_at", { ascending: false });`
  },
  {
    name: "logger.ts",
    path: "/src/server/lib/logger.ts",
    purpose: "Centralized logger that tags terminal logs with clean colors, log levels, and timestamps.",
    keyHighlights: [
      "Supports INFO, WARN, ERROR, and DEBUG logging configurations.",
      "Suppresses debug level logs when running in a production ecosystem."
    ],
    snippet: `class Logger {
  info(message: string, context?: any) {
    console.log(this.formatMessage(LogLevel.INFO, message, context));
  }
}`
  },
  {
    name: "validationMiddleware.ts",
    path: "/src/server/middleware/validationMiddleware.ts",
    purpose: "Validates incoming HTTP request body, query, or route params dynamically using schema parsing with Zod.",
    keyHighlights: [
      "Performs async Zod parsing to prevent runtime typing injections.",
      "Interceptors ZodErrors and formats detailed 400 responses listing wrong fields."
    ],
    snippet: `if (schema.body) {
  req.body = await schema.body.parseAsync(req.body);
}`
  },
  {
    name: "CTO Schema Migration",
    path: "/supabase/migrations/0001_create_cto_schema.sql",
    purpose: "Idempotent SQL script to create the 'studyig_cto' schema and its associated tables. Completely isolates agent memories from StudyIG's main tables.",
    keyHighlights: [
      "Creates the 'studyig_cto' schema if it does not already exist.",
      "Configures projects and assistant_memories tables with safe constraints and CASCADE triggers.",
      "Completely leaves StudyIG's production tables in the public schema untouched."
    ],
    snippet: `CREATE SCHEMA IF NOT EXISTS studyig_cto;
CREATE TABLE IF NOT EXISTS studyig_cto.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);`
  }
];
