import { useState } from "react";
import { useLocation } from "wouter";
import { useValidateGithubRepo } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContourLines } from "@/components/contour-lines";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, ArrowRight, Github, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [url, setUrl] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const validateMutation = useValidateGithubRepo();
  const [showPicker, setShowPicker] = useState(false);
  const [repos, setRepos] = useState<any[]>([]);
  const [owner, setOwner] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    validateMutation.mutate(
      { data: { url } },
      {
        onSuccess: (data) => {
          if (!data.valid) {
            toast({
              title: "Invalid URL",
              description: data.message || "Please enter a valid GitHub URL.",
              variant: "destructive",
            });
            return;
          }

          if (data.type === "profile" && data.repos && data.repos.length > 0) {
            setRepos(data.repos);
            setOwner(data.owner!);
            setShowPicker(true);
          } else if (data.owner && data.repo) {
            setLocation(`/choose?owner=${data.owner}&repo=${data.repo}`);
          }
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to reach GitHub. Please check your connection and try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleSelectRepo = (repoName: string) => {
    setShowPicker(false);
    setLocation(`/choose?owner=${owner}&repo=${repoName}`);
  };

  return (
    <div className="relative min-h-[100dvh] w-full bg-background overflow-hidden flex items-center">
      <ContourLines />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 25% 45%, rgba(91,120,245,0.12) 0%, transparent 70%), " +
            "radial-gradient(ellipse 55% 45% at 65% 75%, rgba(43,191,184,0.07) 0%, transparent 60%), " +
            "radial-gradient(ellipse 40% 30% at 80% 20%, rgba(91,120,245,0.05) 0%, transparent 50%)",
        }}
      />

      <div className="relative z-10 w-full max-w-4xl mx-auto px-6 lg:px-12 flex flex-col justify-center">

        <div className="mb-5 flex items-center gap-2.5">
          <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            GitHub Intelligence
          </span>
        </div>

        <h1
          className="font-display text-white mb-6 leading-[0.95]"
          style={{ textShadow: "0 0 100px rgba(91,120,245,0.30)" }}
        >
          Welcome.
        </h1>

        <p className="text-xl text-muted-foreground mb-10 max-w-lg leading-relaxed font-light">
          Paste any GitHub repository or profile link to instantly unlock deep
          structural analysis, commit patterns, and codebase insights.
        </p>

        <form onSubmit={handleSubmit} className="relative w-full max-w-2xl flex items-center">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste your GitHub profile or repo URL here"
            className="w-full h-16 pl-7 pr-40 rounded-2xl bg-card border border-border text-[15px] text-white placeholder:text-muted-foreground/50 shadow-xl focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/40 transition-all"
            data-testid="input-github-url"
          />
          <Button
            type="submit"
            size="lg"
            className="absolute right-2 h-12 rounded-xl px-7 bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg shadow-primary/20 transition-all text-[15px]"
            disabled={validateMutation.isPending}
            data-testid="button-submit-url"
          >
            {validateMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Next"
            )}
          </Button>
        </form>

        <div className="mt-7 flex items-center gap-6">
          {["Repo Analysis", "Commit Patterns", "Dependency Map"].map((label) => (
            <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              {label}
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-center gap-4 w-full max-w-2xl">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs font-medium text-muted-foreground/60 shrink-0 tracking-wide">or jump straight to</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={() => setLocation("/narrative")}
          className="mt-4 w-full max-w-2xl group flex items-center gap-4 px-5 py-4 rounded-2xl border border-border bg-card hover:bg-primary/5 hover:border-primary/40 transition-all duration-300 text-left"
        >
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-white leading-tight">AI Narrative Generator</p>
            <p className="text-sm text-muted-foreground mt-0.5">Release notes · Standup updates · Portfolio descriptions — no repo needed</p>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0 tracking-wide">
            NEW
          </span>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
        </button>
      </div>

      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-white">Select a Repository</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Found repositories for <span className="text-violet-400 font-medium">{owner}</span>. Which one would you like to analyse?
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 mt-4 custom-scrollbar">
            {repos.map((repo) => (
              <button
                key={repo.name}
                onClick={() => handleSelectRepo(repo.name)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-violet-500/10 border border-white/8 hover:border-violet-500/40 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <Github className="w-4 h-4 text-violet-400" />
                  <div>
                    <div className="font-semibold text-white text-sm">{repo.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                      {repo.description || "No description provided."}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-violet-400 transition-colors" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
