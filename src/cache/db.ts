import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';

export interface FileRow {
  path: string;
  language: string;
  size_bytes: number;
  mtime: number;
  content: string;
  created_at: number;
}

export interface CommitRow {
  hash: string;
  message: string;
  author: string;
  date: string;
  changed_files: string; // JSON array of file paths
}

export interface StackInfoRow {
  key: string;
  value: string;
}

const SCHEMA_VERSION = 1;

const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  path        TEXT PRIMARY KEY NOT NULL,
  language    TEXT NOT NULL DEFAULT '',
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  mtime       INTEGER NOT NULL DEFAULT 0,
  content     TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
  path UNINDEXED,
  content,
  tokenize = 'porter ascii'
);

CREATE TABLE IF NOT EXISTS commits (
  hash          TEXT PRIMARY KEY NOT NULL,
  message       TEXT NOT NULL DEFAULT '',
  author        TEXT NOT NULL DEFAULT '',
  date          TEXT NOT NULL DEFAULT '',
  changed_files TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS stack_info (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL DEFAULT ''
);
`;

/**
 * Returns the absolute path to the SQLite DB for the given repo root.
 * DB is stored at ~/.codeweave/<repo-hash>/cache.db
 */
export function getDbPath(repoRoot: string): string {
  const hash = crypto.createHash('sha1').update(repoRoot).digest('hex').slice(0, 12);
  const dir = path.join(os.homedir(), '.codeweave', hash);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'cache.db');
}

export class CodeweaveDb {
  private db: Database.Database;

  constructor(dbPath: string) {
    logger.verbose(`Opening database at ${dbPath}`);
    this.db = new Database(dbPath);
    this.migrate();
  }

  private migrate(): void {
    // Apply schema (idempotent CREATE IF NOT EXISTS)
    this.db.exec(SCHEMA_SQL);

    // Check/set schema version
    const row = this.db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
      | { version: number }
      | undefined;

    if (!row) {
      this.db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
      logger.verbose(`Database initialized at schema version ${SCHEMA_VERSION}`);
    } else if (row.version < SCHEMA_VERSION) {
      // Future migrations go here
      this.db.prepare('UPDATE schema_version SET version = ?').run(SCHEMA_VERSION);
      logger.verbose(`Database migrated to schema version ${SCHEMA_VERSION}`);
    }
  }

  // ── Files ─────────────────────────────────────────────────────────────────

  upsertFile(row: Omit<FileRow, 'created_at'>): void {
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO files (path, language, size_bytes, mtime, content)
           VALUES (@path, @language, @size_bytes, @mtime, @content)
           ON CONFLICT(path) DO UPDATE SET
             language   = excluded.language,
             size_bytes = excluded.size_bytes,
             mtime      = excluded.mtime,
             content    = excluded.content`,
        )
        .run(row);

      // Keep FTS in sync
      this.db.prepare('DELETE FROM files_fts WHERE path = ?').run(row.path);
      this.db.prepare('INSERT INTO files_fts (path, content) VALUES (?, ?)').run(row.path, row.content);
    })();
  }

  deleteFile(filePath: string): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM files WHERE path = ?').run(filePath);
      this.db.prepare('DELETE FROM files_fts WHERE path = ?').run(filePath);
    })();
  }

  getFile(filePath: string): FileRow | undefined {
    return this.db.prepare('SELECT * FROM files WHERE path = ?').get(filePath) as
      | FileRow
      | undefined;
  }

  getFileMtime(filePath: string): number | undefined {
    const row = this.db
      .prepare('SELECT mtime FROM files WHERE path = ?')
      .get(filePath) as { mtime: number } | undefined;
    return row?.mtime;
  }

  getAllFiles(): FileRow[] {
    return this.db.prepare('SELECT * FROM files ORDER BY path').all() as FileRow[];
  }

  getFileCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as n FROM files').get() as { n: number };
    return row.n;
  }

  searchFiles(query: string, limit = 20): Array<{ path: string; snippet: string }> {
    return this.db
      .prepare(
        `SELECT f.path, snippet(files_fts, 1, '<b>', '</b>', '…', 32) AS snippet
         FROM files_fts
         JOIN files f ON f.path = files_fts.path
         WHERE files_fts MATCH ?
         LIMIT ?`,
      )
      .all(query, limit) as Array<{ path: string; snippet: string }>;
  }

  // ── Commits ────────────────────────────────────────────────────────────────

  upsertCommit(row: CommitRow): void {
    this.db
      .prepare(
        `INSERT INTO commits (hash, message, author, date, changed_files)
         VALUES (@hash, @message, @author, @date, @changed_files)
         ON CONFLICT(hash) DO NOTHING`,
      )
      .run(row);
  }

  getCommits(limit = 50): CommitRow[] {
    return this.db
      .prepare('SELECT * FROM commits ORDER BY date DESC LIMIT ?')
      .all(limit) as CommitRow[];
  }

  // ── Stack info ─────────────────────────────────────────────────────────────

  setStackInfo(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO stack_info (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value);
  }

  getStackInfo(key: string): string | undefined {
    const row = this.db
      .prepare('SELECT value FROM stack_info WHERE key = ?')
      .get(key) as { value: string } | undefined;
    return row?.value;
  }

  getAllStackInfo(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM stack_info').all() as StackInfoRow[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  // ── Housekeeping ────────────────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }

  /** Wipe all indexed data (files, fts, commits, stack_info) but keep schema. */
  clearAll(): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM files').run();
      this.db.prepare('DELETE FROM files_fts').run();
      this.db.prepare('DELETE FROM commits').run();
      this.db.prepare('DELETE FROM stack_info').run();
    })();
  }

  getDbSizeBytes(): number {
    const row = this.db.prepare('PRAGMA page_size').get() as { page_size: number };
    const row2 = this.db.prepare('PRAGMA page_count').get() as { page_count: number };
    return row.page_size * row2.page_count;
  }
}

/** Factory: open (or create) the DB for a given repo root. */
export function openDb(repoRoot: string): CodeweaveDb {
  const dbPath = getDbPath(repoRoot);
  return new CodeweaveDb(dbPath);
}
