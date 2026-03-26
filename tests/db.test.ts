import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CodeweaveDb, getDbPath } from '../src/cache/db.js';

function makeTempDb(): { db: CodeweaveDb; dbPath: string; tmpDir: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-db-test-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const db = new CodeweaveDb(dbPath);
  return { db, dbPath, tmpDir };
}

describe('CodeweaveDb', () => {
  let db: CodeweaveDb;
  let tmpDir: string;

  beforeEach(() => {
    ({ db, tmpDir } = makeTempDb());
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Schema / Creation ──────────────────────────────────────────────────────

  it('creates the database without errors', () => {
    expect(() => new CodeweaveDb(path.join(tmpDir, 'new.db'))).not.toThrow();
  });

  // ── Files ──────────────────────────────────────────────────────────────────

  it('upserts a file and retrieves it', () => {
    db.upsertFile({ path: 'src/index.ts', language: 'typescript', size_bytes: 200, mtime: 1000, content: 'const x = 1;' });
    const row = db.getFile('src/index.ts');
    expect(row).toBeDefined();
    expect(row!.language).toBe('typescript');
    expect(row!.content).toBe('const x = 1;');
  });

  it('updates a file on second upsert', () => {
    db.upsertFile({ path: 'src/index.ts', language: 'typescript', size_bytes: 100, mtime: 1, content: 'old' });
    db.upsertFile({ path: 'src/index.ts', language: 'typescript', size_bytes: 200, mtime: 2, content: 'new' });
    const row = db.getFile('src/index.ts');
    expect(row!.content).toBe('new');
    expect(row!.mtime).toBe(2);
  });

  it('returns undefined for non-existent file', () => {
    expect(db.getFile('does-not-exist.ts')).toBeUndefined();
  });

  it('deletes a file', () => {
    db.upsertFile({ path: 'src/app.ts', language: 'typescript', size_bytes: 50, mtime: 1, content: 'hello' });
    db.deleteFile('src/app.ts');
    expect(db.getFile('src/app.ts')).toBeUndefined();
  });

  it('getFileMtime returns the mtime', () => {
    db.upsertFile({ path: 'src/main.ts', language: 'typescript', size_bytes: 50, mtime: 9999, content: '' });
    expect(db.getFileMtime('src/main.ts')).toBe(9999);
  });

  it('getFileCount returns correct count', () => {
    expect(db.getFileCount()).toBe(0);
    db.upsertFile({ path: 'a.ts', language: 'typescript', size_bytes: 1, mtime: 1, content: '' });
    db.upsertFile({ path: 'b.ts', language: 'typescript', size_bytes: 1, mtime: 1, content: '' });
    expect(db.getFileCount()).toBe(2);
  });

  it('getAllFiles returns all rows', () => {
    db.upsertFile({ path: 'a.ts', language: 'typescript', size_bytes: 1, mtime: 1, content: '' });
    db.upsertFile({ path: 'b.ts', language: 'typescript', size_bytes: 1, mtime: 1, content: '' });
    expect(db.getAllFiles()).toHaveLength(2);
  });

  // ── Full-text search ───────────────────────────────────────────────────────

  it('searches file content via FTS', () => {
    db.upsertFile({ path: 'src/auth.ts', language: 'typescript', size_bytes: 100, mtime: 1, content: 'function authenticate(user: string) { return true; }' });
    db.upsertFile({ path: 'src/server.ts', language: 'typescript', size_bytes: 100, mtime: 1, content: 'import express from "express"; const app = express();' });

    const results = db.searchFiles('authenticate');
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('src/auth.ts');
  });

  it('FTS result is removed when file is deleted', () => {
    db.upsertFile({ path: 'src/auth.ts', language: 'typescript', size_bytes: 100, mtime: 1, content: 'function authenticate() {}' });
    db.deleteFile('src/auth.ts');
    expect(db.searchFiles('authenticate')).toHaveLength(0);
  });

  // ── Commits ────────────────────────────────────────────────────────────────

  it('upserts and retrieves commits', () => {
    db.upsertCommit({ hash: 'abc123', message: 'feat: add login', author: 'Alice', date: '2024-01-01T00:00:00Z', changed_files: '["src/auth.ts"]' });
    const commits = db.getCommits(10);
    expect(commits).toHaveLength(1);
    expect(commits[0].message).toBe('feat: add login');
  });

  it('does not duplicate commits on second upsert', () => {
    const commit = { hash: 'abc123', message: 'fix: bug', author: 'Bob', date: '2024-01-01T00:00:00Z', changed_files: '[]' };
    db.upsertCommit(commit);
    db.upsertCommit(commit);
    expect(db.getCommits(10)).toHaveLength(1);
  });

  // ── Stack info ─────────────────────────────────────────────────────────────

  it('sets and gets stack info', () => {
    db.setStackInfo('language', 'TypeScript');
    expect(db.getStackInfo('language')).toBe('TypeScript');
  });

  it('overwrites stack info on update', () => {
    db.setStackInfo('framework', 'Express');
    db.setStackInfo('framework', 'Fastify');
    expect(db.getStackInfo('framework')).toBe('Fastify');
  });

  it('returns undefined for missing stack key', () => {
    expect(db.getStackInfo('nonexistent')).toBeUndefined();
  });

  it('getAllStackInfo returns all entries', () => {
    db.setStackInfo('a', '1');
    db.setStackInfo('b', '2');
    const all = db.getAllStackInfo();
    expect(all).toEqual({ a: '1', b: '2' });
  });

  // ── Housekeeping ───────────────────────────────────────────────────────────

  it('clearAll removes all data', () => {
    db.upsertFile({ path: 'x.ts', language: 'typescript', size_bytes: 1, mtime: 1, content: 'x' });
    db.upsertCommit({ hash: 'h1', message: 'msg', author: 'a', date: '2024', changed_files: '[]' });
    db.setStackInfo('k', 'v');
    db.clearAll();
    expect(db.getFileCount()).toBe(0);
    expect(db.getCommits(10)).toHaveLength(0);
    expect(db.getAllStackInfo()).toEqual({});
  });

  it('getDbSizeBytes returns a positive number', () => {
    expect(db.getDbSizeBytes()).toBeGreaterThan(0);
  });
});

describe('getDbPath', () => {
  it('returns a path inside ~/.codeweave', () => {
    const p = getDbPath('/some/repo/path');
    expect(p).toContain('.codeweave');
    expect(p.endsWith('cache.db')).toBe(true);
  });

  it('returns different paths for different repos', () => {
    const p1 = getDbPath('/repo/a');
    const p2 = getDbPath('/repo/b');
    expect(p1).not.toBe(p2);
  });

  it('returns the same path for the same repo', () => {
    expect(getDbPath('/repo/x')).toBe(getDbPath('/repo/x'));
  });
});
