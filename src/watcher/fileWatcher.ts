import fs from 'node:fs';
import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { IgnoreRules } from '../utils/ignoreRules.js';
import { logger } from '../utils/logger.js';
import { detectLanguage } from '../indexer/fileScanner.js';
import type { CodeweaveDb } from '../cache/db.js';
import type { CodeweaveConfig } from '../config/index.js';

const DEBOUNCE_MS = 300;

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly repoRoot: string,
    private readonly config: CodeweaveConfig,
    private readonly db: CodeweaveDb,
    private readonly ignoreRules: IgnoreRules,
  ) {}

  start(): void {
    if (this.watcher) return;

    const watchPaths = this.config.include.map((p) =>
      p === '.' ? this.repoRoot : path.join(this.repoRoot, p),
    );

    this.watcher = chokidar.watch(watchPaths, {
      ignoreInitial: true,
      persistent: true,
      followSymlinks: false,
      // Use polling as a fallback on network/docker volumes
      usePolling: false,
      // Ignore .git and node_modules at the chokidar level too
      ignored: [
        /(^|[/\\])\../,        // dot files/dirs
        /node_modules/,
        /\.git/,
        /dist\//,
      ],
    });

    this.watcher
      .on('add', (absPath) => this.scheduleIndex(absPath))
      .on('change', (absPath) => this.scheduleIndex(absPath))
      .on('unlink', (absPath) => this.handleDelete(absPath))
      .on('error', (err) => logger.error('Watcher error', err));

    logger.verbose(`File watcher started for ${watchPaths.join(', ')}`);
  }

  stop(): void {
    if (!this.watcher) return;
    void this.watcher.close();
    this.watcher = null;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    logger.verbose('File watcher stopped');
  }

  private scheduleIndex(absPath: string): void {
    const existing = this.timers.get(absPath);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.timers.delete(absPath);
      this.indexFile(absPath);
    }, DEBOUNCE_MS);

    this.timers.set(absPath, timer);
  }

  private indexFile(absPath: string): void {
    const relPath = path.relative(this.repoRoot, absPath).replace(/\\/g, '/');

    if (this.ignoreRules.shouldSkip(relPath)) {
      logger.verbose(`Watcher: skipping ignored file ${relPath}`);
      return;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(absPath);
    } catch {
      return; // File may have been deleted between event and handler
    }

    const maxBytes = this.config.maxFileSizeKB * 1024;

    let content: string;
    try {
      const raw = fs.readFileSync(absPath);
      content = (raw.length > maxBytes ? raw.slice(0, maxBytes) : raw).toString('utf8');
    } catch {
      logger.verbose(`Watcher: could not read ${relPath}`);
      return;
    }

    const language = detectLanguage(relPath);
    const mtime = Math.floor(stat.mtimeMs);

    this.db.upsertFile({ path: relPath, language, size_bytes: stat.size, mtime, content });
    logger.verbose(`Watcher: re-indexed ${relPath}`);
  }

  private handleDelete(absPath: string): void {
    const relPath = path.relative(this.repoRoot, absPath).replace(/\\/g, '/');
    this.db.deleteFile(relPath);
    logger.verbose(`Watcher: removed ${relPath} from index`);
  }
}

export function createFileWatcher(
  repoRoot: string,
  config: CodeweaveConfig,
  db: CodeweaveDb,
  ignoreRules: IgnoreRules,
): FileWatcher {
  return new FileWatcher(repoRoot, config, db, ignoreRules);
}
