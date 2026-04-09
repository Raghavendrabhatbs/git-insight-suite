import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  ArrowLeft, Sparkles, FileText, Mic, Briefcase,
  Copy, Check, Loader2, RefreshCw, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

type Mode = "release-notes" | "standup" | "portfolio";

interface Field {
  key: string;
  label: string;
  placeholder: string;
  important?: boolean;
  optional?: boolean;
  hint?: string;
}

const MODES: Array<{ id: Mode; label: string; icon: React.ElementType; color: string; ringClass: string; badgeClass: string; description: string; fields: Field[] }> = [
  {
    id: "release-notes",
    label: "Release Notes",
    icon: FileText,
    color: "blue",
    ringClass: "border-blue-500/60 bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/25",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    description: "What changed — formatted for users & developers",
    fields: [
      {
        key: "features",
        label: "Feature Clusters",
        important: true,
        placeholder: "Authentication system\nUI improvements\nAPI integration\nDashboard redesign",
        hint: "One feature per line — the most important input",
      },
      {
        key: "fixes",
        label: "Bug Fixes",
        placeholder: "Fixed login validation bug\nResolved crash on logout\nFixed mobile layout issue",
        hint: "One fix per line",
      },
      {
        key: "improvements",
        label: "Improvements & Refactors",
        placeholder: "Improved page load performance\nRefactored auth middleware\nOptimized database queries",
        hint: "One improvement per line",
      },
      {
        key: "modules",
        label: "Affected Modules",
        placeholder: "Auth module\nUI components\nAPI layer",
        hint: "Which parts of the codebase changed",
      },
    ],
  },
  {
    id: "standup",
    label: "Standup Update",
    icon: Mic,
    color: "green",
    ringClass: "border-green-500/60 bg-green-500/10 text-green-300 ring-1 ring-green-500/25",
    badgeClass: "bg-green-500/10 text-green-400 border-green-500/30",
    description: "Daily progress — ready to read out in your standup",
    fields: [
      {
        key: "recent_work",
        label: "Recent Commits / Work Done",
        important: true,
        placeholder: "Implemented user login flow\nFixed validation bug\nAdded API integration\nUpdated unit tests",
        hint: "What was done in the last 1–2 days — one item per line",
      },
      {
        key: "in_progress",
        label: "Currently In Progress",
        placeholder: "Testing authentication module\nReviewing PR for dashboard\nWriting docs for API",
        hint: "What's being worked on right now",
      },
      {
        key: "blockers",
        label: "Blockers / Issues",
        optional: true,
        placeholder: "Waiting for design review\nBlocked by API credentials",
        hint: "Leave empty if none",
      },
      {
        key: "contributors",
        label: "Contributor Activity",
        optional: true,
        placeholder: "Alice: worked on auth module\nBob: reviewed PRs\nCarol: fixed UI bugs",
        hint: "Who did what — optional",
      },
    ],
  },
  {
    id: "portfolio",
    label: "Portfolio Description",
    icon: Briefcase,
    color: "violet",
    ringClass: "border-violet-500/60 bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/25",
    badgeClass: "bg-violet-500/10 text-violet-400 border-violet-500/30",
    description: "Resume-ready project summary that showcases your skills",
    fields: [
      {
        key: "features",
        label: "Key Features Built",
        placeholder: "Authentication system\nRESTful API integration\nReal-time dashboard\nRole-based access control",
        hint: "Main things you built — one per line",
      },
      {
        key: "tech_stack",
        label: "Tech Stack",
        placeholder: "React\nNode.js\nPostgreSQL\nDocker\nRedis",
        hint: "Technologies used — one per line",
      },
      {
        key: "impact",
        label: "Impact & Outcomes",
        important: true,
        placeholder: "Reduced login errors by 80%\nImproved page load time by 40%\nEnabled team of 5 to ship faster\nAdded functionality used by 1000+ users",
        hint: "The MOST important section — metrics, outcomes, and business impact",
      },
      {
        key: "role",
        label: "Your Role / Contribution",
        optional: true,
        placeholder: "Led backend development\nDesigned and implemented auth flow\nCode reviewed all frontend PRs",
        hint: "What specifically you contributed",
      },
    ],
  },
];

export default function NarrativePage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const owner = params.get("owner");
  const repo = params.get("repo");

  const [mode, setMode] = useState<Mode>("release-notes");
  const [values, setValues] = useState<Record<string, string>>({});
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentMode = MODES.find(m => m.id === mode)!;

  function splitLines(text: string): string[] {
    return text.split("\n").map(l => l.trim()).filter(Boolean);
  }

  function buildInputs() {
    const inputs: Record<string, string[]> = {};
    for (const field of currentMode.fields) {
      const val = values[`${mode}:${field.key}`] ?? "";
      if (val.trim()) inputs[field.key] = splitLines(val);
    }
    return inputs;
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setOutput(null);
    try {
      const res = await fetch("/api/github/generate-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: owner ?? "unknown",
          repo: repo ?? "project",
          mode,
          inputs: buildInputs(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setOutput(data.narrative);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getFieldKey(mode: Mode, key: string) {
    return `${mode}:${key}`;
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border px-6 py-4 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setLocation(owner && repo ? `/choose?owner=${owner}&repo=${repo}` : "/")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold">AI Narrative Generator</h1>
            {owner && repo && (
              <p className="text-xs text-muted-foreground truncate">{owner}/{repo}</p>
            )}
          </div>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">Powered by GPT-4o mini</span>
        </div>
      </div>

      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Mode tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {MODES.map(m => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setOutput(null); setError(null); }}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${
                  isActive ? m.ringClass : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isActive
                    ? m.color === "blue" ? "bg-blue-500/20" : m.color === "green" ? "bg-green-500/20" : "bg-violet-500/20"
                    : "bg-muted"
                }`}>
                  <Icon className={`w-5 h-5 ${
                    isActive
                      ? m.color === "blue" ? "text-blue-400" : m.color === "green" ? "text-green-400" : "text-violet-400"
                      : "text-muted-foreground"
                  }`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${isActive ? "" : "text-foreground/70"}`}>{m.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 hidden sm:block">{m.description}</p>
                </div>
                {isActive && <ChevronRight className={`w-4 h-4 ml-auto shrink-0 ${
                  m.color === "blue" ? "text-blue-400" : m.color === "green" ? "text-green-400" : "text-violet-400"
                }`} />}
              </button>
            );
          })}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Inputs */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Inputs</h2>
              <Button
                onClick={generate}
                disabled={loading}
                size="sm"
                className={`gap-2 text-white border-0 ${
                  currentMode.color === "blue"
                    ? "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500"
                    : currentMode.color === "green"
                    ? "bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500"
                    : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
                }`}
              >
                {loading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                  : <><Sparkles className="w-3.5 h-3.5" /> Generate</>}
              </Button>
            </div>

            {currentMode.fields.map(field => (
              <div key={field.key} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground">{field.label}</label>
                  {field.important && (
                    <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      Most Important
                    </Badge>
                  )}
                  {field.optional && (
                    <span className="text-[10px] text-muted-foreground">optional</span>
                  )}
                </div>
                {field.hint && (
                  <p className="text-[11px] text-muted-foreground">{field.hint}</p>
                )}
                <Textarea
                  value={values[getFieldKey(mode, field.key)] ?? ""}
                  onChange={e => setValues(prev => ({ ...prev, [getFieldKey(mode, field.key)]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={4}
                  className={`resize-none font-mono text-xs bg-background border-border placeholder:text-muted-foreground/40 focus-visible:ring-1 ${
                    field.important
                      ? currentMode.color === "blue" ? "focus-visible:ring-blue-500/50 border-blue-500/20"
                        : currentMode.color === "green" ? "focus-visible:ring-green-500/50 border-green-500/20"
                        : "focus-visible:ring-violet-500/50 border-violet-500/20"
                      : "focus-visible:ring-primary/50"
                  }`}
                />
              </div>
            ))}

            <p className="text-[10px] text-muted-foreground pt-1">
              Each line = one item. Empty lines are ignored.
            </p>
          </div>

          {/* Right: Output */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Output</h2>
              {output && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={generate} disabled={loading}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={copy}
                  >
                    {copied
                      ? <><Check className="w-3 h-3 mr-1 text-green-400" /> Copied</>
                      : <><Copy className="w-3 h-3 mr-1" /> Copy</>}
                  </Button>
                </div>
              )}
            </div>

            {loading && (
              <Card className="border-border bg-card">
                <CardContent className="pt-8 pb-8 flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full border border-violet-500/30 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="absolute inset-0 rounded-full border border-violet-500 border-t-transparent animate-spin" />
                  </div>
                  <p className="text-sm text-muted-foreground">Crafting your {currentMode.label.toLowerCase()}…</p>
                </CardContent>
              </Card>
            )}

            {error && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-destructive">{error}</p>
                </CardContent>
              </Card>
            )}

            {output && !loading && (
              <Card className={`border ${
                currentMode.color === "blue" ? "border-blue-500/20" : currentMode.color === "green" ? "border-green-500/20" : "border-violet-500/20"
              } bg-card`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                    <currentMode.icon className={`w-4 h-4 ${
                      currentMode.color === "blue" ? "text-blue-400" : currentMode.color === "green" ? "text-green-400" : "text-violet-400"
                    }`} />
                    <Badge className={`text-[10px] border ${currentMode.badgeClass}`}>
                      {currentMode.label}
                    </Badge>
                    {owner && repo && (
                      <span className="text-[10px] text-muted-foreground ml-auto font-mono">{owner}/{repo}</span>
                    )}
                  </div>
                  <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {output}
                  </div>
                </CardContent>
              </Card>
            )}

            {!output && !loading && !error && (
              <Card className="border-border/40 bg-card/50 border-dashed h-full min-h-[280px]">
                <CardContent className="flex flex-col items-center justify-center h-full min-h-[280px] gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    currentMode.color === "blue" ? "bg-blue-500/10" : currentMode.color === "green" ? "bg-green-500/10" : "bg-violet-500/10"
                  }`}>
                    <currentMode.icon className={`w-7 h-7 ${
                      currentMode.color === "blue" ? "text-blue-400/50" : currentMode.color === "green" ? "text-green-400/50" : "text-violet-400/50"
                    }`} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground/70 mb-1">Fill in the inputs and click Generate</p>
                    <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">{currentMode.description}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
