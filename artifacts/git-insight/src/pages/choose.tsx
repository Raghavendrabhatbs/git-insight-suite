import { useLocation, useSearch } from "wouter";
import { GitBranch, GitCommit, ArrowLeft, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChooseAnalysis() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const owner = params.get("owner");
  const repo = params.get("repo");

  if (!owner || !repo) {
    setLocation("/");
    return null;
  }

  const cards = [
    {
      id: "repo-analysis",
      icon: GitBranch,
      title: "Repo Analyser",
      desc: "Analyze repository structure, folder hierarchy, dependencies, modules, and backend/frontend separation. Discover entry points and high-churn areas.",
      cta: "Start Analysis",
      accent: "primary",
      accentHex: "91,120,245",
      onClick: () => setLocation(`/repo-analysis?owner=${owner}&repo=${repo}`),
    },
    {
      id: "commit-analysis",
      icon: GitCommit,
      title: "Commit Analyser",
      desc: "Deep-dive into commit history. Discover development phases, feature clusters, contributor roles, architectural events, and risk commits.",
      cta: "Start Analysis",
      accent: "secondary",
      accentHex: "43,191,184",
      onClick: () => setLocation(`/commit-analysis?owner=${owner}&repo=${repo}`),
    },
    {
      id: "narrative",
      icon: Sparkles,
      title: "AI Narrative",
      desc: "Convert technical data into polished release notes, standup updates, and resume-ready portfolio descriptions — powered by GPT-4o.",
      cta: "Generate Content",
      accent: "violet",
      accentHex: "139,92,246",
      badge: "NEW",
      onClick: () => setLocation(`/narrative?owner=${owner}&repo=${repo}`),
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-10">
        <Button
          variant="ghost"
          className="mb-10 text-muted-foreground hover:text-foreground -ml-2"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="mb-12">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase mb-3">Choose Analysis</p>
          <h1 className="text-white mb-3">What do you want to explore?</h1>
          <p className="text-muted-foreground text-lg">
            Analysing{" "}
            <span className="text-primary font-medium font-mono text-base">
              github.com/{owner}/{repo}
            </span>
          </p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {cards.map((card) => {
            const Icon = card.icon;
            const isAccentPrimary = card.accent === "primary";
            const isAccentSecondary = card.accent === "secondary";
            const colorClass = isAccentPrimary ? "text-primary" : isAccentSecondary ? "text-secondary" : "text-violet-400";
            const bgClass = isAccentPrimary ? "bg-primary/10" : isAccentSecondary ? "bg-secondary/10" : "bg-violet-500/10";
            const hoverBorderClass = isAccentPrimary
              ? "hover:border-primary/60"
              : isAccentSecondary
              ? "hover:border-secondary/60"
              : "hover:border-violet-500/60";
            const shadowStyle = { "--shadow-hex": card.accentHex } as React.CSSProperties;

            return (
              <div
                key={card.id}
                className={`group relative bg-card border border-border rounded-2xl p-7 cursor-pointer transition-all duration-300 ${hoverBorderClass} ${
                  card.id === "narrative" ? "md:col-span-2 xl:col-span-1" : ""
                }`}
                style={shadowStyle}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 40px -8px rgba(${card.accentHex},0.25)`)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "")}
                onClick={card.onClick}
                data-testid={`card-${card.id}`}
              >
                {card.badge && (
                  <span className="absolute top-5 right-5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25 tracking-wide">
                    {card.badge}
                  </span>
                )}

                <div className={`w-14 h-14 rounded-2xl ${bgClass} flex items-center justify-center mb-6`}>
                  <Icon className={`w-7 h-7 ${colorClass}`} />
                </div>

                <h3 className="text-white mb-3 font-bold tracking-tight">{card.title}</h3>

                <p className="text-muted-foreground text-sm leading-relaxed mb-7">
                  {card.desc}
                </p>

                <div className={`${colorClass} text-sm font-semibold flex items-center gap-1.5 group-hover:gap-3 transition-all`}>
                  {card.cta}
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
