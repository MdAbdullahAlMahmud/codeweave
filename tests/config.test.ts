import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, DEFAULT_CONFIG } from '../src/config/index.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cw-config-test-'));
}

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns defaults when no config file is present', async () => {
    const config = await loadConfig(tmpDir);
    expect(config.port).toBe(3333);
    expect(config.maxFileSizeKB).toBe(100);
    expect(config.gitDepth).toBe(50);
    expect(config.verbose).toBe(false);
    expect(config.include).toEqual(['.']);
    expect(config.exclude).toEqual([]);
  });

  it('loads and merges values from codeweave.config.js', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'codeweave.config.js'),
      `export default { port: 4444, verbose: true, gitDepth: 10 };\n`,
    );
    const config = await loadConfig(tmpDir);
    expect(config.port).toBe(4444);
    expect(config.verbose).toBe(true);
    expect(config.gitDepth).toBe(10);
    // Unset fields fall back to defaults
    expect(config.maxFileSizeKB).toBe(100);
  });

  it('throws a descriptive error for invalid config values', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'codeweave.config.js'),
      `export default { port: 'not-a-number' };\n`,
    );
    await expect(loadConfig(tmpDir)).rejects.toThrow(/Invalid config/);
  });

  it('throws when config file syntax is invalid', async () => {
    fs.writeFileSync(path.join(tmpDir, 'codeweave.config.js'), `export default { THIS IS BROKEN`);
    await expect(loadConfig(tmpDir)).rejects.toThrow();
  });
});

describe('DEFAULT_CONFIG', () => {
  it('has expected shape', () => {
    expect(DEFAULT_CONFIG).toMatchObject({
      port: 3333,
      verbose: false,
      maxFileSizeKB: 100,
      gitDepth: 50,
    });
  });
});
