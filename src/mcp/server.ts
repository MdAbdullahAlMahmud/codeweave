import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from '../utils/logger.js';
import { openDb } from '../cache/db.js';
import { loadConfig } from '../config/loader.js';
import { createIgnoreRules } from '../utils/ignoreRules.js';
import { scanFiles } from '../indexer/fileScanner.js';
import { readGitHistory } from '../indexer/gitReader.js';
import { parseManifests } from '../indexer/pkgParser.js';
import { detectStack } from '../indexer/stackDetector.js';
import { createFileWatcher } from '../watcher/fileWatcher.js';
import { registerGetFileTree } from './tools/getFileTree.js';
import { registerGetFile } from './tools/getFile.js';
import { registerSearchCodebase } from './tools/searchCodebase.js';
import { registerGetConventions } from './tools/getConventions.js';
import { registerGetDependencies } from './tools/getDependencies.js';
import { registerGetGitHistory } from './tools/getGitHistory.js';
import { registerGetStackInfo } from './tools/getStackInfo.js';

export interface ServerOptions {
  cwd?: string;
  verbose?: boolean;
}

export async function startServer(options: ServerOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();

  // ── Config ─────────────────────────────────────────────────────────────────
  const config = await loadConfig(cwd);
  if (options.verbose) config.verbose = true;
  logger.setVerbose(config.verbose);

  // ── Database ───────────────────────────────────────────────────────────────
  const db = openDb(cwd);

  // ── Ignore rules ───────────────────────────────────────────────────────────
  const ignoreRules = createIgnoreRules(cwd);

  // ── Index ──────────────────────────────────────────────────────────────────
  logger.info('Indexing repository…');
  await scanFiles(cwd, config, db, ignoreRules);

  logger.info('Reading git history…');
  await readGitHistory(cwd, db, config.gitDepth);

  logger.info('Parsing manifests…');
  const manifests = parseManifests(cwd);
  db.setStackInfo('manifests', JSON.stringify(manifests));

  logger.info('Detecting stack…');
  const stack = detectStack(manifests, cwd);
  db.setStackInfo('stack', JSON.stringify(stack, null, 2));

  // Store dev dependency names for convention detection
  const devDeps = manifests
    .flatMap((m) => m.dependencies.filter((d) => d.dev).map((d) => d.name));
  db.setStackInfo('devDependencies', JSON.stringify(devDeps));

  // ── MCP Server ─────────────────────────────────────────────────────────────
  const server = new McpServer({
    name: 'codeweave',
    version: '0.1.0',
  });

  // Register all tools
  registerGetFileTree(server, db);
  registerGetFile(server, db);
  registerSearchCodebase(server, db);
  registerGetConventions(server, db);
  registerGetDependencies(server, db);
  registerGetGitHistory(server, db);
  registerGetStackInfo(server, db);

  // ── File Watcher ───────────────────────────────────────────────────────────
  const watcher = createFileWatcher(cwd, config, db, ignoreRules);
  watcher.start();

  // ── Transport ──────────────────────────────────────────────────────────────
  const transport = new StdioServerTransport();

  // ── Shutdown ───────────────────────────────────────────────────────────────
  const shutdown = () => {
    logger.info('Shutting down…');
    watcher.stop();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await server.connect(transport);
  logger.success('codeweave MCP server ready');
  printConnectionGuide(config.port);
}

function printConnectionGuide(port: number): void {
  logger.log('\n── Connect your AI client ─────────────────────────────────────');
  logger.log('\nClaude Code (.claude/settings.json):');
  logger.log(JSON.stringify({
    mcpServers: {
      codeweave: {
        command: 'npx',
        args: ['codeweave'],
        cwd: '.',
      },
    },
  }, null, 2));

  logger.log('\nCursor (.cursor/mcp.json):');
  logger.log(JSON.stringify({
    mcpServers: {
      codeweave: {
        command: 'npx',
        args: ['codeweave'],
        cwd: '${workspaceFolder}',
      },
    },
  }, null, 2));

  logger.log('\nZed (~/.config/zed/settings.json → context_servers):');
  logger.log(JSON.stringify({
    'context_servers': {
      codeweave: {
        command: { path: 'npx', args: ['codeweave'] },
      },
    },
  }, null, 2));

  logger.log(`\nPort hint (for HTTP transports): ${port}`);
  logger.log('───────────────────────────────────────────────────────────────\n');
}
