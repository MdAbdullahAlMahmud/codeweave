import { createRequire } from 'node:module';
import { Command } from 'commander';
import { logger } from '../utils/logger.js';
import { startServer } from '../mcp/server.js';
import { runInit } from './init.js';
import { runStatus } from './status.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
const { version } = require('../../package.json') as { version: string };

export function buildCli(): Command {
  const program = new Command();

  program
    .name('codeweave')
    .description('Make any repo instantly AI-ready via MCP')
    .version(version, '-V, --version');

  // ── start (default command) ──────────────────────────────────────────────
  program
    .command('start', { isDefault: true })
    .description('Start the codeweave MCP server (default command)')
    .option('--verbose', 'Enable verbose/debug logging')
    .action(async (opts: { verbose?: boolean }) => {
      try {
        await startServer({
          cwd: process.cwd(),
          verbose: opts.verbose,
        });
      } catch (err) {
        logger.error('Failed to start server', err);
        process.exit(1);
      }
    });

  // ── init ──────────────────────────────────────────────────────────────────
  program
    .command('init')
    .description('Create a codeweave.config.js in the current directory')
    .option('--verbose', 'Enable verbose logging')
    .action(async (opts: { verbose?: boolean }) => {
      logger.setVerbose(opts.verbose ?? false);
      try {
        await runInit(process.cwd());
      } catch (err) {
        logger.error('Init failed', err);
        process.exit(1);
      }
    });

  // ── status ────────────────────────────────────────────────────────────────
  program
    .command('status')
    .description('Show indexing stats for the current repo')
    .option('--verbose', 'Enable verbose logging')
    .action(async (opts: { verbose?: boolean }) => {
      logger.setVerbose(opts.verbose ?? false);
      try {
        await runStatus(process.cwd());
      } catch (err) {
        logger.error('Status failed', err);
        process.exit(1);
      }
    });

  return program;
}

export async function main(): Promise<void> {
  const program = buildCli();
  await program.parseAsync(process.argv);
}
