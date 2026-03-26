import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { logger } from '../utils/logger.js';

const CONFIG_FILENAME = 'codeweave.config.js';

/** Auto-detect sensible include paths from the project structure. */
function detectIncludePaths(cwd: string): string[] {
  const candidates = ['src', 'lib', 'app', 'packages', 'apps', 'components', 'pages'];
  const found = candidates.filter((d) => fs.existsSync(path.join(cwd, d)));
  return found.length > 0 ? found : ['.'];
}

function generateConfig(includePaths: string[]): string {
  return `// codeweave.config.js
// Full reference: https://github.com/abdullahbs23/codeweave#configuration

/** @type {import('codeweave').CodeweaveConfig} */
export default {
  /** Directories to index (relative to this file's location). */
  include: ${JSON.stringify(includePaths)},

  /** Additional patterns to exclude on top of .gitignore. */
  exclude: [],

  /** Max file size to index in KB — larger files are truncated. */
  maxFileSizeKB: 100,

  /** How many git commits to read. */
  gitDepth: 50,

  /** MCP server port (used for HTTP transports). */
  port: 3333,

  /** Enable verbose/debug logging. */
  verbose: false,
};
`;
}

export async function runInit(cwd: string): Promise<void> {
  const configPath = path.join(cwd, CONFIG_FILENAME);

  if (fs.existsSync(configPath)) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      `${CONFIG_FILENAME} already exists. Overwrite? (y/N) `,
    );
    rl.close();
    if (answer.trim().toLowerCase() !== 'y') {
      logger.info('Init cancelled — existing config kept');
      return;
    }
  }

  const includePaths = detectIncludePaths(cwd);
  logger.verbose(`Auto-detected include paths: ${includePaths.join(', ')}`);

  const config = generateConfig(includePaths);
  fs.writeFileSync(configPath, config, 'utf8');

  logger.success(`Created ${CONFIG_FILENAME}`);
  logger.log('');
  logger.log('Next steps:');
  logger.log('  1. Review codeweave.config.js and adjust include paths');
  logger.log('  2. Add to your AI client config (run `codeweave start` for snippets)');
  logger.log('  3. Start the server: codeweave start');
}
