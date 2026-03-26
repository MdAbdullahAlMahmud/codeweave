import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectLanguage, scanFiles } from '../src/indexer/fileScanner.js';
import { createIgnoreRules } from '../src/utils/ignoreRules.js';
import { CodeweaveDb } from '../src/cache/db.js';
import { DEFAULT_CONFIG } from '../src/config/index.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cw-scan-test-'));
}

describe('detectLanguage', () => {
  it('detects TypeScript', () => expect(detectLanguage('src/index.ts')).toBe('TypeScript'));
  it('detects TSX', () => expect(detectLanguage('App.tsx')).toBe('TypeScript'));
  it('detects JavaScript', () => expect(detectLanguage('app.js')).toBe('JavaScript'));
  it('detects Python', () => expect(detectLanguage('main.py')).toBe('Python'));
  it('detects Go', () => expect(detectLanguage('main.go')).toBe('Go'));
  it('detects Rust', () => expect(detectLanguage('lib.rs')).toBe('Rust'));
  it('detects Markdown', () => expect(detectLanguage('README.md')).toBe('Markdown'));
  it('detects JSON', () => expect(detectLanguage('config.json')).toBe('JSON'));
  it('returns Unknown for unrecognized extension', () => expect(detectLanguage('file.xyz')).toBe('Unknown'));
  it('is case-insensitive for extension', () => expect(detectLanguage('FILE.TS')).toBe('TypeScript'));
});

describe('scanFiles', () => {
  let tmpDir: string;
  let dbDir: string;
  let db: CodeweaveDb;

  beforeEach(() => {
    tmpDir = makeTempDir();
    dbDir = makeTempDir(); // Keep DB outside the scanned repo root
    db = new CodeweaveDb(path.join(dbDir, 'test.db'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  it('indexes files in the repo', async () => {
    fs.writeFileSync(path.join(tmpDir, 'index.ts'), 'const x = 1;');
    fs.writeFileSync(path.join(tmpDir, 'utils.ts'), 'export function noop() {}');

    const ignoreRules = createIgnoreRules(tmpDir);
    const result = await scanFiles(tmpDir, DEFAULT_CONFIG, db, ignoreRules);

    expect(result.fileCount).toBe(2);
    expect(result.languageCounts['TypeScript']).toBe(2);
  });

  it('skips binary files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'src.ts'), 'code');
    fs.writeFileSync(path.join(tmpDir, 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const result = await scanFiles(tmpDir, DEFAULT_CONFIG, db, createIgnoreRules(tmpDir));
    expect(result.fileCount).toBe(1);
    expect(result.skippedCount).toBe(1);
  });

  it('skips ignored directories', async () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg', 'index.js'), 'module.exports = {}');
    fs.writeFileSync(path.join(tmpDir, 'app.ts'), 'const y = 2;');

    const result = await scanFiles(tmpDir, DEFAULT_CONFIG, db, createIgnoreRules(tmpDir));
    expect(result.fileCount).toBe(1);
  });

  it('truncates files above maxFileSizeKB', async () => {
    const bigContent = 'x'.repeat(200 * 1024); // 200 KB
    fs.writeFileSync(path.join(tmpDir, 'big.ts'), bigContent);

    const config = { ...DEFAULT_CONFIG, maxFileSizeKB: 10 };
    await scanFiles(tmpDir, config, db, createIgnoreRules(tmpDir));

    const row = db.getFile('big.ts');
    expect(row).toBeDefined();
    expect(row!.content.length).toBeLessThanOrEqual(10 * 1024 + 10); // small tolerance
  });

  it('uses mtime cache to skip unchanged files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'cached.ts'), 'const a = 1;');

    // First scan
    await scanFiles(tmpDir, DEFAULT_CONFIG, db, createIgnoreRules(tmpDir));
    // Modify content directly in DB to detect if re-indexed
    db.upsertFile({ path: 'cached.ts', language: 'TypeScript', size_bytes: 5, mtime: db.getFile('cached.ts')!.mtime, content: 'SENTINEL' });

    // Second scan — mtime unchanged, should use cache
    await scanFiles(tmpDir, DEFAULT_CONFIG, db, createIgnoreRules(tmpDir));
    expect(db.getFile('cached.ts')!.content).toBe('SENTINEL');
  });

  it('returns a tree structure', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), 'export {}');
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# hi');

    const result = await scanFiles(tmpDir, DEFAULT_CONFIG, db, createIgnoreRules(tmpDir));
    expect(result.tree.length).toBeGreaterThan(0);
  });
});
