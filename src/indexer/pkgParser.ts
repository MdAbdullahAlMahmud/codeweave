import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { logger } from '../utils/logger.js';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'pip' | 'cargo' | 'go' | 'gradle' | 'maven' | 'composer' | 'bundler' | 'pub' | 'unknown';

export interface Dependency {
  name: string;
  version: string;
  dev: boolean;
}

export interface ParsedManifest {
  file: string;
  packageManager: PackageManager;
  dependencies: Dependency[];
}

/** Detect the JS package manager from lock files in the repo root. */
export function detectJsPackageManager(repoRoot: string): PackageManager {
  if (fs.existsSync(path.join(repoRoot, 'bun.lockb'))) return 'bun';
  if (fs.existsSync(path.join(repoRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(repoRoot, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(repoRoot, 'package-lock.json'))) return 'npm';
  return 'npm';
}

function parsePackageJson(filePath: string, repoRoot: string): ParsedManifest | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    const deps: Dependency[] = [];
    for (const [name, version] of Object.entries(json.dependencies ?? {})) {
      deps.push({ name, version, dev: false });
    }
    for (const [name, version] of Object.entries(json.devDependencies ?? {})) {
      deps.push({ name, version, dev: true });
    }
    for (const [name, version] of Object.entries(json.peerDependencies ?? {})) {
      deps.push({ name, version, dev: false });
    }

    return {
      file: path.relative(repoRoot, filePath),
      packageManager: detectJsPackageManager(repoRoot),
      dependencies: deps,
    };
  } catch (err) {
    logger.warn(`Could not parse package.json at ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function parsePubspecYaml(filePath: string, repoRoot: string): ParsedManifest | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const doc = yaml.load(raw) as {
      dependencies?: Record<string, unknown>;
      dev_dependencies?: Record<string, unknown>;
    } | null;

    if (!doc) return null;

    const deps: Dependency[] = [];
    for (const [name, ver] of Object.entries(doc.dependencies ?? {})) {
      deps.push({ name, version: String(ver ?? ''), dev: false });
    }
    for (const [name, ver] of Object.entries(doc.dev_dependencies ?? {})) {
      deps.push({ name, version: String(ver ?? ''), dev: true });
    }

    return { file: path.relative(repoRoot, filePath), packageManager: 'pub', dependencies: deps };
  } catch (err) {
    logger.warn(`Could not parse pubspec.yaml: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function parseCargoToml(filePath: string, repoRoot: string): ParsedManifest | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const deps: Dependency[] = [];

    // Simple line-based TOML parser — no full TOML library needed for dependency lists
    let section = '';
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        section = sectionMatch[1].trim();
        continue;
      }
      if (section === 'dependencies' || section === 'dev-dependencies') {
        const kvMatch = trimmed.match(/^([\w-]+)\s*=\s*"([^"]+)"/);
        if (kvMatch) {
          deps.push({ name: kvMatch[1], version: kvMatch[2], dev: section === 'dev-dependencies' });
        }
      }
    }

    return { file: path.relative(repoRoot, filePath), packageManager: 'cargo', dependencies: deps };
  } catch (err) {
    logger.warn(`Could not parse Cargo.toml: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function parseGoMod(filePath: string, repoRoot: string): ParsedManifest | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const deps: Dependency[] = [];

    for (const line of raw.split('\n')) {
      const m = line.trim().match(/^([\w./\-]+)\s+(v[\w.\-+]+)/);
      if (m) {
        deps.push({ name: m[1], version: m[2], dev: false });
      }
    }

    return { file: path.relative(repoRoot, filePath), packageManager: 'go', dependencies: deps };
  } catch (err) {
    logger.warn(`Could not parse go.mod: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function parseRequirementsTxt(filePath: string, repoRoot: string): ParsedManifest | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const deps: Dependency[] = [];

    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;
      const m = trimmed.match(/^([\w.\-\[\]]+)([><=!~,\s].+)?$/);
      if (m) {
        deps.push({ name: m[1], version: (m[2] ?? '').trim(), dev: false });
      }
    }

    return { file: path.relative(repoRoot, filePath), packageManager: 'pip', dependencies: deps };
  } catch (err) {
    logger.warn(`Could not parse requirements.txt: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function parsePyprojectToml(filePath: string, repoRoot: string): ParsedManifest | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const deps: Dependency[] = [];
    let inDeps = false;
    let inDevDeps = false;

    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.match(/^\[tool\.poetry\.dependencies\]/) || trimmed.match(/^\[project\]\s*$/)) {
        inDeps = true; inDevDeps = false; continue;
      }
      if (trimmed.match(/^\[tool\.poetry\.dev-dependencies\]/) || trimmed.match(/^\[tool\.poetry\.group\..+\.dependencies\]/)) {
        inDevDeps = true; inDeps = false; continue;
      }
      if (trimmed.startsWith('[')) {
        inDeps = false; inDevDeps = false; continue;
      }
      if (inDeps || inDevDeps) {
        const m = trimmed.match(/^([\w.\-]+)\s*=\s*"([^"]+)"/);
        if (m && m[1] !== 'python') {
          deps.push({ name: m[1], version: m[2], dev: inDevDeps });
        }
      }
    }

    return { file: path.relative(repoRoot, filePath), packageManager: 'pip', dependencies: deps };
  } catch (err) {
    logger.warn(`Could not parse pyproject.toml: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function parseComposerJson(filePath: string, repoRoot: string): ParsedManifest | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw) as {
      require?: Record<string, string>;
      'require-dev'?: Record<string, string>;
    };

    const deps: Dependency[] = [];
    for (const [name, version] of Object.entries(json.require ?? {})) {
      if (name === 'php') continue;
      deps.push({ name, version, dev: false });
    }
    for (const [name, version] of Object.entries(json['require-dev'] ?? {})) {
      deps.push({ name, version, dev: true });
    }

    return { file: path.relative(repoRoot, filePath), packageManager: 'composer', dependencies: deps };
  } catch (err) {
    logger.warn(`Could not parse composer.json: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function parseGemfile(filePath: string, repoRoot: string): ParsedManifest | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const deps: Dependency[] = [];

    for (const line of raw.split('\n')) {
      const m = line.trim().match(/^gem\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?/);
      if (m) {
        deps.push({ name: m[1], version: m[2] ?? '', dev: false });
      }
    }

    return { file: path.relative(repoRoot, filePath), packageManager: 'bundler', dependencies: deps };
  } catch (err) {
    logger.warn(`Could not parse Gemfile: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function parseBuildGradle(filePath: string, repoRoot: string): ParsedManifest | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const deps: Dependency[] = [];

    for (const line of raw.split('\n')) {
      // implementation 'group:artifact:version' or implementation("group:artifact:version")
      const m = line.match(/(?:implementation|api|testImplementation|compileOnly|runtimeOnly)\s*[\('"]([^'"]+):([^'"]+):([^'"]+)['"]/);
      if (m) {
        deps.push({ name: `${m[1]}:${m[2]}`, version: m[3], dev: line.includes('test') });
      }
    }

    return { file: path.relative(repoRoot, filePath), packageManager: 'gradle', dependencies: deps };
  } catch (err) {
    logger.warn(`Could not parse build.gradle: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Scan a repo root for all known manifest files and parse them. */
export function parseManifests(repoRoot: string): ParsedManifest[] {
  const manifests: ParsedManifest[] = [];

  const candidates: [string, (f: string, r: string) => ParsedManifest | null][] = [
    ['package.json', parsePackageJson],
    ['pubspec.yaml', parsePubspecYaml],
    ['Cargo.toml', parseCargoToml],
    ['go.mod', parseGoMod],
    ['requirements.txt', parseRequirementsTxt],
    ['pyproject.toml', parsePyprojectToml],
    ['composer.json', parseComposerJson],
    ['Gemfile', parseGemfile],
    ['build.gradle', parseBuildGradle],
    ['build.gradle.kts', parseBuildGradle],
  ];

  for (const [filename, parser] of candidates) {
    const filePath = path.join(repoRoot, filename);
    if (!fs.existsSync(filePath)) continue;
    const result = parser(filePath, repoRoot);
    if (result) manifests.push(result);
  }

  return manifests;
}
