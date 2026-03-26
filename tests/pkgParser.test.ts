import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseManifests, detectJsPackageManager } from '../src/indexer/pkgParser.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cw-pkg-test-'));
}

describe('detectJsPackageManager', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('detects bun from bun.lockb', () => {
    fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
    expect(detectJsPackageManager(tmpDir)).toBe('bun');
  });

  it('detects pnpm from pnpm-lock.yaml', () => {
    fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), '');
    expect(detectJsPackageManager(tmpDir)).toBe('pnpm');
  });

  it('detects yarn from yarn.lock', () => {
    fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
    expect(detectJsPackageManager(tmpDir)).toBe('yarn');
  });

  it('detects npm from package-lock.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
    expect(detectJsPackageManager(tmpDir)).toBe('npm');
  });

  it('defaults to npm when no lock file found', () => {
    expect(detectJsPackageManager(tmpDir)).toBe('npm');
  });
});

describe('parseManifests', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns empty array when no manifests exist', () => {
    expect(parseManifests(tmpDir)).toEqual([]);
  });

  it('parses package.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0', zod: '^3.0.0' },
      devDependencies: { typescript: '^5.0.0' },
    }));
    const manifests = parseManifests(tmpDir);
    expect(manifests).toHaveLength(1);
    const deps = manifests[0].dependencies;
    expect(deps.find((d) => d.name === 'react')).toMatchObject({ name: 'react', dev: false });
    expect(deps.find((d) => d.name === 'typescript')).toMatchObject({ name: 'typescript', dev: true });
  });

  it('parses pubspec.yaml', () => {
    fs.writeFileSync(path.join(tmpDir, 'pubspec.yaml'), `
dependencies:
  flutter:
    sdk: flutter
  http: ^0.13.0
dev_dependencies:
  flutter_test:
    sdk: flutter
`);
    const manifests = parseManifests(tmpDir);
    expect(manifests).toHaveLength(1);
    expect(manifests[0].packageManager).toBe('pub');
    expect(manifests[0].dependencies.find((d) => d.name === 'http')).toBeDefined();
  });

  it('parses Cargo.toml', () => {
    fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), `
[package]
name = "myapp"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = "1.0"

[dev-dependencies]
assert_cmd = "2.0"
`);
    const manifests = parseManifests(tmpDir);
    expect(manifests).toHaveLength(1);
    expect(manifests[0].packageManager).toBe('cargo');
    expect(manifests[0].dependencies.find((d) => d.name === 'serde')).toMatchObject({ dev: false });
    expect(manifests[0].dependencies.find((d) => d.name === 'assert_cmd')).toMatchObject({ dev: true });
  });

  it('parses go.mod', () => {
    fs.writeFileSync(path.join(tmpDir, 'go.mod'), `
module example.com/myapp

go 1.21

require (
  github.com/gin-gonic/gin v1.9.1
  github.com/stretchr/testify v1.8.4
)
`);
    const manifests = parseManifests(tmpDir);
    expect(manifests).toHaveLength(1);
    expect(manifests[0].packageManager).toBe('go');
    expect(manifests[0].dependencies.find((d) => d.name === 'github.com/gin-gonic/gin')).toBeDefined();
  });

  it('parses requirements.txt', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), `
# comment
django>=4.0,<5.0
requests==2.31.0
pytest
-r other.txt
`);
    const manifests = parseManifests(tmpDir);
    expect(manifests).toHaveLength(1);
    expect(manifests[0].packageManager).toBe('pip');
    expect(manifests[0].dependencies.find((d) => d.name === 'django')).toBeDefined();
    expect(manifests[0].dependencies.find((d) => d.name === 'requests')).toBeDefined();
    expect(manifests[0].dependencies.find((d) => d.name === 'pytest')).toBeDefined();
  });

  it('parses composer.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'composer.json'), JSON.stringify({
      require: { 'laravel/framework': '^10.0', php: '^8.1' },
      'require-dev': { phpunit: '^10.0' },
    }));
    const manifests = parseManifests(tmpDir);
    expect(manifests).toHaveLength(1);
    expect(manifests[0].packageManager).toBe('composer');
    // php is excluded
    expect(manifests[0].dependencies.find((d) => d.name === 'php')).toBeUndefined();
    expect(manifests[0].dependencies.find((d) => d.name === 'laravel/framework')).toBeDefined();
    expect(manifests[0].dependencies.find((d) => d.name === 'phpunit')).toMatchObject({ dev: true });
  });

  it('parses Gemfile', () => {
    fs.writeFileSync(path.join(tmpDir, 'Gemfile'), `
source 'https://rubygems.org'
gem 'rails', '~> 7.0'
gem 'pg', '>= 0.18'
gem 'rspec-rails'
`);
    const manifests = parseManifests(tmpDir);
    expect(manifests).toHaveLength(1);
    expect(manifests[0].packageManager).toBe('bundler');
    expect(manifests[0].dependencies.find((d) => d.name === 'rails')).toBeDefined();
  });

  it('handles malformed package.json gracefully', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), 'NOT VALID JSON {{{');
    expect(() => parseManifests(tmpDir)).not.toThrow();
    expect(parseManifests(tmpDir)).toHaveLength(0);
  });
});
