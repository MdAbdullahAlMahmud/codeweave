# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of codeweave v0.1.0
- MCP server with 7 tools: `get_file_tree`, `get_file`, `search_codebase`, `get_conventions`, `get_dependencies`, `get_git_history`, `get_stack_info`
- Repo indexer with file scanner, git reader, package parser, stack detector, convention detector
- SQLite-based local cache with FTS5 full-text search
- File watcher for live cache updates via chokidar
- CLI commands: `start` (default), `init`, `status`
- Auto-detection of tech stack from manifest files (package.json, pubspec.yaml, Cargo.toml, go.mod, etc.)
- Support for `.gitignore` and `.codeweave-ignore` rules
- Zero API key required — all static analysis, no cloud dependency
