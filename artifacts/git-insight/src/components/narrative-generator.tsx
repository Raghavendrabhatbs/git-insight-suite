import { useState } from "react";
import { Sparkles, FileText, Mic, Briefcase, Copy, Check, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface NarrativeContext {
  type: "commit" | "repo";
  summary?: string;
  phases?: string[];
  features?: string[];
  recentCommits?: string[];
  architecturalEvents?: string[];
  modules?: string[];
  dependencies?: string[];
  language?: string;
  stars?: number;
  totalCommits?: number;
  waves?: string[];
}

type NarrativeMode = "release-notes" | "standup" | "portfolio";

const MODES: Array<{
  id: NarrativeMode;
  label: string;
  icon: React.ElementType;
  description: string;
  color: string;
  activeClass: string;
}> = [
  {
    id: "release-notes",
    label: "Release Notes",
    icon: FileText,
    description: "What changed — formatted for users",
    color: "blue",
    activeClass: "border-blue-500/60 bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/25",
  },
  {
    id: "standup",
    label: "Standup Update",
    icon: Mic,
    description: "Daily progress — ready to read out",
    color: "green",
    activeClass: "border-green-500/60 bg-green-500/10 text-green-300 ring-1 ring-green-500/25",
  },
  {
    id: "portfolio",
    label: "Portfolio Description",
    icon: Briefcase,
    description: "Resume-ready project summary",
    color: "violet",
    activeClass: "border-violet-500/60 bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/25",
  },
];

interface Props {
  owner: string;
  repo: string;
  context: NarrativeContext;
}

export function NarrativeGenerator({ owner, repo, context }: Props) {
  const [mode, setMode] = useState<NarrativeMode>("release-notes");
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentMode = MODES.find(m => m.id === mode)!;

  async function generate() {
    setLoading(true);
    setError(null);
    setNarrative(null);
    try {
      const res = await fetch("/api/github/generate-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, mode, context }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setNarrative(data.narrative);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!narrative) return;
    await navigator.clipboard.writeText(narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MODES.map(m => {
          const Icon = m.icon;
          const isActive = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setNarrative(null); setError(null); }}
              className={`flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all duration-200 ${
                isActive
                  ? m.activeClass
                  : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isActive
                  ? m.color === "blue" ? "bg-blue-500/20" : m.color === "green" ? "bg-green-500/20" : "bg-violet-500/20"
                  : "bg-muted"
              }`}>
                <Icon className={`w-4 h-4 ${
                  isActive
                    ? m.color === "blue" ? "text-blue-400" : m.color === "green" ? "text-green-400" : "text-violet-400"
                    : "text-muted-foreground"
                }`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${isActive ? "" : "text-foreground/70"}`}>{m.label}</p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{m.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Generate button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">
            Powered by GPT-4o mini · {currentMode.label} for <span className="text-foreground font-mono">{owner}/{repo}</span>
          </span>
        </div>
        <Button
          onClick={generate}
          disabled={loading}
          size="sm"
          className="gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white border-0 shrink-0"
        >
          {loading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
            : <><Sparkles className="w-3.5 h-3.5" /> Generate</>}
        </Button>
      </div>

      {/* Output */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {narrative && (
        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-2">
                <currentMode.icon className={`w-4 h-4 ${
                  currentMode.color === "blue" ? "text-blue-400"
                  : currentMode.color === "green" ? "text-green-400"
                  : "text-violet-400"
                }`} />
                <Badge className={`text-[10px] border ${
                  currentMode.color === "blue" ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                  : currentMode.color === "green" ? "bg-green-500/10 text-green-400 border-green-500/30"
                  : "bg-violet-500/10 text-violet-400 border-violet-500/30"
                }`}>
                  {currentMode.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={generate}
                  disabled={loading}
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={copy}
                >
                  {copied
                    ? <><Check className="w-3 h-3 mr-1 text-green-400" /> Copied</>
                    : <><Copy className="w-3 h-3 mr-1" /> Copy</>}
                </Button>
              </div>
            </div>
            <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans">
              {narrative}
            </div>
          </CardContent>
        </Card>
      )}

      {!narrative && !loading && !error && (
        <Card className="border-border/40 bg-card/50 border-dashed">
          <CardContent className="pt-8 pb-8 text-center">
            <Sparkles className="w-8 h-8 text-violet-400/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Select a format above and click <span className="text-foreground font-medium">Generate</span> to create your narrative.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
