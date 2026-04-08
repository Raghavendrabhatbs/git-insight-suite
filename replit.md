# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

### Git Insight Suite (artifacts/git-insight)
A full-stack GitHub repository intelligence tool.

**Pages:**
- `/` — Landing page with animated contour lines background, GitHub URL input with "Next" button
- `/choose?owner=&repo=` — Choose between Repo Analyser or Commit Analyser
- `/repo-analysis?owner=&repo=` — Deep codebase structure analysis (folder hierarchy, modules, dependencies, frontend/backend split, entry points, churn)
- `/commit-analysis?owner=&repo=` — Commit history analysis (phases, development waves, contributor roles, architectural events, risk commits)

**API Routes (api-server):**
- `POST /api/github/validate` — validates GitHub URL (profile or repo), returns owner/repo + repo list for profiles
- `POST /api/github/repo-analysis` — analyzes repo codebase structure via GitHub API tree
- `POST /api/github/commit-analysis` — analyzes commit history, groups into phases, identifies patterns

**Design:** Dark theme only, purple-violet primary (#7c3aed), blue secondary (#3b82f6), near-black backgrounds

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
