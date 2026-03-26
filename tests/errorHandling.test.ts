/**
 * Error handling verification tests.
 * Confirms graceful degradation for all listed failure scenarios.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/config/index.js';
import { CodeweaveDb } from '../src/cache/db.js';
import { createIgnoreRules } from '../src/utils/ignoreRules.js';
import { scanFiles } from '../src/indexer/fileScanner.js';
import { readGitHistory } from '../src/indexer/gitReader.js';
import { parseManifests } from '../src/indexer/pkgParser.js';
import { DEFAULT_CONFIG } from '../src/config/index.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cw-err-test-'));
}

describe('Error handling: not a git repo', () => {
  let tmpDir: string;
  let db: CodeweaveDb;

  beforeEach(() => {
    tmpDir = makeTempDir();
    db = new CodeweaveDb(path.join(makeTempDir(), 'test.db'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('readGitHistory returns empty array gracefully', async () => {
    const commits = await readGitHistory(tmpDir, db);
    expect(commits).toEqual([]);
  });

  it('server can still index files when not a git repo', async () => {
    fs.writeFileSync(path.join(tmpDir, 'app.ts'), 'export const x = 1;');
    const result = await scanFiles(tmpDir, DEFAULT_CONFIG, db, createIgnoreRules(tmpDir));
    expect(result.fileCount).toBe(1);
  });
});

describe('Error handling: unreadable file', () => {
  let tmpDir: string;
  let dbDir: string;
  let db: CodeweaveDb;

  beforeEach(() => {
    tmpDir = makeTempDir();
    dbDir = makeTempDir();
    db = new CodeweaveDb(path.join(dbDir, 'test.db'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(dbDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('skips unreadable files without crashing', async () => {
    fs.writeFileSync(path.join(tmpDir, 'readable.ts'), 'const x = 1;');
    fs.writeFileSync(path.join(tmpDir, 'unreadable.ts'), 'const y = 2;');

    // Make the second file unreadable by mocking readFileSync to throw on that path
    const origReadFileSync = fs.readFileSync.bind(fs);
    vi.spyOn(fs, 'readFileSync').mockImplementation((p, ...args) => {
      if (String(p).endsWith('unreadable.ts')) {
        throw new Error('EACCES: permission denied');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (origReadFileSync as any)(p, ...args);
    });

    const result = await scanFiles(tmpDir, DEFAULT_CONFIG, db, createIgnoreRules(tmpDir));
    expect(result.fileCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(db.getFile('readable.ts')).toBeDefined();
    expect(db.getFile('unreadable.ts')).toBeUndefined();
  });
});

describe('Error handling: invalid config file', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('throws a clear error on invalid config values', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'codeweave.config.js'),
      `export default { port: 'not-a-port', maxFileSizeKB: -1 };\n`,
    );
    await expect(loadConfig(tmpDir)).rejects.toThrow(/Invalid config/);
  });

  it('throws a clear error on syntax error in config', async () => {
    fs.writeFileSync(path.join(tmpDir, 'codeweave.config.js'), `export default { BROKEN`);
    await expect(loadConfig(tmpDir)).rejects.toThrow();
  });

  it('falls back to defaults when no config file exists', async () => {
    const config = await loadConfig(tmpDir);
    expect(config.port).toBe(3333);
    expect(config.maxFileSizeKB).toBe(100);
  });

  it('error message names the offending field', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'codeweave.config.js'),
      `export default { gitDepth: 'many' };\n`,
    );
    let msg = '';
    try {
      await loadConfig(tmpDir);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toContain('gitDepth');
  });
});

describe('Error handling: malformed manifest files', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('skips malformed package.json and returns empty array', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), 'NOT VALID JSON {{{');
    expect(() => parseManifests(tmpDir)).not.toThrow();
    expect(parseManifests(tmpDir)).toHaveLength(0);
  });

  it('skips malformed Gemfile entries and continues', () => {
    // A Gemfile with mixed valid and garbage lines
    fs.writeFileSync(path.join(tmpDir, 'Gemfile'), `
source 'https://rubygems.org'
gem 'rails', '~> 7.0'
THIS IS NOT A VALID GEMFILE LINE @@##$$
gem 'pg'
`);
    expect(() => parseManifests(tmpDir)).not.toThrow();
    const manifests = parseManifests(tmpDir);
    expect(manifests[0].dependencies.find((d) => d.name === 'rails')).toBeDefined();
    expect(manifests[0].dependencies.find((d) => d.name === 'pg')).toBeDefined();
  });

  it('skips malformed go.mod lines and continues', () => {
    fs.writeFileSync(path.join(tmpDir, 'go.mod'), `
module example.com/app
go 1.21
require (
  github.com/gin-gonic/gin v1.9.1
  THIS LINE IS GARBAGE
  github.com/stretchr/testify v1.8.4
)
`);
    expect(() => parseManifests(tmpDir)).not.toThrow();
    const manifests = parseManifests(tmpDir);
    const deps = manifests[0].dependencies;
    expect(deps.find((d) => d.name === 'github.com/gin-gonic/gin')).toBeDefined();
    expect(deps.find((d) => d.name === 'github.com/stretchr/testify')).toBeDefined();
  });

  it('handles completely empty manifest files gracefully', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), '');
    expect(() => parseManifests(tmpDir)).not.toThrow();
    expect(parseManifests(tmpDir)[0].dependencies).toHaveLength(0);
  });
});

describe('Error handling: DB operations on empty repo', () => {
  let db: CodeweaveDb;
  let dbDir: string;

  beforeEach(() => {
    dbDir = makeTempDir();
    db = new CodeweaveDb(path.join(dbDir, 'test.db'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  it('search returns empty array on empty DB', () => {
    expect(db.searchFiles('anything', 20)).toHaveLength(0);
  });

  it('getFile returns undefined on empty DB', () => {
    expect(db.getFile('nonexistent.ts')).toBeUndefined();
  });

  it('getCommits returns empty array on empty DB', () => {
    expect(db.getCommits(10)).toHaveLength(0);
  });

  it('getAllStackInfo returns empty object on empty DB', () => {
    expect(db.getAllStackInfo()).toEqual({});
  });
});

describe('Error handling: config validation edge cases', () => {
  it('accepts all valid config fields', async () => {
    const tmpDir = makeTempDir();
    fs.writeFileSync(path.join(tmpDir, 'codeweave.config.js'), `
export default {
  include: ['src', 'lib'],
  exclude: ['**/*.generated.ts'],
  maxFileSizeKB: 50,
  gitDepth: 100,
  port: 8080,
  verbose: true,
};
`);
    const config = await loadConfig(tmpDir);
    expect(config.include).toEqual(['src', 'lib']);
    expect(config.exclude).toEqual(['**/*.generated.ts']);
    expect(config.maxFileSizeKB).toBe(50);
    expect(config.port).toBe(8080);
    expect(config.verbose).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects port out of range', async () => {
    const tmpDir = makeTempDir();
    fs.writeFileSync(path.join(tmpDir, 'codeweave.config.js'), `export default { port: 99999 };`);
    await expect(loadConfig(tmpDir)).rejects.toThrow(/Invalid config/);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects maxFileSizeKB of zero', async () => {
    const tmpDir = makeTempDir();
    fs.writeFileSync(path.join(tmpDir, 'codeweave.config.js'), `export default { maxFileSizeKB: 0 };`);
    await expect(loadConfig(tmpDir)).rejects.toThrow(/Invalid config/);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
