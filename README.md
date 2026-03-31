# codeweave

[![npm version](https://img.shields.io/npm/v/codeweave.svg)](https://www.npmjs.com/package/codeweave)
[![CI](https://github.com/MdAbdullahAlMahmud/codeweave/actions/workflows/ci.yml/badge.svg)](https://github.com/MdAbdullahAlMahmud/codeweave/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/codeweave.svg)](https://www.npmjs.com/package/codeweave)

**Make any repo instantly AI-ready via MCP — a self-hosted, zero-API-key context server for your codebase.**

<div align="center">
  <img src="assets/demo.gif" alt="codeweave demo" width="800" />
</div>

codeweave runs locally alongside your AI coding tool. It indexes your entire repo into a fast SQLite database and exposes it as an [MCP](https://modelcontextprotocol.io) server, giving AI assistants deep, accurate context about your code — file tree, full-text search, git history, dependencies, stack detection, and coding conventions — without ever sending your code to a third party.

---

## Quick Start

```bash
# 1. Install globally (or use npx)
npm install -g codeweave

# 2. Generate a config in your project root
cd /path/to/your/project
codeweave init

# 3. Start the MCP server
codeweave start
```

Then add codeweave to your AI client (see [AI Client Setup](#ai-client-setup) below).

---

## Features

| Feature | Description |
|---------|-------------|
| **File tree** | Annotated JSON tree with language tags for every file |
| **Full-text search** | SQLite FTS5 with porter stemming — sub-millisecond queries |
| **File content** | Line-numbered file content with optional line range slicing |
| **Git history** | Recent commits with author, date, and changed files |
| **Dependency graph** | Parsed from `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, and 6 more |
| **Stack detection** | Automatically detects language, framework, database, test runner, styling |
| **Convention detection** | File naming style, import patterns, component structure |
| **File watcher** | Re-indexes changed files in < 1s with 300ms debounce |
| **Incremental indexing** | mtime-based cache — warm starts in < 30ms |
| **Zero API keys** | Runs entirely locally. No cloud. No telemetry. |

---

## AI Client Setup

codeweave uses the stdio MCP transport and works with any MCP-compatible client.

### Claude Code

Add to `.claude/settings.json` in your project root:

```json
{
  "mcpServers": {
    "codeweave": {
      "command": "npx",
      "args": ["codeweave"],
      "cwd": "."
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "codeweave": {
      "command": "npx",
      "args": ["codeweave"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

### Zed

Add to `~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "codeweave": {
      "command": {
        "path": "npx",
        "args": ["codeweave"]
      }
    }
  }
}
```

### Continue.dev

Add to `.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "codeweave",
      "command": "npx",
      "args": ["codeweave"]
    }
  ]
}
```

---

## CLI Reference

```
codeweave [command] [options]

Commands:
  start    Start the MCP server (default)
  init     Generate codeweave.config.js in the current directory
  status   Show indexing stats for the current repo

Options:
  --verbose    Enable debug logging
  -V, --version  Show version number
  -h, --help     Show help
```

See the full [CLI reference →](docs/cli.md)

---

## Configuration

Run `codeweave init` to generate a `codeweave.config.js`. All fields are optional — defaults work well for most projects.

```js
// codeweave.config.js
export default {
  // Directories to index (relative to config file)
  include: ['src'],

  // Extra patterns to exclude beyond .gitignore
  exclude: ['**/*.generated.ts'],

  // Files larger than this are truncated (KB)
  maxFileSizeKB: 100,

  // How many git commits to read
  gitDepth: 50,

  // Port for future HTTP transport
  port: 3333,

  // Enable verbose/debug logging
  verbose: false,
};
```

See the full [configuration reference →](docs/api.md#configuration)

---

## MCP Tools

codeweave exposes 7 MCP tools that AI assistants can call:

| Tool | Description |
|------|-------------|
| `get_file_tree` | Annotated file tree, filterable by language |
| `get_file` | File content with line numbers and optional line range |
| `search_codebase` | Full-text search with snippet context |
| `get_conventions` | Detected naming style, import patterns, test framework |
| `get_dependencies` | All dependencies from parsed manifest files |
| `get_git_history` | Recent commits, filterable by file path |
| `get_stack_info` | Detected language, framework, database, tooling |

See the full [API reference →](docs/api.md)

---

## Architecture

```
your repo on disk
      │
      ▼
┌─────────────────────────────────────────────────────┐
│                   codeweave process                  │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │ File     │  │   Git    │  │  Manifest Parser  │ │
│  │ Scanner  │  │  Reader  │  │  (9 formats)      │ │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘ │
│       │              │                 │            │
│       └──────────────┴─────────────────┘            │
│                       │                             │
│              ┌────────▼────────┐                   │
│              │  SQLite DB      │                   │
│              │  (WAL + FTS5)   │◄──────────────────┤
│              └────────┬────────┘     File Watcher  │
│                       │                             │
│       ┌───────────────┼───────────────┐            │
│       ▼               ▼               ▼            │
│  get_file_tree   search_codebase  get_stack_info   │
│  get_file        get_conventions  get_dependencies │
│  get_git_history                                   │
│       │                                            │
│       └──────────────────────────────────────────┐ │
│                    MCP Server (stdio)             │ │
└───────────────────────────────────────────────────┘
                        │
              ┌─────────┘
              ▼
    AI client (Claude Code, Cursor, Zed…)
```

**Key design decisions:**

- **SQLite over in-memory** — the full file content lives on disk, not in the Node.js heap. Memory usage stays flat regardless of repo size.
- **FTS5 porter tokenizer** — full-text search that handles stemming (`authenticate` → `authenticat`) without any external dependencies.
- **mtime cache** — unchanged files are never re-read. Warm starts on a 1K-file repo take ~28ms.
- **Stdio transport** — no port conflicts, no firewall rules. Works in any environment where the AI client can spawn a subprocess.

---

## Supported Stacks

codeweave detects and parses:

**Languages:** TypeScript, JavaScript, Python, Go, Rust, Dart, Ruby, PHP, Java, Kotlin, Swift, and more

**Frameworks:** Next.js, Nuxt, Remix, SvelteKit, Astro, Vite+React, Express, Fastify, NestJS, Hono, Django, Flask, FastAPI, Rails, Laravel, Symfony, Angular, Vue, Svelte

**Databases:** Prisma, TypeORM, Drizzle, MongoDB, PostgreSQL, MySQL, SQLite, Redis, Sequelize

**Manifest formats:** `package.json`, `pubspec.yaml`, `Cargo.toml`, `go.mod`, `requirements.txt`, `pyproject.toml`, `composer.json`, `Gemfile`, `build.gradle`

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to fork, develop, test, and submit PRs.

```bash
git clone https://github.com/MdAbdullahAlMahmud/codeweave.git
cd codeweave
npm install
npm test         # run tests
npm run typecheck  # type check
npm run lint     # lint
```

---

## License

MIT © Abdullah — see [LICENSE](LICENSE) for details.
