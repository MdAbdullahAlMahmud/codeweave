import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CodeweaveDb } from '../../cache/db.js';
import { detectConventions } from '../../indexer/conventionDetector.js';

export function registerGetConventions(server: McpServer, db: CodeweaveDb): void {
  server.registerTool(
    'get_conventions',
    {
      description: 'Get detected coding conventions: file naming style, import patterns, component structure, and test framework',
    },
    async () => {
      const allFiles = db.getAllFiles();
      const filePaths = allFiles.map((f) => f.path);

      // Only sample TS/JS files for import analysis (cap at 200 for performance)
      const tsJsFiles = allFiles
        .filter((f) => ['TypeScript', 'JavaScript'].includes(f.language))
        .slice(0, 200);

      // Get dev dependencies from stack_info if stored
      const devDepsRaw = db.getStackInfo('devDependencies');
      const devDependencies = devDepsRaw ? (JSON.parse(devDepsRaw) as string[]) : [];

      const conventions = detectConventions({
        filePaths,
        tsJsContents: tsJsFiles.map((f) => f.content),
        devDependencies,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(conventions, null, 2),
          },
        ],
      };
    },
  );
}
