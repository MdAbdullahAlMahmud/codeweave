# codeweave CLI Reference

## Usage

```
codeweave [command] [options]
```

Running `codeweave` with no command starts the MCP server (same as `codeweave start`).

---

## Commands

### `codeweave start`

Start the MCP server for the current directory. This is the **default command** — running `codeweave` alone is equivalent.

```bash
codeweave start [--verbose]
```

**What it does:**

1. Loads `codeweave.config.js` from the current directory (falls back to defaults)
2. Opens (or creates) the SQLite cache at `~/.codeweave/<repo-hash>/cache.db`
3. Scans all files matching `include` paths, skipping `.gitignore` patterns and binaries
4. Reads recent git commits up to `gitDepth`
5. Parses all manifest files and detects the technology stack
6. Registers 7 MCP tools and connects via stdio transport
7. Starts the file watcher — re-indexes changed files within ~300ms of a save

**Options:**

| Flag | Description |
|------|-------------|
| `--verbose` | Enable debug logging (file-by-file indexing, cache hits, watcher events) |

**Example:**

```bash
# Start with debug output
codeweave start --verbose
```

---

### `codeweave init`

Generate a `codeweave.config.js` in the current directory.

```bash
codeweave init [--verbose]
```

**What it does:**

1. Checks for an existing `codeweave.config.js` — prompts before overwriting
2. Detects common source directories (`src/`, `lib/`, `app/`, `packages/`, etc.)
3. Generates a fully annotated config file pre-filled with detected paths
4. Prints next steps

**Example output:**

```
ok    Created codeweave.config.js

Next steps:
  1. Review codeweave.config.js and adjust include paths
  2. Add to your AI client config (run `codeweave start` for snippets)
  3. Start the server: codeweave start
```

---

### `codeweave status`

Show indexing statistics for the current repo's cache.

```bash
codeweave status [--verbose]
```

**Output includes:**

- Total indexed file count
- Git commit count
- SQLite DB size on disk
- Estimated token count (cl100k_base approximation)
- Language breakdown with percentage bar
- Detected stack summary (language, framework, package manager)
- Active config values

**Example output:**

```
── codeweave status ────────────────────────────────────────────
  Indexed files  : 342
  Git commits    : 47
  DB size        : 1842.0 KB
  Est. tokens    : 284.3K

  Language breakdown:
    TypeScript          214  ████████████████
    Markdown             48  ████
    JSON                 32  ███
    JavaScript           24  ██
    YAML                 18  ██
    CSS                   6  █

  Detected stack:
    Language    : TypeScript
    Framework   : Next.js
    Pkg manager : pnpm

  Config:
    include       : src, app
    maxFileSizeKB : 100
    gitDepth      : 50
────────────────────────────────────────────────────────────────
```

---

## Global Options

| Flag | Description |
|------|-------------|
| `-V, --version` | Print version number and exit |
| `-h, --help` | Show help text |

---

## Environment

codeweave stores its cache at:

```
~/.codeweave/<sha1-of-repo-path>/cache.db
```

Each repo gets its own isolated database. The directory is created automatically on first run.

To clear the cache for the current repo, delete the directory:

```bash
rm -rf ~/.codeweave/$(node -e "
  const crypto = require('crypto');
  const p = require('path').resolve('.');
  console.log(crypto.createHash('sha1').update(p).digest('hex').slice(0, 12));
")
```
