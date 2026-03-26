import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IgnoreRules, createIgnoreRules } from '../src/utils/ignoreRules.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cw-ignore-test-'));
}

describe('IgnoreRules', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('always ignores node_modules', () => {
    const rules = createIgnoreRules(tmpDir);
    expect(rules.isIgnored('node_modules/lodash/index.js')).toBe(true);
  });

  it('always ignores .git', () => {
    const rules = createIgnoreRules(tmpDir);
    expect(rules.isIgnored('.git/config')).toBe(true);
  });

  it('always ignores dist/', () => {
    const rules = createIgnoreRules(tmpDir);
    expect(rules.isIgnored('dist/main.js')).toBe(true);
  });

  it('does not ignore regular source files by default', () => {
    const rules = createIgnoreRules(tmpDir);
    expect(rules.isIgnored('src/index.ts')).toBe(false);
  });

  it('respects .gitignore rules', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '*.log\nbuild/\n');
    const rules = createIgnoreRules(tmpDir);
    expect(rules.isIgnored('server.log')).toBe(true);
    expect(rules.isIgnored('build/output.js')).toBe(true);
    expect(rules.isIgnored('src/app.ts')).toBe(false);
  });

  it('respects .codeweave-ignore rules layered on top', () => {
    fs.writeFileSync(path.join(tmpDir, '.codeweave-ignore'), 'secret/\n*.private\n');
    const rules = createIgnoreRules(tmpDir);
    expect(rules.isIgnored('secret/keys.json')).toBe(true);
    expect(rules.isIgnored('config.private')).toBe(true);
    expect(rules.isIgnored('src/main.ts')).toBe(false);
  });

  it('works fine when neither .gitignore nor .codeweave-ignore exist', () => {
    const rules = createIgnoreRules(tmpDir);
    expect(rules.isIgnored('src/utils.ts')).toBe(false);
  });

  describe('isBinaryExtension', () => {
    it('returns true for image extensions', () => {
      expect(IgnoreRules.isBinaryExtension('photo.png')).toBe(true);
      expect(IgnoreRules.isBinaryExtension('logo.svg')).toBe(true);
    });

    it('returns true for archive extensions', () => {
      expect(IgnoreRules.isBinaryExtension('archive.zip')).toBe(true);
      expect(IgnoreRules.isBinaryExtension('data.tar.gz')).toBe(true);
    });

    it('returns false for source file extensions', () => {
      expect(IgnoreRules.isBinaryExtension('main.ts')).toBe(false);
      expect(IgnoreRules.isBinaryExtension('styles.css')).toBe(false);
      expect(IgnoreRules.isBinaryExtension('config.json')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(IgnoreRules.isBinaryExtension('PHOTO.PNG')).toBe(true);
      expect(IgnoreRules.isBinaryExtension('Archive.ZIP')).toBe(true);
    });
  });

  describe('shouldSkip', () => {
    it('returns true for ignored paths', () => {
      const rules = createIgnoreRules(tmpDir);
      expect(rules.shouldSkip('node_modules/foo/bar.js')).toBe(true);
    });

    it('returns true for binary files', () => {
      const rules = createIgnoreRules(tmpDir);
      expect(rules.shouldSkip('assets/photo.jpg')).toBe(true);
    });

    it('returns false for normal source files', () => {
      const rules = createIgnoreRules(tmpDir);
      expect(rules.shouldSkip('src/index.ts')).toBe(false);
    });
  });
});
