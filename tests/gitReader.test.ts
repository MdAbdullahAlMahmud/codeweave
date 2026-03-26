import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { readGitHistory } from '../src/indexer/gitReader.js';
import { CodeweaveDb } from '../src/cache/db.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cw-git-test-'));
}

function initGitRepo(dir: string): void {
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'ignore' });
}

function makeCommit(dir: string, filename: string, message: string): void {
  fs.writeFileSync(path.join(dir, filename), `content of ${filename}`);
  execSync(`git add ${filename}`, { cwd: dir, stdio: 'ignore' });
  execSync(`git commit -m "${message}"`, { cwd: dir, stdio: 'ignore' });
}

describe('readGitHistory', () => {
  let tmpDir: string;
  let db: CodeweaveDb;

  beforeEach(() => {
    tmpDir = makeTempDir();
    db = new CodeweaveDb(path.join(tmpDir, 'test.db'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array gracefully for non-git directory', async () => {
    const result = await readGitHistory(tmpDir, db);
    expect(result).toEqual([]);
  });

  it('returns commits for a git repo', async () => {
    initGitRepo(tmpDir);
    makeCommit(tmpDir, 'README.md', 'initial commit');
    makeCommit(tmpDir, 'src.ts', 'feat: add source');

    const commits = await readGitHistory(tmpDir, db);
    expect(commits.length).toBe(2);
    expect(commits[0].message).toContain('feat: add source');
  });

  it('stores commits in the database', async () => {
    initGitRepo(tmpDir);
    makeCommit(tmpDir, 'file.ts', 'fix: bug');

    await readGitHistory(tmpDir, db);
    const stored = db.getCommits(10);
    expect(stored.length).toBe(1);
    expect(stored[0].message).toContain('fix: bug');
  });

  it('respects depth limit', async () => {
    initGitRepo(tmpDir);
    for (let i = 0; i < 5; i++) {
      makeCommit(tmpDir, `file${i}.ts`, `commit ${i}`);
    }

    const commits = await readGitHistory(tmpDir, db, 3);
    expect(commits.length).toBe(3);
  });

  it('populates author and date fields', async () => {
    initGitRepo(tmpDir);
    makeCommit(tmpDir, 'a.ts', 'test commit');

    const commits = await readGitHistory(tmpDir, db);
    expect(commits[0].author).toBe('Test');
    expect(commits[0].date).toBeTruthy();
    expect(commits[0].hash).toMatch(/^[0-9a-f]+$/);
  });
});
