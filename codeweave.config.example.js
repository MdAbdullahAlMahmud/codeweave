// codeweave.config.example.js
//
// Copy this file to codeweave.config.js in your project root,
// or run `codeweave init` to generate one automatically.
//
// All fields are optional. Defaults work well for most projects.

/** @type {import('codeweave').CodeweaveConfig} */
export default {
  // ── What to index ──────────────────────────────────────────────────────────
  //
  // Directories to include, relative to this config file.
  // Default: ['.'] (entire repo)
  //
  // Tip: narrow this down on large monorepos for faster indexing.
  // Example: ['src', 'lib'] or ['packages/core/src', 'packages/ui/src']
  include: ['src'],

  // Additional glob patterns to exclude on top of .gitignore.
  // Default: []
  //
  // .gitignore patterns are ALWAYS applied — you don't need to repeat them here.
  // Use this for repo-specific extras.
  // Example: ['**/*.generated.ts', 'src/fixtures/**', '**/__mocks__/**']
  exclude: [],

  // ── File handling ──────────────────────────────────────────────────────────
  //
  // Maximum file size to index in KB. Files larger than this limit are
  // truncated to this size before storage.
  // Default: 100 (100 KB)
  //
  // Lower this if you have many large generated files bloating the context.
  maxFileSizeKB: 100,

  // ── Git integration ────────────────────────────────────────────────────────
  //
  // How many recent commits to read from git history.
  // Default: 50
  //
  // Increase for a richer `get_git_history` result.
  // Set to 0 to disable git history entirely.
  gitDepth: 50,

  // ── Server ─────────────────────────────────────────────────────────────────
  //
  // Port reserved for future HTTP/SSE transport.
  // The current stdio transport does not use this value.
  // Default: 3333
  port: 3333,

  // ── Logging ────────────────────────────────────────────────────────────────
  //
  // Enable verbose/debug output — shows each file being indexed,
  // cache hits, watcher events, and config loading details.
  // Default: false
  //
  // You can also pass --verbose on the CLI without changing this file.
  verbose: false,
};
