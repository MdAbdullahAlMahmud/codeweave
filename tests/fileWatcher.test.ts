import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FileWatcher } from '../src/watcher/fileWatcher.js';
import { CodeweaveDb } from '../src/cache/db.js';
import { createIgnoreRules } from '../src/utils/ignoreRules.js';
import { DEFAULT_CONFIG } from '../src/config/index.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cw-watcher-test-'));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('FileWatcher', () => {
  let repoDir: string;
  let dbDir: string;
  let db: CodeweaveDb;
  let watcher: FileWatcher;

  beforeEach(() => {
    repoDir = makeTempDir();
    dbDir = makeTempDir();
    db = new CodeweaveDb(path.join(dbDir, 'test.db'));
    watcher = new FileWatcher(repoDir, DEFAULT_CONFIG, db, createIgnoreRules(repoDir));
  });

  afterEach(() => {
    watcher.stop();
    db.close();
    fs.rmSync(repoDir, { recursive: true, force: true });
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  it('starts and stops without error', () => {
    expect(() => watcher.start()).not.toThrow();
    expect(() => watcher.stop()).not.toThrow();
  });

  it('can call stop without start', () => {
    expect(() => watcher.stop()).not.toThrow();
  });

  it('indexes a newly created file', async () => {
    watcher.start();
    await sleep(200); // give chokidar time to initialize
    fs.writeFileSync(path.join(repoDir, 'new.ts'), 'const x = 1;');
    await sleep(600); // debounce is 300ms
    const file = db.getFile('new.ts');
    expect(file).toBeDefined();
    expect(file!.language).toBe('TypeScript');
  });

  it('updates the index when a file changes', async () => {
    // Pre-index the file
    db.upsertFile({ path: 'edit.ts', language: 'TypeScript', size_bytes: 5, mtime: 1, content: 'old' });
    fs.writeFileSync(path.join(repoDir, 'edit.ts'), 'old');

    watcher.start();
    await sleep(100);

    fs.writeFileSync(path.join(repoDir, 'edit.ts'), 'updated content');
    await sleep(600);

    const file = db.getFile('edit.ts');
    expect(file!.content).toBe('updated content');
  });

  it('removes a deleted file from the index', async () => {
    db.upsertFile({ path: 'toDelete.ts', language: 'TypeScript', size_bytes: 5, mtime: 1, content: 'bye' });
    fs.writeFileSync(path.join(repoDir, 'toDelete.ts'), 'bye');

    watcher.start();
    await sleep(100);

    fs.unlinkSync(path.join(repoDir, 'toDelete.ts'));
    await sleep(600);

    expect(db.getFile('toDelete.ts')).toBeUndefined();
  });

  it('does not index binary files', async () => {
    watcher.start();
    fs.writeFileSync(path.join(repoDir, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await sleep(600);
    expect(db.getFile('image.png')).toBeUndefined();
  });
});
