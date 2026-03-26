import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCli } from '../src/cli/index.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cw-cli-test-'));
}

describe('CLI argument parsing', () => {
  it('exposes --version flag', () => {
    const program = buildCli();
    expect(program.version()).toBeTruthy();
  });

  it('has start command registered as default', () => {
    const program = buildCli();
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('start');
  });

  it('has init command registered', () => {
    const program = buildCli();
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('init');
  });

  it('has status command registered', () => {
    const program = buildCli();
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('status');
  });

  it('start command has --verbose option', () => {
    const program = buildCli();
    const startCmd = program.commands.find((c) => c.name() === 'start')!;
    const optNames = startCmd.options.map((o) => o.long);
    expect(optNames).toContain('--verbose');
  });
});

describe('runInit', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('creates codeweave.config.js', async () => {
    const { runInit } = await import('../src/cli/init.js');
    await runInit(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'codeweave.config.js'))).toBe(true);
  });

  it('generated config contains default keys', async () => {
    const { runInit } = await import('../src/cli/init.js');
    await runInit(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, 'codeweave.config.js'), 'utf8');
    expect(content).toContain('include');
    expect(content).toContain('maxFileSizeKB');
    expect(content).toContain('gitDepth');
    expect(content).toContain('port');
  });

  it('auto-detects src/ directory as include path', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    const { runInit } = await import('../src/cli/init.js');
    await runInit(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, 'codeweave.config.js'), 'utf8');
    expect(content).toContain('"src"');
  });

  it('falls back to "." when no known dirs exist', async () => {
    const { runInit } = await import('../src/cli/init.js');
    await runInit(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, 'codeweave.config.js'), 'utf8');
    expect(content).toContain('"."');
  });
});

describe('runStatus', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs without error on an empty repo', async () => {
    const { runStatus } = await import('../src/cli/status.js');
    await expect(runStatus(tmpDir)).resolves.not.toThrow();
  });

  it('outputs indexed file count', async () => {
    const { runStatus } = await import('../src/cli/status.js');
    const lines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });

    await runStatus(tmpDir);
    const output = lines.join('');
    expect(output).toContain('Indexed files');
    expect(output).toContain('DB size');
  });
});
