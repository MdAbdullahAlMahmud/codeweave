import simpleGit from 'simple-git';
import { logger } from '../utils/logger.js';
import type { CodeweaveDb, CommitRow } from '../cache/db.js';

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
  changedFiles: string[];
}

/**
 * Read recent git commits for the repo at `repoRoot`.
 * Returns an empty array gracefully if not a git repo or git is unavailable.
 */
export async function readGitHistory(
  repoRoot: string,
  db: CodeweaveDb,
  depth = 50,
): Promise<CommitInfo[]> {
  const git = simpleGit(repoRoot);

  let isRepo: boolean;
  try {
    isRepo = await git.checkIsRepo();
  } catch {
    isRepo = false;
  }

  if (!isRepo) {
    logger.warn('Not a git repository — skipping git history');
    return [];
  }

  let log;
  try {
    log = await git.log({
      maxCount: depth,
      '--name-only': null,
    });
  } catch (err) {
    logger.warn(`Could not read git history: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }

  const commits: CommitInfo[] = [];

  for (const entry of log.all) {
    // simple-git doesn't natively expose changed files per commit in log —
    // we use diff to get them, but for performance we use the diff summary
    let changedFiles: string[] = [];
    try {
      const diff = await git.diffSummary([`${entry.hash}^`, entry.hash]);
      changedFiles = diff.files.map((f) => f.file);
    } catch {
      // First commit has no parent — that's fine
    }

    const commitInfo: CommitInfo = {
      hash: entry.hash,
      message: entry.message,
      author: entry.author_name,
      date: entry.date,
      changedFiles,
    };

    const row: CommitRow = {
      hash: commitInfo.hash,
      message: commitInfo.message,
      author: commitInfo.author,
      date: commitInfo.date,
      changed_files: JSON.stringify(commitInfo.changedFiles),
    };

    db.upsertCommit(row);
    commits.push(commitInfo);
  }

  logger.success(`Read ${commits.length} commits from git history`);
  return commits;
}
