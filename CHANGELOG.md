# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-03-26

### Added

#### MCP Server & Tools
- `get_file_tree` — annotated JSON file tree, filterable by language
- `get_file` — file content with line numbers and optional line range slicing
- `search_codebase` — FTS5 full-text search with porter stemming and snippet context
- `get_conventions` — detected file naming style, import patterns, component structure, test framework
- `get_dependencies` — parsed dependencies from all manifest files, grouped by dev/prod
- `get_git_history` — recent commits with author, date, changed files; filterable by path
- `get_stack_info` — auto-detected language, framework, database, testing tools, build tool

#### Repo Indexer
- File scanner with `fast-glob`, language detection for 40+ extensions, mtime-based cache invalidation
- Files > `maxFileSizeKB` are truncated rather than skipped
- Git history reader via `simple-git` with graceful non-repo fallback
- Manifest parser for 9 formats: `package.json`, `pubspec.yaml`, `Cargo.toml`, `go.mod`, `requirements.txt`, `pyproject.toml`, `composer.json`, `Gemfile`, `build.gradle`
- Stack detector: language, runtime, framework, database, testing, styling, package manager, build tool
- Convention detector: file naming case (camelCase/PascalCase/snake_case/kebab-case), import style, component structure

#### Storage
- SQLite database in WAL mode at `~/.codeweave/<repo-hash>/cache.db`
- FTS5 virtual table with porter tokenizer for sub-millisecond full-text search
- Schema versioning with migration system

#### File Watcher
- chokidar-based watcher with 300ms debounce
- Add/change/delete events all kept in sync with the SQLite cache

#### CLI
- `codeweave start` (default) — indexes repo, starts MCP server, prints AI client config snippets
- `codeweave init` — generates annotated `codeweave.config.js` with auto-detected include paths
- `codeweave status` — shows file count, language breakdown, DB size, token estimate, stack summary
- `--verbose` flag on all commands

#### Performance
- 1,000-file repo indexed in ~300ms cold start
- Warm start (mtime cache, no changes) ~28ms
- FTS search < 1ms
- Single file fetch < 0.1ms

#### Open-source foundation
- MIT license
- CI/CD with GitHub Actions (Node 20/22/23 matrix, Ubuntu + macOS)
- npm publish workflow with provenance
- Contributing guide, issue templates, PR template

[0.1.0]: https://github.com/abdullahbs23/codeweave/releases/tag/v0.1.0
