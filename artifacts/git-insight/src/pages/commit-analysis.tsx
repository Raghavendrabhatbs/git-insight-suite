import { useEffect, useState, useRef, type ElementType } from "react";
import { useLocation, useSearch } from "wouter";
import { useAnalyzeCommits, useExplainCommit } from "@workspace/api-client-react";
import { useRateStatus, RateLimitScreen } from "@/components/rate-limit-guard";
import { AiAssistant } from "@/components/ai-assistant";
import {
  ArrowLeft,
  Compass,
  Clock,
  Waves,
  Users,
  AlertTriangle,
  Activity,
  GitCommit,
  Zap,
  Shield,
  BookOpen,
  Plus,
  Minus,
  FileCode,
  Search,
  Sparkles,
  ChevronRight,
  Hash,
  ExternalLink,
  User,
  Calendar,
  TrendingUp,
  Layers,
  GitMerge,
  Flame,
  X,
  Loader2,
  Mail,
  Globe,
  MapPin,
  Building2,
  Twitter,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

function CommitExplainerPanel({
  owner,
  repo,
  prefilledSha,
  onAuthorClick,
}: {
  owner: string;
  repo: string;
  prefilledSha?: string;
  onAuthorClick?: (author: string) => void;
}) {
  const [input, setInput] = useState(prefilledSha ?? "");
  const [submitted, setSubmitted] = useState(false);
  const { mutate: explain, data, isPending, error, reset } = useExplainCommit();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prefilledSha && prefilledSha !== input) {
      setInput(prefilledSha);
      setSubmitted(false);
      reset?.();
    }
  }, [prefilledSha]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    setSubmitted(true);
    explain({ data: { owner, repo, sha: input.trim() } });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  const typeColor: Record<string, string> = {
    Feature: "text-blue-400",
    Fix: "text-red-400",
    Refactor: "text-orange-400",
    Setup: "text-green-400",
    Docs: "text-purple-400",
    Chore: "text-gray-400",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <h3 className="font-semibold text-sm">Commit Explainer</h3>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Enter a commit SHA (e.g. <code className="text-violet-400">abc1234</code>) or a position number where 1 = most recent commit.
        </p>
      </div>

      {/* Input area */}
      <div className="shrink-0 px-4 pt-3 pb-4 border-b border-border space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="SHA (abc1234) or position (1, 2, 3…)"
              className="pl-8 h-8 text-xs font-mono bg-background border-border"
            />
          </div>
          <Button
            size="sm"
            className="h-8 px-3 text-xs shrink-0"
            onClick={handleSubmit}
            disabled={isPending || !input.trim()}
          >
            {isPending ? (
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 animate-pulse" />
                <span>Analyzing…</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Search className="w-3 h-3" />
                <span>Explain</span>
              </div>
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/60">
          Click any commit story on the left to auto-fill
        </p>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {!submitted && (
          <div className="text-center py-12 text-muted-foreground/50">
            <GitCommit className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-xs">Enter a commit SHA or number above</p>
          </div>
        )}

        {isPending && (
          <div className="text-center py-12">
            <div className="relative w-10 h-10 mx-auto mb-4">
              <div className="w-10 h-10 rounded-full border-2 border-violet-500/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-xs text-muted-foreground">Reading code diff…</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">AI is analyzing the changes</p>
          </div>
        )}

        {error && !isPending && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-xs text-destructive font-medium mb-1">Failed to explain commit</p>
            <p className="text-[11px] text-muted-foreground">
              {error instanceof Error ? error.message : "Check the SHA or commit number and try again."}
            </p>
          </div>
        )}

        {data && !isPending && (
          <div className="space-y-4">
            {/* Commit meta */}
            <div className="rounded-lg bg-background/60 border border-border p-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-violet-400">
                  {data.shortSha}
                </code>
                {data.commitNumber && (
                  <span className="text-[10px] text-muted-foreground">#{data.commitNumber}</span>
                )}
                <Badge
                  className={`border text-[10px] px-1.5 py-0 ${
                    activityColors[data.type] ?? "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  {data.type}
                </Badge>
              </div>
              <p className="text-xs font-mono text-foreground/70 leading-snug mb-2 line-clamp-2">
                {data.message.split("\n")[0]}
              </p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                {onAuthorClick ? (
                  <button
                    className="flex items-center gap-0.5 hover:text-violet-400 transition-colors cursor-pointer"
                    title="View developer profile"
                    onClick={() => onAuthorClick(data.author)}
                  >
                    <User className="w-2.5 h-2.5" />{data.author}
                  </button>
                ) : (
                  <span>{data.author}</span>
                )}
                <span>{new Date(data.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>
                <span className="flex items-center gap-1">
                  <Plus className="w-2.5 h-2.5 text-green-400" />
                  <span className="text-green-400">{data.totalAdditions}</span>
                  <Minus className="w-2.5 h-2.5 text-red-400 ml-1" />
                  <span className="text-red-400">{data.totalDeletions}</span>
                </span>
              </div>
            </div>

            {/* AI Summary */}
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
              <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Summary
              </p>
              <p className="text-xs text-foreground leading-relaxed">{data.humanSummary}</p>
            </div>

            {/* What Changed */}
            {data.whatChanged && (
              <div className="rounded-lg border border-border bg-background/40 p-3">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                  What Changed
                </p>
                <div className="space-y-1">
                  {data.whatChanged
                    .split(/\n•\s*|\n-\s*/)
                    .filter(Boolean)
                    .map((bullet, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <ChevronRight className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                        <span className="leading-snug">{bullet.trim()}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Why It Matters */}
            {data.whyItMatters && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-[10px] text-primary font-semibold uppercase tracking-wider mb-2">
                  Why It Matters
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{data.whyItMatters}</p>
              </div>
            )}

            {/* File Diffs */}
            {data.fileDiffs && data.fileDiffs.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileCode className="w-3 h-3" /> Files Changed ({data.fileDiffs.length})
                </p>
                <div className="space-y-2">
                  {data.fileDiffs.map((f, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-border bg-background/40 p-2.5"
                    >
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="font-mono text-[10px] text-foreground/80 truncate max-w-[160px]">
                          {f.filename.split("/").pop()}
                        </span>
                        <span
                          className={`text-[9px] px-1 rounded ${
                            f.status === "added"
                              ? "bg-green-500/20 text-green-400"
                              : f.status === "removed"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-orange-500/20 text-orange-400"
                          }`}
                        >
                          {f.status}
                        </span>
                        <span className="text-[10px] text-green-400 ml-auto">+{f.additions}</span>
                        <span className="text-[10px] text-red-400">-{f.deletions}</span>
                      </div>
                      {f.explanation && (
                        <p className="text-[11px] text-muted-foreground leading-snug">{f.explanation}</p>
                      )}
                      {/* Inline diff preview (first few lines) */}
                      {f.patch && (
                        <div className="mt-2 rounded bg-black/40 border border-border/40 overflow-hidden">
                          {f.patch
                            .split("\n")
                            .slice(0, 12)
                            .map((line, j) => (
                              <div
                                key={j}
                                className={`text-[9px] font-mono px-2 py-0 leading-5 ${
                                  line.startsWith("+") && !line.startsWith("+++")
                                    ? "bg-green-500/10 text-green-400"
                                    : line.startsWith("-") && !line.startsWith("---")
                                    ? "bg-red-500/10 text-red-400"
                                    : line.startsWith("@@")
                                    ? "text-cyan-400/70"
                                    : "text-muted-foreground/60"
                                }`}
                              >
                                {line || " "}
                              </div>
                            ))}
                          {f.patch.split("\n").length > 12 && (
                            <div className="text-[9px] font-mono px-2 py-0.5 text-muted-foreground/40">
                              … {f.patch.split("\n").length - 12} more lines
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface AuthorProfile {
  author: string; avatarUrl?: string; profileUrl: string;
  commitCount: number; commitPercentage: number; role: string; roleEmoji: string;
  typeBreakdown: { type: string; count: number }[];
  modules: string[]; activeMonths: string[]; firstCommit: string; lastCommit: string;
  highImpactFiles: string[]; collaborators: string[];
  linesAdded?: number; linesRemoved?: number;
  email?: string; twitter?: string; website?: string; company?: string; location?: string; bio?: string;
}

function DevProfilePanel({
  author,
  owner,
  repo,
  onClose,
}: {
  author: string;
  owner: string;
  repo: string;
  onClose: () => void;
}) {
  const [dev, setDev] = useState<AuthorProfile | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setDev(null); setIsPending(true); setFetchError(null);
    fetch("/api/github/author-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, repo, author }),
    })
      .then(async (r) => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? "Failed"); }
        return r.json() as Promise<AuthorProfile>;
      })
      .then((d) => { setDev(d); setIsPending(false); })
      .catch((e: unknown) => { setFetchError(e instanceof Error ? e.message : "Failed to load profile"); setIsPending(false); });
  }, [owner, repo, author]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-80 bg-background border-l border-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Flame className="w-3 h-3 text-violet-400" />
            </div>
            <p className="font-semibold text-sm">Developer Profile</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isPending && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
              <p className="text-xs">Analyzing {author}…</p>
            </div>
          )}

          {!isPending && (fetchError || !dev) && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {fetchError
                ? <><span className="text-red-400">{fetchError}</span><br />No commits found for this author.</>
                : <>No profile data found for <span className="text-foreground font-medium">{author}</span>.</>
              }
            </div>
          )}

          {dev && (
            <>
              {/* Avatar + name */}
              <div className="flex items-start gap-3">
                {dev.avatarUrl ? (
                  <img
                    src={dev.avatarUrl}
                    alt={dev.author}
                    className="w-12 h-12 rounded-full ring-2 ring-border shrink-0"
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
                    className="flex items-center gap-1 group w-fit"
                  >
                    <span className="font-bold text-sm group-hover:text-violet-400 transition-colors">{dev.author}</span>
                    <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <p className="text-xs text-violet-400 font-medium mt-0.5">{dev.roleEmoji} {dev.role}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{dev.firstCommit} → {dev.lastCommit}</p>
                </div>
              </div>

              {/* Bio */}
              {dev.bio && <p className="text-[11px] text-muted-foreground leading-relaxed">{dev.bio}</p>}

              {/* Contact chips */}
              {(dev.email || dev.twitter || dev.website || dev.company || dev.location) && (
                <div className="flex flex-wrap gap-1.5">
                  {dev.email && (
                    <a href={`mailto:${dev.email}`} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary bg-background border border-border rounded px-2 py-0.5 transition-colors" title={dev.email}>
                      <Mail className="w-2.5 h-2.5 shrink-0" /><span className="truncate max-w-[110px]">{dev.email}</span>
                    </a>
                  )}
                  {dev.twitter && (
                    <a href={`https://twitter.com/${dev.twitter}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-sky-400 bg-background border border-border rounded px-2 py-0.5 transition-colors">
                      <Twitter className="w-2.5 h-2.5 shrink-0" />@{dev.twitter}
                    </a>
                  )}
                  {dev.website && (
                    <a href={dev.website.startsWith("http") ? dev.website : `https://${dev.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary bg-background border border-border rounded px-2 py-0.5 transition-colors">
                      <Globe className="w-2.5 h-2.5 shrink-0" /><span className="truncate max-w-[100px]">{dev.website.replace(/^https?:\/\//, "")}</span>
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

              {/* Contribution */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Contribution</span>
                  <span className="text-[11px] font-semibold text-violet-400">{dev.commitPercentage}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-primary" style={{ width: `${Math.min(dev.commitPercentage, 100)}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{dev.commitCount} commits</p>
              </div>

              {/* Commit types */}
              {dev.typeBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {dev.typeBreakdown.map((tb, j) => (
                    <span key={j} className={`text-[10px] px-2 py-0.5 rounded-full border ${activityColors[tb.type] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
                      {waveIcons[tb.type] ?? "•"} {tb.type} {tb.count}
                    </span>
                  ))}
                </div>
              )}

              {/* Focus modules */}
              {dev.modules.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1"><Layers className="w-3 h-3" /> Focus Areas</p>
                  <div className="flex flex-wrap gap-1">
                    {dev.modules.map((m, j) => (
                      <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">{m}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity timeline */}
              {dev.activeMonths.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1"><Clock className="w-3 h-3" /> Activity · {dev.activeMonths.length} months</p>
                  <div className="flex flex-wrap gap-1">
                    {dev.activeMonths.slice(-24).map((m, j) => (
                      <div key={j} className="w-2.5 h-2.5 rounded-sm bg-violet-500/70 hover:bg-violet-400 transition-colors" title={m} />
                    ))}
                  </div>
                </div>
              )}

              {/* Lines */}
              {(dev.linesAdded || dev.linesRemoved) && (
                <div className="flex items-center gap-4">
                  {dev.linesAdded && <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1"><Plus className="w-3 h-3" />{dev.linesAdded.toLocaleString()}</span>}
                  {dev.linesRemoved && <span className="text-[11px] text-red-400 font-mono flex items-center gap-1"><Minus className="w-3 h-3" />{dev.linesRemoved.toLocaleString()}</span>}
                  <span className="text-[9px] text-muted-foreground">(from diffs)</span>
                </div>
              )}

              {/* Full Developer Intelligence link (deep-links to this contributor's card) */}
              <a
                href={`/developer-intelligence?owner=${owner}&repo=${repo}&author=${encodeURIComponent(author)}`}
                className="flex items-center justify-center gap-1.5 w-full text-xs text-violet-400 hover:text-violet-200 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 hover:border-violet-500/50 rounded-lg px-3 py-2 transition-all font-medium"
              >
                <Flame className="w-3 h-3" />
                Open in Developer Intelligence
                <ExternalLink className="w-3 h-3" />
              </a>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function CommitAnalysis() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const owner = params.get("owner");
  const repo = params.get("repo");

  const [explainerSha, setExplainerSha] = useState<string>("");
  const [devProfileAuthor, setDevProfileAuthor] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

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
          <h2 className="text-2xl font-bold mb-2">Analyzing Commit History…</h2>
          <p className="text-muted-foreground max-w-sm">
            Reading diffs, running AI storytelling, grouping development phases.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {["Fetching commits", "Reading diffs", "AI storytelling", "Grouping phases", "Building insights"].map((step, i) => (
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
    const serverMsg = (() => {
      try {
        const m = msg.match(/\{[\s\S]*\}/);
        if (m) return (JSON.parse(m[0]) as { error?: string }).error ?? null;
      } catch { /* ignore */ }
      return null;
    })();
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold">Analysis Failed</h2>
        <p className="text-muted-foreground text-center max-w-sm">
          {isRateLimit
            ? "GitHub API rate limit reached. Add a GITHUB_TOKEN secret for higher limits, or wait a minute."
            : serverMsg
            ? serverMsg
            : "Unable to analyze this repository. It may be private, have no commits, or the server may be temporarily unavailable."}
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setLocation(`/choose?owner=${owner}&repo=${repo}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
          <Button onClick={() => owner && repo && analyze({ data: { owner, repo } })}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        day: "numeric", month: "short", year: "numeric",
      });
    } catch { return dateStr; }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setLocation(`/choose?owner=${owner}&repo=${repo}`)}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-base font-bold leading-tight">Commit Analysis</h1>
              <p className="text-[11px] text-muted-foreground">{data.owner}/{data.repo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/50 text-primary text-xs" data-testid="badge-total-commits">
              {`${data.totalCommits.toLocaleString()} commits`}
            </Badge>
            {data.startDate && data.endDate && (
              <Badge variant="outline" className="border-border text-muted-foreground text-[10px] hidden sm:flex">
                {formatDate(data.startDate)} — {formatDate(data.endDate)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* ── LEFT: Main analysis content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-5">

            {/* Enhanced Executive Summary */}
            <Card className="bg-card border-border" data-testid="card-executive-summary">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <Compass className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base mb-0.5">Executive Summary</h2>
                    <p className="text-[11px] text-muted-foreground">{data.owner}/{data.repo}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Total Commits", value: data.totalCommits.toLocaleString(), color: "text-primary" },
                    { label: "Contributors", value: (data.contributors ?? 0).toString(), color: "text-violet-400" },
                    { label: "Phases", value: data.phases.length.toString(), color: "text-cyan-400" },
                    { label: "Noisy Commits", value: (data.noisyCommits?.length ?? 0).toString(), color: "text-amber-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-lg bg-background/60 border border-border p-3 text-center">
                      <p className={`text-xl font-bold ${color}`}>{value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{data.executiveSummary}</p>
              </CardContent>
            </Card>

            {/* Section navigation buttons */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "stories", label: "AI Commit Stories", icon: BookOpen, count: data.commitStories?.length ?? 0 },
                  { id: "phases", label: "Phase Timeline", icon: Clock, count: data.phases.length },
                  { id: "noisy", label: "Detect Noisy Commits", icon: Filter, count: data.noisyCommits?.length ?? 0, color: "amber" },
                  { id: "waves", label: "Development Waves", icon: Waves, count: data.developmentWaves.length },
                  { id: "clusters", label: "Feature Clusters", icon: Layers, count: data.featureClusters.length },
                  { id: "architectural", label: "Architectural Events", icon: Zap, count: data.architecturalEvents?.length ?? 0 },
                  { id: "risk", label: "High Risk Commits", icon: Shield, count: data.riskCommits?.length ?? 0, color: "red" },
                  { id: "churn", label: "High Churn Files", icon: FileCode, count: data.highChurnFiles?.length ?? 0, color: "rose" },
                ] as Array<{ id: string; label: string; icon: ElementType; count: number; color?: string }>
              ).map(({ id, label, icon: Icon, count, color }) => {
                const isActive = activeSection === id;
                const activeCls =
                  color === "amber" ? "border-amber-500/60 text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/25 shadow-md"
                  : color === "red" ? "border-red-500/60 text-red-300 bg-red-500/10 ring-1 ring-red-500/25 shadow-md"
                  : color === "rose" ? "border-rose-500/60 text-rose-300 bg-rose-500/10 ring-1 ring-rose-500/25 shadow-md"
                  : "border-violet-500/60 text-violet-300 bg-violet-500/10 ring-1 ring-violet-500/25 shadow-md";
                return (
                  <button
                    key={id}
                    onClick={() => setActiveSection(activeSection === id ? null : id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium transition-all ${
                      isActive
                        ? activeCls
                        : "border-border text-muted-foreground bg-card hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {label}
                    <span className={`ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/10" : "bg-muted/50 text-muted-foreground"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* AI Commit Stories */}
            {activeSection === "stories" && data.commitStories && data.commitStories.length > 0 && (
              <div data-testid="section-commit-stories">
                <h2 className="flex items-center gap-3 text-lg font-bold mb-4">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  What Changed — AI Commit Stories
                  <span className="text-xs font-normal text-muted-foreground ml-auto hidden sm:block">
                    Last {data.commitStories.length} commits
                  </span>
                </h2>
                <div className="space-y-2">
                  {data.commitStories.map((story, i) => (
                    <Card
                      key={i}
                      className="bg-card border-border"
                      data-testid={`card-story-${i}`}
                    >
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                story.type === "Feature" ? "bg-blue-400" :
                                story.type === "Fix" ? "bg-red-400" :
                                story.type === "Refactor" ? "bg-orange-400" :
                                story.type === "Setup" ? "bg-green-400" :
                                story.type === "Docs" ? "bg-purple-400" :
                                story.type === "Chore" ? "bg-gray-400" :
                                "bg-primary"
                              }`}
                            />
                            <div className="flex items-center gap-1">
                              <code
                                className="text-[9px] text-violet-400 font-mono cursor-pointer hover:underline"
                                title="Click to explain this commit"
                                onClick={() => setExplainerSha(story.shortSha)}
                              >{story.shortSha}</code>
                              <a
                                href={`https://github.com/${data.owner}/${data.repo}/commit/${story.sha}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View on GitHub"
                                onClick={e => e.stopPropagation()}
                              >
                                <ExternalLink className="w-2.5 h-2.5 text-muted-foreground hover:text-foreground" />
                              </a>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            {story.message && (
                              <p className="text-[10px] font-mono text-muted-foreground/70 mb-1 leading-snug truncate" title={story.message}>
                                {story.message.split("\n")[0]}
                              </p>
                            )}
                            <p className="text-xs font-medium text-foreground leading-snug mb-1">
                              {story.humanSummary}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={`border text-[9px] px-1.5 py-0 ${activityColors[story.type] ?? "bg-gray-500/20 text-gray-400"}`}>
                                {story.type}
                              </Badge>
                              <button
                                className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-violet-400 transition-colors cursor-pointer"
                                title="View developer profile"
                                onClick={() => setDevProfileAuthor(story.author)}
                              >
                                <User className="w-2.5 h-2.5" />{story.author}
                              </button>
                              {story.date && (
                                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                  <Calendar className="w-2.5 h-2.5" />{formatDate(story.date)}
                                </span>
                              )}
                              {(story.linesAdded !== undefined || story.linesRemoved !== undefined) && (
                                <span className="flex items-center gap-0.5 text-[10px]">
                                  <Plus className="w-2.5 h-2.5 text-green-400" />
                                  <span className="text-green-400">{story.linesAdded ?? 0}</span>
                                  <Minus className="w-2.5 h-2.5 text-red-400 ml-1" />
                                  <span className="text-red-400">{story.linesRemoved ?? 0}</span>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="text-[9px] text-violet-400 flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              Explain
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Phase Timeline */}
            {activeSection === "phases" && data.phases && data.phases.length > 0 && (
              <div data-testid="section-phase-timeline">
                <h2 className="flex items-center gap-3 text-lg font-bold mb-4">
                  <div className="w-7 h-7 rounded-lg bg-secondary/20 flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 text-secondary" />
                  </div>
                  Phase Timeline
                </h2>
                <div className="relative">
                  <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gradient-to-b from-primary via-secondary to-transparent" />
                  <div className="space-y-3 pl-10">
                    {data.phases.map((phase, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-10 top-4 w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px] shadow-primary/50" />
                        <Card className="bg-card border-border hover:border-primary/30 transition-colors" data-testid={`card-phase-${i + 1}`}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div>
                                <h3 className="font-bold text-sm">{phase.name}</h3>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {phase.startDate} — {phase.endDate}
                                </p>
                              </div>
                              <Badge variant="outline" className="shrink-0 border-border text-muted-foreground text-xs">
                                {phase.commitCount} commits
                              </Badge>
                            </div>
                            <Badge className={`mb-2 border text-xs ${activityColors[phase.dominantActivity] ?? "bg-gray-500/20 text-gray-400"}`}>
                              {phase.dominantActivity}
                            </Badge>
                            <p className="text-xs text-muted-foreground leading-relaxed">{phase.description}</p>
                            {phase.keyChanges && phase.keyChanges.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Key changes</p>
                                {phase.keyChanges.slice(0, 3).map((change, j) => (
                                  <div key={j} className="text-[10px] text-muted-foreground font-mono bg-background/50 rounded px-2 py-0.5 truncate">
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

            {/* Detect Noisy Commits */}
            {activeSection === "noisy" && (
              <div data-testid="section-noisy-commits">
                <h2 className="flex items-center gap-3 text-lg font-bold mb-4">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Filter className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  Detected Noisy Commits
                  <Badge className="ml-auto border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs">
                    {data.noisyCommits?.length ?? 0} found
                  </Badge>
                </h2>
                {!data.noisyCommits || data.noisyCommits.length === 0 ? (
                  <Card className="bg-card border-border">
                    <CardContent className="pt-10 pb-10 text-center">
                      <div className="text-3xl mb-3">🎉</div>
                      <p className="font-semibold text-sm mb-1">Clean commit history!</p>
                      <p className="text-xs text-muted-foreground">No merge commits, bot PRs, version bumps, or format-only commits detected.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {data.noisyCommits.map((nc, i) => (
                      <Card key={i} className="bg-card border-amber-500/10 hover:border-amber-500/30 transition-colors">
                        <CardContent className="pt-3 pb-3">
                          <div className="flex items-start gap-3">
                            <code className="text-[9px] text-amber-400 font-mono shrink-0 mt-0.5 pt-0.5">{nc.commitSha.slice(0, 7)}</code>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-foreground/80 truncate">{nc.message}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge className="border text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/30">{nc.reason}</Badge>
                                <span className="text-[10px] text-muted-foreground">{nc.author}</span>
                                {nc.date && <span className="text-[10px] text-muted-foreground">{formatDate(nc.date)}</span>}
                              </div>
                            </div>
                            <a
                              href={`https://github.com/${data.owner}/${data.repo}/commit/${nc.commitSha}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 mt-0.5"
                              onClick={e => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors" />
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Development Waves */}
            {activeSection === "waves" && data.developmentWaves && data.developmentWaves.length > 0 && (
              <div data-testid="section-development-waves">
                <h2 className="flex items-center gap-3 text-lg font-bold mb-4">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <Waves className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  Development Waves
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.developmentWaves.map((wave, i) => (
                    <Card key={i} className="bg-card border-border" data-testid={`card-wave-${i}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{waveIcons[wave.type] ?? "🌊"}</span>
                          <Badge className={`border text-xs ${activityColors[wave.type] ?? "bg-gray-500/20 text-gray-400"}`}>
                            {wave.type}
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-sm mb-1">{wave.title}</h3>
                        <p className="text-xs text-muted-foreground">{wave.description}</p>
                        {wave.commitCount && (
                          <p className="text-[10px] text-muted-foreground mt-1">{wave.commitCount} commits</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Feature Clusters */}
            {activeSection === "clusters" && data.featureClusters && data.featureClusters.length > 0 && (
              <div data-testid="section-feature-clusters">
                <h2 className="flex items-center gap-3 text-lg font-bold mb-4">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  Feature Clusters
                </h2>
                <Card className="bg-card border-border">
                  <CardContent className="pt-5">
                    <div className="flex flex-wrap gap-2">
                      {data.featureClusters.map((cluster, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background border border-border hover:border-primary/40 transition-colors"
                          data-testid={`badge-cluster-${i}`}
                        >
                          <span className="text-xs font-medium">{cluster.name}</span>
                          <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                            {cluster.commitCount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Developer Intelligence is a dedicated analyser — see /developer-intelligence */}
            {data.contributorIntelligence && data.contributorIntelligence.length > 0 && false && (
              <div data-testid="section-developer-intelligence">
                <h2 className="flex items-center gap-3 text-lg font-bold mb-4">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <Flame className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  Developer Intelligence
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {data.contributorIntelligence.map((dev, i) => (
                    <Card key={i} className="bg-card border-border hover:border-violet-500/30 transition-colors" data-testid={`card-dev-intel-${i}`}>
                      <CardContent className="pt-4 pb-4">
                        {/* Header */}
                        <div className="flex items-start gap-3 mb-3">
                          {dev.avatarUrl ? (
                            <img
                              src={dev.avatarUrl}
                              alt={dev.author}
                              className="w-10 h-10 rounded-full ring-2 ring-border"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-violet-500/40 to-primary/40 flex items-center justify-center font-bold text-sm">
                              {dev.author.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <a
                              href={dev.profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 group w-fit"
                            >
                              <span className="font-bold text-sm group-hover:text-primary transition-colors truncate">{dev.author}</span>
                              <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-100 shrink-0 transition-opacity" />
                            </a>
                            <p className="text-[11px] text-violet-400 font-medium mt-0.5">{dev.roleEmoji} {dev.role}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] border-border shrink-0 ml-auto">
                            {dev.commitCount} commits
                          </Badge>
                        </div>

                        {/* Commit contribution bar */}
                        <div className="mb-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Contribution share</span>
                            <span className="text-[11px] font-semibold text-primary">{dev.commitPercentage}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-primary transition-all"
                              style={{ width: `${Math.min(dev.commitPercentage, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Commit type breakdown */}
                        {dev.typeBreakdown.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
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

                        {/* Module focus areas */}
                        {dev.modules.length > 0 && (
                          <div className="mb-3">
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

                        {/* Activity timeline dots */}
                        {dev.activeMonths.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Timeline · {dev.firstCommit} → {dev.lastCommit}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {dev.activeMonths.slice(-18).map((m, j) => (
                                <div
                                  key={j}
                                  className="w-2.5 h-2.5 rounded-sm bg-violet-500/70 hover:bg-violet-400 transition-colors"
                                  title={m}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Lines added/removed */}
                        {(dev.linesAdded !== undefined || dev.linesRemoved !== undefined) && (
                          <div className="flex items-center gap-4 mb-3">
                            {dev.linesAdded !== undefined && (
                              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                                <Plus className="w-3 h-3" />{dev.linesAdded.toLocaleString()}
                              </span>
                            )}
                            {dev.linesRemoved !== undefined && (
                              <span className="text-[11px] text-red-400 flex items-center gap-1 font-mono">
                                <Minus className="w-3 h-3" />{dev.linesRemoved.toLocaleString()}
                              </span>
                            )}
                            <span className="text-[9px] text-muted-foreground">(from analyzed diffs)</span>
                          </div>
                        )}

                        {/* High-impact files */}
                        {dev.highImpactFiles.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1">
                              <Flame className="w-3 h-3 text-rose-400" /> High-Impact Files
                            </p>
                            <div className="space-y-0.5">
                              {dev.highImpactFiles.map((f, j) => (
                                <div key={j} className="text-[10px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-0.5 truncate">
                                  {f}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
                          {/* Collaborators */}
                          {dev.collaborators.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[10px] text-muted-foreground">Also worked with:</span>
                              {dev.collaborators.map((c, j) => (
                                <a
                                  key={j}
                                  href={`https://github.com/${c}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border hover:border-primary/50 text-muted-foreground hover:text-primary transition-colors"
                                >
                                  @{c}
                                </a>
                              ))}
                            </div>
                          )}
                          {/* Phase badges */}
                          {dev.phases.length > 0 && (
                            <div className="flex items-center gap-1 ml-auto">
                              {dev.phases.slice(0, 5).map((ph, j) => (
                                <Badge key={j} variant="outline" className="text-[9px] border-border text-muted-foreground h-4 px-1.5 shrink-0">
                                  Ph.{ph}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Collaboration Insights — moved to dedicated developer-intelligence page */}
            {data.collaborationInsights && data.collaborationInsights.length > 0 && false && (
              <div data-testid="section-collaboration-insights">
                <h2 className="flex items-center gap-3 text-lg font-bold mb-4">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <GitMerge className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  Collaboration Insights
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.collaborationInsights.map((insight, i) => (
                    <Card key={i} className="bg-card border-border hover:border-blue-500/30 transition-colors" data-testid={`card-insight-${i}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Users className="w-3 h-3 text-blue-400" />
                          </div>
                          <div className="flex items-center gap-1 text-xs font-medium min-w-0">
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
                          Co-edited <span className="text-blue-400 font-semibold">{insight.fileCount}</span> file{insight.fileCount !== 1 ? "s" : ""} — possible conflict area
                        </p>
                        <div className="space-y-0.5">
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

            {/* Architectural Events */}
            {activeSection === "architectural" && data.architecturalEvents && data.architecturalEvents.length > 0 && (
              <div data-testid="section-architectural-events" className="col-span-2">
                  <h2 className="flex items-center gap-3 text-base font-bold mb-3">
                    <div className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <Activity className="w-3 h-3 text-orange-400" />
                    </div>
                    Architectural Events
                  </h2>
                  <div className="space-y-2">
                    {data.architecturalEvents.map((event, i) => (
                      <Card
                        key={i}
                        className="bg-card border-orange-500/20 cursor-pointer hover:border-orange-500/40 transition-colors"
                        onClick={() => setExplainerSha(event.commitSha)}
                      >
                        <CardContent className="pt-3">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <a
                              href={`https://github.com/${data.owner}/${data.repo}/commit/${event.commitSha}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View on GitHub"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 group"
                            >
                              <code className="text-[10px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded font-mono group-hover:bg-orange-500/20">
                                {event.commitSha}
                              </code>
                              <ExternalLink className="w-2.5 h-2.5 text-orange-400/60 group-hover:text-orange-400" />
                            </a>
                            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] border">
                              {event.impact} Impact
                            </Badge>
                          </div>
                          <p className="text-xs font-medium mb-1">{event.event}</p>
                          <p className="text-[11px] text-muted-foreground mb-1.5">{event.description}</p>
                          <div className="flex items-center gap-3 flex-wrap">
                            {event.author && (
                              <button
                                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-violet-400 transition-colors cursor-pointer"
                                title="View developer profile"
                                onClick={(e) => { e.stopPropagation(); setDevProfileAuthor(event.author!); }}
                              >
                                <User className="w-2.5 h-2.5" />{event.author}
                              </button>
                            )}
                            {event.date && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Calendar className="w-2.5 h-2.5" />{formatDate(event.date)}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

            {/* High Risk Commits */}
            {activeSection === "risk" && data.riskCommits && data.riskCommits.length > 0 && (
              <div data-testid="section-risk-commits">
                  <h2 className="flex items-center gap-3 text-base font-bold mb-3">
                    <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
                      <Shield className="w-3 h-3 text-red-400" />
                    </div>
                    High Risk Commits
                  </h2>
                  <div className="space-y-2">
                    {data.riskCommits.map((commit, i) => (
                      <Card
                        key={i}
                        className="bg-card border-red-500/20 cursor-pointer hover:border-red-500/40 transition-colors"
                        onClick={() => setExplainerSha(commit.commitSha)}
                      >
                        <CardContent className="pt-3">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <a
                              href={`https://github.com/${data.owner}/${data.repo}/commit/${commit.commitSha}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View on GitHub"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 group"
                            >
                              <code className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-mono group-hover:bg-red-500/20">
                                {commit.commitSha}
                              </code>
                              <ExternalLink className="w-2.5 h-2.5 text-red-400/60 group-hover:text-red-400" />
                            </a>
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] border">
                              {commit.riskLevel}
                            </Badge>
                          </div>
                          <p className="text-xs font-mono mb-1 truncate text-foreground/80">{commit.message}</p>
                          <p className="text-[11px] text-muted-foreground mb-1.5">{commit.reason}</p>
                          <div className="flex items-center gap-3 flex-wrap">
                            {commit.author && (
                              <button
                                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-violet-400 transition-colors cursor-pointer"
                                title="View developer profile"
                                onClick={(e) => { e.stopPropagation(); setDevProfileAuthor(commit.author!); }}
                              >
                                <User className="w-2.5 h-2.5" />{commit.author}
                              </button>
                            )}
                            {commit.date && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Calendar className="w-2.5 h-2.5" />{formatDate(commit.date)}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
            )}

            {/* High Churn Files */}
            {activeSection === "churn" && data.highChurnFiles && data.highChurnFiles.length > 0 && (
              <div data-testid="section-churn-files">
                <h2 className="flex items-center gap-3 text-lg font-bold mb-4">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  High Churn Files
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
                                {file.changes} changes
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
        </div>

        {/* ── RIGHT: Commit Explainer Panel ── */}
        <div className="hidden lg:flex flex-col w-[360px] shrink-0 border-l border-border bg-card/30 sticky top-[57px] h-[calc(100vh-57px)] overflow-hidden">
          <CommitExplainerPanel
            owner={owner ?? ""}
            repo={repo ?? ""}
            prefilledSha={explainerSha}
            onAuthorClick={setDevProfileAuthor}
          />
        </div>
      </div>

      {/* Developer Profile Panel */}
      {devProfileAuthor && owner && repo && (
        <DevProfilePanel
          author={devProfileAuthor}
          owner={owner}
          repo={repo}
          onClose={() => setDevProfileAuthor(null)}
        />
      )}

      {/* Mobile: Explainer as a bottom card when a SHA is selected */}
      {explainerSha && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-2xl max-h-[60vh] flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <span className="text-sm font-semibold">Commit Explainer</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setExplainerSha("")}>
              Close
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <CommitExplainerPanel
              owner={owner ?? ""}
              repo={repo ?? ""}
              prefilledSha={explainerSha}
              onAuthorClick={setDevProfileAuthor}
            />
          </div>
        </div>
      )}
      {owner && repo && <AiAssistant owner={owner} repo={repo} />}
    </div>
  );
}
