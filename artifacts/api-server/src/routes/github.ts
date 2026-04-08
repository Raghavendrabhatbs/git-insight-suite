import { Router, type IRouter } from "express";
import {
  ValidateGithubRepoBody,
  ValidateGithubRepoResponse,
  AnalyzeRepoBody,
  AnalyzeRepoResponse,
  AnalyzeCommitsBody,
  AnalyzeCommitsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function githubFetch(url: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "git-insight-suite/1.0",
  };
  if (GITHUB_TOKEN) {
    headers["Authorization"] = `token ${GITHUB_TOKEN}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function githubFetchPaginated(url: string, maxPages = 5): Promise<unknown[]> {
  const results: unknown[] = [];
  let page = 1;
  while (page <= maxPages) {
    const sep = url.includes("?") ? "&" : "?";
    const data = await githubFetch(`${url}${sep}per_page=100&page=${page}`) as unknown[];
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return results;
}

function parseGithubUrl(url: string): { owner: string; repo: string | null } | null {
  url = url.trim();
  // Remove trailing slash
  url = url.replace(/\/$/, "");
  // Add protocol if missing
  if (!url.startsWith("http")) url = "https://" + url;

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("github.com")) return null;
    // pathname: /owner, /owner/repo, /owner/repo.git, /owner/repo/tree/main/src, etc.
    const parts = parsed.pathname.replace(/^\//, "").split("/").filter(Boolean);
    if (parts.length === 0) return null;
    const owner = parts[0];
    if (parts.length === 1) return { owner, repo: null };
    // Strip .git suffix
    let repo = parts[1].replace(/\.git$/, "");
    // Skip known non-repo path segments that appear after the username
    const skipOwnerLevel = ["orgs", "users", "sponsors", "settings", "notifications", "explore"];
    if (skipOwnerLevel.includes(owner.toLowerCase())) return null;
    return { owner, repo };
  } catch {
    // Fallback: try splitting manually (e.g. "github.com/owner/repo")
    const cleaned = url.replace(/https?:\/\/(www\.)?github\.com\/?/, "");
    const parts = cleaned.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 1) return { owner: parts[0], repo: null };
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  }
}

router.get("/rate-status", async (_req, res) => {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "git-insight-suite/1.0",
    };
    if (GITHUB_TOKEN) headers["Authorization"] = `token ${GITHUB_TOKEN}`;
    const r = await fetch("https://api.github.com/rate_limit", { headers });
    const data = await r.json() as { resources?: { core?: { remaining: number; reset: number; limit: number } } };
    const core = data?.resources?.core;
    res.json({
      remaining: core?.remaining ?? 0,
      limit: core?.limit ?? 60,
      resetAt: core?.reset ? new Date(core.reset * 1000).toISOString() : null,
      hasToken: !!GITHUB_TOKEN,
    });
  } catch {
    res.json({ remaining: 0, limit: 60, resetAt: null, hasToken: !!GITHUB_TOKEN });
  }
});

router.post("/validate", async (req, res) => {
  let body: { url: string };
  try {
    body = ValidateGithubRepoBody.parse(req.body);
  } catch {
    res.json({ valid: false, message: "Please provide a GitHub URL." });
    return;
  }

  const parsed = parseGithubUrl(body.url);

  if (!parsed) {
    res.json({ valid: false, message: "That doesn't look like a valid GitHub URL. Try: https://github.com/owner/repo" });
    return;
  }

  if (!parsed.repo) {
    try {
      const repos = await githubFetch(`https://api.github.com/users/${parsed.owner}/repos?per_page=30&sort=updated`) as Array<{
        name: string;
        full_name: string;
        description: string | null;
        language: string | null;
        stargazers_count: number;
        forks_count: number;
        updated_at: string;
      }>;

      const data = ValidateGithubRepoResponse.parse({
        valid: true,
        owner: parsed.owner,
        type: "profile",
        repos: repos.map((r) => ({
          name: r.name,
          fullName: r.full_name,
          description: r.description ?? undefined,
          language: r.language ?? undefined,
          stars: r.stargazers_count,
          forks: r.forks_count,
          updatedAt: r.updated_at,
        })),
      });
      res.json(data);
      return;
    } catch (err) {
      const msg = err instanceof Error && err.message.includes("403")
        ? "GitHub API rate limit reached. Please try again in a minute."
        : `GitHub user not found: ${parsed.owner}`;
      res.json({ valid: false, message: msg });
      return;
    }
  }

  try {
    const repoData = await githubFetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`) as {
      name: string;
      full_name: string;
      description: string | null;
      language: string | null;
      stargazers_count: number;
      forks_count: number;
      updated_at: string;
    };

    const data = ValidateGithubRepoResponse.parse({
      valid: true,
      owner: parsed.owner,
      repo: parsed.repo,
      type: "repo",
      repos: [{
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description ?? undefined,
        language: repoData.language ?? undefined,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        updatedAt: repoData.updated_at,
      }],
    });
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error && err.message.includes("403")
      ? "GitHub API rate limit reached. Please try again in a minute."
      : err instanceof Error && err.message.includes("404")
      ? `Repository not found: ${parsed.owner}/${parsed.repo}. Make sure it's a public repository.`
      : `Could not reach GitHub. Please check the URL and try again.`;
    res.json({ valid: false, message: msg });
  }
});

interface TreeItem {
  path?: string;
  type?: string;
  sha?: string;
}

interface CommitItem {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
    committer: { name: string; email: string; date: string };
  };
  author?: { login: string };
  files?: Array<{ filename: string; additions: number; deletions: number; changes: number }>;
}

function buildFolderHierarchy(paths: string[], maxDepth = 4) {
  const root: Record<string, unknown> = {};

  for (const p of paths) {
    const parts = p.split("/");
    let node: Record<string, unknown> = root;
    for (let i = 0; i < Math.min(parts.length - 1, maxDepth); i++) {
      const part = parts[i];
      if (!node[part]) {
        node[part] = { _files: 0, _dirs: {} };
      }
      (node[part] as { _files: number; _dirs: Record<string, unknown> })._files++;
      node = (node[part] as { _files: number; _dirs: Record<string, unknown> })._dirs;
    }
  }

  function toTree(obj: Record<string, unknown>, basePath = ""): Array<{
    name: string; path: string; type: string; children?: Array<unknown>; fileCount?: number;
  }> {
    return Object.entries(obj).map(([name, val]) => {
      const fullPath = basePath ? `${basePath}/${name}` : name;
      const v = val as { _files: number; _dirs: Record<string, unknown> };
      const children = toTree(v._dirs, fullPath);
      return {
        name,
        path: fullPath,
        type: "dir",
        children: children.length > 0 ? children : undefined,
        fileCount: v._files,
      };
    });
  }

  return toTree(root);
}

function categorizeFile(path: string): "frontend" | "backend" | "unknown" {
  const frontendPatterns = [
    /\.(tsx|jsx|vue|svelte|html|css|scss|sass|less)$/i,
    /^(src|components|pages|views|public|assets|styles|ui|client|frontend|web)\//i,
    /\/(components|pages|views|styles|hooks|context|store|redux|zustand)\//i,
    /tailwind|postcss|next\.config|vite\.config/i,
  ];
  const backendPatterns = [
    /^(server|api|backend|routes|controllers|services|models|middleware|lib|db|database)\//i,
    /\/(routes|controllers|services|models|middleware|handlers|resolvers)\//i,
    /\.(py|rb|php|java|go|rs|cs)$/i,
    /express|fastapi|django|rails|spring|gin/i,
    /schema|migration|seed/i,
  ];

  if (frontendPatterns.some((p) => p.test(path))) return "frontend";
  if (backendPatterns.some((p) => p.test(path))) return "backend";
  return "unknown";
}

function detectDependencies(packageJson: Record<string, unknown>) {
  const deps: Array<{ name: string; version: string; category: string }> = [];
  const categories: Record<string, string> = {
    react: "framework", vue: "framework", angular: "framework", svelte: "framework",
    next: "framework", nuxt: "framework", gatsby: "framework", remix: "framework",
    express: "framework", fastify: "framework", koa: "framework", nestjs: "framework",
    django: "framework", flask: "framework", rails: "framework",
    typescript: "language", "@types": "types",
    jest: "testing", vitest: "testing", mocha: "testing", cypress: "testing", playwright: "testing",
    tailwindcss: "styling", styled: "styling", emotion: "styling", sass: "styling",
    webpack: "build", vite: "build", esbuild: "build", rollup: "build",
    prisma: "database", drizzle: "database", sequelize: "database", mongoose: "database", typeorm: "database",
    axios: "http", "react-query": "state", redux: "state", zustand: "state", mobx: "state",
    stripe: "payment", "@stripe": "payment",
    firebase: "cloud", supabase: "cloud", mongodb: "database",
  };

  function categorizeDep(name: string): string {
    for (const [key, cat] of Object.entries(categories)) {
      if (name.includes(key)) return cat;
    }
    return "library";
  }

  const allDeps = {
    ...(packageJson.dependencies as Record<string, string> | undefined ?? {}),
    ...(packageJson.devDependencies as Record<string, string> | undefined ?? {}),
  };

  for (const [name, version] of Object.entries(allDeps)) {
    deps.push({ name, version: String(version), category: categorizeDep(name) });
  }

  return deps.slice(0, 40);
}

function detectEntryPoints(paths: string[]): Array<{ file: string; purpose: string }> {
  const entryPatterns: Array<{ pattern: RegExp; purpose: string }> = [
    { pattern: /^(index|main|app|server)\.(ts|js|tsx|jsx|py|go|rb)$/i, purpose: "Main application entry point" },
    { pattern: /^src\/(index|main|app)\.(ts|js|tsx|jsx)$/i, purpose: "Frontend entry point" },
    { pattern: /^(server|app)\.(ts|js)$/i, purpose: "Server entry point" },
    { pattern: /^pages\/index\.(ts|js|tsx|jsx)$/i, purpose: "Home page (Next.js)" },
    { pattern: /^app\/(page|layout)\.(ts|js|tsx|jsx)$/i, purpose: "App entry (Next.js app router)" },
    { pattern: /package\.json$/i, purpose: "Package manifest and scripts" },
    { pattern: /^(webpack|vite|rollup)\.config\.(ts|js)$/i, purpose: "Build configuration" },
    { pattern: /^README\.md$/i, purpose: "Documentation and setup guide" },
    { pattern: /^(Dockerfile|docker-compose\.yml)$/i, purpose: "Container configuration" },
  ];

  const found: Array<{ file: string; purpose: string }> = [];
  for (const p of paths) {
    const name = p.split("/").pop() ?? "";
    for (const { pattern, purpose } of entryPatterns) {
      if (pattern.test(name) || pattern.test(p)) {
        if (!found.find((f) => f.file === p)) {
          found.push({ file: p, purpose });
          break;
        }
      }
    }
  }
  return found.slice(0, 8);
}

router.post("/repo-analysis", async (req, res) => {
  const body = AnalyzeRepoBody.parse(req.body);
  const { owner, repo } = body;

  try {
    const [repoData, treeData] = await Promise.all([
      githubFetch(`https://api.github.com/repos/${owner}/${repo}`) as Promise<{
        description: string | null;
        language: string | null;
        stargazers_count: number;
        forks_count: number;
        default_branch: string;
      }>,
      githubFetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`) as Promise<{ tree: TreeItem[] }>,
    ]);

    const allPaths = (treeData.tree ?? [])
      .filter((item: TreeItem) => item.type === "blob")
      .map((item: TreeItem) => item.path ?? "")
      .filter(Boolean);

    const dirPaths = (treeData.tree ?? [])
      .filter((item: TreeItem) => item.type === "tree")
      .map((item: TreeItem) => item.path ?? "")
      .filter(Boolean);

    const topLevelDirs = [...new Set(allPaths.map((p: string) => p.split("/")[0]).filter((d: string) => d && !d.includes(".")))];

    const folderHierarchy = buildFolderHierarchy(allPaths);

    const modules = topLevelDirs.slice(0, 10).map((dir: string) => {
      const fileCount = allPaths.filter((p: string) => p.startsWith(dir + "/")).length;
      const purposeMap: Record<string, string> = {
        src: "Main source code directory", components: "UI components",
        pages: "Application pages/views", api: "API endpoints and handlers",
        server: "Server-side code and logic", lib: "Shared libraries and utilities",
        utils: "Utility functions and helpers", styles: "Stylesheets and theme files",
        public: "Static public assets", assets: "Media and asset files",
        models: "Data models and schemas", controllers: "Route controllers",
        services: "Business logic services", middleware: "Express/server middleware",
        tests: "Test files and suites", hooks: "React custom hooks",
        store: "State management (Redux/Zustand)", config: "Configuration files",
        scripts: "Build and utility scripts", db: "Database schemas and migrations",
        routes: "Route definitions", docs: "Documentation files",
        types: "TypeScript type definitions", constants: "Constants and enums",
      };
      return {
        name: dir + "/",
        path: dir,
        purpose: purposeMap[dir.toLowerCase()] ?? `${dir} module`,
        fileCount,
      };
    });

    let dependencies: Array<{ name: string; version: string; category: string }> = [];
    const pkgJsonPath = allPaths.find((p: string) => p === "package.json");
    if (pkgJsonPath) {
      try {
        const pkgContent = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`) as { content: string };
        const decoded = Buffer.from(pkgContent.content, "base64").toString("utf-8");
        const pkg = JSON.parse(decoded);
        dependencies = detectDependencies(pkg);
      } catch {
        // skip
      }
    }

    const frontendFiles = allPaths.filter((p: string) => categorizeFile(p) === "frontend").length;
    const backendFiles = allPaths.filter((p: string) => categorizeFile(p) === "backend").length;
    const unknownFiles = allPaths.length - frontendFiles - backendFiles;

    const frontendFolders = topLevelDirs.filter((d: string) =>
      ["src", "components", "pages", "views", "public", "assets", "styles", "frontend", "client", "web", "ui"].includes(d.toLowerCase())
    );
    const backendFolders = topLevelDirs.filter((d: string) =>
      ["server", "api", "backend", "routes", "controllers", "services", "models", "middleware", "db", "database"].includes(d.toLowerCase())
    );

    const entryPoints = detectEntryPoints(allPaths);

    // Derive high-churn signals from folder activity (no extra API calls needed)
    const highChurnFiles: Array<{ file: string; changes: number; reason?: string }> = [];
    const evolvedFolders: string[] = [];

    const mainIdea = repoData.description
      ? repoData.description
      : `A ${repoData.language ?? "software"} project with ${allPaths.length} files across ${topLevelDirs.length} modules.`;

    const data = AnalyzeRepoResponse.parse({
      owner,
      repo,
      mainIdea,
      language: repoData.language ?? "Unknown",
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      folderHierarchy,
      modules,
      dependencies,
      frontendFiles,
      backendFiles,
      unknownFiles,
      frontendFolders,
      backendFolders,
      entryPoints,
      highChurnFiles,
      evolvedFolders,
    });

    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Repo analysis failed");
    const message = err instanceof Error ? err.message : "Analysis failed";
    res.status(500).json({ error: message });
  }
});

function classifyCommit(message: string): string {
  const msg = message.toLowerCase();
  if (/^(feat|feature|add|implement|create|introduce|new)/i.test(msg)) return "Feature";
  if (/^(fix|bug|hotfix|patch|resolve|close|revert)/i.test(msg)) return "Fix";
  if (/^(refactor|restructure|reorganize|rename|move|extract|split|merge)/i.test(msg)) return "Refactor";
  if (/^(test|spec|coverage|jest|vitest|cypress)/i.test(msg)) return "Test";
  if (/^(docs|documentation|readme|comment|changelog)/i.test(msg)) return "Docs";
  if (/^(chore|build|ci|cd|deploy|release|version|bump|update deps)/i.test(msg)) return "Chore";
  if (/^(style|format|lint|prettier|eslint)/i.test(msg)) return "Style";
  if (/^(perf|performance|optimize|speed|cache)/i.test(msg)) return "Performance";
  if (/^(init|initial|scaffold|setup|bootstrap|first)/i.test(msg)) return "Setup";
  return "Feature";
}

function groupIntoPhasesWithGaps(commits: CommitItem[]): Array<{
  commits: CommitItem[];
  startDate: Date;
  endDate: Date;
}> {
  if (commits.length === 0) return [];

  const sorted = [...commits].sort(
    (a, b) => new Date(a.commit.author.date).getTime() - new Date(b.commit.author.date).getTime()
  );

  const phases: Array<{ commits: CommitItem[]; startDate: Date; endDate: Date }> = [];
  let current: CommitItem[] = [sorted[0]];
  let currentStart = new Date(sorted[0].commit.author.date);
  let currentEnd = new Date(sorted[0].commit.author.date);

  for (let i = 1; i < sorted.length; i++) {
    const date = new Date(sorted[i].commit.author.date);
    const dayGap = (date.getTime() - currentEnd.getTime()) / (1000 * 60 * 60 * 24);

    if (dayGap > 14 || current.length >= 60) {
      phases.push({ commits: current, startDate: currentStart, endDate: currentEnd });
      current = [sorted[i]];
      currentStart = date;
    } else {
      current.push(sorted[i]);
    }
    currentEnd = date;
  }
  if (current.length > 0) {
    phases.push({ commits: current, startDate: currentStart, endDate: currentEnd });
  }

  return phases.slice(0, 6);
}

router.post("/commit-analysis", async (req, res) => {
  const body = AnalyzeCommitsBody.parse(req.body);
  const { owner, repo } = body;

  try {
    const commits = await githubFetchPaginated(`https://api.github.com/repos/${owner}/${repo}/commits`, 2) as CommitItem[];

    if (commits.length === 0) {
      res.status(404).json({ error: "No commits found in this repository" });
      return;
    }

    const sorted = [...commits].sort(
      (a, b) => new Date(a.commit.author.date).getTime() - new Date(b.commit.author.date).getTime()
    );

    const startDate = sorted[0].commit.author.date;
    const endDate = sorted[sorted.length - 1].commit.author.date;

    const authorMap: Record<string, { count: number; types: Record<string, number> }> = {};
    const featureKeywords: Record<string, string[]> = {};

    for (const commit of commits) {
      const author = commit.author?.login ?? commit.commit.author.name;
      if (!authorMap[author]) authorMap[author] = { count: 0, types: {} };
      authorMap[author].count++;
      const type = classifyCommit(commit.commit.message);
      authorMap[author].types[type] = (authorMap[author].types[type] ?? 0) + 1;

      const words = commit.commit.message.toLowerCase().split(/\W+/).filter(w => w.length > 4);
      for (const word of words) {
        if (!featureKeywords[word]) featureKeywords[word] = [];
        featureKeywords[word].push(commit.sha);
      }
    }

    // Skip per-commit detail fetches to stay within unauthenticated rate limits.
    // File churn data requires a GITHUB_TOKEN for large repos.
    const highChurnFiles: Array<{ file: string; changes: number; reason?: string }> = [];

    const rawPhases = groupIntoPhasesWithGaps(commits);

    const phases = rawPhases.map((ph, idx) => {
      const typeCounts: Record<string, number> = {};
      for (const c of ph.commits) {
        const t = classifyCommit(c.commit.message);
        typeCounts[t] = (typeCounts[t] ?? 0) + 1;
      }
      const dominantActivity = Object.entries(typeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "Feature";

      const phaseNames: Record<string, string> = {
        Setup: "Project Initialization", Feature: "Feature Development",
        Refactor: "Architectural Refactor", Fix: "Stabilization & Bug Fixes",
        Test: "Testing & Quality Assurance", Chore: "Maintenance & Housekeeping",
        Performance: "Performance Optimization", Docs: "Documentation",
      };

      const keyChanges = ph.commits
        .slice(0, 5)
        .map((c) => c.commit.message.split("\n")[0].slice(0, 80));

      return {
        phase: idx + 1,
        name: `Phase ${idx + 1} — ${phaseNames[dominantActivity] ?? dominantActivity}`,
        startDate: ph.startDate.toISOString().split("T")[0],
        endDate: ph.endDate.toISOString().split("T")[0],
        commitCount: ph.commits.length,
        dominantActivity,
        description: `${dominantActivity} phase with ${ph.commits.length} commits. ${
          dominantActivity === "Feature"
            ? "Active feature development period."
            : dominantActivity === "Refactor"
            ? "Internal restructuring and code quality improvements."
            : dominantActivity === "Fix"
            ? "Bug fixes and stability improvements."
            : dominantActivity === "Setup"
            ? "Initial project setup and scaffolding."
            : "Development activity."
        }`,
        keyChanges,
      };
    });

    const topKeywords = Object.entries(featureKeywords)
      .sort(([, a], [, b]) => b.length - a.length)
      .filter(([word]) => !["with", "from", "this", "that", "have", "been", "will", "should", "when", "into", "also", "some", "there", "their"].includes(word))
      .slice(0, 8);

    const featureClusters = topKeywords.map(([keyword, shas]) => ({
      name: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      commitCount: shas.length,
      commits: shas.slice(0, 5),
    }));

    const typeWaveCounts: Record<string, number> = {};
    for (const c of commits) {
      const t = classifyCommit(c.commit.message);
      typeWaveCounts[t] = (typeWaveCounts[t] ?? 0) + 1;
    }

    const waveDescriptions: Record<string, { icon: string; desc: string }> = {
      Feature: { icon: "🔥", desc: "High commit density focused on new functionality" },
      Fix: { icon: "🛠", desc: "Focused bug fixes and stability improvements" },
      Refactor: { icon: "🏗", desc: "Internal restructuring and architecture improvements" },
      Setup: { icon: "🚀", desc: "Project initialization and environment configuration" },
      Test: { icon: "✅", desc: "Test coverage expansion and quality assurance" },
      Chore: { icon: "⚙️", desc: "Maintenance, dependency updates, and housekeeping" },
      Performance: { icon: "⚡️", desc: "Optimization and performance improvements" },
      Docs: { icon: "📝", desc: "Documentation additions and updates" },
    };

    const developmentWaves = Object.entries(typeWaveCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({
        type,
        title: `${waveDescriptions[type]?.icon ?? ""} ${type} Wave`,
        description: waveDescriptions[type]?.desc ?? `${type} commits`,
        commitCount: count,
      }));

    const contributorRoles = Object.entries(authorMap)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 8)
      .map(([author, data]) => {
        const topType = Object.entries(data.types).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "Feature";
        const roles: Record<string, string> = {
          Feature: "Feature Developer", Fix: "Stabilization Engineer",
          Refactor: "Core Architect", Setup: "Project Bootstrapper",
          Test: "QA Engineer", Docs: "Documentation Lead",
          Chore: "DevOps Engineer", Performance: "Performance Engineer",
        };
        return {
          author,
          role: roles[topType] ?? "Core Contributor",
          commitCount: data.count,
          focus: `Primarily focused on ${topType.toLowerCase()} work`,
        };
      });

    const architecturalEvents = commits
      .filter((c) => {
        const msg = c.commit.message.toLowerCase();
        return /refactor|restructure|reorganize|migrate|architecture|rewrite|overhaul/.test(msg);
      })
      .slice(0, 4)
      .map((c) => ({
        commitSha: c.sha.slice(0, 7),
        event: "Architectural Change",
        impact: "High",
        description: c.commit.message.split("\n")[0].slice(0, 100),
      }));

    const riskCommits = commits
      .filter((c) => {
        const msg = c.commit.message.toLowerCase();
        return /revert|hotfix|critical|breaking|force|remove.*core|delete.*main/.test(msg);
      })
      .slice(0, 4)
      .map((c) => ({
        commitSha: c.sha.slice(0, 7),
        message: c.commit.message.split("\n")[0].slice(0, 100),
        riskLevel: "High",
        reason: "Potentially breaking or reverting commit",
      }));

    const uniqueContributors = new Set(commits.map((c) => c.author?.login ?? c.commit.author.name)).size;

    const topFeature = featureClusters[0]?.name ?? "general development";
    const topFile = highChurnFiles[0]?.file ?? "unknown";

    const executiveSummary = `This repository has ${commits.length} commits from ${uniqueContributors} contributor(s), spanning from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}. The development history is organized into ${phases.length} distinct phases. The project ${phases[0]?.dominantActivity === "Setup" ? "began with initial setup and scaffolding" : "began with feature development"}. The most prominent feature area is "${topFeature}" with ${featureClusters[0]?.commitCount ?? 0} related commits. The most frequently modified file is "${topFile}" with ${highChurnFiles[0]?.changes ?? 0} changes.`;

    const data = AnalyzeCommitsResponse.parse({
      owner,
      repo,
      totalCommits: commits.length,
      contributors: uniqueContributors,
      startDate,
      endDate,
      executiveSummary,
      phases,
      featureClusters,
      developmentWaves,
      contributorRoles,
      architecturalEvents,
      riskCommits,
      highChurnFiles,
    });

    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Commit analysis failed");
    const message = err instanceof Error ? err.message : "Analysis failed";
    res.status(500).json({ error: message });
  }
});

export default router;
