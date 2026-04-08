import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAnalyzeRepo } from "@workspace/api-client-react";
import { ArrowLeft, Folder, File, Code, Package, Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRateStatus, RateLimitScreen } from "@/components/rate-limit-guard";

export default function RepoAnalysis() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const owner = params.get("owner");
  const repo = params.get("repo");

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

  const renderFolderTree = (nodes: any[], depth = 0) => {
    return (
      <div className="space-y-1" style={{ paddingLeft: `${depth * 16}px` }}>
        {nodes.map((node, i) => (
          <div key={i} className="flex flex-col">
            <div className="flex items-center gap-2 py-1 px-2 hover:bg-white/5 rounded-md cursor-pointer text-sm text-gray-300">
              {node.type === "dir" ? (
                <Folder className="w-4 h-4 text-blue-400" />
              ) : (
                <File className="w-4 h-4 text-gray-400" />
              )}
              <span className="font-mono">{node.name}</span>
            </div>
            {node.children && node.children.length > 0 && renderFolderTree(node.children, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  const totalFiles = (data.frontendFiles || 0) + (data.backendFiles || 0) + (data.unknownFiles || 0) || 1;
  const frontPct = Math.round(((data.frontendFiles || 0) / totalFiles) * 100);
  const backPct = Math.round(((data.backendFiles || 0) / totalFiles) * 100);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/choose?owner=${owner}&repo=${repo}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{data.repo}</h1>
            <p className="text-xs text-muted-foreground">{data.owner}/{data.repo}</p>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

        {/* Main Idea Card */}
        <Card className="bg-card border-border">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Main Idea</p>
                <p className="text-foreground">{data.mainIdea}</p>
              </div>
              <div className="flex gap-4 shrink-0">
                {data.language && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Language</p>
                    <p className="font-mono text-sm text-primary">{data.language}</p>
                  </div>
                )}
                {data.stars !== undefined && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Stars</p>
                    <p className="font-bold text-yellow-400">{data.stars.toLocaleString()}</p>
                  </div>
                )}
                {data.forks !== undefined && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Forks</p>
                    <p className="font-bold text-blue-400">{data.forks.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 bg-card border-border row-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-primary" />
                Folder Hierarchy
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[800px] overflow-y-auto custom-scrollbar">
              {data.folderHierarchy ? renderFolderTree(data.folderHierarchy) : <p className="text-muted-foreground text-sm">No hierarchy available.</p>}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-secondary" />
                Major Modules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.modules?.map((mod, i) => (
                  <div key={i} className="p-4 rounded-lg bg-background border border-border flex items-start justify-between">
                    <div>
                      <div className="font-mono font-medium mb-1">{mod.name}</div>
                      <div className="text-sm text-muted-foreground">{mod.purpose}</div>
                    </div>
                    {mod.fileCount && <Badge variant="secondary">{mod.fileCount} files</Badge>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 bg-card border-border">
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
                </div>
                <div className="p-4 rounded-lg bg-background border border-border">
                  <div className="text-purple-500 text-sm font-medium mb-1">Backend</div>
                  <div className="text-2xl font-bold">{data.backendFiles || 0} files</div>
                </div>
                <div className="p-4 rounded-lg bg-background border border-border">
                  <div className="text-gray-500 text-sm font-medium mb-1">Unknown</div>
                  <div className="text-2xl font-bold">{data.unknownFiles || 0} files</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dependencies */}
        {data.dependencies && data.dependencies.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-400" />
                Dependencies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.dependencies.map((dep, i) => {
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Entry Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.entryPoints?.map((ep, i) => (
                  <div key={i} className="flex flex-col border-b border-border/50 pb-3 last:border-0 last:pb-0">
                    <span className="font-mono text-sm text-blue-400 mb-1">{ep.file}</span>
                    <span className="text-sm text-muted-foreground">{ep.purpose}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-orange-400" />
                High Churn Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.highChurnFiles?.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-background rounded border border-border">
                    <span className="font-mono text-sm truncate mr-4">{file.file}</span>
                    <Badge variant="destructive" className="shrink-0">{file.changes} changes</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
