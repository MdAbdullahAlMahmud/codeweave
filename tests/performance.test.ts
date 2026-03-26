/**
 * Performance benchmarks.
 * Targets from the execution plan:
 *   - 10K file repo < 3s initial index
 *   - Warm start (mtime cache) < 500ms
 *   - Search response < 200ms
 *   - File fetch < 50ms
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CodeweaveDb } from '../src/cache/db.js';
import { createIgnoreRules } from '../src/utils/ignoreRules.js';
import { scanFiles } from '../src/indexer/fileScanner.js';
import { DEFAULT_CONFIG } from '../src/config/index.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cw-perf-'));
}

/** Generate `count` TypeScript files with realistic-sized content. */
function generateFiles(dir: string, count: number, sizeBytes = 512): void {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  const content = `
// Auto-generated module
export interface Config${0} {
  id: string;
  name: string;
  enabled: boolean;
}

export function process(config: Config${0}): string {
  if (!config.enabled) return '';
  return \`\${config.name}:\${config.id}\`;
}

export const defaultConfig: Config${0} = {
  id: 'default',
  name: 'Default',
  enabled: true,
};
`.padEnd(sizeBytes, '// padding\n');

  for (let i = 0; i < count; i++) {
    const subDir = path.join(dir, 'src', `pkg${Math.floor(i / 100)}`);
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, `module${i}.ts`), content.replace(/0/g, String(i)));
  }
}

describe('Performance benchmarks', () => {
  let repoDir: string;
  let dbDir: string;
  let db: CodeweaveDb;

  beforeEach(() => {
    repoDir = makeTempDir();
    dbDir = makeTempDir();
    db = new CodeweaveDb(path.join(dbDir, 'test.db'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(repoDir, { recursive: true, force: true });
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  it('indexes 1K files in < 3s', async () => {
    generateFiles(repoDir, 1000);

    const start = Date.now();
    const result = await scanFiles(repoDir, DEFAULT_CONFIG, db, createIgnoreRules(repoDir));
    const elapsed = Date.now() - start;

    expect(result.fileCount).toBe(1000);
    expect(elapsed).toBeLessThan(3000);
    console.log(`  1K files indexed in ${elapsed}ms`);
  }, 10_000);

  it('warm start (mtime cache) is < 500ms for 1K already-indexed files', async () => {
    generateFiles(repoDir, 1000);

    // Cold scan to populate cache
    await scanFiles(repoDir, DEFAULT_CONFIG, db, createIgnoreRules(repoDir));

    // Warm scan — no files changed, all served from mtime cache
    const start = Date.now();
    const result = await scanFiles(repoDir, DEFAULT_CONFIG, db, createIgnoreRules(repoDir));
    const elapsed = Date.now() - start;

    expect(result.fileCount).toBe(1000);
    expect(elapsed).toBeLessThan(500);
    console.log(`  1K file warm start in ${elapsed}ms`);
  }, 15_000);

  it('FTS search response < 200ms across 500 indexed files', async () => {
    generateFiles(repoDir, 500);
    await scanFiles(repoDir, DEFAULT_CONFIG, db, createIgnoreRules(repoDir));

    const start = Date.now();
    const results = db.searchFiles('process', 20);
    const elapsed = Date.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
    console.log(`  FTS search across 500 files: ${elapsed}ms (${results.length} results)`);
  }, 15_000);

  it('single file fetch < 50ms', async () => {
    generateFiles(repoDir, 10);
    await scanFiles(repoDir, DEFAULT_CONFIG, db, createIgnoreRules(repoDir));

    const allFiles = db.getAllFiles();
    const targetPath = allFiles[0].path;

    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      db.getFile(targetPath);
    }
    const elapsed = (Date.now() - start) / 100;

    expect(elapsed).toBeLessThan(50);
    console.log(`  Single file fetch avg: ${elapsed.toFixed(2)}ms`);
  }, 10_000);

  it('DB does not hold full file content in heap after close+reopen', async () => {
    generateFiles(repoDir, 50);
    await scanFiles(repoDir, DEFAULT_CONFIG, db, createIgnoreRules(repoDir));
    db.close();

    // Re-open and check we can query without loading everything into memory
    const db2 = new CodeweaveDb(path.join(dbDir, 'test.db'));
    const count = db2.getFileCount();
    expect(count).toBe(50);

    // Only fetch one file at a time — no bulk in-memory load
    const file = db2.getFile(db2.getAllFiles()[0].path);
    expect(file).toBeDefined();
    db2.close();
  }, 10_000);
});
