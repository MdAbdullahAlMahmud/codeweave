import path from 'node:path';

export type NamingCase = 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case' | 'mixed';
export type ImportStyle = 'relative' | 'absolute' | 'mixed';
export type ComponentStructure = 'colocated' | 'separate' | 'unknown';

export interface ConventionInfo {
  fileNaming: NamingCase;
  /** Confidence from 0–1 based on how many files matched the dominant pattern. */
  fileNamingConfidence: number;
  importStyle: ImportStyle;
  componentStructure: ComponentStructure;
  testFramework: string | null;
}

// ── Naming case detection ─────────────────────────────────────────────────

function classifyName(basename: string): NamingCase | null {
  // Strip extension(s)
  const name = basename.replace(/(\.\w+)+$/, '');
  if (!name || name.length < 2) return null;

  const hasUpperFirst = /^[A-Z]/.test(name);
  const hasLower = /[a-z]/.test(name);
  const hasUnderscore = name.includes('_');
  const hasHyphen = name.includes('-');
  const hasUpperMid = /[a-z][A-Z]/.test(name);

  if (hasUnderscore && !hasHyphen) return 'snake_case';
  if (hasHyphen && !hasUnderscore) return 'kebab-case';
  if (hasUpperFirst && hasLower && !hasUnderscore && !hasHyphen) return 'PascalCase';
  if (!hasUpperFirst && hasUpperMid) return 'camelCase';
  return null;
}

export function detectFileNaming(filePaths: string[]): { naming: NamingCase; confidence: number } {
  const counts: Record<NamingCase, number> = {
    camelCase: 0,
    PascalCase: 0,
    snake_case: 0,
    'kebab-case': 0,
    mixed: 0,
  };

  let classified = 0;
  for (const fp of filePaths) {
    const basename = path.basename(fp);
    const cls = classifyName(basename);
    if (cls) {
      counts[cls]++;
      classified++;
    }
  }

  if (classified === 0) return { naming: 'mixed', confidence: 0 };

  const top = (Object.entries(counts) as [NamingCase, number][]).sort((a, b) => b[1] - a[1])[0];
  const confidence = top[1] / classified;

  if (confidence < 0.5) return { naming: 'mixed', confidence };
  return { naming: top[0], confidence };
}

// ── Import style detection ─────────────────────────────────────────────────

export function detectImportStyle(fileContents: string[]): ImportStyle {
  let relative = 0;
  let absolute = 0;

  const relImport = /from\s+['"](\.\.|\.\/)/g;
  const absImport = /from\s+['"](?!\.\.?\/|@?)([a-zA-Z@])/g;
  const aliasImport = /from\s+['"](@\/|~\/|#\/|src\/)/g;

  for (const content of fileContents) {
    relative += (content.match(relImport) ?? []).length;
    absolute += (content.match(aliasImport) ?? []).length;
    // Standard library / node_modules imports don't count
    const absCount = (content.match(absImport) ?? []).length;
    absolute += absCount;
  }

  if (relative === 0 && absolute === 0) return 'mixed';
  if (relative > 0 && absolute === 0) return 'relative';
  if (absolute > 0 && relative === 0) return 'absolute';

  const ratio = relative / (relative + absolute);
  if (ratio > 0.7) return 'relative';
  if (ratio < 0.3) return 'absolute';
  return 'mixed';
}

// ── Component structure detection ─────────────────────────────────────────

/**
 * Detect whether components are colocated (test/style next to component)
 * or in separate directories.
 */
export function detectComponentStructure(filePaths: string[]): ComponentStructure {
  let colocated = 0;
  let separate = 0;

  const testPaths = new Set(
    filePaths.filter((p) => /\.(test|spec)\.[a-z]+$/.test(p)),
  );

  for (const testPath of testPaths) {
    const dir = path.dirname(testPath);
    // If test is in a __tests__ or tests/ directory, it's separate
    if (dir.includes('__tests__') || dir.split('/').includes('tests') || dir.split('/').includes('test')) {
      separate++;
    } else {
      colocated++;
    }
  }

  if (colocated === 0 && separate === 0) return 'unknown';
  if (colocated >= separate) return 'colocated';
  return 'separate';
}

// ── Test framework detection ───────────────────────────────────────────────

export function detectTestFramework(devDependencies: string[]): string | null {
  const devDeps = new Set(devDependencies);
  if (devDeps.has('vitest')) return 'vitest';
  if (devDeps.has('jest') || devDeps.has('@jest/core')) return 'jest';
  if (devDeps.has('mocha')) return 'mocha';
  if (devDeps.has('jasmine') || devDeps.has('jasmine-core')) return 'jasmine';
  if (devDeps.has('@playwright/test')) return 'playwright';
  if (devDeps.has('cypress')) return 'cypress';
  return null;
}

// ── Main export ───────────────────────────────────────────────────────────

export interface DetectConventionsInput {
  filePaths: string[];
  /** Subset of file contents for import style analysis (TypeScript/JS only). */
  tsJsContents: string[];
  devDependencies: string[];
}

export function detectConventions(input: DetectConventionsInput): ConventionInfo {
  const { naming, confidence } = detectFileNaming(input.filePaths);
  const importStyle = detectImportStyle(input.tsJsContents);
  const componentStructure = detectComponentStructure(input.filePaths);
  const testFramework = detectTestFramework(input.devDependencies);

  return {
    fileNaming: naming,
    fileNamingConfidence: confidence,
    importStyle,
    componentStructure,
    testFramework,
  };
}
