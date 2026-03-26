import fs from 'node:fs';
import path from 'node:path';
import ignore, { type Ignore } from 'ignore';

/** Binary file extensions that are always skipped. */
const BINARY_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp', '.tiff', '.avif',
  // Video / audio
  '.mp4', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.ogg', '.flac',
  // Archives
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
  // Compiled / binary
  '.exe', '.dll', '.so', '.dylib', '.a', '.lib',
  '.class', '.pyc', '.pyo', '.pyd',
  '.wasm', '.bin',
  // Documents
  '.pdf', '.docx', '.xlsx', '.pptx',
  // Fonts
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  // Data / model
  '.db', '.sqlite', '.sqlite3', '.pkl', '.npy', '.npz', '.pt', '.pth',
  // SQLite WAL/SHM auxiliary files
  '.db-wal', '.db-shm', '.sqlite-wal', '.sqlite-shm',
]);

/** Paths always excluded regardless of any config. */
const ALWAYS_IGNORE = [
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.turbo',
  'coverage',
  '.nyc_output',
  '*.min.js',
  '*.min.css',
  '*.map',
  '*.lock',
  'yarn.lock',
  'package-lock.json',
  'pnpm-lock.yaml',
];

export interface IgnoreRulesOptions {
  /** Absolute path to the repo root. */
  repoRoot: string;
}

export class IgnoreRules {
  private ig: Ignore;

  constructor(private readonly repoRoot: string) {
    this.ig = ignore();
    this.ig.add(ALWAYS_IGNORE);
    this.loadFile('.gitignore');
    this.loadFile('.codeweave-ignore');
  }

  private loadFile(filename: string): void {
    const filePath = path.join(this.repoRoot, filename);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      this.ig.add(content);
    } catch {
      // File doesn't exist — that's fine
    }
  }

  /**
   * Returns true if the given path (relative to repoRoot) should be ignored.
   */
  isIgnored(relativePath: string): boolean {
    // Normalize to forward slashes
    const normalized = relativePath.replace(/\\/g, '/');
    return this.ig.ignores(normalized);
  }

  /**
   * Returns true if the file extension indicates a binary file.
   */
  static isBinaryExtension(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return BINARY_EXTENSIONS.has(ext);
  }

  /**
   * Returns true if the path should be skipped entirely (ignored OR binary).
   */
  shouldSkip(relativePath: string): boolean {
    return this.isIgnored(relativePath) || IgnoreRules.isBinaryExtension(relativePath);
  }
}

export function createIgnoreRules(repoRoot: string): IgnoreRules {
  return new IgnoreRules(repoRoot);
}
