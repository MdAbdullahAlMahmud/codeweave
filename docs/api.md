# codeweave API Reference

## Configuration

Full reference for `codeweave.config.js`.

### `include`

**Type:** `string[]` | **Default:** `['.']`

Directories or glob patterns to index, relative to the config file. Narrowing this to `['src']` on a large monorepo dramatically speeds up indexing.

```js
include: ['src', 'lib', 'packages']
```

### `exclude`

**Type:** `string[]` | **Default:** `[]`

Additional glob patterns to exclude on top of `.gitignore` rules. The patterns in `.gitignore` and `.codeweave-ignore` are always applied first.

```js
exclude: ['**/*.generated.ts', 'src/vendor/**']
```

### `maxFileSizeKB`

**Type:** `number` (positive integer) | **Default:** `100`

Files larger than this limit are truncated to `maxFileSizeKB` KB before being stored. This prevents very large generated files from dominating the context.

```js
maxFileSizeKB: 50   // 50 KB limit
```

### `gitDepth`

**Type:** `number` (positive integer) | **Default:** `50`

How many recent git commits to read and cache. Increase for deeper history in `get_git_history`.

```js
gitDepth: 100
```

### `port`

**Type:** `number` (1–65535) | **Default:** `3333`

Port number reserved for future HTTP transport. The current stdio transport does not use this value.

### `verbose`

**Type:** `boolean` | **Default:** `false`

Enables debug-level logging. Useful for troubleshooting indexing issues.

---

## MCP Tools

All tools return a JSON string in the `content[0].text` field.

---

### `get_file_tree`

Returns an annotated JSON tree of all indexed files.

**Input schema:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `include_languages` | `string[]` | No | Filter to only include files of these languages. Case-insensitive. |

**Output:**

```json
{
  "fileCount": 42,
  "tree": [
    {
      "path": "src",
      "language": "directory",
      "type": "directory",
      "children": [
        {
          "path": "src/index.ts",
          "language": "TypeScript",
          "type": "file"
        }
      ]
    },
    {
      "path": "README.md",
      "language": "Markdown",
      "type": "file"
    }
  ]
}
```

**Example call:**
```json
{ "include_languages": ["TypeScript", "Python"] }
```

---

### `get_file`

Returns the content of a specific indexed file.

**Input schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `path` | `string` | **Yes** | — | Relative path to the file (e.g. `"src/utils/logger.ts"`) |
| `line_numbers` | `boolean` | No | `true` | Prefix each line with its line number |
| `start_line` | `number` | No | — | First line to return (1-based) |
| `end_line` | `number` | No | — | Last line to return, inclusive (1-based) |

**Output:**

```json
{
  "path": "src/index.ts",
  "language": "TypeScript",
  "sizeBytes": 1024,
  "content": "   1 | import express from 'express';\n   2 | const app = express();\n   3 | app.listen(3000);\n"
}
```

**Error output (file not found):**

```json
{
  "error": "File not found",
  "path": "src/missing.ts",
  "hint": "Use get_file_tree to browse available files"
}
```

**Example — read lines 10–20:**
```json
{ "path": "src/server.ts", "start_line": 10, "end_line": 20 }
```

---

### `search_codebase`

Full-text search across all indexed files using SQLite FTS5.

**Input schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | **Yes** | — | Search query. Supports FTS5 syntax (see below). |
| `limit` | `number` (1–100) | No | `20` | Maximum results to return |

**FTS5 query syntax:**

| Syntax | Example | Matches |
|--------|---------|---------|
| Term | `authenticate` | Files containing "authenticate" or "authenticat*" (porter stemmed) |
| Phrase | `"user session"` | Files containing the exact phrase |
| AND | `authenticate user` | Files containing both terms |
| Prefix | `auth*` | Files containing any word starting with "auth" |
| NOT | `authenticate NOT test` | Files with "authenticate" but not "test" |

**Output:**

```json
{
  "query": "authenticate",
  "resultCount": 3,
  "elapsedMs": 1,
  "results": [
    {
      "path": "src/auth/service.ts",
      "snippet": "export async function <b>authenticate</b>(user: User): Promise<Session> {"
    }
  ]
}
```

---

### `get_conventions`

Returns detected coding conventions inferred from the indexed files.

**Input schema:** *(no parameters)*

**Output:**

```json
{
  "fileNaming": "camelCase",
  "fileNamingConfidence": 0.87,
  "importStyle": "relative",
  "componentStructure": "colocated",
  "testFramework": "vitest"
}
```

| Field | Possible values |
|-------|----------------|
| `fileNaming` | `"camelCase"`, `"PascalCase"`, `"snake_case"`, `"kebab-case"`, `"mixed"` |
| `fileNamingConfidence` | `0.0` – `1.0` |
| `importStyle` | `"relative"`, `"absolute"`, `"mixed"` |
| `componentStructure` | `"colocated"`, `"separate"`, `"unknown"` |
| `testFramework` | `"vitest"`, `"jest"`, `"mocha"`, `"jasmine"`, `"playwright"`, `"cypress"`, or `null` |

---

### `get_dependencies`

Returns all dependencies parsed from manifest files in the repo.

**Input schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `include_dev` | `boolean` | No | `true` | Whether to include dev dependencies |

**Output:**

```json
{
  "manifestCount": 1,
  "totalDependencies": 12,
  "manifests": [
    {
      "file": "package.json",
      "packageManager": "pnpm",
      "dependencies": [
        { "name": "express", "version": "^4.18.0", "dev": false },
        { "name": "vitest", "version": "^2.0.0", "dev": true }
      ]
    }
  ]
}
```

**Supported manifest formats:** `package.json`, `pubspec.yaml`, `Cargo.toml`, `go.mod`, `requirements.txt`, `pyproject.toml`, `composer.json`, `Gemfile`, `build.gradle`

---

### `get_git_history`

Returns recent git commits from the indexed history.

**Input schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | `number` (1–200) | No | `20` | Number of commits to return |
| `file_path` | `string` | No | — | Filter to commits that touched this path (substring match) |

**Output:**

```json
{
  "total": 2,
  "commits": [
    {
      "hash": "a3f8c12",
      "message": "feat: add user authentication",
      "author": "Alice",
      "date": "2024-03-15T10:22:00+00:00",
      "changedFiles": ["src/auth/service.ts", "src/auth/middleware.ts"]
    }
  ]
}
```

**Example — commits touching auth files:**
```json
{ "file_path": "src/auth", "limit": 10 }
```

---

### `get_stack_info`

Returns the detected technology stack for the repo.

**Input schema:** *(no parameters)*

**Output:**

```json
{
  "language": "TypeScript",
  "runtime": "Node.js",
  "framework": "Next.js",
  "database": "Prisma (ORM)",
  "testing": ["Vitest", "Testing Library"],
  "styling": ["Tailwind CSS"],
  "packageManager": "pnpm",
  "buildTool": "tsup",
  "raw": {
    "allDependencies": ["next", "react", "react-dom", "prisma", "..."]
  }
}
```

All fields except `raw` can be `null` if not detected.
