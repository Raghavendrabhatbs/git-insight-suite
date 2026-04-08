import { useState } from "react";
import { useLocation } from "wouter";
import { useValidateGithubRepo } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContourLines } from "@/components/contour-lines";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, ArrowRight, Github } from "lucide-react";
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
    <div className="relative min-h-[100dvh] w-full bg-[#0a0a0f] overflow-hidden flex items-center">
      <ContourLines />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 30% 50%, rgba(124,58,237,0.13) 0%, transparent 70%), " +
            "radial-gradient(ellipse 50% 40% at 60% 80%, rgba(59,130,246,0.08) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 w-full max-w-4xl mx-auto px-6 lg:px-12 flex flex-col justify-center">

        <div className="mb-3 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-xs font-medium tracking-widest text-violet-400 uppercase">
            GitHub Intelligence
          </span>
        </div>

        <h1
          className="text-7xl lg:text-9xl font-bold tracking-tighter text-white mb-5 leading-none"
          style={{ textShadow: "0 0 80px rgba(124,58,237,0.35)" }}
        >
          Welcome.
        </h1>

        <p className="text-lg text-zinc-400 mb-10 max-w-lg leading-relaxed">
          Paste any GitHub repository or profile link to instantly unlock deep
          structural analysis, commit patterns, and codebase insights.
        </p>

        <form onSubmit={handleSubmit} className="relative w-full max-w-2xl flex items-center">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste Your Github Profile or Repo Here"
            className="w-full h-16 pl-6 pr-36 rounded-full bg-white/5 border border-white/10 text-base text-white placeholder:text-zinc-500 backdrop-blur-sm shadow-xl focus-visible:ring-2 focus-visible:ring-violet-500/70 focus-visible:border-violet-500/50 transition-all"
            data-testid="input-github-url"
          />
          <Button
            type="submit"
            size="lg"
            className="absolute right-2 h-12 rounded-full px-7 bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-lg shadow-violet-900/40 transition-all"
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

        <div className="mt-8 flex items-center gap-6">
          {["Repo Analysis", "Commit Patterns", "Dependency Map"].map((label) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500/60" />
              {label}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="sm:max-w-md bg-[#13131a] border-white/10">
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
