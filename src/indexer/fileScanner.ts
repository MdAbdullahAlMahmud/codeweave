import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { IgnoreRules } from '../utils/ignoreRules.js';
import { logger } from '../utils/logger.js';
import type { CodeweaveConfig } from '../config/index.js';
import type { CodeweaveDb } from '../cache/db.js';

/** Map from file extension to canonical language name. */
const EXT_TO_LANGUAGE: Record<string, string> = {
  // TypeScript / JavaScript
  ts: 'TypeScript', tsx: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript',
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  // Web
  html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'SASS', less: 'LESS',
  // Systems
  rs: 'Rust', go: 'Go', c: 'C', h: 'C', cpp: 'C++', hpp: 'C++', cc: 'C++',
  // JVM
  java: 'Java', kt: 'Kotlin', kts: 'Kotlin', scala: 'Scala', groovy: 'Groovy',
  // Scripting
  py: 'Python', rb: 'Ruby', php: 'PHP', lua: 'Lua', pl: 'Perl',
  // Shell
  sh: 'Shell', bash: 'Shell', zsh: 'Shell', fish: 'Shell', ps1: 'PowerShell',
  // Data / config
  json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', xml: 'XML',
  csv: 'CSV', sql: 'SQL',
  // Docs
  md: 'Markdown', mdx: 'Markdown', rst: 'reStructuredText', txt: 'Text',
  // Mobile
  swift: 'Swift', m: 'Objective-C', dart: 'Dart',
  // Other
  ex: 'Elixir', exs: 'Elixir', erl: 'Erlang', hrl: 'Erlang',
  hs: 'Haskell', lhs: 'Haskell', clj: 'Clojure', cljs: 'Clojure',
  r: 'R', jl: 'Julia', tf: 'Terraform', hcl: 'HCL',
  vue: 'Vue', svelte: 'Svelte', astro: 'Astro',
};

export interface FileNode {
  path: string;
  language: string;
  sizeBytes: number;
  children?: FileNode[];
}

export interface ScanResult {
  fileCount: number;
  skippedCount: number;
  tree: FileNode[];
  languageCounts: Record<string, number>;
}

export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return EXT_TO_LANGUAGE[ext] ?? 'Unknown';
}

/**
 * Recursively scan the repo, index files into SQLite, and return a tree.
 */
export async function scanFiles(
  repoRoot: string,
  config: CodeweaveConfig,
  db: CodeweaveDb,
  ignoreRules: IgnoreRules,
): Promise<ScanResult> {
  const maxBytes = config.maxFileSizeKB * 1024;
  const patterns = config.include.map((p) => (p === '.' ? '**/*' : `${p}/**/*`));

  const entries = await fg(patterns, {
    cwd: repoRoot,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
  });

  if (entries.length > 50_000) {
    logger.warn(`Repo contains ${entries.length} files — indexing may be slow. Consider narrowing "include" paths.`);
  }

  let fileCount = 0;
  let skippedCount = 0;
  const languageCounts: Record<string, number> = {};
  const treeMap = new Map<string, FileNode>();

  for (const relPath of entries) {
    if (ignoreRules.shouldSkip(relPath)) {
      skippedCount++;
      continue;
    }

    const absPath = path.join(repoRoot, relPath);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(absPath);
    } catch {
      logger.verbose(`Skipping unreadable file: ${relPath}`);
      skippedCount++;
      continue;
    }

    const mtime = Math.floor(stat.mtimeMs);
    const cachedMtime = db.getFileMtime(relPath);

    if (cachedMtime === mtime) {
      // Cache hit — count it but skip re-indexing
      const cached = db.getFile(relPath);
      if (cached) {
        fileCount++;
        languageCounts[cached.language] = (languageCounts[cached.language] ?? 0) + 1;
        treeMap.set(relPath, { path: relPath, language: cached.language, sizeBytes: cached.size_bytes });
        continue;
      }
    }

    let content: string;
    try {
      const raw = fs.readFileSync(absPath);
      if (raw.length > maxBytes) {
        content = raw.slice(0, maxBytes).toString('utf8');
        logger.verbose(`Truncated ${relPath} at ${config.maxFileSizeKB}KB`);
      } else {
        content = raw.toString('utf8');
      }
    } catch {
      logger.verbose(`Could not read ${relPath} — skipping`);
      skippedCount++;
      continue;
    }

    const language = detectLanguage(relPath);

    db.upsertFile({
      path: relPath,
      language,
      size_bytes: stat.size,
      mtime,
      content,
    });

    fileCount++;
    languageCounts[language] = (languageCounts[language] ?? 0) + 1;
    treeMap.set(relPath, { path: relPath, language, sizeBytes: stat.size });
    logger.verbose(`Indexed ${relPath} (${language})`);
  }

  logger.success(`Indexed ${fileCount} files (${skippedCount} skipped)`);

  return {
    fileCount,
    skippedCount,
    tree: buildTree(treeMap),
    languageCounts,
  };
}

/** Build a hierarchical tree from a flat map of file paths. */
function buildTree(fileMap: Map<string, FileNode>): FileNode[] {
  const root: FileNode[] = [];
  const dirs = new Map<string, FileNode>();

  for (const [relPath, node] of fileMap) {
    const parts = relPath.split('/');
    if (parts.length === 1) {
      root.push(node);
      continue;
    }

    let parent = root;
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      let dir = dirs.get(currentPath);
      if (!dir) {
        dir = { path: currentPath, language: 'Directory', sizeBytes: 0, children: [] };
        dirs.set(currentPath, dir);
        parent.push(dir);
      }
      parent = dir.children!;
    }
    parent.push(node);
  }

  return root;
}
