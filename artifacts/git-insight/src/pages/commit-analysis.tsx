import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAnalyzeCommits } from "@workspace/api-client-react";
import { useRateStatus, RateLimitScreen } from "@/components/rate-limit-guard";
import {
  ArrowLeft,
  Compass,
  Clock,
  Waves,
  Users,
  AlertTriangle,
  Activity,
  GitCommit,
  Loader2,
  Zap,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const activityColors: Record<string, string> = {
  Feature: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Fix: "bg-red-500/20 text-red-400 border-red-500/30",
  Refactor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Setup: "bg-green-500/20 text-green-400 border-green-500/30",
  Test: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Chore: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  Performance: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Docs: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Style: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

const waveIcons: Record<string, string> = {
  Feature: "🔥",
  Fix: "🛠",
  Refactor: "🏗",
  Setup: "🚀",
  Test: "✅",
  Chore: "⚙️",
  Performance: "⚡️",
  Docs: "📝",
};

export default function CommitAnalysis() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const owner = params.get("owner");
  const repo = params.get("repo");

  const { isLimited, checking: checkingRate, status: rateStatus, recheck } = useRateStatus();
  const { mutate: analyze, data, isPending, error } = useAnalyzeCommits();

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
            <GitCommit className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Analyzing Commit History...</h2>
          <p className="text-muted-foreground max-w-sm">
            Scanning commits, grouping patterns, identifying phases and contributors.
          </p>
        </div>
        <div className="flex gap-2 mt-4">
          {["Fetching commits", "Grouping phases", "Analyzing patterns", "Building insights"].map((step, i) => (
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
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold">Analysis Failed</h2>
        <p className="text-muted-foreground text-center max-w-sm">
          {isRateLimit
            ? "GitHub API rate limit reached. Add a GITHUB_TOKEN secret in your Replit Secrets for higher limits, or wait a minute and try again."
            : "Unable to analyze this repository. It may be private, have no commits, or GitHub may be temporarily unavailable."}
        </p>
        <Button onClick={() => setLocation(`/choose?owner=${owner}&repo=${repo}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation(`/choose?owner=${owner}&repo=${repo}`)}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Commit Analysis</h1>
              <p className="text-xs text-muted-foreground">
                {data.owner}/{data.repo}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="border-primary/50 text-primary"
              data-testid="badge-total-commits"
            >
              {data.totalCommits} commits
            </Badge>
            {data.startDate && data.endDate && (
              <Badge variant="outline" className="border-border text-muted-foreground text-xs">
                {formatDate(data.startDate)} — {formatDate(data.endDate)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-8">
        {/* Executive Summary */}
        <Card className="bg-card border-border" data-testid="card-executive-summary">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Compass className="w-4 h-4 text-primary" />
              </div>
              Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">{data.executiveSummary}</p>
          </CardContent>
        </Card>

        {/* Phase Timeline */}
        {data.phases && data.phases.length > 0 && (
          <div data-testid="section-phase-timeline">
            <h2 className="flex items-center gap-3 text-xl font-bold mb-6">
              <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center">
                <Clock className="w-4 h-4 text-secondary" />
              </div>
              Phase Timeline
            </h2>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-primary via-secondary to-transparent" />
              <div className="space-y-4 pl-12">
                {data.phases.map((phase, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-12 top-5 w-3 h-3 rounded-full bg-primary shadow-[0_0_8px] shadow-primary/50" />
                    <Card
                      className="bg-card border-border hover:border-primary/30 transition-colors"
                      data-testid={`card-phase-${i + 1}`}
                    >
                      <CardContent className="pt-5">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <h3 className="font-bold text-base">{phase.name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {phase.startDate} — {phase.endDate}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="shrink-0 border-border text-muted-foreground"
                          >
                            {phase.commitCount} commits
                          </Badge>
                        </div>
                        <Badge
                          className={`mb-3 border text-xs ${
                            activityColors[phase.dominantActivity] ?? "bg-gray-500/20 text-gray-400"
                          }`}
                        >
                          {phase.dominantActivity}
                        </Badge>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {phase.description}
                        </p>
                        {phase.keyChanges && phase.keyChanges.length > 0 && (
                          <div className="mt-3 space-y-1">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
                              Key changes
                            </p>
                            {phase.keyChanges.slice(0, 3).map((change, j) => (
                              <div
                                key={j}
                                className="text-xs text-muted-foreground font-mono bg-background/50 rounded px-2 py-1 truncate"
                              >
                                {change}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Development Waves */}
        {data.developmentWaves && data.developmentWaves.length > 0 && (
          <div data-testid="section-development-waves">
            <h2 className="flex items-center gap-3 text-xl font-bold mb-6">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Waves className="w-4 h-4 text-cyan-400" />
              </div>
              Development Waves
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.developmentWaves.map((wave, i) => (
                <Card
                  key={i}
                  className="bg-card border-border hover:border-primary/20 transition-colors"
                  data-testid={`card-wave-${i}`}
                >
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{waveIcons[wave.type] ?? "🌊"}</span>
                      <Badge
                        className={`border text-xs ${
                          activityColors[wave.type] ?? "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {wave.type}
                      </Badge>
                    </div>
                    <h3 className="font-semibold mb-1">{wave.title}</h3>
                    <p className="text-sm text-muted-foreground">{wave.description}</p>
                    {wave.commitCount && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {wave.commitCount} commits
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Feature Clusters */}
        {data.featureClusters && data.featureClusters.length > 0 && (
          <div data-testid="section-feature-clusters">
            <h2 className="flex items-center gap-3 text-xl font-bold mb-6">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-purple-400" />
              </div>
              Feature Clusters
            </h2>
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-3">
                  {data.featureClusters.map((cluster, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border hover:border-primary/40 transition-colors"
                      data-testid={`badge-cluster-${i}`}
                    >
                      <span className="text-sm font-medium">{cluster.name}</span>
                      <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {cluster.commitCount}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Contributor Roles */}
        {data.contributorRoles && data.contributorRoles.length > 0 && (
          <div data-testid="section-contributors">
            <h2 className="flex items-center gap-3 text-xl font-bold mb-6">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-green-400" />
              </div>
              Contributor Roles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.contributorRoles.map((contributor, i) => (
                <Card
                  key={i}
                  className="bg-card border-border"
                  data-testid={`card-contributor-${i}`}
                >
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 flex items-center justify-center font-bold text-sm">
                        {contributor.author.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{contributor.author}</p>
                        <p className="text-xs text-primary">{contributor.role}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{contributor.focus}</p>
                    <Badge variant="outline" className="text-xs border-border">
                      {contributor.commitCount} commits
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Architectural Events */}
          {data.architecturalEvents && data.architecturalEvents.length > 0 && (
            <div data-testid="section-architectural-events">
              <h2 className="flex items-center gap-3 text-lg font-bold mb-4">
                <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-orange-400" />
                </div>
                Architectural Events
              </h2>
              <div className="space-y-3">
                {data.architecturalEvents.map((event, i) => (
                  <Card key={i} className="bg-card border-orange-500/20">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded font-mono">
                          {event.commitSha}
                        </code>
                        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs border">
                          {event.impact} Impact
                        </Badge>
                      </div>
                      <p className="text-sm font-medium mb-1">{event.event}</p>
                      <p className="text-xs text-muted-foreground">{event.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* High Risk Commits */}
          {data.riskCommits && data.riskCommits.length > 0 && (
            <div data-testid="section-risk-commits">
              <h2 className="flex items-center gap-3 text-lg font-bold mb-4">
                <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-red-400" />
                </div>
                High Risk Commits
              </h2>
              <div className="space-y-3">
                {data.riskCommits.map((commit, i) => (
                  <Card key={i} className="bg-card border-red-500/20">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded font-mono">
                          {commit.commitSha}
                        </code>
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs border">
                          {commit.riskLevel}
                        </Badge>
                      </div>
                      <p className="text-sm font-mono mb-2 truncate text-foreground/80">
                        {commit.message}
                      </p>
                      <p className="text-xs text-muted-foreground">{commit.reason}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* High Churn Files */}
        {data.highChurnFiles && data.highChurnFiles.length > 0 && (
          <div data-testid="section-churn-files">
            <h2 className="flex items-center gap-3 text-xl font-bold mb-6">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
                <Activity className="w-4 h-4 text-rose-400" />
              </div>
              High Churn Files
            </h2>
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {data.highChurnFiles.map((file, i) => {
                    const maxChanges = data.highChurnFiles?.[0]?.changes ?? 1;
                    const pct = Math.round((file.changes / maxChanges) * 100);
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm truncate mr-4 flex-1">{file.file}</span>
                          <Badge variant="outline" className="shrink-0 text-xs border-rose-500/30 text-rose-400">
                            {file.changes} changes
                          </Badge>
                        </div>
                        <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-500 transition-all duration-1000"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
