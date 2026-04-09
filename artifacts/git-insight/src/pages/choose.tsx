import { useLocation, useSearch } from "wouter";
import { GitBranch, GitCommit, ArrowLeft } from "lucide-react";
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

  return (
    <div className="min-h-[100dvh] bg-background text-foreground p-6 lg:p-12">
      <Button 
        variant="ghost" 
        className="mb-8 text-muted-foreground hover:text-white"
        onClick={() => setLocation("/")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <div className="max-w-5xl mx-auto mt-12">
        <h1 className="text-4xl font-bold mb-2">Choose Analysis</h1>
        <p className="text-xl text-muted-foreground mb-12">
          Analyzing: <span className="text-primary">github.com/{owner}/{repo}</span>
        </p>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          <div 
            className="group relative bg-card border border-border rounded-2xl p-8 cursor-pointer hover:border-primary transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(124,58,237,0.3)]"
            onClick={() => setLocation(`/repo-analysis?owner=${owner}&repo=${repo}`)}
            data-testid="card-repo-analysis"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
              <GitBranch className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-4 tracking-tight">REPO ANALYSER</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Analyze the repository structure, folder hierarchy, dependencies, modules, and backend/frontend separation. Discover entry points and high-churn areas.
            </p>
            <div className="text-primary font-medium flex items-center group-hover:translate-x-2 transition-transform">
              Start Analysis &gt;
            </div>
          </div>

          <div 
            className="group relative bg-card border border-border rounded-2xl p-8 cursor-pointer hover:border-secondary transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)]"
            onClick={() => setLocation(`/commit-analysis?owner=${owner}&repo=${repo}`)}
            data-testid="card-commit-analysis"
          >
            <div className="w-16 h-16 rounded-2xl bg-secondary/20 flex items-center justify-center mb-6">
              <GitCommit className="w-8 h-8 text-secondary" />
            </div>
            <h2 className="text-2xl font-bold mb-4 tracking-tight">COMMIT ANALYSER</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Deep-dive into the commit history. Discover development phases, feature clusters, contributor roles, architectural events, and risk commits.
            </p>
            <div className="text-secondary font-medium flex items-center group-hover:translate-x-2 transition-transform">
              Start Analysis &gt;
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
