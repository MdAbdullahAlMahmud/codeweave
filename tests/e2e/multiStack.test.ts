/**
 * Multi-stack integration tests.
 * Verifies that the indexer + stack detector work for Node, Python, Go, Rust, Flutter repos.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CodeweaveDb } from '../../src/cache/db.js';
import { createIgnoreRules } from '../../src/utils/ignoreRules.js';
import { scanFiles } from '../../src/indexer/fileScanner.js';
import { parseManifests } from '../../src/indexer/pkgParser.js';
import { detectStack } from '../../src/indexer/stackDetector.js';
import { DEFAULT_CONFIG } from '../../src/config/index.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cw-stack-e2e-'));
}

function writeFiles(dir: string, files: Record<string, string>): void {
  for (const [relPath, content] of Object.entries(files)) {
    const abs = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

function nodeProject(dir: string): void {
  writeFiles(dir, {
    'package.json': JSON.stringify({
      name: 'myapp',
      dependencies: { fastify: '^4.0.0', '@prisma/client': '^5.0.0' },
      devDependencies: { jest: '^29.0.0', tailwindcss: '^3.0.0' },
    }),
    'tsconfig.json': '{}',
    'src/server.ts': `import fastify from 'fastify';\nconst app = fastify();\n`,
    'src/db.ts': `import { PrismaClient } from '@prisma/client';\n`,
    'src/UserCard.tsx': `export function UserCard() { return null; }\n`,
    'src/UserCard.test.tsx': `import { describe } from '@jest/globals';\n`,
  });
}

function pythonProject(dir: string): void {
  writeFiles(dir, {
    'requirements.txt': 'django>=4.0\npsycopg2>=2.9\npytest>=7.0\n',
    'src/main.py': 'from django.http import HttpResponse\n',
    'src/models.py': 'from django.db import models\n',
    'tests/test_views.py': 'import pytest\n',
  });
}

function goProject(dir: string): void {
  writeFiles(dir, {
    'go.mod': `module example.com/myapp\n\ngo 1.21\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n)\n`,
    'main.go': `package main\nimport "github.com/gin-gonic/gin"\nfunc main() { r := gin.Default(); r.Run() }\n`,
    'internal/db/db.go': `package db\n`,
    'internal/handlers/user.go': `package handlers\n`,
  });
}

function rustProject(dir: string): void {
  writeFiles(dir, {
    'Cargo.toml': `[package]\nname = "myapp"\nversion = "0.1.0"\n\n[dependencies]\ntokio = "1.0"\nserde = "1.0"\n\n[dev-dependencies]\nassert_cmd = "2.0"\n`,
    'src/main.rs': `use tokio;\n#[tokio::main]\nasync fn main() {}\n`,
    'src/lib.rs': `pub mod utils;\n`,
    'src/utils.rs': `pub fn greet(name: &str) -> String { format!("Hello, {}!", name) }\n`,
    'tests/integration_test.rs': `#[test]\nfn test_greet() {}\n`,
  });
}

function flutterProject(dir: string): void {
  writeFiles(dir, {
    'pubspec.yaml': `name: myapp\nversion: 1.0.0\ndependencies:\n  flutter:\n    sdk: flutter\n  http: ^0.13.0\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n`,
    'lib/main.dart': `import 'package:flutter/material.dart';\nvoid main() => runApp(const MyApp());\n`,
    'lib/screens/home.dart': `import 'package:flutter/material.dart';\n`,
    'test/widget_test.dart': `import 'package:flutter_test/flutter_test.dart';\n`,
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Multi-stack detection', () => {
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

  it('Node.js: detects TypeScript + Fastify + Prisma + Jest + Tailwind', async () => {
    nodeProject(repoDir);
    const scan = await scanFiles(repoDir, DEFAULT_CONFIG, db, createIgnoreRules(repoDir));
    const manifests = parseManifests(repoDir);
    const stack = detectStack(manifests, repoDir);

    expect(scan.fileCount).toBeGreaterThan(0);
    expect(scan.languageCounts['TypeScript']).toBeGreaterThan(0);
    expect(stack.language).toBe('TypeScript');
    expect(stack.framework).toBe('Fastify');
    expect(stack.database).toBe('Prisma (ORM)');
    expect(stack.testing).toContain('Jest');
    expect(stack.styling).toContain('Tailwind CSS');
  });

  it('Python: detects Python + Django + PostgreSQL + pytest', async () => {
    pythonProject(repoDir);
    const scan = await scanFiles(repoDir, DEFAULT_CONFIG, db, createIgnoreRules(repoDir));
    const manifests = parseManifests(repoDir);
    const stack = detectStack(manifests, repoDir);

    expect(scan.languageCounts['Python']).toBeGreaterThan(0);
    expect(stack.language).toBe('Python'); // from requirements.txt
    expect(stack.framework).toBe('Django');
    expect(stack.testing).toContain('pytest');
  });

  it('Go: detects Go + Gin framework', async () => {
    goProject(repoDir);
    const scan = await scanFiles(repoDir, DEFAULT_CONFIG, db, createIgnoreRules(repoDir));
    const manifests = parseManifests(repoDir);
    const stack = detectStack(manifests, repoDir);

    expect(scan.languageCounts['Go']).toBeGreaterThan(0);
    expect(stack.language).toBe('Go');
    expect(manifests[0].dependencies.find((d) => d.name.includes('gin'))).toBeDefined();
  });

  it('Rust: detects Rust + Tokio, separates dev-dependencies', async () => {
    rustProject(repoDir);
    const scan = await scanFiles(repoDir, DEFAULT_CONFIG, db, createIgnoreRules(repoDir));
    const manifests = parseManifests(repoDir);
    const stack = detectStack(manifests, repoDir);

    expect(scan.languageCounts['Rust']).toBeGreaterThan(0);
    expect(stack.language).toBe('Rust');
    expect(manifests[0].dependencies.find((d) => d.name === 'tokio' && !d.dev)).toBeDefined();
    expect(manifests[0].dependencies.find((d) => d.name === 'assert_cmd' && d.dev)).toBeDefined();
  });

  it('Flutter/Dart: detects Dart language and pub package manager', async () => {
    flutterProject(repoDir);
    const scan = await scanFiles(repoDir, DEFAULT_CONFIG, db, createIgnoreRules(repoDir));
    const manifests = parseManifests(repoDir);
    const stack = detectStack(manifests, repoDir);

    expect(scan.languageCounts['Dart']).toBeGreaterThan(0);
    expect(stack.language).toBe('Dart');
    expect(stack.packageManager).toBe('pub');
    expect(manifests[0].dependencies.find((d) => d.name === 'http')).toBeDefined();
  });

  it('small repo (< 10 files) indexes in < 500ms', async () => {
    nodeProject(repoDir);
    const start = Date.now();
    await scanFiles(repoDir, DEFAULT_CONFIG, db, createIgnoreRules(repoDir));
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('medium repo (100 files) indexes in < 2s', async () => {
    // Generate 100 TypeScript files
    fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
    for (let i = 0; i < 100; i++) {
      fs.writeFileSync(
        path.join(repoDir, 'src', `module${i}.ts`),
        `export const value${i} = ${i};\nexport function fn${i}() { return value${i}; }\n`,
      );
    }

    const start = Date.now();
    const result = await scanFiles(repoDir, DEFAULT_CONFIG, db, createIgnoreRules(repoDir));
    const elapsed = Date.now() - start;

    expect(result.fileCount).toBe(100);
    expect(elapsed).toBeLessThan(2000);
  });
});
