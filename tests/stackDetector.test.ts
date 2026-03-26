import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectStack } from '../src/indexer/stackDetector.js';
import type { ParsedManifest } from '../src/indexer/pkgParser.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cw-stack-test-'));
}

function makeDeps(names: string[], dev = false): ParsedManifest['dependencies'] {
  return names.map((name) => ({ name, version: '*', dev }));
}

function manifest(deps: string[], devDeps: string[] = [], pm: ParsedManifest['packageManager'] = 'npm'): ParsedManifest[] {
  return [{
    file: 'package.json',
    packageManager: pm,
    dependencies: [...makeDeps(deps, false), ...makeDeps(devDeps, true)],
  }];
}

describe('detectStack', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('detects TypeScript from tsconfig.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');
    const stack = detectStack([], tmpDir);
    expect(stack.language).toBe('TypeScript');
  });

  it('detects JavaScript from package.json when no tsconfig', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const stack = detectStack([], tmpDir);
    expect(stack.language).toBe('JavaScript');
  });

  it('detects Go from go.mod', () => {
    fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/app\n\ngo 1.21');
    const stack = detectStack([], tmpDir);
    expect(stack.language).toBe('Go');
  });

  it('detects Rust from Cargo.toml', () => {
    fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]\nname = "app"');
    const stack = detectStack([], tmpDir);
    expect(stack.language).toBe('Rust');
  });

  it('detects Next.js framework', () => {
    const stack = detectStack(manifest(['next', 'react', 'react-dom']), tmpDir);
    expect(stack.framework).toBe('Next.js');
  });

  it('detects Express framework', () => {
    const stack = detectStack(manifest(['express']), tmpDir);
    expect(stack.framework).toBe('Express');
  });

  it('detects React when no meta-framework present', () => {
    const stack = detectStack(manifest(['react', 'react-dom']), tmpDir);
    expect(stack.framework).toBe('React');
  });

  it('detects Vue framework', () => {
    const stack = detectStack(manifest(['vue']), tmpDir);
    expect(stack.framework).toBe('Vue');
  });

  it('detects Prisma database', () => {
    const stack = detectStack(manifest(['@prisma/client'], ['prisma']), tmpDir);
    expect(stack.database).toBe('Prisma (ORM)');
  });

  it('detects PostgreSQL', () => {
    const stack = detectStack(manifest(['pg']), tmpDir);
    expect(stack.database).toBe('PostgreSQL');
  });

  it('detects multiple testing frameworks', () => {
    const stack = detectStack(manifest([], ['vitest', '@testing-library/react']), tmpDir);
    expect(stack.testing).toContain('Vitest');
    expect(stack.testing).toContain('Testing Library');
  });

  it('detects Tailwind CSS', () => {
    const stack = detectStack(manifest([], ['tailwindcss']), tmpDir);
    expect(stack.styling).toContain('Tailwind CSS');
  });

  it('detects Vite build tool', () => {
    const stack = detectStack(manifest([], ['vite']), tmpDir);
    expect(stack.buildTool).toBe('Vite');
  });

  it('passes through package manager', () => {
    const stack = detectStack(manifest(['react'], [], 'pnpm'), tmpDir);
    expect(stack.packageManager).toBe('pnpm');
  });

  it('returns nulls when nothing detected', () => {
    const stack = detectStack([], tmpDir);
    expect(stack.framework).toBeNull();
    expect(stack.database).toBeNull();
    expect(stack.testing).toEqual([]);
  });
});
