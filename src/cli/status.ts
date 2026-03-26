import { openDb } from '../cache/db.js';
import { loadConfig } from '../config/loader.js';
import { logger } from '../utils/logger.js';
import { estimateTokensForFiles, formatTokenCount } from '../utils/tokenEstimator.js';

export async function runStatus(cwd: string): Promise<void> {
  const config = await loadConfig(cwd);
  const db = openDb(cwd);

  try {
    const files = db.getAllFiles();
    const fileCount = files.length;
    const commits = db.getCommits(1000);
    const stackRaw = db.getStackInfo('stack');
    const dbSizeBytes = db.getDbSizeBytes();

    // Language breakdown
    const langCounts: Record<string, number> = {};
    for (const f of files) {
      langCounts[f.language] = (langCounts[f.language] ?? 0) + 1;
    }
    const topLangs = Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    // Token estimate
    const tokenCount = estimateTokensForFiles(files);

    // Stack info
    const stack = stackRaw ? (JSON.parse(stackRaw) as {
      language: string | null;
      framework: string | null;
      packageManager: string | null;
    }) : null;

    logger.log('');
    logger.log('── codeweave status ────────────────────────────────────────────');
    logger.log(`  Indexed files  : ${fileCount}`);
    logger.log(`  Git commits    : ${commits.length}`);
    logger.log(`  DB size        : ${(dbSizeBytes / 1024).toFixed(1)} KB`);
    logger.log(`  Est. tokens    : ${formatTokenCount(tokenCount)}`);
    logger.log('');
    logger.log('  Language breakdown:');
    for (const [lang, count] of topLangs) {
      const bar = '█'.repeat(Math.round((count / fileCount) * 20));
      logger.log(`    ${lang.padEnd(18)} ${String(count).padStart(5)}  ${bar}`);
    }
    logger.log('');

    if (stack) {
      logger.log('  Detected stack:');
      if (stack.language) logger.log(`    Language    : ${stack.language}`);
      if (stack.framework) logger.log(`    Framework   : ${stack.framework}`);
      if (stack.packageManager) logger.log(`    Pkg manager : ${stack.packageManager}`);
    }

    logger.log('');
    logger.log('  Config:');
    logger.log(`    include       : ${config.include.join(', ')}`);
    logger.log(`    maxFileSizeKB : ${config.maxFileSizeKB}`);
    logger.log(`    gitDepth      : ${config.gitDepth}`);
    logger.log('────────────────────────────────────────────────────────────────');
    logger.log('');
  } finally {
    db.close();
  }
}
