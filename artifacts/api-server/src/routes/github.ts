import { Router, type IRouter } from "express";
import {
  ValidateGithubRepoBody,
  ValidateGithubRepoResponse,
  AnalyzeRepoBody,
  AnalyzeRepoResponse,
  AnalyzeCommitsBody,
  AnalyzeCommitsResponse,
  ExplainCommitBody,
  ExplainCommitResponse,
  RepoChatBody,
  RepoChatResponse,
  DeveloperIntelligenceBody,
  DeveloperIntelligenceResponse,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

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

async function getTotalCommitCount(owner: string, repo: string): Promise<number> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "git-insight-suite/1.0",
    };
    if (GITHUB_TOKEN) headers["Authorization"] = `token ${GITHUB_TOKEN}`;
    const r = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
      { headers },
    );
    const link = r.headers.get("Link") ?? "";
    const match = link.match(/page=(\d+)>;\s*rel="last"/);
    if (match) return parseInt(match[1], 10);
    const data = await r.json() as unknown[];
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
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
  author?: { login: string; avatar_url?: string };
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

    // Generate AI summary of the repository
    let aiSummary: string | undefined;
    try {
      const depNames = dependencies.slice(0, 12).map(d => d.name).join(", ");
      const moduleNames = modules.slice(0, 8).map(m => `${m.name} (${m.purpose})`).join(", ");
      const entryList = entryPoints.slice(0, 4).map(e => e.file).join(", ");
      const prompt = `You are a senior developer. Given the following metadata about a GitHub repository, write a clear 3–4 sentence plain-English summary of what this project is, what it does, who it's for, and what its tech stack looks like. Be specific and insightful — avoid generic statements like "this is a software project".

Repository: ${owner}/${repo}
Description: ${repoData.description ?? "none"}
Primary language: ${repoData.language ?? "unknown"}
Total files: ${allPaths.length}
Top-level modules: ${moduleNames || topLevelDirs.slice(0, 8).join(", ")}
Key dependencies: ${depNames || "none detected"}
Entry points: ${entryList || "none detected"}
Frontend files: ${frontendFiles}, Backend files: ${backendFiles}

Write only the summary paragraph, no headings or bullet points.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });
      const raw = response.choices[0]?.message?.content ?? "";
      aiSummary = raw.trim() || undefined;
    } catch {
      // AI summary is optional — silently skip on failure
    }

    const data = AnalyzeRepoResponse.parse({
      owner,
      repo,
      mainIdea,
      aiSummary,
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

interface CommitDetail {
  sha: string;
  message: string;
  author: string;
  date: string;
  filesChanged: string[];
  linesAdded: number;
  linesRemoved: number;
  patchSummary: string;
}

async function fetchCommitDiff(owner: string, repo: string, sha: string): Promise<CommitDetail | null> {
  try {
    const data = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`) as {
      sha: string;
      commit: { message: string; author: { name: string; date: string } };
      stats?: { additions: number; deletions: number };
      files?: Array<{ filename: string; additions: number; deletions: number; patch?: string }>;
    };

    const files = data.files ?? [];
    const filesChanged = files.map(f => f.filename);
    const linesAdded = data.stats?.additions ?? files.reduce((s, f) => s + f.additions, 0);
    const linesRemoved = data.stats?.deletions ?? files.reduce((s, f) => s + f.deletions, 0);

    // Build a concise patch summary (limit per file to avoid huge prompts)
    const patchSummary = files
      .slice(0, 8)
      .map(f => {
        const patch = f.patch ? f.patch.split("\n").slice(0, 20).join("\n") : "";
        return `  ${f.filename} (+${f.additions}/-${f.deletions}):\n${patch}`;
      })
      .join("\n---\n")
      .slice(0, 3000);

    return {
      sha: data.sha,
      message: data.commit.message.split("\n")[0].slice(0, 120),
      author: data.commit.author.name,
      date: data.commit.author.date,
      filesChanged,
      linesAdded,
      linesRemoved,
      patchSummary,
    };
  } catch {
    return null;
  }
}

async function generateCommitStories(details: CommitDetail[]): Promise<Record<string, string>> {
  if (details.length === 0) return {};

  const commitList = details
    .map((d, i) => {
      return `Commit ${i + 1} [sha: ${d.sha.slice(0, 7)}]
Message: "${d.message}"
Author: ${d.author} | Date: ${d.date}
Files changed (${d.filesChanged.length}): ${d.filesChanged.slice(0, 6).join(", ")}
Lines: +${d.linesAdded} / -${d.linesRemoved}
Diff preview:
${d.patchSummary || "(no diff available)"}`;
    })
    .join("\n\n=====\n\n");

  const prompt = `You are a senior developer reading a GitHub commit history. For each commit below, write a clear, concise 1–2 sentence plain-English explanation of what the developer actually BUILT or CHANGED — focusing on the real-world impact, not just repeating the commit message. Use active voice. Be specific about what functionality was added, removed, or fixed.

${commitList}

Respond with ONLY a valid JSON array. Each element must have:
- "sha": the 7-char sha shown above
- "summary": your 1–2 sentence plain-English explanation

Example format:
[{"sha":"abc1234","summary":"Added a login page with email/password fields and connected it to the authentication API."}]`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content ?? "[]";
    // Extract JSON from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return {};
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ sha: string; summary: string }>;
    const map: Record<string, string> = {};
    for (const item of parsed) {
      if (item.sha && item.summary) map[item.sha] = item.summary;
    }
    return map;
  } catch {
    return {};
  }
}

router.post("/commit-analysis", async (req, res) => {
  const body = AnalyzeCommitsBody.parse(req.body);
  const { owner, repo } = body;

  try {
    const [commits, realTotal] = await Promise.all([
      githubFetchPaginated(`https://api.github.com/repos/${owner}/${repo}/commits`, 10) as Promise<CommitItem[]>,
      getTotalCommitCount(owner, repo),
    ]);

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
    const featureKeywords: Record<string, string[]> = Object.create(null);

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

    // Fetch diffs for the 6 most recent commits for AI storytelling
    const recentCommits = [...commits]
      .sort((a, b) => new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime())
      .slice(0, 6);

    const commitDetails = (
      await Promise.all(recentCommits.map(c => fetchCommitDiff(owner, repo, c.sha)))
    ).filter((d): d is CommitDetail => d !== null);

    // Generate AI summaries for each commit in one batched call
    const aiSummaries = await generateCommitStories(commitDetails);

    // Build commitStories for the response
    const commitStories = commitDetails.map(d => ({
      sha: d.sha,
      shortSha: d.sha.slice(0, 7),
      message: d.message,
      author: d.author,
      date: d.date,
      type: classifyCommit(d.message),
      humanSummary: aiSummaries[d.sha.slice(0, 7)] ?? d.message,
      filesChanged: d.filesChanged.slice(0, 10),
      linesAdded: d.linesAdded,
      linesRemoved: d.linesRemoved,
    }));

    // Build high-churn files from fetched diffs
    const fileChangeCounts: Record<string, number> = {};
    for (const d of commitDetails) {
      for (const f of d.filesChanged) {
        fileChangeCounts[f] = (fileChangeCounts[f] ?? 0) + 1;
      }
    }
    const highChurnFiles = Object.entries(fileChangeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([file, changes]) => ({ file, changes }));

    const rawPhases = groupIntoPhasesWithGaps(commits);

    // Noise words to strip when extracting phase themes from commit messages
    const NOISE_WORDS = new Set([
      "fix","fixed","fixes","feat","chore","refactor","test","docs","style","perf","ci","build",
      "add","adds","added","remove","removed","update","updated","updates","bump","change","changes",
      "the","and","for","from","with","this","that","into","are","was","not","use","used",
      "improve","improved","handle","handles","allow","allows","support","supports","make","makes",
      "minor","major","misc","wip","merge","revert","release","version","patch","hotfix","temp",
      "when","will","have","been","also","some","more","just","only","back","base","move","pass",
      "correct","should","would","could","they","them","their","there","where","what","which",
    ]);

    // Derive a meaningful 2-word theme from the commit messages in a phase
    function extractPhaseTheme(phCommits: CommitItem[]): string {
      const wordFreq: Record<string, number> = Object.create(null);
      for (const c of phCommits) {
        const line = c.commit.message.split("\n")[0].toLowerCase();
        // Strip prefix like "fix:", "feat(scope):", PR numbers
        const cleaned = line.replace(/^[a-z]+(\([^)]*\))?!?:\s*/, "").replace(/#\d+/g, "").replace(/[^a-z\s]/g, " ");
        for (const word of cleaned.split(/\s+/)) {
          if (word.length < 4 || NOISE_WORDS.has(word)) continue;
          wordFreq[word] = (wordFreq[word] ?? 0) + 1;
        }
      }
      const topWords = Object.entries(wordFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));
      return topWords.length >= 2 ? topWords.slice(0, 2).join(" & ") : topWords[0] ?? "";
    }

    const phaseActivityNames: Record<string, string> = {
      Setup: "Project Initialization", Feature: "Feature Development",
      Refactor: "Architectural Refactor", Fix: "Stabilization & Bug Fixes",
      Test: "Testing & Quality Assurance", Chore: "Maintenance & Housekeeping",
      Performance: "Performance Optimization", Docs: "Documentation",
    };

    // Check whether all phases share the same dominant activity (monotone repo)
    const allDominants: string[] = [];

    const phases = rawPhases.map((ph, idx) => {
      const typeCounts: Record<string, number> = {};
      for (const c of ph.commits) {
        const t = classifyCommit(c.commit.message);
        typeCounts[t] = (typeCounts[t] ?? 0) + 1;
      }
      const dominantActivity = Object.entries(typeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "Feature";
      allDominants.push(dominantActivity);

      const keyChanges = ph.commits
        .slice(0, 5)
        .map((c) => c.commit.message.split("\n")[0].slice(0, 80));

      // Build a date label like "Feb–Mar 2026"
      const start = ph.startDate;
      const end = ph.endDate;
      const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short" });
      const yearFmt = new Intl.DateTimeFormat("en-US", { year: "numeric" });
      const startLabel = monthFmt.format(start);
      const endLabel = monthFmt.format(end);
      const yearLabel = yearFmt.format(end);
      const dateLabel = startLabel === endLabel
        ? `${startLabel} ${yearLabel}`
        : start.getFullYear() === end.getFullYear()
        ? `${startLabel}–${endLabel} ${yearLabel}`
        : `${startLabel} ${yearFmt.format(start)}–${endLabel} ${yearLabel}`;

      const theme = extractPhaseTheme(ph.commits);

      return {
        ph, idx, dominantActivity, keyChanges, dateLabel, theme,
        typeCounts, startDate: ph.startDate.toISOString().split("T")[0],
        endDate: ph.endDate.toISOString().split("T")[0], commitCount: ph.commits.length,
      };
    });

    const allSameDominant = allDominants.every(d => d === allDominants[0]);

    const builtPhases = phases.map(({ ph: _ph, idx, dominantActivity, keyChanges, dateLabel, theme, typeCounts, startDate, endDate, commitCount }) => {
      // If all phases share the same dominant type, use extracted keyword theme + date to differentiate
      let name: string;
      if (allSameDominant && theme) {
        name = `Phase ${idx + 1} — ${theme} · ${dateLabel}`;
      } else {
        const activityLabel = phaseActivityNames[dominantActivity] ?? dominantActivity;
        name = theme
          ? `Phase ${idx + 1} — ${activityLabel} · ${theme}`
          : `Phase ${idx + 1} — ${activityLabel} (${dateLabel})`;
      }

      // Build a richer description using type breakdown
      const pluralType = (type: string, count: number): string => {
        const t = type.toLowerCase();
        if (count <= 1) return t;
        if (t === "fix") return "fixes";
        if (t === "chore") return "chores";
        if (t === "refactor") return "refactors";
        return t + "s";
      };
      const typeBreakdown = Object.entries(typeCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([type, count]) => `${count} ${pluralType(type, count)}`)
        .join(", ");

      const description = `${commitCount} commits across ${dateLabel} — ${typeBreakdown}. ${
        dominantActivity === "Feature" ? "Active feature development period." :
        dominantActivity === "Refactor" ? "Internal restructuring and code quality improvements." :
        dominantActivity === "Fix" ? "Bug fixes and stability improvements." :
        dominantActivity === "Setup" ? "Initial project setup and scaffolding." :
        dominantActivity === "Test" ? "Testing and quality assurance work." :
        "General development activity."
      }`;

      return { phase: idx + 1, name, startDate, endDate, commitCount, dominantActivity, description, keyChanges };
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
        author: c.author?.login ?? c.commit.author.name,
        date: c.commit.author.date,
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
        author: c.author?.login ?? c.commit.author.name,
        date: c.commit.author.date,
      }));

    // ── Developer Contribution Intelligence ─────────────────────────────────
    interface AuthorIntel {
      commitCount: number;
      types: Record<string, number>;
      avatarUrl?: string;
      dates: Date[];
      files: Set<string>;
      linesAdded: number;
      linesRemoved: number;
    }
    const authorIntelMap2: Record<string, AuthorIntel> = Object.create(null);
    for (const c of commits) {
      const author = c.author?.login ?? c.commit.author.name;
      if (!authorIntelMap2[author]) {
        authorIntelMap2[author] = {
          commitCount: 0, types: {}, avatarUrl: c.author?.avatar_url,
          dates: [], files: new Set(), linesAdded: 0, linesRemoved: 0,
        };
      }
      const ai2 = authorIntelMap2[author];
      ai2.commitCount++;
      ai2.avatarUrl = ai2.avatarUrl ?? c.author?.avatar_url;
      const t2 = classifyCommit(c.commit.message);
      ai2.types[t2] = (ai2.types[t2] ?? 0) + 1;
      ai2.dates.push(new Date(c.commit.author.date));
    }
    for (const d of commitDetails) {
      const ai2 = authorIntelMap2[d.author];
      if (ai2) {
        for (const f of d.filesChanged) ai2.files.add(f);
        ai2.linesAdded += d.linesAdded;
        ai2.linesRemoved += d.linesRemoved;
      }
    }

    const modulePatterns: [RegExp, string][] = [
      [/\bauth\b|\blogin\b|\bsignup\b|\bpassword\b|\bsession\b|\btoken\b|\bjwt\b|\boauth\b/, "Authentication"],
      [/\bui\b|\bcomponent\b|\bbutton\b|\bmodal\b|\bstyle\b|\btheme\b|\bcss\b|\bdesign\b|\blayout\b|\bicon\b/, "UI & Components"],
      [/\bapi\b|\bbackend\b|\bserver\b|\bservice\b|\bcontroller\b|\broute\b|\bendpoint\b|\brest\b|\bgraphql\b/, "Backend / API"],
      [/\bdatabase\b|\bdb\b|\bmodel\b|\bmigration\b|\bschema\b|\bpostgres\b|\bmongo\b|\bsql\b|\bprisma\b/, "Database"],
      [/\btest\b|\bspec\b|\bjest\b|\bvitest\b|\bcypress\b|\bplaywright\b|\be2e\b/, "Testing"],
      [/\bdocs?\b|\breadme\b|\bchangelog\b|\bguide\b/, "Documentation"],
      [/\bdeploy\b|\bci\b|\bcd\b|\bworkflow\b|\bdocker\b|\bnix\b|\bkubernetes\b|\bk8s\b|\binfra\b/, "DevOps / CI"],
      [/\bperform\b|\boptimiz\b|\bcache\b|\bspeed\b|\bbundle\b/, "Performance"],
      [/\bpayment\b|\bstripe\b|\bbilling\b|\bsubscription\b/, "Payments"],
      [/\bdashboard\b|\bhome\b|\blanding\b|\bpage\b|\bnavigation\b|\bsidebar\b/, "Pages / Routes"],
      [/\bsearch\b|\bfilter\b|\bsort\b|\bquery\b/, "Search & Filtering"],
      [/\bnotif\b|\bemail\b|\bwebhook\b|\bevent\b/, "Notifications"],
    ];
    const authorModuleScores: Record<string, Record<string, number>> = Object.create(null);
    for (const c of commits) {
      const author = c.author?.login ?? c.commit.author.name;
      if (!authorModuleScores[author]) authorModuleScores[author] = Object.create(null);
      const scores = authorModuleScores[author];
      const msg = c.commit.message.toLowerCase();
      const scopeMatch = msg.match(/^[a-z]+\(([^)]+)\)/);
      if (scopeMatch) { const scope = scopeMatch[1]; scores[scope] = (scores[scope] ?? 0) + 2; }
      for (const [pattern, moduleName] of modulePatterns) {
        if (pattern.test(msg)) scores[moduleName] = (scores[moduleName] ?? 0) + 1;
      }
    }

    const fileAuthorsMap: Record<string, string[]> = Object.create(null);
    for (const d of commitDetails) {
      for (const f of d.filesChanged) {
        if (!fileAuthorsMap[f]) fileAuthorsMap[f] = [];
        if (!fileAuthorsMap[f].includes(d.author)) fileAuthorsMap[f].push(d.author);
      }
    }
    const collaborationMap2: Record<string, Set<string>> = Object.create(null);
    const sharedFilesMap: Record<string, string[]> = Object.create(null);
    for (const [file, fAuthors] of Object.entries(fileAuthorsMap)) {
      for (let i = 0; i < fAuthors.length; i++) {
        for (let j = i + 1; j < fAuthors.length; j++) {
          const a = fAuthors[i], b = fAuthors[j];
          if (!collaborationMap2[a]) collaborationMap2[a] = new Set();
          if (!collaborationMap2[b]) collaborationMap2[b] = new Set();
          collaborationMap2[a].add(b);
          collaborationMap2[b].add(a);
          const key = [a, b].sort().join("|");
          if (!sharedFilesMap[key]) sharedFilesMap[key] = [];
          sharedFilesMap[key].push(file);
        }
      }
    }

    const authorPhaseMap: Record<string, Set<number>> = Object.create(null);
    for (let phIdx = 0; phIdx < rawPhases.length; phIdx++) {
      for (const c of rawPhases[phIdx].commits) {
        const author = c.author?.login ?? c.commit.author.name;
        if (!authorPhaseMap[author]) authorPhaseMap[author] = new Set();
        authorPhaseMap[author].add(phIdx + 1);
      }
    }

    const highChurnFileSet = new Set(highChurnFiles.map(f => f.file));
    const intelRoleConfig: Record<string, { label: string; emoji: string }> = {
      Feature: { label: "Feature Builder", emoji: "✨" },
      Fix: { label: "Bug Fixer", emoji: "🐛" },
      Refactor: { label: "Refactorer", emoji: "⚡" },
      Setup: { label: "Project Bootstrapper", emoji: "🚀" },
      Test: { label: "QA Engineer", emoji: "✅" },
      Docs: { label: "Documentation Lead", emoji: "📝" },
      Chore: { label: "DevOps Engineer", emoji: "🔧" },
      Performance: { label: "Performance Engineer", emoji: "⚡️" },
    };
    const totalAnalyzedCount = commits.length;
    const contributorIntelligence = Object.entries(authorIntelMap2)
      .sort(([, a], [, b]) => b.commitCount - a.commitCount)
      .slice(0, 12)
      .map(([author, intel]) => {
        const topType = Object.entries(intel.types).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "Feature";
        const rc = intelRoleConfig[topType] ?? { label: "Core Contributor", emoji: "👨‍💻" };
        const sortedDates = [...intel.dates].sort((a, b) => a.getTime() - b.getTime());
        const firstCommit = sortedDates[0].toISOString().split("T")[0];
        const lastCommit = sortedDates[sortedDates.length - 1].toISOString().split("T")[0];
        const monthSet = new Set<string>();
        for (const d of intel.dates) monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        const activeMonths = [...monthSet].sort();
        const modules = Object.entries(authorModuleScores[author] ?? {}).sort(([, a], [, b]) => b - a).slice(0, 3).map(([m]) => m);
        const highImpactFiles = [...intel.files].filter(f => highChurnFileSet.has(f)).slice(0, 3);
        const collaborators = [...(collaborationMap2[author] ?? [])].slice(0, 4);
        const typeBreakdown = Object.entries(intel.types).sort(([, a], [, b]) => b - a).slice(0, 5).map(([type, count]) => ({ type, count }));
        const commitPercentage = Math.round((intel.commitCount / totalAnalyzedCount) * 100);
        return {
          author, avatarUrl: intel.avatarUrl, profileUrl: `https://github.com/${author}`,
          commitCount: intel.commitCount, commitPercentage, role: rc.label, roleEmoji: rc.emoji,
          typeBreakdown, modules, activeMonths, firstCommit, lastCommit,
          phases: [...(authorPhaseMap[author] ?? [])].sort((a, b) => a - b),
          highImpactFiles, collaborators,
          linesAdded: intel.linesAdded > 0 ? intel.linesAdded : undefined,
          linesRemoved: intel.linesRemoved > 0 ? intel.linesRemoved : undefined,
        };
      });

    const collaborationInsights = Object.entries(sharedFilesMap)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 6)
      .map(([pair, files]) => {
        const [a, b] = pair.split("|");
        return { authors: [a, b], sharedFiles: files.slice(0, 3), fileCount: files.length };
      });
    // ────────────────────────────────────────────────────────────────────────

    const uniqueContributors = new Set(commits.map((c) => c.author?.login ?? c.commit.author.name)).size;

    const topFeature = featureClusters[0]?.name ?? "general development";
    const topFile = highChurnFiles[0]?.file ?? "unknown";

    const displayTotal = realTotal > 0 ? realTotal : commits.length;
    const analyzedCommits = commits.length;
    const partialNote = displayTotal > analyzedCommits
      ? ` (analysis covers the most recent ${analyzedCommits.toLocaleString()} of ${displayTotal.toLocaleString()} total commits)`
      : "";

    // ── Noisy commit detection ──────────────────────────────────────────────
    function detectNoisyReason(msg: string, login: string): string | null {
      const first = msg.toLowerCase().split("\n")[0].trim();
      const l = login.toLowerCase();
      if (first.startsWith("merge pull request") || first.startsWith("merge branch")) return "Merge commit";
      if (l.includes("[bot]") || l === "dependabot" || l === "dependabot[bot]" || l === "renovate-bot" || l === "github-actions[bot]") return "Bot / automated commit";
      if (/^v?\d+\.\d+\.\d+/.test(first) || /\bbump\b.*\bversion\b|\bversion\b.*\bbump\b/.test(first) || /\brelease\b.*v?\d+\.\d+/.test(first)) return "Version bump / release tag";
      if (/^(chore|fix|update)?[: ]*(dep(s|endencies)|packages|yarn\.lock|package-lock)/.test(first) || /dependabot|renovate/.test(first)) return "Dependency update";
      if (/^(fix[: ]+)?(lint|format|prettier|eslint|stylelint|editorconfig)/.test(first)) return "Format / lint only";
      if (first.includes("[skip ci]") || first.includes("auto-generated") || first.includes("automated commit")) return "Auto-generated";
      if (/^(wip|temp|tmp|draft|cleanup|housekeeping|minor( fix)?|typo)[\s:]/.test(first)) return "Minor / trivial change";
      return null;
    }
    const noisyCommits = commits
      .filter(c => detectNoisyReason(c.commit.message, c.author?.login ?? "") !== null)
      .slice(0, 60)
      .map(c => ({
        commitSha: c.sha,
        message: c.commit.message.split("\n")[0],
        reason: detectNoisyReason(c.commit.message, c.author?.login ?? "") as string,
        author: c.author?.login ?? c.commit.author.name,
        date: c.commit.author.date,
      }));
    // ────────────────────────────────────────────────────────────────────────

    // ── Enhanced executive summary ──────────────────────────────────────────
    const typeTotal = Object.values(typeWaveCounts).reduce((s, v) => s + v, 0) || 1;
    const topTypes = Object.entries(typeWaveCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([t, c]) => `${t} (${Math.round((c / typeTotal) * 100)}%)`)
      .join(", ");
    const topContributor = contributorIntelligence[0];
    const topContribLine = topContributor
      ? ` ${topContributor.author} leads development with ${topContributor.commitPercentage}% of commits, primarily in ${topContributor.role.toLowerCase()} work.`
      : "";
    const phaseArc = builtPhases.length > 1
      ? `${builtPhases[0].dominantActivity} → … → ${builtPhases[builtPhases.length - 1].dominantActivity}`
      : (builtPhases[0]?.dominantActivity ?? "mixed development");
    const riskNote = riskCommits.length > 0
      ? `${riskCommits.length} high-risk commit${riskCommits.length !== 1 ? "s" : ""} flagged for review`
      : "no high-risk commits detected";
    const noisyNote = noisyCommits.length > 0
      ? ` ${noisyCommits.length} noisy or automated commits (merges, version bumps, bot PRs) were identified.`
      : "";
    const topFiles = highChurnFiles.slice(0, 3).map(f => `"${f.file}" (${f.changes}×)`).join(", ");

    const executiveSummary =
      `This repository contains ${displayTotal.toLocaleString()} commit${displayTotal !== 1 ? "s" : ""} by ${uniqueContributors} contributor${uniqueContributors !== 1 ? "s" : ""}, spanning ${new Date(startDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })} to ${new Date(endDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}${partialNote}. ` +
      `Development is structured into ${builtPhases.length} phase${builtPhases.length !== 1 ? "s" : ""}, following an arc of: ${phaseArc}. ` +
      `Commit activity breaks down as ${topTypes}, reflecting a ${Object.keys(typeWaveCounts)[0]?.toLowerCase() ?? "mixed"}-focused codebase. ` +
      `The most prominent feature cluster is "${topFeature}" with ${featureClusters[0]?.commitCount ?? 0} related commits across ${featureClusters.length} detected cluster${featureClusters.length !== 1 ? "s" : ""}. ` +
      `Hottest files by change frequency: ${topFiles || topFile}. ` +
      `${topContribLine} ` +
      `Risk analysis found ${riskNote}, and ${highChurnFiles.length} file${highChurnFiles.length !== 1 ? "s" : ""} exhibit high churn.${noisyNote}`;
    // ────────────────────────────────────────────────────────────────────────

    const data = AnalyzeCommitsResponse.parse({
      owner,
      repo,
      totalCommits: displayTotal,
      analyzedCommits,
      contributors: uniqueContributors,
      startDate,
      endDate,
      executiveSummary,
      commitStories,
      phases: builtPhases,
      featureClusters,
      developmentWaves,
      contributorRoles,
      architecturalEvents,
      riskCommits,
      highChurnFiles,
      noisyCommits,
      contributorIntelligence,
      collaborationInsights,
    });

    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Commit analysis failed");
    const message = err instanceof Error ? err.message : "Analysis failed";
    res.status(500).json({ error: message });
  }
});

router.post("/explain-commit", async (req, res) => {
  const body = ExplainCommitBody.parse(req.body);
  const { owner, repo, sha: shaInput } = body;

  try {
    // If shaInput is a number, look up that commit by position (1 = most recent)
    let resolvedSha = shaInput.trim();
    let commitNumber: number | undefined;

    if (/^\d+$/.test(resolvedSha)) {
      const num = parseInt(resolvedSha, 10);
      // Only treat as a position number if it's small enough to plausibly be a commit index.
      // For larger numbers, fall through and try it as a partial SHA (all digits are valid hex).
      if (num <= 1000) {
        const commits = await githubFetchPaginated(
          `https://api.github.com/repos/${owner}/${repo}/commits`, 10
        ) as CommitItem[];
        const sorted = [...commits].sort(
          (a, b) => new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime()
        );
        const target = sorted[num - 1];
        if (target) {
          commitNumber = num;
          resolvedSha = target.sha;
        }
        // If no target found (num > sorted.length), fall through and try as SHA below
      }
      // For num > 1000, keep resolvedSha as-is and GitHub's API will resolve it as a partial SHA
    }

    // Fetch full commit detail with diff
    let detail: {
      sha: string;
      commit: { message: string; author: { name: string; date: string } };
      stats?: { additions: number; deletions: number };
      files?: Array<{ filename: string; status: string; additions: number; deletions: number; patch?: string }>;
    };

    try {
      detail = await githubFetch(
        `https://api.github.com/repos/${owner}/${repo}/commits/${resolvedSha}`
      ) as typeof detail;
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : "";
      const isNotFound = msg.includes("404") || msg.includes("422");
      if (isNotFound) {
        // Give a helpful, specific error depending on the input
        const inputNum = /^\d+$/.test(shaInput.trim()) ? parseInt(shaInput.trim(), 10) : null;
        let hint: string;
        if (inputNum !== null && inputNum > 1000) {
          hint = `"${shaInput}" is too large for position-based lookup (supported: 1–1000). If you meant a commit SHA, enter at least 7 hex characters (e.g. a1b2c3d or the full 40-char SHA).`;
        } else if (resolvedSha.length < 7) {
          hint = `"${shaInput}" is too short to identify a commit. Enter at least 7 characters of a commit SHA (e.g. abc1234) or a position number (1 = most recent).`;
        } else {
          hint = `Commit "${resolvedSha}" was not found in ${owner}/${repo}. Check the SHA or try a position number (1 = most recent commit).`;
        }
        res.status(404).json({ error: hint });
      } else {
        res.status(500).json({ error: msg || "Failed to fetch commit." });
      }
      return;
    }

    if (!detail.sha) {
      res.status(404).json({ error: "Commit not found." });
      return;
    }

    const files = detail.files ?? [];
    const totalAdditions = detail.stats?.additions ?? 0;
    const totalDeletions = detail.stats?.deletions ?? 0;
    const commitMsg = detail.commit.message.split("\n")[0];
    const type = classifyCommit(commitMsg);

    // Build per-file diff blocks for the AI prompt (capped to avoid huge prompts)
    const fileBlocks = files
      .slice(0, 12)
      .map(f => {
        const patchLines = (f.patch ?? "").split("\n").slice(0, 40).join("\n");
        return `File: ${f.filename} [${f.status}] +${f.additions}/-${f.deletions}\n${patchLines}`;
      })
      .join("\n\n---\n\n")
      .slice(0, 8000);

    const prompt = `You are a senior software engineer explaining a GitHub commit to a colleague who wants to understand what changed and why.

COMMIT DETAILS:
SHA: ${detail.sha.slice(0, 7)}
Message: "${detail.commit.message}"
Author: ${detail.commit.author.name}
Date: ${detail.commit.author.date}
Total: +${totalAdditions} lines added, -${totalDeletions} lines removed across ${files.length} file(s)

CODE DIFFS:
${fileBlocks}

Write a detailed, human-readable explanation of this commit. Respond with ONLY a valid JSON object with these exact keys:
- "humanSummary": 2-3 sentence plain-English overview of what this commit accomplished
- "whatChanged": detailed bullet-point breakdown of the specific changes made (use "\\n• " for bullets)
- "whyItMatters": 1-2 sentences on the impact or significance of this change
- "fileExplanations": array of objects with "filename" and "explanation" (1 sentence each, what changed in that file)

Be specific about the actual code — mention function names, variable names, UI changes, or logic changes you can see in the diffs.`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = aiResponse.choices[0]?.message?.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let parsed: {
      humanSummary?: string;
      whatChanged?: string;
      whyItMatters?: string;
      fileExplanations?: Array<{ filename: string; explanation: string }>;
    } = {};
    try {
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = {};
    }

    const fileExps = parsed.fileExplanations ?? [];
    const fileDiffs = files.slice(0, 12).map(f => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch ?? "",
      explanation: fileExps.find(e => e.filename === f.filename)?.explanation ?? "",
    }));

    const data = ExplainCommitResponse.parse({
      sha: detail.sha,
      shortSha: detail.sha.slice(0, 7),
      message: detail.commit.message,
      author: detail.commit.author.name,
      date: detail.commit.author.date,
      type,
      humanSummary: parsed.humanSummary ?? commitMsg,
      whatChanged: parsed.whatChanged ?? "",
      whyItMatters: parsed.whyItMatters ?? "",
      fileDiffs,
      totalAdditions,
      totalDeletions,
      commitNumber,
    });

    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Explain commit failed");
    const message = err instanceof Error ? err.message : "Failed to explain commit";
    res.status(500).json({ error: message });
  }
});

router.post("/repo-chat", async (req, res) => {
  try {
    const { owner, repo, message, history } = RepoChatBody.parse(req.body);

    const [repoInfoResult, commitsResult, contributorsResult, languagesResult, contentsResult] =
      await Promise.allSettled([
        githubFetch(`https://api.github.com/repos/${owner}/${repo}`),
        githubFetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=30`),
        githubFetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=10`),
        githubFetch(`https://api.github.com/repos/${owner}/${repo}/languages`),
        githubFetch(`https://api.github.com/repos/${owner}/${repo}/contents`),
      ]);

    let readmeContent = "";
    try {
      const readmeData = await githubFetch(
        `https://api.github.com/repos/${owner}/${repo}/readme`,
      ) as { content?: string };
      if (readmeData.content) {
        readmeContent = Buffer.from(readmeData.content, "base64").toString("utf8").slice(0, 5000);
      }
    } catch {}

    const repoData = repoInfoResult.status === "fulfilled"
      ? repoInfoResult.value as Record<string, unknown>
      : null;
    const commits = commitsResult.status === "fulfilled"
      ? commitsResult.value as Array<Record<string, unknown>>
      : [];
    const contributors = contributorsResult.status === "fulfilled"
      ? contributorsResult.value as Array<Record<string, unknown>>
      : [];
    const languages = languagesResult.status === "fulfilled"
      ? languagesResult.value as Record<string, number>
      : {};
    const rootContents = contentsResult.status === "fulfilled"
      ? contentsResult.value as Array<{ name?: string; type?: string }>
      : [];

    const repoContext = [
      `Repository: ${owner}/${repo}`,
      repoData?.description ? `Description: ${repoData.description}` : "",
      repoData?.language ? `Primary language: ${repoData.language}` : "",
      Object.keys(languages).length
        ? `Languages: ${Object.entries(languages)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([lang, bytes]) => `${lang} (${Math.round((bytes as number) / 1024)}KB)`)
            .join(", ")}`
        : "",
      repoData?.stargazers_count !== undefined ? `Stars: ${repoData.stargazers_count}` : "",
      repoData?.forks_count !== undefined ? `Forks: ${repoData.forks_count}` : "",
      repoData?.open_issues_count !== undefined ? `Open issues: ${repoData.open_issues_count}` : "",
      repoData?.license ? `License: ${(repoData.license as Record<string, unknown>)?.name}` : "",
      repoData?.created_at ? `Created: ${String(repoData.created_at).slice(0, 10)}` : "",
      repoData?.updated_at ? `Last updated: ${String(repoData.updated_at).slice(0, 10)}` : "",
      repoData?.topics && (repoData.topics as string[]).length
        ? `Topics: ${(repoData.topics as string[]).join(", ")}`
        : "",
      repoData?.homepage ? `Homepage: ${repoData.homepage}` : "",
    ].filter(Boolean).join("\n");

    const contributorsContext = Array.isArray(contributors) && contributors.length
      ? contributors.slice(0, 10).map((c) => {
          const cc = c as { login?: string; contributions?: number };
          return `- ${cc.login} (${cc.contributions} commits)`;
        }).join("\n")
      : "";

    const rootFilesContext = Array.isArray(rootContents) && rootContents.length
      ? rootContents
          .map((f) => `${f.type === "dir" ? "📁" : "📄"} ${f.name}`)
          .join("  ")
      : "";

    const recentCommitsContext = Array.isArray(commits)
      ? commits.slice(0, 30).map((c) => {
          const cc = c as {
            sha?: string;
            commit?: { message?: string; author?: { name?: string; date?: string } };
          };
          return `- [${cc.sha?.slice(0, 7)}] ${cc.commit?.message?.split("\n")[0]} — ${cc.commit?.author?.name} (${cc.commit?.author?.date?.slice(0, 10)})`;
        }).join("\n")
      : "";

    const systemPrompt = [
      "You are an advanced AI assistant — a senior software engineer and developer advocate.",
      "You can answer ANY question, whether it's about this specific repository, general software development, coding concepts, architecture, best practices, debugging, career advice, or any other topic.",
      "When relevant, use the repository context below to give specific, accurate answers about this repo.",
      "Format your responses using markdown: use **bold**, *italic*, `inline code`, ```code blocks```, bullet lists, and numbered lists where appropriate.",
      "Be thorough but concise. Provide real, actionable advice. Never say you can't answer — always give your best response.",
      "",
      "=== REPOSITORY CONTEXT ===",
      repoContext,
      contributorsContext ? `\n=== TOP CONTRIBUTORS ===\n${contributorsContext}` : "",
      rootFilesContext ? `\n=== ROOT FILE STRUCTURE ===\n${rootFilesContext}` : "",
      readmeContent ? `\n=== README ===\n${readmeContent}` : "",
      recentCommitsContext ? `\n=== RECENT COMMITS (last 30) ===\n${recentCommitsContext}` : "",
    ].join("\n");

    const aiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...(history ?? []).map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user" as const, content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: aiMessages,
      max_completion_tokens: 2048,
    });

    const response =
      completion.choices[0]?.message?.content ??
      "I couldn't generate a response. Please try again.";
    res.json(RepoChatResponse.parse({ response }));
  } catch (err) {
    req.log.error({ err }, "Repo chat failed");
    const message = err instanceof Error ? err.message : "Failed to process chat";
    res.status(500).json({ error: message });
  }
});

// ── Developer Intelligence (standalone endpoint) ─────────────────────────────
router.post("/developer-intelligence", async (req, res) => {
  const body = DeveloperIntelligenceBody.parse(req.body);
  const { owner, repo } = body;

  try {
    const [commits, realTotal] = await Promise.all([
      githubFetchPaginated(`https://api.github.com/repos/${owner}/${repo}/commits`, 10) as Promise<CommitItem[]>,
      getTotalCommitCount(owner, repo),
    ]);

    if (commits.length === 0) {
      res.status(404).json({ error: "No commits found in this repository" });
      return;
    }

    const sorted = [...commits].sort(
      (a, b) => new Date(a.commit.author.date).getTime() - new Date(b.commit.author.date).getTime()
    );
    const startDate = sorted[0].commit.author.date;
    const endDate = sorted[sorted.length - 1].commit.author.date;

    // Fetch diffs for most recent commits (for file analysis)
    const recentCommits = [...commits]
      .sort((a, b) => new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime())
      .slice(0, 10);
    const commitDetails = (
      await Promise.all(recentCommits.map(c => fetchCommitDiff(owner, repo, c.sha)))
    ).filter((d): d is CommitDetail => d !== null);

    // Build author intelligence map
    interface DevAuthorIntel {
      commitCount: number;
      types: Record<string, number>;
      avatarUrl?: string;
      dates: Date[];
      files: Set<string>;
      linesAdded: number;
      linesRemoved: number;
    }
    const devAuthorMap: Record<string, DevAuthorIntel> = Object.create(null);
    for (const c of commits) {
      const author = c.author?.login ?? c.commit.author.name;
      if (!devAuthorMap[author]) {
        devAuthorMap[author] = { commitCount: 0, types: {}, avatarUrl: c.author?.avatar_url, dates: [], files: new Set(), linesAdded: 0, linesRemoved: 0 };
      }
      const a = devAuthorMap[author];
      a.commitCount++;
      a.avatarUrl = a.avatarUrl ?? c.author?.avatar_url;
      const t = classifyCommit(c.commit.message);
      a.types[t] = (a.types[t] ?? 0) + 1;
      a.dates.push(new Date(c.commit.author.date));
    }
    for (const d of commitDetails) {
      const a = devAuthorMap[d.author];
      if (a) { for (const f of d.filesChanged) a.files.add(f); a.linesAdded += d.linesAdded; a.linesRemoved += d.linesRemoved; }
    }

    // Module detection
    const devModulePatterns: [RegExp, string][] = [
      [/\bauth\b|\blogin\b|\bsignup\b|\bpassword\b|\bsession\b|\btoken\b|\bjwt\b|\boauth\b/, "Authentication"],
      [/\bui\b|\bcomponent\b|\bbutton\b|\bmodal\b|\bstyle\b|\btheme\b|\bcss\b|\bdesign\b|\blayout\b|\bicon\b/, "UI & Components"],
      [/\bapi\b|\bbackend\b|\bserver\b|\bservice\b|\bcontroller\b|\broute\b|\bendpoint\b|\brest\b|\bgraphql\b/, "Backend / API"],
      [/\bdatabase\b|\bdb\b|\bmodel\b|\bmigration\b|\bschema\b|\bpostgres\b|\bmongo\b|\bsql\b|\bprisma\b/, "Database"],
      [/\btest\b|\bspec\b|\bjest\b|\bvitest\b|\bcypress\b|\bplaywright\b|\be2e\b/, "Testing"],
      [/\bdocs?\b|\breadme\b|\bchangelog\b|\bguide\b/, "Documentation"],
      [/\bdeploy\b|\bci\b|\bcd\b|\bworkflow\b|\bdocker\b|\bnix\b|\bkubernetes\b|\bk8s\b|\binfra\b/, "DevOps / CI"],
      [/\bperform\b|\boptimiz\b|\bcache\b|\bspeed\b|\bbundle\b/, "Performance"],
      [/\bpayment\b|\bstripe\b|\bbilling\b|\bsubscription\b/, "Payments"],
      [/\bdashboard\b|\bhome\b|\blanding\b|\bpage\b|\bnavigation\b|\bsidebar\b/, "Pages / Routes"],
      [/\bsearch\b|\bfilter\b|\bsort\b|\bquery\b/, "Search & Filtering"],
      [/\bnotif\b|\bemail\b|\bwebhook\b|\bevent\b/, "Notifications"],
    ];
    const devModuleScores: Record<string, Record<string, number>> = Object.create(null);
    for (const c of commits) {
      const author = c.author?.login ?? c.commit.author.name;
      if (!devModuleScores[author]) devModuleScores[author] = Object.create(null);
      const scores = devModuleScores[author];
      const msg = c.commit.message.toLowerCase();
      const scopeMatch = msg.match(/^[a-z]+\(([^)]+)\)/);
      if (scopeMatch) { const scope = scopeMatch[1]; scores[scope] = (scores[scope] ?? 0) + 2; }
      for (const [pattern, moduleName] of devModulePatterns) {
        if (pattern.test(msg)) scores[moduleName] = (scores[moduleName] ?? 0) + 1;
      }
    }

    // File → authors map + collaboration detection
    const devFileAuthorsMap: Record<string, string[]> = Object.create(null);
    for (const d of commitDetails) {
      for (const f of d.filesChanged) {
        if (!devFileAuthorsMap[f]) devFileAuthorsMap[f] = [];
        if (!devFileAuthorsMap[f].includes(d.author)) devFileAuthorsMap[f].push(d.author);
      }
    }
    const devCollabMap: Record<string, Set<string>> = Object.create(null);
    const devSharedFilesMap: Record<string, string[]> = Object.create(null);
    for (const [file, fAuthors] of Object.entries(devFileAuthorsMap)) {
      for (let i = 0; i < fAuthors.length; i++) {
        for (let j = i + 1; j < fAuthors.length; j++) {
          const a = fAuthors[i], b = fAuthors[j];
          if (!devCollabMap[a]) devCollabMap[a] = new Set();
          if (!devCollabMap[b]) devCollabMap[b] = new Set();
          devCollabMap[a].add(b); devCollabMap[b].add(a);
          const key = [a, b].sort().join("|");
          if (!devSharedFilesMap[key]) devSharedFilesMap[key] = [];
          devSharedFilesMap[key].push(file);
        }
      }
    }

    // High-churn files from diffs
    const devFileChangeCounts: Record<string, number> = {};
    for (const d of commitDetails) { for (const f of d.filesChanged) devFileChangeCounts[f] = (devFileChangeCounts[f] ?? 0) + 1; }
    const devHighChurnFiles = Object.entries(devFileChangeCounts).sort(([, a], [, b]) => b - a).slice(0, 8).map(([file, changes]) => ({ file, changes }));
    const devHighChurnSet = new Set(devHighChurnFiles.map(f => f.file));

    const devRoleConfig: Record<string, { label: string; emoji: string }> = {
      Feature: { label: "Feature Builder", emoji: "✨" }, Fix: { label: "Bug Fixer", emoji: "🐛" },
      Refactor: { label: "Refactorer", emoji: "⚡" }, Setup: { label: "Project Bootstrapper", emoji: "🚀" },
      Test: { label: "QA Engineer", emoji: "✅" }, Docs: { label: "Documentation Lead", emoji: "📝" },
      Chore: { label: "DevOps Engineer", emoji: "🔧" }, Performance: { label: "Performance Engineer", emoji: "⚡️" },
    };
    const totalCount = commits.length;
    const displayTotal = realTotal > 0 ? realTotal : totalCount;
    const uniqueContributors = Object.keys(devAuthorMap).length;

    const contributorIntelligence = Object.entries(devAuthorMap)
      .sort(([, a], [, b]) => b.commitCount - a.commitCount)
      .slice(0, 12)
      .map(([author, intel]) => {
        const topType = Object.entries(intel.types).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "Feature";
        const rc = devRoleConfig[topType] ?? { label: "Core Contributor", emoji: "👨‍💻" };
        const sortedDates = [...intel.dates].sort((a, b) => a.getTime() - b.getTime());
        const monthSet = new Set<string>();
        for (const d of intel.dates) monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        return {
          author, avatarUrl: intel.avatarUrl, profileUrl: `https://github.com/${author}`,
          commitCount: intel.commitCount, commitPercentage: Math.round((intel.commitCount / totalCount) * 100),
          role: rc.label, roleEmoji: rc.emoji,
          typeBreakdown: Object.entries(intel.types).sort(([, a], [, b]) => b - a).slice(0, 5).map(([type, count]) => ({ type, count })),
          modules: Object.entries(devModuleScores[author] ?? {}).sort(([, a], [, b]) => b - a).slice(0, 3).map(([m]) => m),
          activeMonths: [...monthSet].sort(),
          firstCommit: sortedDates[0].toISOString().split("T")[0],
          lastCommit: sortedDates[sortedDates.length - 1].toISOString().split("T")[0],
          phases: [] as number[],
          highImpactFiles: [...intel.files].filter(f => devHighChurnSet.has(f)).slice(0, 3),
          collaborators: [...(devCollabMap[author] ?? [])].slice(0, 4),
          linesAdded: intel.linesAdded > 0 ? intel.linesAdded : undefined,
          linesRemoved: intel.linesRemoved > 0 ? intel.linesRemoved : undefined,
        };
      });

    const collaborationInsights = Object.entries(devSharedFilesMap)
      .sort(([, a], [, b]) => b.length - a.length).slice(0, 6)
      .map(([pair, files]) => { const [a, b] = pair.split("|"); return { authors: [a, b], sharedFiles: files.slice(0, 3), fileCount: files.length }; });

    // Enrich top contributors with GitHub profile contact details
    const enrichedContributors = await Promise.all(
      contributorIntelligence.map(async (ci) => {
        try {
          const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
          if (GITHUB_TOKEN) headers["Authorization"] = `token ${GITHUB_TOKEN}`;
          const pr = await fetch(`https://api.github.com/users/${ci.author}`, { headers });
          if (pr.ok) {
            const p = await pr.json() as { email?: string; twitter_username?: string; blog?: string; company?: string; location?: string; bio?: string };
            return {
              ...ci,
              email: p.email || undefined,
              twitter: p.twitter_username || undefined,
              website: p.blog || undefined,
              company: p.company ? p.company.replace(/^@/, "") : undefined,
              location: p.location || undefined,
              bio: p.bio || undefined,
            };
          }
        } catch { /* ignore */ }
        return ci;
      })
    );

    const data = DeveloperIntelligenceResponse.parse({
      owner, repo, totalCommits: displayTotal, analyzedCommits: totalCount,
      contributors: uniqueContributors, startDate, endDate,
      contributorIntelligence: enrichedContributors, collaborationInsights, highChurnFiles: devHighChurnFiles,
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Developer intelligence failed");
    const message = err instanceof Error ? err.message : "Analysis failed";
    res.status(500).json({ error: message });
  }
});

// ── Single Author Profile (works for any contributor, not just top ones) ──────
router.post("/author-profile", async (req, res) => {
  const { owner, repo, author } = req.body as { owner: string; repo: string; author: string };
  if (!owner || !repo || !author) { res.status(400).json({ error: "owner, repo, and author are required" }); return; }

  try {
    // Fetch up to 1000 commits for this repo
    const commits = await githubFetchPaginated(
      `https://api.github.com/repos/${owner}/${repo}/commits`, 10
    ) as CommitItem[];

    const totalCount = commits.length;

    // Filter commits by this author — match both GitHub login and git display name
    const authorCommits = commits.filter(c =>
      (c.author?.login ?? c.commit.author.name) === author ||
      c.commit.author.name === author ||
      (c.author?.login && c.author.login.toLowerCase() === author.toLowerCase()) ||
      c.commit.author.name.toLowerCase() === author.toLowerCase()
    );

    // If not found in the paged scan, try GitHub commit search API (covers older commits)
    let searchFallbackCommits: CommitItem[] = [];
    if (authorCommits.length === 0) {
      try {
        const searchHeaders: Record<string, string> = {
          Accept: "application/vnd.github.cloak-preview+json",
        };
        if (GITHUB_TOKEN) searchHeaders["Authorization"] = `token ${GITHUB_TOKEN}`;
        const searchRes = await fetch(
          `https://api.github.com/search/commits?q=author-name:${encodeURIComponent(`"${author}"`)}&repo=${owner}/${repo}&per_page=30`,
          { headers: searchHeaders }
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json() as { items?: CommitItem[] };
          searchFallbackCommits = searchData.items ?? [];
        }
      } catch { /* ignore */ }
    }

    const allAuthorCommits = authorCommits.length > 0 ? authorCommits : searchFallbackCommits;

    if (allAuthorCommits.length === 0) {
      res.status(404).json({ error: `No commits found for author "${author}"` });
      return;
    }

    // Resolve the canonical GitHub login (for profile fetch and display)
    const githubLogin = allAuthorCommits[0]?.author?.login ?? author;
    // Reuse allAuthorCommits for stats

    // Module detection patterns (same as dev-intel)
    const modulePatterns: [RegExp, string][] = [
      [/\bauth\b|\blogin\b|\bsignup\b|\bpassword\b|\bsession\b|\btoken\b|\bjwt\b|\boauth\b/, "Authentication"],
      [/\bui\b|\bcomponent\b|\bbutton\b|\bmodal\b|\bstyle\b|\btheme\b|\bcss\b|\bdesign\b|\blayout\b|\bicon\b/, "UI & Components"],
      [/\bapi\b|\bbackend\b|\bserver\b|\bservice\b|\bcontroller\b|\broute\b|\bendpoint\b|\brest\b|\bgraphql\b/, "Backend / API"],
      [/\bdatabase\b|\bdb\b|\bmodel\b|\bmigration\b|\bschema\b|\bpostgres\b|\bmongo\b|\bsql\b|\bprisma\b/, "Database"],
      [/\btest\b|\bspec\b|\bjest\b|\bvitest\b|\bcypress\b|\bplaywright\b|\be2e\b/, "Testing"],
      [/\bdocs?\b|\breadme\b|\bchangelog\b|\bguide\b/, "Documentation"],
      [/\bdeploy\b|\bci\b|\bcd\b|\bworkflow\b|\bdocker\b|\bnix\b|\bkubernetes\b|\bk8s\b|\binfra\b/, "DevOps / CI"],
      [/\bperform\b|\boptimiz\b|\bcache\b|\bspeed\b|\bbundle\b/, "Performance"],
      [/\bpayment\b|\bstripe\b|\bbilling\b|\bsubscription\b/, "Payments"],
      [/\bdashboard\b|\bhome\b|\blanding\b|\bpage\b|\bnavigation\b|\bsidebar\b/, "Pages / Routes"],
      [/\bsearch\b|\bfilter\b|\bsort\b|\bquery\b/, "Search & Filtering"],
      [/\bnotif\b|\bemail\b|\bwebhook\b|\bevent\b/, "Notifications"],
    ];

    const roleConfig: Record<string, { label: string; emoji: string }> = {
      Feature: { label: "Feature Builder", emoji: "✨" }, Fix: { label: "Bug Fixer", emoji: "🐛" },
      Refactor: { label: "Refactorer", emoji: "⚡" }, Setup: { label: "Project Bootstrapper", emoji: "🚀" },
      Test: { label: "QA Engineer", emoji: "✅" }, Docs: { label: "Documentation Lead", emoji: "📝" },
      Chore: { label: "DevOps Engineer", emoji: "🔧" }, Performance: { label: "Performance Engineer", emoji: "⚡️" },
    };

    // Build type map + module scores from this author's commits
    const types: Record<string, number> = Object.create(null);
    const moduleScores: Record<string, number> = Object.create(null);
    const dates: Date[] = [];
    let avatarUrl: string | undefined;

    for (const c of allAuthorCommits) {
      if (!avatarUrl) avatarUrl = c.author?.avatar_url;
      const t = classifyCommit(c.commit.message);
      types[t] = (types[t] ?? 0) + 1;
      dates.push(new Date(c.commit.author.date));
      const msg = c.commit.message.toLowerCase();
      const scopeMatch = msg.match(/^[a-z]+\(([^)]+)\)/);
      if (scopeMatch) { const scope = scopeMatch[1]; moduleScores[scope] = (moduleScores[scope] ?? 0) + 2; }
      for (const [pattern, moduleName] of modulePatterns) {
        if (pattern.test(msg)) moduleScores[moduleName] = (moduleScores[moduleName] ?? 0) + 1;
      }
    }

    // Fetch diffs for this author's most recent commits (up to 5)
    const recentAuthorCommits = [...allAuthorCommits]
      .sort((a, b) => new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime())
      .slice(0, 5);
    const diffs = (await Promise.all(recentAuthorCommits.map(c => fetchCommitDiff(owner, repo, c.sha))))
      .filter((d): d is CommitDetail => d !== null);

    const files = new Set<string>();
    let linesAdded = 0, linesRemoved = 0;
    for (const d of diffs) { for (const f of d.filesChanged) files.add(f); linesAdded += d.linesAdded; linesRemoved += d.linesRemoved; }

    // Month activity
    const monthSet = new Set<string>();
    for (const d of dates) monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());

    const topType = Object.entries(types).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "Feature";
    const rc = roleConfig[topType] ?? { label: "Core Contributor", emoji: "👨‍💻" };

    // Fetch GitHub user profile for contact details
    let email: string | undefined, twitter: string | undefined, website: string | undefined;
    let company: string | undefined, location: string | undefined, bio: string | undefined;
    try {
      const profileHeaders: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
      if (GITHUB_TOKEN) profileHeaders["Authorization"] = `token ${GITHUB_TOKEN}`;
      const pr = await fetch(`https://api.github.com/users/${githubLogin}`, { headers: profileHeaders });
      if (pr.ok) {
        const p = await pr.json() as { email?: string; twitter_username?: string; blog?: string; company?: string; location?: string; bio?: string };
        email = p.email || undefined;
        twitter = p.twitter_username || undefined;
        website = p.blog || undefined;
        company = p.company ? p.company.replace(/^@/, "") : undefined;
        location = p.location || undefined;
        bio = p.bio || undefined;
      }
    } catch { /* ignore */ }

    res.json({
      author: githubLogin !== author ? `${author} (${githubLogin})` : author,
      avatarUrl,
      profileUrl: `https://github.com/${githubLogin}`,
      commitCount: allAuthorCommits.length,
      commitPercentage: Math.round((allAuthorCommits.length / totalCount) * 100),
      role: rc.label,
      roleEmoji: rc.emoji,
      typeBreakdown: Object.entries(types).sort(([, a], [, b]) => b - a).slice(0, 5).map(([type, count]) => ({ type, count })),
      modules: Object.entries(moduleScores).sort(([, a], [, b]) => b - a).slice(0, 3).map(([m]) => m),
      activeMonths: [...monthSet].sort(),
      firstCommit: sortedDates[0].toISOString().split("T")[0],
      lastCommit: sortedDates[sortedDates.length - 1].toISOString().split("T")[0],
      highImpactFiles: [...files].slice(0, 3),
      collaborators: [] as string[],
      linesAdded: linesAdded > 0 ? linesAdded : undefined,
      linesRemoved: linesRemoved > 0 ? linesRemoved : undefined,
      email, twitter, website, company, location, bio,
    });
  } catch (err) {
    req.log.error({ err }, "Author profile failed");
    const message = err instanceof Error ? err.message : "Analysis failed";
    res.status(500).json({ error: message });
  }
});

// ── AI Narrative Generator ────────────────────────────────────────────────────
router.post("/generate-narrative", async (req, res) => {
  try {
    const { owner, repo, mode, inputs, context } = req.body as {
      owner: string;
      repo: string;
      mode: "release-notes" | "standup" | "portfolio";
      inputs?: {
        // release-notes
        features?: string[];
        fixes?: string[];
        improvements?: string[];
        modules?: string[];
        // standup
        recent_work?: string[];
        in_progress?: string[];
        blockers?: string[];
        contributors?: string[];
        // portfolio
        tech_stack?: string[];
        impact?: string[];
        role?: string[];
      };
      context?: {
        type?: string;
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
      };
    };

    if (!owner || !repo || !mode) {
      res.status(400).json({ error: "owner, repo, and mode are required" });
      return;
    }

    const repoLabel = `${owner}/${repo}`;
    const ctx = context ?? {};
    const inp = inputs ?? {};

    const fmt = (arr: string[] | undefined, bullet = "•") =>
      arr?.length ? arr.map(i => `${bullet} ${i}`).join("\n") : "";

    let prompt = "";

    if (mode === "release-notes") {
      const useStructured = inp.features?.length || inp.fixes?.length || inp.improvements?.length || inp.modules?.length;
      if (useStructured) {
        prompt = `You are a technical writer. Generate polished, professional release notes for the project "${repoLabel}" based on the following structured input.

${inp.features?.length ? `🧩 Feature Clusters (MOST IMPORTANT):\n${fmt(inp.features)}\n` : ""}
${inp.fixes?.length ? `🐛 Bug Fixes:\n${fmt(inp.fixes)}\n` : ""}
${inp.improvements?.length ? `⚡ Improvements & Refactors:\n${fmt(inp.improvements)}\n` : ""}
${inp.modules?.length ? `📁 Affected Modules: ${inp.modules.join(", ")}\n` : ""}

Output format — write clean release notes in markdown:
## Overview
(one paragraph summarising what changed and the user value)

## What's New
(bullet points for each feature, user-facing and clear)

## Bug Fixes
(bullet points for each fix, include user impact)

## Improvements
(bullet points for improvements and refactors)

${inp.modules?.length ? `## Affected Modules\n(list the changed areas with brief notes)\n` : ""}

Rules:
- Write from the user's perspective — describe impact, not just code changes
- Use clear, concise bullet points
- Do not include any code snippets
- Keep each bullet to one sentence`;
      } else {
        prompt = `You are a technical writer generating clean release notes for the GitHub repository "${repoLabel}".

Here is what you know about the project's development:
${ctx.summary ? `- Overall summary: ${ctx.summary}` : ""}
${ctx.phases?.length ? `- Development phases: ${ctx.phases.slice(0, 6).join("; ")}` : ""}
${ctx.features?.length ? `- Feature areas: ${ctx.features.slice(0, 8).join(", ")}` : ""}
${ctx.architecturalEvents?.length ? `- Key architectural events: ${ctx.architecturalEvents.slice(0, 5).join("; ")}` : ""}
${ctx.recentCommits?.length ? `- Recent commit summaries:\n${ctx.recentCommits.slice(0, 20).map(c => `  • ${c}`).join("\n")}` : ""}
${ctx.totalCommits ? `- Total commits: ${ctx.totalCommits}` : ""}

Write professional release notes in markdown with sections: ## Overview, ## What's New, ## Improvements, ## Technical Changes
Use bullet points. Write for end users and developers.`;
      }
    } else if (mode === "standup") {
      const useStructured = inp.recent_work?.length || inp.in_progress?.length;
      if (useStructured) {
        prompt = `Generate a concise, ready-to-read daily standup update for the project "${repoLabel}".

${inp.recent_work?.length ? `📅 Recent Work Done (last 1–2 days):\n${fmt(inp.recent_work)}\n` : ""}
${inp.in_progress?.length ? `🧩 Currently In Progress:\n${fmt(inp.in_progress)}\n` : ""}
${inp.blockers?.length ? `⚠️ Blockers / Issues:\n${fmt(inp.blockers)}\n` : ""}
${inp.contributors?.length ? `👤 Contributor Activity:\n${fmt(inp.contributors)}\n` : ""}

Format the standup update EXACTLY like this — keep each section short and readable:

✅ Yesterday:
(bullet points of what was completed — directly from "Recent Work Done")

🔨 Today:
(bullet points of active work — directly from "Currently In Progress")

🚧 Blockers:
(bullet points of blockers, or "None" if not provided)

${inp.contributors?.length ? `👥 Contributors:\n(brief summary of who did what)\n` : ""}

Rules:
- Keep it short and conversational — ready to read out loud
- Do not add anything not mentioned in the inputs
- Do not pad with filler text`;
      } else {
        prompt = `Generate a concise daily standup update for the repository "${repoLabel}".

${ctx.recentCommits?.length ? `Recent work:\n${ctx.recentCommits.slice(0, 15).map(c => `  • ${c}`).join("\n")}` : ""}
${ctx.phases?.length ? `Current phase: ${ctx.phases[ctx.phases.length - 1] ?? "active development"}` : ""}
${ctx.summary ? `Project context: ${ctx.summary}` : ""}

Format:
✅ Yesterday / Recently Done:
🔨 Currently In Progress:
📋 Up Next:
🚧 Blockers / Notes:

Keep it short and ready to read out loud.`;
      }
    } else {
      const useStructured = inp.features?.length || inp.tech_stack?.length || inp.impact?.length;
      if (useStructured) {
        prompt = `Write a compelling, resume-ready portfolio description for the project "${repoLabel}".

${inp.features?.length ? `🧩 Key Features Built:\n${fmt(inp.features)}\n` : ""}
${inp.tech_stack?.length ? `⚙️ Tech Stack: ${inp.tech_stack.join(", ")}\n` : ""}
${inp.impact?.length ? `🔥 Impact & Outcomes (MOST IMPORTANT — reflect these strongly in the output):\n${fmt(inp.impact)}\n` : ""}
${inp.role?.length ? `🧠 Role / Contribution:\n${fmt(inp.role)}\n` : ""}

Output EXACTLY in this format:

Resume Bullets:
• [Strong action verb] [what you built] using [tech], [impact/metric]
• [Strong action verb] [feature or system] that [user or business outcome]
• [Strong action verb] [technical accomplishment] resulting in [measurable result or quality improvement]

Portfolio Summary:
[Two compelling sentences for a portfolio website that highlight the project's purpose, your technical contribution, and the impact.]

Rules:
- Use powerful action verbs: Engineered, Architected, Built, Developed, Implemented, Designed, Delivered
- Impact & Outcomes MUST be reflected prominently in the resume bullets
- Be specific — mention technologies, numbers, and user impact
- Do NOT use generic filler like "a robust application" or "modern tech stack"`;
      } else {
        prompt = `Write a compelling portfolio/resume description for the project "${repoLabel}".

${ctx.language ? `- Primary language: ${ctx.language}` : ""}
${ctx.summary ? `- Description: ${ctx.summary}` : ""}
${ctx.modules?.length ? `- Key modules: ${ctx.modules.slice(0, 6).join(", ")}` : ""}
${ctx.dependencies?.length ? `- Tech stack: ${ctx.dependencies.slice(0, 10).join(", ")}` : ""}
${ctx.totalCommits ? `- Scale: ${ctx.totalCommits} commits` : ""}

Write 3 resume bullet points then a 2-sentence portfolio summary paragraph.
Use strong action verbs (Engineered, Architected, Built, Developed, Implemented, Designed).`;
      }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 800,
    });

    const narrative = completion.choices[0]?.message?.content ?? "Could not generate narrative. Please try again.";
    res.json({ narrative });
  } catch (err) {
    req.log.error({ err }, "Narrative generation failed");
    const message = err instanceof Error ? err.message : "Generation failed";
    res.status(500).json({ error: message });
  }
});

export default router;
