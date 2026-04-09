import { useEffect, useState, type ElementType } from "react";
import { useLocation, useSearch } from "wouter";
import { useAnalyzeRepo } from "@workspace/api-client-react";
import {
  ArrowLeft, Folder, File, Code, Package, Activity, Loader2,
  Sparkles, ExternalLink, GitBranch, Layers, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRateStatus, RateLimitScreen } from "@/components/rate-limit-guard";
import { AiAssistant } from "@/components/ai-assistant";
import { NarrativeGenerator } from "@/components/narrative-generator";

export default function RepoAnalysis() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const owner = params.get("owner");
  const repo = params.get("repo");

  const [activeSection, setActiveSection] = useState<string | null>(null);

  const { isLimited, checking: checkingRate, status: rateStatus, recheck } = useRateStatus();
  const { mutate: analyze, data, isPending, error } = useAnalyzeRepo();

  useEffect(() => {
    if (checkingRate || isLimited) return;
    if (owner && repo) {
      analyze({ data: { owner, repo } });
    } else {
      setLocation("/");
    }
  }, [owner, repo, analyze, setLocation, checkingRate, isLimited]);

  if (checkingRate) return null;

  if (isLimited) {
    return (
      <RateLimitScreen
        resetAt={rateStatus?.resetAt ?? null}
        onBack={() => setLocation(`/choose?owner=${owner}&repo=${repo}`)}
        onRetry={recheck}
      />
    );
  }

  if (isPending) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-2 border-primary/30 flex items-center justify-center">
            <Folder className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Analyzing Repository...</h2>
          <p className="text-muted-foreground max-w-sm">
            Scanning files, detecting structure, and mapping dependencies.
          </p>
        </div>
        <div className="flex gap-2 mt-2">
          {["Reading files", "Detecting stack", "Mapping modules", "Building report"].map((step, i) => (
            <div
              key={i}
              className="text-xs px-3 py-1 rounded-full bg-card border border-border text-muted-foreground animate-pulse"
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    const msg = error instanceof Error ? error.message : "";
    const isRateLimit = msg.includes("403") || msg.toLowerCase().includes("rate limit");
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <Activity className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold">Analysis Failed</h2>
        <p className="text-muted-foreground text-center max-w-sm">
          {isRateLimit
            ? "GitHub API rate limit reached. Add a GITHUB_TOKEN secret in your Replit Secrets for higher limits, or wait a minute and try again."
            : "Could not analyse this repository. It may be private, empty, or GitHub may be temporarily unavailable."}
        </p>
        <Button onClick={() => setLocation(`/choose?owner=${owner}&repo=${repo}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const renderFolderTree = (nodes: any[], depth = 0) => (
    <div className="space-y-1" style={{ paddingLeft: `${depth * 16}px` }}>
      {nodes.map((node, i) => (
        <div key={i} className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 py-1 px-2 hover:bg-white/5 rounded-md cursor-pointer text-sm text-gray-300 min-w-0">
            <span className="shrink-0">
              {node.type === "dir"
                ? <Folder className="w-4 h-4 text-blue-400" />
                : <File className="w-4 h-4 text-gray-400" />}
            </span>
            <span className="font-mono truncate" title={node.name}>{node.name}</span>
          </div>
          {node.children && node.children.length > 0 && renderFolderTree(node.children, depth + 1)}
        </div>
      ))}
    </div>
  );

  const totalFiles = (data.frontendFiles || 0) + (data.backendFiles || 0) + (data.unknownFiles || 0) || 1;
  const frontPct = Math.round(((data.frontendFiles || 0) / totalFiles) * 100);
  const backPct = Math.round(((data.backendFiles || 0) / totalFiles) * 100);

  const catColors: Record<string, string> = {
    framework: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    library: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    testing: "bg-green-500/20 text-green-300 border-green-500/30",
    styling: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    build: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    database: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    payment: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    cloud: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    http: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    state: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  };

  const sections = (
    [
      { id: "hierarchy", label: "Folder Hierarchy", icon: Folder, count: data.folderHierarchy?.length ?? 0, color: "blue" },
      { id: "modules", label: "Major Modules", icon: Package, count: data.modules?.length ?? 0, color: "secondary" },
      { id: "separation", label: "Frontend / Backend", icon: Code, count: null, color: "cyan" },
      { id: "deps", label: "Dependencies", icon: Layers, count: data.dependencies?.length ?? 0, color: "purple" },
      { id: "entrypoints", label: "Entry Points", icon: GitBranch, count: data.entryPoints?.length ?? 0, color: "primary" },
      { id: "narrative", label: "AI Narrative", icon: Sparkles, count: null, color: "violet" },
    ] as Array<{ id: string; label: string; icon: ElementType; count: number | null; color: string }>
  );

  return (
    <div className="min-h-[100dvh] bg-background text-foreground overflow-x-hidden">
      {/* Sticky header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border px-6 py-4 flex items-center justify-between min-w-0">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setLocation(`/choose?owner=${owner}&repo=${repo}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold truncate">{data.repo}</h1>
              <a
                href={`https://github.com/${data.owner}/${data.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title="View on GitHub"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground truncate">{data.owner}/{data.repo}</p>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

        {/* Executive summary */}
        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Language", value: data.language ?? "—", color: "text-primary" },
                { label: "Stars", value: data.stars !== undefined ? data.stars.toLocaleString() : "—", color: "text-yellow-400" },
                { label: "Forks", value: data.forks !== undefined ? data.forks.toLocaleString() : "—", color: "text-blue-400" },
                { label: "Total Files", value: totalFiles.toLocaleString(), color: "text-violet-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-background/50 rounded-xl border border-border p-4 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                  <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Repository Summary — always visible */}
        {data.aiSummary && (
          <div className="relative rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/5 via-card to-card p-5">
            <div className="absolute top-4 right-4 opacity-10">
              <Sparkles className="w-20 h-20 text-violet-400" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">AI Repository Summary</span>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{data.aiSummary}</p>
          </div>
        )}

        {/* Section toggle bar */}
        <div className="flex flex-wrap gap-2">
          {sections.map(({ id, label, icon: Icon, count, color }) => {
            const isActive = activeSection === id;
            const colorMap: Record<string, string> = {
              blue: "border-blue-500/60 text-blue-300 bg-blue-500/10 ring-1 ring-blue-500/25 shadow-md",
              secondary: "border-secondary/60 text-secondary-foreground bg-secondary/10 ring-1 ring-secondary/25 shadow-md",
              cyan: "border-cyan-500/60 text-cyan-300 bg-cyan-500/10 ring-1 ring-cyan-500/25 shadow-md",
              purple: "border-purple-500/60 text-purple-300 bg-purple-500/10 ring-1 ring-purple-500/25 shadow-md",
              primary: "border-primary/60 text-primary bg-primary/10 ring-1 ring-primary/25 shadow-md",
            };
            const activeCls = colorMap[color] ?? "border-primary/60 text-primary bg-primary/10 ring-1 ring-primary/25 shadow-md";
            return (
              <button
                key={id}
                onClick={() => setActiveSection(activeSection === id ? null : id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? activeCls
                    : "border-border text-muted-foreground bg-card hover:border-border/80 hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {count !== null && count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/15" : "bg-muted"}`}>
                    {count}
                  </span>
                )}
                {isActive
                  ? <ChevronUp className="w-3 h-3 ml-0.5 opacity-60" />
                  : <ChevronDown className="w-3 h-3 ml-0.5 opacity-40" />}
              </button>
            );
          })}
        </div>

        {/* ── Folder Hierarchy ──────────────────────────────── */}
        {activeSection === "hierarchy" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-blue-400" />
                Folder Hierarchy
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto overflow-x-hidden custom-scrollbar">
              {data.folderHierarchy
                ? renderFolderTree(data.folderHierarchy)
                : <p className="text-muted-foreground text-sm">No hierarchy available.</p>}
            </CardContent>
          </Card>
        )}

        {/* ── Major Modules ─────────────────────────────────── */}
        {activeSection === "modules" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-secondary" />
                Major Modules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.modules?.map((mod, i) => (
                  <div key={i} className="p-4 rounded-lg bg-background border border-border flex items-start justify-between gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono font-medium mb-1 break-all">{mod.name}</div>
                      <div className="text-sm text-muted-foreground break-words">{mod.purpose}</div>
                    </div>
                    {mod.fileCount && <Badge variant="secondary" className="shrink-0">{mod.fileCount} files</Badge>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Frontend / Backend Separation ─────────────────── */}
        {activeSection === "separation" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5 text-cyan-400" />
                Backend vs Frontend Separation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-4 w-full rounded-full overflow-hidden flex bg-muted mb-6">
                <div style={{ width: `${frontPct}%` }} className="bg-cyan-500" title="Frontend" />
                <div style={{ width: `${backPct}%` }} className="bg-purple-500" title="Backend" />
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-background border border-border">
                  <div className="text-cyan-500 text-sm font-medium mb-1">Frontend</div>
                  <div className="text-2xl font-bold">{data.frontendFiles || 0} files</div>
                  <div className="text-xs text-muted-foreground mt-1">{frontPct}% of total</div>
                </div>
                <div className="p-4 rounded-lg bg-background border border-border">
                  <div className="text-purple-500 text-sm font-medium mb-1">Backend</div>
                  <div className="text-2xl font-bold">{data.backendFiles || 0} files</div>
                  <div className="text-xs text-muted-foreground mt-1">{backPct}% of total</div>
                </div>
                <div className="p-4 rounded-lg bg-background border border-border">
                  <div className="text-gray-500 text-sm font-medium mb-1">Unknown</div>
                  <div className="text-2xl font-bold">{data.unknownFiles || 0} files</div>
                  <div className="text-xs text-muted-foreground mt-1">{100 - frontPct - backPct}% of total</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Dependencies ──────────────────────────────────── */}
        {activeSection === "deps" && data.dependencies && data.dependencies.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                Dependencies
                <Badge variant="secondary" className="ml-auto text-xs">{data.dependencies.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.dependencies.map((dep, i) => {
                  const colorClass = catColors[dep.category] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";
                  return (
                    <span
                      key={i}
                      className={`text-xs px-2.5 py-1 rounded-full border font-mono ${colorClass}`}
                      title={`${dep.name} ${dep.version} (${dep.category})`}
                    >
                      {dep.name} <span className="opacity-60">{dep.version}</span>
                    </span>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Entry Points ──────────────────────────────────── */}
        {activeSection === "entrypoints" && data.entryPoints && data.entryPoints.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-primary" />
                Entry Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.entryPoints.map((ep, i) => (
                  <div key={i} className="flex flex-col rounded-lg bg-background border border-border/50 p-3 min-w-0">
                    <span className="font-mono text-sm text-blue-400 mb-1 break-all">{ep.file}</span>
                    <span className="text-sm text-muted-foreground break-words">{ep.purpose}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── AI Narrative Generator ─────────────────────────── */}
        {activeSection === "narrative" && owner && repo && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <h2 className="text-lg font-bold">AI Narrative Generator</h2>
              <span className="text-xs text-muted-foreground ml-1">Converts repo data into human-readable content</span>
            </div>
            <NarrativeGenerator
              owner={owner}
              repo={repo}
              context={{
                type: "repo",
                summary: data.aiSummary,
                modules: data.modules?.map(m => `${m.name}: ${m.purpose}`),
                dependencies: data.dependencies?.map(d => d.name),
                language: data.language ?? undefined,
                stars: data.stars,
              }}
            />
          </div>
        )}

      </div>
      {owner && repo && <AiAssistant owner={owner} repo={repo} />}
    </div>
  );
}
