import { useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useDeveloperIntelligence } from "@workspace/api-client-react";
import { useRateStatus, RateLimitScreen } from "@/components/rate-limit-guard";
import { AiAssistant } from "@/components/ai-assistant";
import {
  ArrowLeft,
  Users,
  GitMerge,
  ExternalLink,
  Plus,
  Minus,
  Clock,
  Layers,
  Flame,
  TrendingUp,
  AlertTriangle,
  GitCommit,
  Star,
  Mail,
  Twitter,
  Globe,
  MapPin,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const activityColors: Record<string, string> = {
  Feature: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Fix: "bg-red-500/20 text-red-400 border-red-500/30",
  Refactor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Setup: "bg-green-500/20 text-green-400 border-green-500/30",
  Test: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Chore: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  Performance: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Docs: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const waveIcons: Record<string, string> = {
  Feature: "🔥", Fix: "🛠", Refactor: "🏗", Setup: "🚀",
  Test: "✅", Chore: "⚙️", Performance: "⚡️", Docs: "📝",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function DeveloperIntelligence() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const owner = params.get("owner");
  const repo = params.get("repo");
  const highlightAuthor = params.get("author"); // deep-link from commit analysis

  const { mutate, data, isPending, error } = useDeveloperIntelligence();
  const { rateStatus } = useRateStatus();
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (owner && repo) {
      mutate({ data: { owner, repo } });
    }
  }, [owner, repo]);

  // After data loads, scroll to the highlighted contributor
  useEffect(() => {
    if (!data || !highlightAuthor || !highlightRef.current) return;
    const timer = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    return () => clearTimeout(timer);
  }, [data, highlightAuthor]);

  if (!owner || !repo) {
    setLocation("/");
    return null;
  }

  if (rateStatus?.remaining === 0) return <RateLimitScreen reset={rateStatus.reset} />;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground hover:text-white gap-1.5 shrink-0"
            onClick={() => setLocation(`/choose?owner=${owner}&repo=${repo}`)}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-violet-500/20 flex items-center justify-center shrink-0">
                <Users className="w-3 h-3 text-violet-400" />
              </div>
              <span className="font-bold text-sm truncate">Developer Intelligence</span>
              <span className="text-muted-foreground text-xs truncate hidden sm:block">
                — {owner}/{repo}
              </span>
            </div>
          </div>
          {data && (
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="border-violet-500/50 text-violet-400 text-xs hidden sm:flex">
                {data.contributors} contributors
              </Badge>
              <Badge variant="outline" className="border-border text-muted-foreground text-xs">
                {data.analyzedCommits < data.totalCommits
                  ? `${data.analyzedCommits.toLocaleString()} of ${data.totalCommits.toLocaleString()} commits`
                  : `${data.totalCommits.toLocaleString()} commits`}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isPending && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-2 border-violet-500/30 animate-spin border-t-violet-500" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Users className="w-8 h-8 text-violet-400" />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Profiling Developers…</h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              Analysing commit patterns, detecting roles, and mapping module ownership.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap justify-center">
            {["Fetching commits", "Reading diffs", "Detecting roles", "Mapping modules", "Building profiles"].map((step, i) => (
              <span key={i} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-border">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                {step}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isPending && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold">Analysis Failed</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            {error instanceof Error ? error.message : "Something went wrong"}
          </p>
          <Button onClick={() => mutate({ data: { owner, repo } })}>Retry</Button>
        </div>
      )}

      {/* Main Content */}
      {data && !isPending && (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">

          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Contributors", value: data.contributors, icon: Users, color: "violet" },
              { label: "Commits Analyzed", value: data.analyzedCommits.toLocaleString(), icon: GitCommit, color: "blue" },
              {
                label: "Active Period",
                value: data.startDate && data.endDate
                  ? `${formatDate(data.startDate)} – ${formatDate(data.endDate)}`
                  : "—",
                icon: Clock,
                color: "green",
              },
              {
                label: "Top Contributor",
                value: data.contributorIntelligence[0]?.author ?? "—",
                icon: Star,
                color: "yellow",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="bg-card border-border">
                <CardContent className="pt-4 pb-4">
                  <div className={`w-7 h-7 rounded-lg bg-${color}-500/20 flex items-center justify-center mb-2`}>
                    <Icon className={`w-3.5 h-3.5 text-${color}-400`} />
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="font-bold text-sm truncate">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Developer Cards */}
          {data.contributorIntelligence.length > 0 && (
            <div>
              <h2 className="flex items-center gap-3 text-xl font-bold mb-5">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-violet-400" />
                </div>
                Developer Profiles
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.contributorIntelligence.map((dev, i) => {
                  const ghLogin = dev.profileUrl?.split("/").pop() ?? "";
                  const isHighlighted = highlightAuthor
                    ? dev.author.toLowerCase().includes(highlightAuthor.toLowerCase()) ||
                      ghLogin.toLowerCase() === highlightAuthor.toLowerCase() ||
                      highlightAuthor.toLowerCase().includes(ghLogin.toLowerCase())
                    : false;
                  return (
                  <Card
                    key={i}
                    ref={isHighlighted ? (el) => { highlightRef.current = el; } : undefined}
                    className={`bg-card border-border transition-colors ${isHighlighted ? "ring-2 ring-violet-500 border-violet-500 shadow-[0_0_24px_rgba(139,92,246,0.35)]" : "hover:border-violet-500/30"}`}
                    data-testid={`card-dev-${i}`}
                  >
                    <CardContent className="pt-5 pb-5">
                      {/* Header */}
                      <div className="flex items-start gap-3 mb-4">
                        {dev.avatarUrl ? (
                          <img
                            src={dev.avatarUrl}
                            alt={dev.author}
                            className="w-12 h-12 rounded-full ring-2 ring-border shrink-0"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-violet-500/40 to-primary/40 flex items-center justify-center font-bold text-base">
                            {dev.author.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <a
                            href={dev.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 group w-fit mb-0.5"
                          >
                            <span className="font-bold text-sm group-hover:text-violet-400 transition-colors truncate">{dev.author}</span>
                            <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-100 shrink-0 transition-opacity" />
                          </a>
                          <p className="text-xs text-violet-400 font-medium">{dev.roleEmoji} {dev.role}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDate(dev.firstCommit)} → {formatDate(dev.lastCommit)}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-border shrink-0">
                          {dev.commitCount}
                        </Badge>
                      </div>

                      {/* Bio */}
                      {dev.bio && (
                        <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed line-clamp-2">{dev.bio}</p>
                      )}

                      {/* Contact & meta row */}
                      {(dev.email || dev.twitter || dev.website || dev.company || dev.location) && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {dev.email && (
                            <a
                              href={`mailto:${dev.email}`}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors bg-background border border-border rounded px-2 py-0.5"
                              title={dev.email}
                            >
                              <Mail className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate max-w-[120px]">{dev.email}</span>
                            </a>
                          )}
                          {dev.twitter && (
                            <a
                              href={`https://twitter.com/${dev.twitter}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-sky-400 transition-colors bg-background border border-border rounded px-2 py-0.5"
                            >
                              <Twitter className="w-2.5 h-2.5 shrink-0" />@{dev.twitter}
                            </a>
                          )}
                          {dev.website && (
                            <a
                              href={dev.website.startsWith("http") ? dev.website : `https://${dev.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors bg-background border border-border rounded px-2 py-0.5"
                            >
                              <Globe className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate max-w-[100px]">{dev.website.replace(/^https?:\/\//, "")}</span>
                            </a>
                          )}
                          {dev.company && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-background border border-border rounded px-2 py-0.5">
                              <Building2 className="w-2.5 h-2.5 shrink-0" />{dev.company}
                            </span>
                          )}
                          {dev.location && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-background border border-border rounded px-2 py-0.5">
                              <MapPin className="w-2.5 h-2.5 shrink-0" />{dev.location}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Contribution bar */}
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Contribution
                          </span>
                          <span className="text-[11px] font-semibold text-violet-400">{dev.commitPercentage}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
                            style={{ width: `${Math.min(dev.commitPercentage, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Commit type breakdown */}
                      {dev.typeBreakdown.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {dev.typeBreakdown.map((tb, j) => (
                            <span
                              key={j}
                              className={`text-[10px] px-2 py-0.5 rounded-full border ${activityColors[tb.type] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}
                            >
                              {waveIcons[tb.type] ?? "•"} {tb.type} {tb.count}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Module focus */}
                      {dev.modules.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Layers className="w-3 h-3" /> Focus Areas
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {dev.modules.map((m, j) => (
                              <span
                                key={j}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Activity timeline */}
                      {dev.activeMonths.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Activity — {dev.activeMonths.length} month{dev.activeMonths.length !== 1 ? "s" : ""} active
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {dev.activeMonths.slice(-24).map((m, j) => (
                              <div
                                key={j}
                                className="w-3 h-3 rounded-sm bg-violet-500/60 hover:bg-violet-400 transition-colors cursor-default"
                                title={m}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Lines added/removed */}
                      {(dev.linesAdded !== undefined || dev.linesRemoved !== undefined) && (
                        <div className="flex items-center gap-4 mb-4">
                          {dev.linesAdded !== undefined && (
                            <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                              <Plus className="w-3 h-3" />{dev.linesAdded.toLocaleString()} added
                            </span>
                          )}
                          {dev.linesRemoved !== undefined && (
                            <span className="text-[11px] text-red-400 flex items-center gap-1 font-mono">
                              <Minus className="w-3 h-3" />{dev.linesRemoved.toLocaleString()} removed
                            </span>
                          )}
                        </div>
                      )}

                      {/* High-impact files */}
                      {dev.highImpactFiles.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Flame className="w-3 h-3 text-rose-400" /> High-Impact Files
                          </p>
                          <div className="space-y-1">
                            {dev.highImpactFiles.map((f, j) => (
                              <div key={j} className="text-[10px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-0.5 truncate">
                                {f}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Collaborators */}
                      {dev.collaborators.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5">
                            Also worked with
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {dev.collaborators.map((c, j) => (
                              <a
                                key={j}
                                href={`https://github.com/${c}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] px-2 py-0.5 rounded-full bg-background border border-border hover:border-violet-500/50 text-muted-foreground hover:text-violet-400 transition-colors"
                              >
                                @{c}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Collaboration Insights */}
          {data.collaborationInsights.length > 0 && (
            <div>
              <h2 className="flex items-center gap-3 text-xl font-bold mb-5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <GitMerge className="w-4 h-4 text-blue-400" />
                </div>
                Collaboration Insights
                <span className="text-sm font-normal text-muted-foreground">— potential conflict areas</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.collaborationInsights.map((insight, i) => (
                  <Card key={i} className="bg-card border-border hover:border-blue-500/30 transition-colors">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
                          <Users className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <div className="flex items-center gap-1 text-xs font-medium min-w-0 flex-1">
                          <a
                            href={`https://github.com/${insight.authors[0]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-400 transition-colors truncate"
                          >
                            {insight.authors[0]}
                          </a>
                          <span className="text-muted-foreground shrink-0">+</span>
                          <a
                            href={`https://github.com/${insight.authors[1]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-400 transition-colors truncate"
                          >
                            {insight.authors[1]}
                          </a>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-2">
                        Co-edited <span className="text-blue-400 font-semibold">{insight.fileCount}</span> file{insight.fileCount !== 1 ? "s" : ""}
                      </p>
                      <div className="space-y-1">
                        {insight.sharedFiles.map((f, j) => (
                          <div key={j} className="text-[10px] font-mono bg-background border border-border rounded px-2 py-0.5 truncate text-muted-foreground">
                            {f}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* High Churn Files */}
          {data.highChurnFiles && data.highChurnFiles.length > 0 && (
            <div>
              <h2 className="flex items-center gap-3 text-xl font-bold mb-5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-rose-400" />
                </div>
                Most-Changed Files
              </h2>
              <Card className="bg-card border-border">
                <CardContent className="pt-5">
                  <div className="space-y-3">
                    {data.highChurnFiles.map((file, i) => {
                      const maxChanges = data.highChurnFiles?.[0]?.changes ?? 1;
                      const pct = Math.round((file.changes / maxChanges) * 100);
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs truncate mr-4 flex-1">{file.file}</span>
                            <Badge variant="outline" className="shrink-0 text-[10px] border-rose-500/30 text-rose-400">
                              {file.changes} edits
                            </Badge>
                          </div>
                          <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-500"
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
      )}

      {owner && repo && <AiAssistant owner={owner} repo={repo} />}
    </div>
  );
}
