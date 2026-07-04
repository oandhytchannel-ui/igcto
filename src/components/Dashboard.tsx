import { useState, useEffect } from "react";
import { 
  Terminal, Cpu, Database, Github, Send, AlertCircle, 
  CheckCircle2, XCircle, Clock, BookOpen, RefreshCw, 
  ChevronRight, Code2, Folder, Info, Sparkles, Layers 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { DiagnosticsReport, ArchitectureInfo, FileExplainer } from "../types";
import { fileExplainers } from "../data/fileExplainers";

export default function Dashboard() {
  // States for backend connectivity
  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(null);
  const [architecture, setArchitecture] = useState<ArchitectureInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Selected state for interactive files explainer
  const [selectedFile, setSelectedFile] = useState<FileExplainer>(fileExplainers[0]);
  
  // Selected state for setup guide instructions
  const [selectedServiceGuide, setSelectedServiceGuide] = useState<string>("gemini");

  // Fetch real diagnostic data from our Express server
  const fetchBackendData = async () => {
    setIsRefreshing(true);
    try {
      const diagRes = await fetch("/api/diagnostics");
      const archRes = await fetch("/api/architecture");

      if (!diagRes.ok || !archRes.ok) {
        throw new Error("Failed to communicate with Express backend endpoints.");
      }

      const diagData = await diagRes.json();
      const archData = await archRes.json();

      if (diagData.success) {
        setDiagnostics(diagData.data);
      }
      if (archData.success) {
        setArchitecture(archData.data);
      }
      setError(null);
    } catch (err: any) {
      console.error("Connectivity error:", err);
      setError(err.message || "Could not connect to the Express server. Make sure port 3000 is active.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBackendData();
  }, []);

  // Guide contents for setting up credentials in future phases
  const serviceGuides: Record<string, { title: string; steps: string[]; linkText: string }> = {
    gemini: {
      title: "Google Gemini 3.5 API Key Setup",
      steps: [
        "Open the AI Studio Settings menu or Secrets panel.",
        "Add a secret key named 'GEMINI_API_KEY'.",
        "At runtime, the platform injects this value automatically.",
        "We use 'gemini-3.5-flash' for reasoning and code analysis."
      ],
      linkText: "Get key from Google AI Studio"
    },
    supabase: {
      title: "Supabase Persistent Memory Setup",
      steps: [
        "Use your existing StudyIG Supabase project (no need to create a second project).",
        "Navigate to Project Settings > API to locate your URL and Service Role Key.",
        "Add 'SUPABASE_URL' and 'SUPABASE_SERVICE_ROLE_KEY' to your environment variables to bypass Row Level Security.",
        "Optionally set 'SUPABASE_SCHEMA' (defaults to 'studyig_cto') to isolate all AI memory tables from production application data."
      ],
      linkText: "Go to Supabase Dashboard"
    },
    telegram: {
      title: "Telegram Bot API Setup",
      steps: [
        "Open Telegram and search for the official account @BotFather.",
        "Send the command '/newbot' and follow instructions to choose a name and username.",
        "Copy the HTTP API access token provided by BotFather.",
        "Add 'TELEGRAM_BOT_TOKEN' to your environment variables."
      ],
      linkText: "Create a Telegram Bot"
    },
    github: {
      title: "GitHub API Personal Access Token Setup",
      steps: [
        "Go to github.com > Settings > Developer Settings.",
        "Create a 'Personal Access Token (classic)' or fine-grained token.",
        "Enable 'repo' scope permissions so the bot can read your project codebases.",
        "Add 'GITHUB_TOKEN' to your environment configurations."
      ],
      linkText: "Generate GitHub Token"
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 lg:p-8">
      {/* 1. Header Branding & Live Status Bar */}
      <header className="max-w-7xl mx-auto mb-8 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
            <Cpu className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Project Workspace</span>
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[10px] font-semibold">Phase 1 Complete</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans mt-0.5">
              StudyIG CTO
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Active backend connectivity badge */}
          <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-semibold ${
            error 
              ? "bg-rose-500/10 border border-rose-500/30 text-rose-400" 
              : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${error ? "bg-rose-500 animate-ping" : "bg-emerald-500 animate-pulse"}`} />
            {error ? "BACKEND DISCONNECTED" : "EXPRESS + VITE SERVER ONLINE"}
          </div>

          <button 
            id="refresh-btn"
            onClick={fetchBackendData}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-650 transition text-xs font-semibold rounded-xl border border-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Diagnostics
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        
        {/* 2. Left Column: Live Diagnostics & Environment Configuration (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          
          {/* Service Pillar Status Cards */}
          <section className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">System Service Pillars</h2>
              </div>
              <span className="text-xs text-slate-400">Phase 1 Setup Check</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Gemini Card */}
              <div 
                id="card-gemini"
                onClick={() => setSelectedServiceGuide("gemini")}
                className={`p-4 rounded-xl border transition cursor-pointer select-none flex flex-col justify-between h-36 ${
                  selectedServiceGuide === "gemini" 
                    ? "bg-violet-500/10 border-violet-500/40 shadow-md shadow-violet-500/5" 
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-750"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-violet-500/10 text-violet-400 rounded-lg">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    diagnostics?.services.gemini.status === "configured"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}>
                    {diagnostics?.services.gemini.status || "Checking"}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mt-2">Gemini 3.5 AI</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                    Generative planning and code auditing.
                  </p>
                </div>
              </div>

              {/* Supabase Card */}
              <div 
                id="card-supabase"
                onClick={() => setSelectedServiceGuide("supabase")}
                className={`p-4 rounded-xl border transition cursor-pointer select-none flex flex-col justify-between h-36 ${
                  selectedServiceGuide === "supabase" 
                    ? "bg-emerald-500/10 border-emerald-500/40 shadow-md shadow-emerald-500/5" 
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-750"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <Database className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    diagnostics?.services.supabase.status === "configured"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}>
                    {diagnostics?.services.supabase.status || "Checking"}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mt-2">Supabase Database</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                    Persistent memories and tracking histories.
                  </p>
                </div>
              </div>

              {/* Telegram Card */}
              <div 
                id="card-telegram"
                onClick={() => setSelectedServiceGuide("telegram")}
                className={`p-4 rounded-xl border transition cursor-pointer select-none flex flex-col justify-between h-36 ${
                  selectedServiceGuide === "telegram" 
                    ? "bg-blue-500/10 border-blue-500/40 shadow-md shadow-blue-500/5" 
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-750"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                    <Send className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    diagnostics?.services.telegram.status === "configured"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}>
                    {diagnostics?.services.telegram.status || "Checking"}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mt-2">Telegram Bot API</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                    Conversational control interface.
                  </p>
                </div>
              </div>

              {/* GitHub Card */}
              <div 
                id="card-github"
                onClick={() => setSelectedServiceGuide("github")}
                className={`p-4 rounded-xl border transition cursor-pointer select-none flex flex-col justify-between h-36 ${
                  selectedServiceGuide === "github" 
                    ? "bg-indigo-500/10 border-indigo-500/40 shadow-md shadow-indigo-500/5" 
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-750"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                    <Github className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    diagnostics?.services.github.status === "configured"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}>
                    {diagnostics?.services.github.status || "Checking"}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mt-2">GitHub Integration</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                    Reading repositories and file context.
                  </p>
                </div>
              </div>

            </div>

            {/* Selected Service Setup Instructions */}
            <div className="mt-6 p-4 bg-slate-900/80 rounded-xl border border-slate-800">
              <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-400" />
                {serviceGuides[selectedServiceGuide].title}
              </h4>
              <ul className="space-y-2 text-xs text-slate-300">
                {serviceGuides[selectedServiceGuide].steps.map((step, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-indigo-400 font-bold">{idx + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Phase 1 parses and registers these credentials securely.</span>
                <span className="text-indigo-400 hover:underline font-semibold cursor-default">
                  {serviceGuides[selectedServiceGuide].linkText}
                </span>
              </div>
            </div>
          </section>

          {/* Raw Diagnostics JSON Visual Terminal */}
          <section className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6 shadow-lg flex-1">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">Live Diagnostics Console</h2>
              </div>
              <span className="text-[10px] font-mono text-slate-500">GET /api/diagnostics</span>
            </div>

            <div className="bg-slate-950 rounded-xl border border-slate-850 p-4 font-mono text-xs overflow-x-auto text-emerald-400 h-64 shadow-inner">
              {loading ? (
                <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  Requesting system status...
                </div>
              ) : error ? (
                <div className="text-rose-400 flex items-start gap-2 p-2">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Diagnostics Connection Failed</p>
                    <p className="text-xs text-slate-400 mt-1">{error}</p>
                  </div>
                </div>
              ) : (
                <pre>{JSON.stringify({ success: true, data: diagnostics }, null, 2)}</pre>
              )}
            </div>
          </section>

        </div>

        {/* 3. Right Column: File Architecture & Interactive Code Explainer (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          
          <section className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6 shadow-lg flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">File Architecture</h2>
              </div>
              <span className="text-xs text-slate-400">Interactive Codebase</span>
            </div>

            {/* Folder selection tab/list */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {fileExplainers.slice(0, 3).map((file) => (
                <button
                  key={file.name}
                  onClick={() => setSelectedFile(file)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border text-center truncate transition ${
                    selectedFile.name === file.name
                      ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300"
                      : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-750"
                  }`}
                >
                  {file.name}
                </button>
              ))}
            </div>

            <div className="space-y-2 mb-6 flex-1 max-h-[180px] overflow-y-auto pr-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Services Base</span>
              {fileExplainers.slice(3).map((file) => (
                <div
                  key={file.name}
                  onClick={() => setSelectedFile(file)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    selectedFile.name === file.name
                      ? "bg-indigo-500/10 border-indigo-500/40"
                      : "bg-slate-900/50 border-slate-800 hover:border-slate-750"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Code2 className={`w-4 h-4 shrink-0 ${selectedFile.name === file.name ? "text-indigo-400" : "text-slate-500"}`} />
                    <div className="min-w-0">
                      <span className={`text-xs font-semibold block truncate ${selectedFile.name === file.name ? "text-indigo-300" : "text-slate-300"}`}>
                        {file.name}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">{file.path}</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${
                    selectedFile.name === file.name ? "text-indigo-400 translate-x-0.5" : "text-slate-600"
                  }`} />
                </div>
              ))}
            </div>

            {/* Code Explainer display */}
            <div className="border-t border-slate-800 pt-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                    {selectedFile.path}
                  </span>
                  <span className="text-[10px] text-slate-500">TypeScript Module</span>
                </div>
                
                <h3 className="text-sm font-bold text-white mb-2">{selectedFile.name} Explainer</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  {selectedFile.purpose}
                </p>

                <div className="space-y-1.5 mb-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Key Highlights</span>
                  {selectedFile.keyHighlights.map((highlight, idx) => (
                    <div key={idx} className="flex gap-2 text-xs text-slate-300 leading-normal">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Snippet Preview</span>
                <div className="bg-slate-950 rounded-xl border border-slate-850 p-3 font-mono text-[10px] text-slate-400 overflow-x-auto">
                  <pre className="whitespace-pre-wrap">{selectedFile.snippet}</pre>
                </div>
              </div>
            </div>
          </section>

        </div>

      </main>

      {/* 4. Bottom Section: Roadmap and Progress Tracker */}
      <footer className="max-w-7xl mx-auto bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          <div className="md:col-span-7">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Phase 1 Deliverables Checklist
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                "Modular directory folder architecture",
                "Environment variables example blueprint",
                "Diagnostics reporting API backend",
                "Unified Express + Vite dev server (Port 3000)",
                "TypeScript strict compiler config",
                "Lazy-initialization service connectors"
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-850">
                  <div className="p-1 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium text-slate-200">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-5 flex flex-col justify-between p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
            <div>
              <h3 className="text-sm font-bold text-indigo-300 mb-1.5 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Phase 2 Core Objectives
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Once approved, we will construct event listeners for Telegram webhook notifications, 
                initialize Supabase client adapters, pull live file structures from GitHub repos, and invoke Gemini for coding plan summaries.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Ready to initiate next step?</span>
              <button 
                id="approve-btn"
                onClick={() => alert("Phase 1 Approved! Please let the agent know in your chat so they can begin building Phase 2.")}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition shadow-md shadow-indigo-500/15"
              >
                Approve Phase 1
              </button>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}
