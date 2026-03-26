/**
 * Tests for MCP tool logic — we test the underlying DB operations and
 * output shapes directly, without spinning up a full MCP transport.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CodeweaveDb } from '../src/cache/db.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cw-mcp-test-'));
}

// ── Helpers that mirror what the tool handlers do ──────────────────────────

function buildTree(files: Array<{ path: string; language: string }>) {
  type Node = { path: string; language: string; type: 'file' | 'directory'; children?: Node[] };
  const root: Node[] = [];
  const dirMap = new Map<string, Node>();
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of sorted) {
    const parts = file.path.split('/');
    let parent = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join('/');
      let dir = dirMap.get(dirPath);
      if (!dir) {
        dir = { path: dirPath, language: 'directory', type: 'directory', children: [] };
        dirMap.set(dirPath, dir);
        parent.push(dir);
      }
      parent = dir.children!;
    }
    parent.push({ path: file.path, language: file.language, type: 'file' });
  }
  return root;
}

describe('get_file_tree logic', () => {
  let db: CodeweaveDb;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    db = new CodeweaveDb(path.join(tmpDir, 'test.db'));
    db.upsertFile({ path: 'src/index.ts', language: 'TypeScript', size_bytes: 100, mtime: 1, content: 'export {}' });
    db.upsertFile({ path: 'src/utils/helper.ts', language: 'TypeScript', size_bytes: 50, mtime: 1, content: 'export const x = 1' });
    db.upsertFile({ path: 'README.md', language: 'Markdown', size_bytes: 200, mtime: 1, content: '# Hello' });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('builds a tree with correct structure', () => {
    const files = db.getAllFiles().map((f) => ({ path: f.path, language: f.language }));
    const tree = buildTree(files);
    expect(tree.length).toBeGreaterThan(0);

    // src/ directory should be a node with children
    const src = tree.find((n) => n.path === 'src');
    expect(src?.type).toBe('directory');
    expect(src?.children?.length).toBeGreaterThan(0);
  });

  it('filters by language', () => {
    const all = db.getAllFiles().map((f) => ({ path: f.path, language: f.language }));
    const tsOnly = all.filter((f) => f.language === 'TypeScript');
    expect(tsOnly).toHaveLength(2);
  });
});

describe('get_file logic', () => {
  let db: CodeweaveDb;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    db = new CodeweaveDb(path.join(tmpDir, 'test.db'));
    db.upsertFile({
      path: 'src/app.ts',
      language: 'TypeScript',
      size_bytes: 100,
      mtime: 1,
      content: 'line1\nline2\nline3\nline4\nline5',
    });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('retrieves existing file', () => {
    const file = db.getFile('src/app.ts');
    expect(file).toBeDefined();
    expect(file!.language).toBe('TypeScript');
  });

  it('returns undefined for non-existent file', () => {
    expect(db.getFile('nonexistent.ts')).toBeUndefined();
  });

  it('slices content by line range', () => {
    const file = db.getFile('src/app.ts')!;
    const lines = file.content.split('\n');
    const sliced = lines.slice(1, 3).join('\n'); // lines 2–3
    expect(sliced).toBe('line2\nline3');
  });
});

describe('search_codebase logic', () => {
  let db: CodeweaveDb;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    db = new CodeweaveDb(path.join(tmpDir, 'test.db'));
    db.upsertFile({ path: 'auth.ts', language: 'TypeScript', size_bytes: 100, mtime: 1, content: 'function authenticate(user: string) { return true; }' });
    db.upsertFile({ path: 'server.ts', language: 'TypeScript', size_bytes: 100, mtime: 1, content: 'import express from "express"; const app = express();' });
    db.upsertFile({ path: 'config.ts', language: 'TypeScript', size_bytes: 100, mtime: 1, content: 'export const PORT = 3000;' });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns matching files', () => {
    const results = db.searchFiles('authenticate', 20);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('auth.ts');
  });

  it('returns empty array for no match', () => {
    expect(db.searchFiles('nonexistentxyz', 20)).toHaveLength(0);
  });

  it('respects limit', () => {
    // All 3 files have "export" or "const" or similar
    const results = db.searchFiles('express', 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('returns snippets with results', () => {
    const results = db.searchFiles('authenticate', 20);
    expect(results[0].snippet).toBeTruthy();
  });
});

describe('get_git_history logic', () => {
  let db: CodeweaveDb;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    db = new CodeweaveDb(path.join(tmpDir, 'test.db'));
    db.upsertCommit({ hash: 'abc', message: 'feat: auth', author: 'Alice', date: '2024-01-03', changed_files: '["src/auth.ts"]' });
    db.upsertCommit({ hash: 'def', message: 'fix: bug', author: 'Bob', date: '2024-01-02', changed_files: '["src/server.ts"]' });
    db.upsertCommit({ hash: 'ghi', message: 'init', author: 'Alice', date: '2024-01-01', changed_files: '["README.md"]' });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('retrieves commits up to limit', () => {
    const commits = db.getCommits(2);
    expect(commits).toHaveLength(2);
  });

  it('filters by file path', () => {
    const commits = db.getCommits(200).filter((c) => {
      const files = JSON.parse(c.changed_files) as string[];
      return files.some((f) => f.includes('auth.ts'));
    });
    expect(commits).toHaveLength(1);
    expect(commits[0].hash).toBe('abc');
  });
});

describe('get_stack_info logic', () => {
  let db: CodeweaveDb;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    db = new CodeweaveDb(path.join(tmpDir, 'test.db'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns stored stack info JSON', () => {
    const stackData = { language: 'TypeScript', framework: 'Next.js' };
    db.setStackInfo('stack', JSON.stringify(stackData));
    const raw = db.getStackInfo('stack');
    expect(JSON.parse(raw!)).toMatchObject(stackData);
  });

  it('returns undefined when not set', () => {
    expect(db.getStackInfo('stack')).toBeUndefined();
  });
});

describe('get_dependencies logic', () => {
  let db: CodeweaveDb;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    db = new CodeweaveDb(path.join(tmpDir, 'test.db'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('retrieves stored manifest data', () => {
    const manifests = [
      {
        file: 'package.json',
        packageManager: 'npm',
        dependencies: [
          { name: 'react', version: '^18', dev: false },
          { name: 'vitest', version: '^2', dev: true },
        ],
      },
    ];
    db.setStackInfo('manifests', JSON.stringify(manifests));
    const raw = db.getStackInfo('manifests');
    const parsed = JSON.parse(raw!) as typeof manifests;
    expect(parsed[0].dependencies).toHaveLength(2);
  });

  it('can filter dev dependencies', () => {
    const manifests = [
      {
        file: 'package.json',
        packageManager: 'npm',
        dependencies: [
          { name: 'react', version: '^18', dev: false },
          { name: 'vitest', version: '^2', dev: true },
        ],
      },
    ];
    db.setStackInfo('manifests', JSON.stringify(manifests));
    const raw = db.getStackInfo('manifests');
    const parsed = JSON.parse(raw!) as typeof manifests;
    const prodOnly = parsed.map((m) => ({
      ...m,
      dependencies: m.dependencies.filter((d) => !d.dev),
    }));
    expect(prodOnly[0].dependencies).toHaveLength(1);
    expect(prodOnly[0].dependencies[0].name).toBe('react');
  });
});
