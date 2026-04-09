import { useState, type ElementType } from "react";
import { useLocation, useSearch } from "wouter";
import {
  ArrowLeft, Sparkles, FileText, Mic, Briefcase,
  Copy, Check, Loader2, RefreshCw, ChevronDown, ChevronUp, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface ModeConfig {
  id: Mode;
  label: string;
  icon: ElementType;
  accent: string;
  bgAccent: string;
  borderAccent: string;
  textAccent: string;
  description: string;
  outputTitle: string;
  fields: Field[];
}

const MODES: ModeConfig[] = [
  {
    id: "release-notes",
    label: "Release Notes",
    icon: FileText,
    accent: "blue",
    bgAccent: "bg-blue-500/10",
    borderAccent: "border-blue-500/25",
    textAccent: "text-blue-400",
    description: "Clean, user-facing changelog with features, fixes & improvements",
    outputTitle: "📄 Release Notes",
    fields: [
      {
        key: "features",
        label: "Feature Clusters",
        important: true,
        placeholder: "Authentication system\nUI improvements\nAPI integration\nDashboard redesign",
        hint: "One feature per line — MOST IMPORTANT",
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
        optional: true,
        placeholder: "Auth module\nUI components\nAPI layer",
        hint: "Which parts changed",
      },
    ],
  },
  {
    id: "standup",
    label: "Standup Update",
    icon: Mic,
    accent: "green",
    bgAccent: "bg-green-500/10",
    borderAccent: "border-green-500/25",
    textAccent: "text-green-400",
    description: "Ready-to-read daily standup with Yesterday / Today / Blockers",
    outputTitle: "🗣️ Standup Update",
    fields: [
      {
        key: "recent_work",
        label: "Recent Work Done",
        important: true,
        placeholder: "Implemented user login flow\nFixed validation bug\nAdded API integration",
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
        placeholder: "Alice: worked on auth module\nBob: reviewed PRs",
        hint: "Who did what — optional",
      },
    ],
  },
  {
    id: "portfolio",
    label: "Portfolio Description",
    icon: Briefcase,
    accent: "violet",
    bgAccent: "bg-violet-500/10",
    borderAccent: "border-violet-500/25",
    textAccent: "text-violet-400",
    description: "Resume-ready bullets + portfolio summary showcasing your skills & impact",
    outputTitle: "💼 Portfolio Description",
    fields: [
      {
        key: "features",
        label: "Key Features Built",
        placeholder: "Authentication system\nRESTful API integration\nReal-time dashboard",
        hint: "Main things you built — one per line",
      },
      {
        key: "tech_stack",
        label: "Tech Stack",
        placeholder: "React\nNode.js\nPostgreSQL\nDocker",
        hint: "Technologies used — one per line",
      },
      {
        key: "impact",
        label: "Impact & Outcomes",
        important: true,
        placeholder: "Reduced login errors by 80%\nImproved page load time by 40%\nEnabled team of 5 to ship faster",
        hint: "Metrics, outcomes, business impact — MOST IMPORTANT",
      },
      {
        key: "role",
        label: "Your Role / Contribution",
        optional: true,
        placeholder: "Led backend development\nDesigned and implemented auth flow",
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

  const [values, setValues] = useState<Record<string, string>>({});
  const [outputs, setOutputs] = useState<Partial<Record<Mode, string>>>({});
  const [loading, setLoading] = useState<Partial<Record<Mode, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<Mode, string>>>({});
  const [copied, setCopied] = useState<Partial<Record<Mode, boolean>>>({});
  const [collapsed, setCollapsed] = useState<Partial<Record<Mode, boolean>>>({});
  const [generatingAll, setGeneratingAll] = useState(false);

  function splitLines(text: string): string[] {
    return text.split("\n").map(l => l.trim()).filter(Boolean);
  }

  function buildInputs(mode: Mode) {
    const modeConfig = MODES.find(m => m.id === mode)!;
    const inputs: Record<string, string[]> = {};
    for (const field of modeConfig.fields) {
      const val = values[`${mode}:${field.key}`] ?? "";
      if (val.trim()) inputs[field.key] = splitLines(val);
    }
    return inputs;
  }

  async function generateOne(mode: Mode) {
    setLoading(prev => ({ ...prev, [mode]: true }));
    setErrors(prev => ({ ...prev, [mode]: undefined }));
    try {
      const res = await fetch("/api/github/generate-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: owner ?? "unknown",
          repo: repo ?? "project",
          mode,
          inputs: buildInputs(mode),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setOutputs(prev => ({ ...prev, [mode]: data.narrative }));
      setCollapsed(prev => ({ ...prev, [mode]: true }));
    } catch (e) {
      setErrors(prev => ({ ...prev, [mode]: e instanceof Error ? e.message : "Generation failed" }));
    } finally {
      setLoading(prev => ({ ...prev, [mode]: false }));
    }
  }

  async function generateAll() {
    setGeneratingAll(true);
    await Promise.all(MODES.map(m => generateOne(m.id)));
    setGeneratingAll(false);
  }

  async function copyOutput(mode: Mode) {
    const text = outputs[mode];
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(prev => ({ ...prev, [mode]: true }));
    setTimeout(() => setCopied(prev => ({ ...prev, [mode]: false })), 2000);
  }

  const setVal = (mode: Mode, key: string, val: string) => {
    setValues(prev => ({ ...prev, [`${mode}:${key}`]: val }));
  };

  const totalHasInput = MODES.some(m =>
    m.fields.some(f => (values[`${m.id}:${f.key}`] ?? "").trim().length > 0)
  );

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Sticky header */}
      <div className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border px-5 py-3.5 flex items-center gap-3">
        <Button
          variant="ghost" size="icon" className="shrink-0 h-8 w-8"
          onClick={() => setLocation(owner && repo ? `/choose?owner=${owner}&repo=${repo}` : "/")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none">AI Narrative Generator</h1>
            {owner && repo && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{owner}/{repo}</p>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
            <span className="text-[11px] text-muted-foreground">GPT-4o mini</span>
          </div>
          <Button
            onClick={generateAll}
            disabled={generatingAll || !totalHasInput}
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 hover:from-blue-500 hover:via-violet-500 hover:to-purple-500 text-white border-0 text-xs h-8"
          >
            {generatingAll
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating All…</>
              : <><Zap className="w-3 h-3" /> Generate All</>}
          </Button>
        </div>
      </div>

      <div className="p-5 lg:p-8 max-w-6xl mx-auto space-y-6">
        {/* Instruction banner */}
        <div className="rounded-xl border border-border/60 bg-card/40 px-5 py-4 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Fill in the fields for each section and click <span className="text-foreground font-medium">Generate</span> individually, or click{" "}
            <span className="text-foreground font-medium">Generate All</span> in the header to produce all three at once.
            Each line in a textarea = one item.
          </p>
        </div>

        {/* Three sections */}
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isLoading = loading[mode.id];
          const output = outputs[mode.id];
          const error = errors[mode.id];
          const isCopied = copied[mode.id];
          const isCollapsed = collapsed[mode.id] && !!output;

          return (
            <div
              key={mode.id}
              className={`rounded-2xl border bg-card overflow-hidden ${mode.borderAccent}`}
            >
              {/* Section header */}
              <div className={`flex items-center gap-3 px-6 py-4 border-b ${mode.borderAccent} ${mode.bgAccent}`}>
                <div className={`w-9 h-9 rounded-xl ${mode.bgAccent} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${mode.textAccent}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold">{mode.label}</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{mode.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {output && (
                    <>
                      <Button
                        variant="ghost" size="sm"
                        className={`h-7 px-2.5 text-xs gap-1 ${mode.textAccent} hover:${mode.bgAccent}`}
                        onClick={() => copyOutput(mode.id)}
                      >
                        {isCopied
                          ? <><Check className="w-3 h-3" /> Copied</>
                          : <><Copy className="w-3 h-3" /> Copy</>}
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 px-2.5 text-xs gap-1 text-muted-foreground"
                        onClick={() => generateOne(mode.id)} disabled={isLoading}
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                  <Button
                    onClick={() => generateOne(mode.id)}
                    disabled={isLoading}
                    size="sm"
                    className={`h-7 px-3 text-xs gap-1.5 text-white border-0 ${
                      mode.accent === "blue"
                        ? "bg-blue-600 hover:bg-blue-500"
                        : mode.accent === "green"
                        ? "bg-green-700 hover:bg-green-600"
                        : "bg-violet-600 hover:bg-violet-500"
                    }`}
                  >
                    {isLoading
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                      : <><Sparkles className="w-3 h-3" /> Generate</>}
                  </Button>
                  {output && (
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => setCollapsed(prev => ({ ...prev, [mode.id]: !prev[mode.id] }))}
                    >
                      {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Body */}
              {!isCollapsed && (
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border/50">
                  {/* Inputs */}
                  <div className="p-5 space-y-4">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Inputs</p>
                    {mode.fields.map(field => (
                      <div key={field.key} className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-medium">{field.label}</label>
                          {field.important && (
                            <Badge className="text-[9px] px-1 py-0 h-3.5 bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              ★ Key
                            </Badge>
                          )}
                          {field.optional && (
                            <span className="text-[9px] text-muted-foreground">optional</span>
                          )}
                        </div>
                        {field.hint && (
                          <p className="text-[10px] text-muted-foreground">{field.hint}</p>
                        )}
                        <Textarea
                          value={values[`${mode.id}:${field.key}`] ?? ""}
                          onChange={e => setVal(mode.id, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={3}
                          className={`resize-none font-mono text-[11px] bg-background border-border/60 placeholder:text-muted-foreground/30 focus-visible:ring-1 ${
                            field.important
                              ? mode.accent === "blue" ? "focus-visible:ring-blue-500/50"
                                : mode.accent === "green" ? "focus-visible:ring-green-500/50"
                                : "focus-visible:ring-violet-500/50"
                              : ""
                          }`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Output */}
                  <div className="p-5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Output</p>
                    {isLoading && (
                      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
                        <div className="relative w-9 h-9">
                          <div className={`absolute inset-0 rounded-full border ${
                            mode.accent === "blue" ? "border-blue-500" : mode.accent === "green" ? "border-green-500" : "border-violet-500"
                          } border-t-transparent animate-spin`} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Icon className={`w-3.5 h-3.5 ${mode.textAccent}`} />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Generating {mode.label.toLowerCase()}…</p>
                      </div>
                    )}
                    {error && !isLoading && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                        <p className="text-xs text-destructive">{error}</p>
                      </div>
                    )}
                    {output && !isLoading && (
                      <div className={`rounded-xl border ${mode.borderAccent} ${mode.bgAccent} p-4`}>
                        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-border/40">
                          <Icon className={`w-3.5 h-3.5 ${mode.textAccent}`} />
                          <span className={`text-[11px] font-semibold ${mode.textAccent}`}>{mode.outputTitle}</span>
                          {owner && repo && (
                            <span className="text-[10px] text-muted-foreground ml-auto font-mono opacity-60">{owner}/{repo}</span>
                          )}
                        </div>
                        <div className="text-[12px] text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans">
                          {output}
                        </div>
                      </div>
                    )}
                    {!output && !isLoading && !error && (
                      <div className="flex flex-col items-center justify-center min-h-[200px] gap-2 rounded-xl border border-dashed border-border/40">
                        <Icon className={`w-7 h-7 ${mode.textAccent} opacity-20`} />
                        <p className="text-xs text-muted-foreground">Output appears here after generation</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Collapsed output preview */}
              {isCollapsed && output && (
                <div className="px-6 py-3">
                  <p className="text-xs text-muted-foreground line-clamp-2 font-mono opacity-60">{output.slice(0, 180)}…</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
