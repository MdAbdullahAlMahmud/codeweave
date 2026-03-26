/**
 * End-to-end tests: full pipeline flow without an MCP transport.
 * Tests: config → scan → git → manifests → stack detection → tool queries → re-index
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { loadConfig } from '../../src/config/index.js';
import { CodeweaveDb } from '../../src/cache/db.js';
import { createIgnoreRules } from '../../src/utils/ignoreRules.js';
import { scanFiles } from '../../src/indexer/fileScanner.js';
import { readGitHistory } from '../../src/indexer/gitReader.js';
import { parseManifests } from '../../src/indexer/pkgParser.js';
import { detectStack } from '../../src/indexer/stackDetector.js';
import { detectConventions } from '../../src/indexer/conventionDetector.js';
import { FileWatcher } from '../../src/watcher/fileWatcher.js';
import { runInit } from '../../src/cli/init.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cw-e2e-'));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function scaffoldNodeProject(dir: string): void {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'utils'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });

  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'test-app',
    version: '1.0.0',
    dependencies: { express: '^4.18.0', zod: '^3.0.0' },
    devDependencies: { typescript: '^5.0.0', vitest: '^2.0.0' },
  }, null, 2));

  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'ESNext' },
  }, null, 2));

  fs.writeFileSync(path.join(dir, 'src', 'index.ts'),
    `import express from 'express';\nconst app = express();\napp.listen(3000);\n`);
  fs.writeFileSync(path.join(dir, 'src', 'utils', 'logger.ts'),
    `export function log(msg: string): void { console.log(msg); }\n`);
  fs.writeFileSync(path.join(dir, 'tests', 'app.test.ts'),
    `import { describe, it } from 'vitest';\ndescribe('app', () => { it('works', () => {}); });\n`);
  fs.writeFileSync(path.join(dir, 'README.md'), '# Test App\n\nA test application.\n');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules\ndist\n');
}

function initGitRepo(dir: string, withCommits = false): void {
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'ignore' });
  if (withCommits) {
    execSync('git add .', { cwd: dir, stdio: 'ignore' });
    execSync('git commit -m "initial commit"', { cwd: dir, stdio: 'ignore' });
  }
}

describe('Full pipeline flow', () => {
  let repoDir: string;
  let dbDir: string;
  let db: CodeweaveDb;

  beforeEach(() => {
    repoDir = makeTempDir();
    dbDir = makeTempDir();
    db = new CodeweaveDb(path.join(dbDir, 'test.db'));
    scaffoldNodeProject(repoDir);
    initGitRepo(repoDir, true);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(repoDir, { recursive: true, force: true });
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  it('completes full init → scan → git → stack pipeline', async () => {
    // 1. Init config
    await runInit(repoDir);
    expect(fs.existsSync(path.join(repoDir, 'codeweave.config.js'))).toBe(true);

    // 2. Load config
    const config = await loadConfig(repoDir);
    expect(config.port).toBe(3333);

    // 3. Scan files
    const ignoreRules = createIgnoreRules(repoDir);
    const scanResult = await scanFiles(repoDir, config, db, ignoreRules);
    expect(scanResult.fileCount).toBeGreaterThan(0);
    expect(scanResult.languageCounts['TypeScript']).toBeGreaterThan(0);

    // 4. Git history
    const commits = await readGitHistory(repoDir, db, 10);
    expect(commits.length).toBeGreaterThanOrEqual(1);
    expect(commits[0].message).toContain('initial commit');

    // 5. Manifests & stack
    const manifests = parseManifests(repoDir);
    expect(manifests).toHaveLength(1);
    const stack = detectStack(manifests, repoDir);
    expect(stack.language).toBe('TypeScript');
    expect(stack.framework).toBe('Express');
    expect(stack.testing).toContain('Vitest');

    // 6. Conventions
    const allFiles = db.getAllFiles();
    const tsFiles = allFiles.filter((f) => f.language === 'TypeScript');
    const conventions = detectConventions({
      filePaths: allFiles.map((f) => f.path),
      tsJsContents: tsFiles.map((f) => f.content),
      devDependencies: ['typescript', 'vitest'],
    });
    expect(conventions.testFramework).toBe('vitest');
  });

  it('tool: get_file returns indexed content', async () => {
    const config = await loadConfig(repoDir);
    await scanFiles(repoDir, config, db, createIgnoreRules(repoDir));

    const file = db.getFile('src/index.ts');
    expect(file).toBeDefined();
    expect(file!.content).toContain('express');
    expect(file!.language).toBe('TypeScript');
  });

  it('tool: search_codebase finds content across files', async () => {
    const config = await loadConfig(repoDir);
    await scanFiles(repoDir, config, db, createIgnoreRules(repoDir));

    const results = db.searchFiles('express', 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.path.includes('index'))).toBe(true);
  });

  it('tool: get_file_tree includes all indexed files', async () => {
    const config = await loadConfig(repoDir);
    await scanFiles(repoDir, config, db, createIgnoreRules(repoDir));

    const allFiles = db.getAllFiles();
    expect(allFiles.some((f) => f.path === 'src/index.ts')).toBe(true);
    expect(allFiles.some((f) => f.path === 'README.md')).toBe(true);
  });

  it('watcher: re-indexes a changed file', async () => {
    const config = await loadConfig(repoDir);
    await scanFiles(repoDir, config, db, createIgnoreRules(repoDir));

    const originalContent = db.getFile('src/index.ts')!.content;

    const watcher = new FileWatcher(repoDir, config, db, createIgnoreRules(repoDir));
    watcher.start();
    await sleep(200);

    const newContent = `${originalContent}\n// updated\n`;
    fs.writeFileSync(path.join(repoDir, 'src', 'index.ts'), newContent);
    await sleep(600);

    watcher.stop();
    expect(db.getFile('src/index.ts')!.content).toContain('// updated');
  });

  it('watcher: removes deleted file from index', async () => {
    const config = await loadConfig(repoDir);
    await scanFiles(repoDir, config, db, createIgnoreRules(repoDir));
    expect(db.getFile('README.md')).toBeDefined();

    const watcher = new FileWatcher(repoDir, config, db, createIgnoreRules(repoDir));
    watcher.start();
    await sleep(200);

    fs.unlinkSync(path.join(repoDir, 'README.md'));
    await sleep(600);

    watcher.stop();
    expect(db.getFile('README.md')).toBeUndefined();
  });

  it('second scan uses mtime cache — DB content unchanged for unmodified files', async () => {
    const config = await loadConfig(repoDir);
    await scanFiles(repoDir, config, db, createIgnoreRules(repoDir));

    // Poison the cache entry
    const row = db.getFile('README.md')!;
    db.upsertFile({ ...row, content: 'POISONED' });

    // Second scan — mtime hasn't changed, should not re-read disk
    await scanFiles(repoDir, config, db, createIgnoreRules(repoDir));
    expect(db.getFile('README.md')!.content).toBe('POISONED');
  });
});
