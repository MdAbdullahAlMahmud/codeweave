# codeweave — Execution Plan

**Version:** 0.1.0 MVP
**Target:** 14-day build to npm publish
**Approach:** Open-source first, scalable architecture, test-driven

---

## Phase 0: Project Scaffolding & Open-Source Foundation (Day 1)

Everything committed from the first commit must follow open-source standards.

### 0.1 Repository Setup

- [ ] Initialize `package.json` with proper metadata
  - `name`: `codeweave`
  - `license`: `MIT`
  - `bin`: `{ "codeweave": "./bin/codeweave.js" }`
  - `engines`: `{ "node": ">=18.0.0" }`
  - `repository`, `bugs`, `homepage` fields pointing to GitHub
  - `keywords`: `["mcp", "ai", "coding-tools", "cli", "context-protocol"]`
  - `files` field to whitelist published files only (`bin/`, `dist/`)
- [ ] `tsconfig.json` — strict mode, ES2022 target, `outDir: dist/`
- [ ] `tsup.config.ts` — bundle `src/` → `dist/`, preserve `bin/` entry
- [ ] `.gitignore` — `node_modules/`, `dist/`, `*.db`, `.env`, `coverage/`
- [ ] `.npmignore` — exclude `src/`, `tests/`, docs, dev configs from npm package

### 0.2 Open-Source Essentials (first commit)

- [ ] `LICENSE` — MIT license file
- [ ] `README.md` — project description, badges, quick start, architecture overview, contributing link
- [ ] `CONTRIBUTING.md` — how to fork, develop, test, submit PRs
- [ ] `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1
- [ ] `CHANGELOG.md` — keep-a-changelog format, start with `## [Unreleased]`
- [ ] `.github/ISSUE_TEMPLATE/` — bug report & feature request templates
- [ ] `.github/PULL_REQUEST_TEMPLATE.md`

### 0.3 CI/CD Pipeline

- [ ] `.github/workflows/ci.yml` — on push/PR to `main`:
  - Lint (`eslint`)
  - Type-check (`tsc --noEmit`)
  - Test (`vitest run`)
  - Build (`tsup`)
  - Matrix: Node 18, 20, 22 on ubuntu-latest
- [ ] `.github/workflows/release.yml` — on version tag push:
  - Build, test, publish to npm with provenance

### 0.4 Code Quality Tooling

- [ ] `eslint.config.js` — flat config, TypeScript rules, no unused vars
- [ ] `prettier.config.js` — consistent formatting
- [ ] `.editorconfig` — tabs/spaces, trailing whitespace, final newline
- [ ] `vitest.config.ts` — test config, coverage thresholds
- [ ] Husky + lint-staged for pre-commit hooks (lint + format)

### 0.5 Install Dependencies

**Runtime:**
```
@modelcontextprotocol/sdk  better-sqlite3  commander  fast-glob
simple-git  chokidar  zod  js-yaml  ignore
```

**Dev:**
```
typescript  tsx  vitest  tsup  eslint  prettier
@types/better-sqlite3  @types/node  husky  lint-staged
```

### Commit: `feat: initial project scaffolding with open-source foundation`

---

## Phase 1: Core Infrastructure (Days 2–3)

Build the foundational modules that everything else depends on.

### 1.1 Logger (`src/utils/logger.ts`)

- [ ] Color-coded terminal output (info, success, warn, error)
- [ ] Verbose mode toggle
- [ ] No file content in logs (security requirement)
- [ ] **Tests:** logger output formatting

### 1.2 Ignore Rules (`src/utils/ignoreRules.ts`)

- [ ] Parse `.gitignore` rules using `ignore` package
- [ ] Layer `.codeweave-ignore` on top
- [ ] Always ignore: `node_modules`, `.git`, binary extensions
- [ ] **Tests:** ignore matching with various patterns

### 1.3 Config System (`src/config/`)

- [ ] `defaults.ts` — sensible default values
- [ ] `loader.ts` — load `codeweave.config.js` from cwd, validate with Zod
- [ ] Graceful fallback to defaults if no config found
- [ ] Clear error messages on invalid config with line numbers
- [ ] **Tests:** config loading, validation, defaults

### 1.4 SQLite Cache (`src/cache/db.ts`)

- [ ] Setup `better-sqlite3` with WAL mode
- [ ] Store DB at `~/.codeweave/{repo-hash}/cache.db`
- [ ] Schema: `files`, `files_fts` (FTS5), `commits`, `stack_info` tables
- [ ] Migration system for future schema changes
- [ ] **Tests:** DB creation, migrations, CRUD operations

### Commit: `feat: core infrastructure — config, cache, logger, ignore rules`

---

## Phase 2: Repo Indexer (Days 4–5)

### 2.1 File Scanner (`src/indexer/fileScanner.ts`)

- [ ] Recursive scan with `fast-glob`, respecting ignore rules
- [ ] Detect language from file extension (extension → language map)
- [ ] Skip binary files by extension
- [ ] Truncate files > 100KB (configurable)
- [ ] Mtime-based cache invalidation (skip unchanged files)
- [ ] Store file metadata + content in SQLite
- [ ] Build hierarchical file tree JSON
- [ ] Warn if repo > 50,000 files
- [ ] **Performance:** < 3s for 10K files, < 500ms warm start
- [ ] **Tests:** scanning, language detection, ignore rules, large file handling

### 2.2 Git Reader (`src/indexer/gitReader.ts`)

- [ ] Read recent commits using `simple-git` (depth from config, default 50)
- [ ] Extract: hash, message, author, date, changed files
- [ ] Cache commits in SQLite
- [ ] Graceful empty result if not a git repo
- [ ] **Tests:** commit parsing, non-git-repo handling

### 2.3 Package Parser (`src/indexer/pkgParser.ts`)

- [ ] Parse manifest files: `package.json`, `pubspec.yaml`, `build.gradle`, `Cargo.toml`, `requirements.txt`, `pyproject.toml`, `go.mod`, `composer.json`, `Gemfile`
- [ ] Extract dependency lists (name + version)
- [ ] Detect package manager (npm/yarn/pnpm/bun)
- [ ] **Tests:** each manifest format parsing

### 2.4 Stack Detector (`src/indexer/stackDetector.ts`)

- [ ] Detect language, runtime, framework, database, testing, styling, package manager
- [ ] Pure static analysis from manifest files — no LLM
- [ ] Output structured `StackInfo` object
- [ ] **Tests:** detection for each supported stack

### 2.5 Convention Detector (`src/indexer/conventionDetector.ts`)

- [ ] File naming: camelCase vs snake_case vs kebab-case (frequency count)
- [ ] Component structure: colocation vs separate
- [ ] Import style: relative vs absolute
- [ ] Test framework detection from devDependencies
- [ ] **Tests:** pattern detection accuracy

### Commit: `feat: repo indexer — file scanner, git reader, stack detection`

---

## Phase 3: MCP Server & Tools (Days 6–9)

### 3.1 MCP Server Bootstrap (`src/mcp/server.ts`)

- [ ] Initialize `McpServer` from `@modelcontextprotocol/sdk`
- [ ] StdioServerTransport for MCP communication
- [ ] Register all tools on startup
- [ ] Run indexer before accepting connections
- [ ] Start file watcher after indexing
- [ ] Graceful shutdown handling (SIGINT, SIGTERM)
- [ ] **Tests:** server lifecycle

### 3.2 MCP Tools (`src/mcp/tools/`)

Each tool is a self-contained module. All read from SQLite. None call external APIs.

#### `get_file_tree` (Day 6)
- [ ] Return annotated JSON tree with language tags
- [ ] Respect config `include` paths
- [ ] **Tests:** tree structure, filtering

#### `get_file` (Day 6)
- [ ] Return file content with line numbers
- [ ] Handle file-not-found gracefully
- [ ] **Tests:** content retrieval, missing files

#### `search_codebase` (Day 7)
- [ ] Full-text search via SQLite FTS5 with porter tokenizer
- [ ] Return matching files with snippet context
- [ ] Default limit 20, configurable
- [ ] Response < 200ms
- [ ] **Tests:** search accuracy, performance, edge cases

#### `get_conventions` (Day 7)
- [ ] Return detected naming patterns, folder structure, import styles
- [ ] JSON output with confidence scores
- [ ] **Tests:** convention output format

#### `get_dependencies` (Day 8)
- [ ] Return parsed dependencies from all detected manifest files
- [ ] Group by dev/prod dependencies
- [ ] **Tests:** dependency output structure

#### `get_git_history` (Day 8)
- [ ] Return recent commits with metadata
- [ ] Filter by file path (optional)
- [ ] **Tests:** history output, filtering

#### `get_stack_info` (Day 9)
- [ ] Return normalized stack summary JSON
- [ ] **Tests:** stack info output

### 3.3 File Watcher (`src/watcher/fileWatcher.ts`)

- [ ] Watch with `chokidar`, respect ignore rules
- [ ] On add/change → re-index file in SQLite + update FTS
- [ ] On unlink → remove from SQLite
- [ ] Debounce rapid changes
- [ ] Latency < 1s after save
- [ ] **Tests:** watcher events, cache updates

### 3.4 Token Estimator (`src/utils/tokenEstimator.ts`)

- [ ] Estimate token count of indexed content (cl100k_base approximation)
- [ ] Used by status command and future dashboard
- [ ] **Tests:** estimation accuracy

### Commit: `feat: MCP server with 7 tools and file watcher`

---

## Phase 4: CLI Interface (Days 10–11)

### 4.1 CLI Entry Point (`src/cli/index.ts` + `bin/codeweave.js`)

- [ ] `commander.js` setup with commands and flags
- [ ] `codeweave` / `codeweave start` — start MCP server (default command)
  - `--port <port>` (default 3333)
  - `--verbose`
- [ ] `codeweave init` — interactive config wizard
- [ ] `codeweave status` — show indexing stats
- [ ] Version flag from `package.json`
- [ ] **Tests:** CLI argument parsing

### 4.2 Init Wizard (`src/cli/init.ts`)

- [ ] Detect existing config, ask before overwriting
- [ ] Auto-detect include paths from project structure
- [ ] Generate `codeweave.config.js` with detected settings
- [ ] Print next steps after generation
- [ ] **Tests:** config generation

### 4.3 Status Command (`src/cli/status.ts`)

- [ ] Show: indexed file count, languages breakdown, DB size, stack info
- [ ] Show: file watcher status, MCP server status
- [ ] Estimated token count
- [ ] **Tests:** status output

### 4.4 Connection Guide

- [ ] On server start, print config snippets for:
  - Claude Code (`.claude/settings.json`)
  - Cursor (`.cursor/mcp.json`)
  - Zed (`~/.config/zed/settings.json`)
  - Continue.dev (`.continue/config.json`)
- [ ] Copy-paste ready JSON blocks

### Commit: `feat: CLI with start, init, and status commands`

---

## Phase 5: Integration Testing & Hardening (Days 12–13)

### 5.1 End-to-End Tests

- [ ] Test full flow: init → start → index → query tools → file change → re-index
- [ ] Test with sample repos of varying sizes (small, medium, large)
- [ ] Test each MCP tool with a real MCP client connection
- [ ] Test with repos of different stacks (Node, Python, Go, Rust, Flutter)

### 5.2 Error Handling Verification

- [ ] Not a git repo → warn and continue
- [ ] File unreadable (permissions) → skip, log, continue
- [ ] Config file invalid → clear error, fall back to defaults
- [ ] Port already in use → suggest alternative port
- [ ] Manifest file malformed → skip parser, continue
- [ ] MCP client disconnects → keep server running

### 5.3 Performance Testing

- [ ] Benchmark: 10K file repo < 3s initial index
- [ ] Benchmark: warm start < 500ms
- [ ] Benchmark: search response < 200ms
- [ ] Benchmark: file fetch < 50ms
- [ ] Profile memory usage — no full content in memory

### 5.4 Cross-Platform Verification

- [ ] macOS (local dev)
- [ ] Linux (CI)
- [ ] Windows WSL2 (CI or manual)

### Commit: `test: end-to-end tests and performance benchmarks`

---

## Phase 6: Documentation & Polish (Day 13)

### 6.1 README.md (Production Quality)

- [ ] Badges: npm version, CI status, license, downloads
- [ ] Hero section: one-liner + demo GIF/screenshot
- [ ] Quick Start: 3 steps to running
- [ ] Features list with brief descriptions
- [ ] AI Client Setup: config snippets for each client
- [ ] Configuration: full config reference
- [ ] Architecture: simplified diagram
- [ ] Contributing: link to CONTRIBUTING.md
- [ ] License section

### 6.2 API Documentation

- [ ] Each MCP tool: input schema, output format, example
- [ ] Config file reference with all options
- [ ] CLI reference with all commands and flags

### 6.3 Example Config

- [ ] `codeweave.config.example.js` — annotated example config

### Commit: `docs: comprehensive README, API docs, and examples`

---

## Phase 7: Release (Day 14)

### 7.1 Pre-Release Checklist

- [ ] All CI checks green (lint, types, tests, build)
- [ ] `npx codeweave` works from a fresh npm install
- [ ] Tested with Claude Code as MCP client
- [ ] Tested with at least one other MCP client (Cursor or Zed)
- [ ] README has demo GIF
- [ ] CHANGELOG updated for v0.1.0
- [ ] `npm pack` — verify package contents are clean (no secrets, no dev files)
- [ ] License header in source files (optional but good practice)

### 7.2 Publish

- [ ] `npm version 0.1.0`
- [ ] `npm publish` with provenance
- [ ] Create GitHub Release with changelog notes
- [ ] Tag: `v0.1.0`

### 7.3 Launch Activities

- [ ] Submit PR to `awesome-mcp-servers`
- [ ] Post on r/ClaudeAI, r/cursor
- [ ] Write dev.to blog post: "How I built an MCP server for any codebase"
- [ ] Show HN post with demo GIF

### Commit: `chore: release v0.1.0`

---

## Architecture Principles (Enforced Throughout)

### Scalability

1. **Module boundaries** — Each module (indexer, cache, mcp, watcher) has a clean interface. No circular dependencies. Modules communicate through well-defined types.
2. **Plugin-ready tool registration** — MCP tools are self-contained files. Adding a new tool = adding one file + one line in the registry. No modification of existing code.
3. **Incremental indexing** — Mtime-based cache invalidation means only changed files are re-processed. Scales to large repos.
4. **FTS5 for search** — SQLite's full-text search scales to millions of rows without external dependencies.
5. **Streaming file reads** — Never load entire repo into memory. Stream and truncate large files.

### Maintainability

1. **Strict TypeScript** — `strict: true`, no `any` types, explicit return types on public APIs.
2. **Zod schemas** — Runtime validation at system boundaries (config, MCP inputs).
3. **Test coverage** — Unit tests for every module, integration tests for full flows. Minimum 80% coverage.
4. **Conventional commits** — `feat:`, `fix:`, `test:`, `docs:`, `chore:` prefixes.
5. **Keep-a-changelog** — Every user-facing change documented.
6. **Small, focused modules** — Each file has one responsibility. Easy to understand, test, and replace.

### Open-Source Standards

1. **Semantic versioning** — from v0.1.0 onward.
2. **MIT license** — maximum adoption.
3. **Contributing guide** — lower barrier for community PRs.
4. **Issue templates** — structured bug reports and feature requests.
5. **CI on every PR** — no broken code merges to main.
6. **npm provenance** — supply chain security from day one.

---

## File Creation Order (Dependency-Aware)

This is the order files should be created to minimize blocked work:

```
1.  package.json, tsconfig.json, tsup.config.ts        ← project foundation
2.  LICENSE, README.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md  ← OSS foundation
3.  .github/workflows/ci.yml                            ← CI from first PR
4.  eslint.config.js, prettier.config.js, vitest.config.ts   ← tooling
5.  src/utils/logger.ts                                  ← used by everything
6.  src/utils/ignoreRules.ts                             ← used by indexer + watcher
7.  src/config/defaults.ts → src/config/loader.ts        ← used by CLI + indexer
8.  src/cache/db.ts                                      ← used by indexer + tools
9.  src/cache/fileCache.ts → src/cache/searchIndex.ts
10. src/indexer/fileScanner.ts                           ← core indexer
11. src/indexer/gitReader.ts
12. src/indexer/pkgParser.ts
13. src/indexer/stackDetector.ts
14. src/indexer/conventionDetector.ts
15. src/mcp/tools/getFileTree.ts                         ← tools (parallel)
16. src/mcp/tools/getFile.ts
17. src/mcp/tools/searchCodebase.ts
18. src/mcp/tools/getConventions.ts
19. src/mcp/tools/getDependencies.ts
20. src/mcp/tools/getGitHistory.ts
21. src/mcp/tools/getStackInfo.ts
22. src/mcp/server.ts                                    ← wires everything
23. src/watcher/fileWatcher.ts
24. src/utils/tokenEstimator.ts
25. src/cli/init.ts → src/cli/status.ts → src/cli/index.ts
26. bin/codeweave.js                                     ← CLI entry point
```

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| MCP SDK breaking changes | Pin exact version, add integration test against SDK |
| `better-sqlite3` native build fails on some platforms | Document Node version requirements, test in CI matrix |
| Large repos slow down indexing | Incremental indexing, configurable file size limits, include/exclude paths |
| Name `codeweave` taken on npm | Verify availability before first publish (already confirmed in PRD) |
| Scope creep delays MVP | Strict phase boundaries — dashboard, multi-repo, cloud are all post-MVP |

---

*End of Execution Plan — codeweave v0.1.0*
