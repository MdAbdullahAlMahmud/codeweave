import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CodeweaveDb } from '../../cache/db.js';

export function registerGetStackInfo(server: McpServer, db: CodeweaveDb): void {
  server.registerTool(
    'get_stack_info',
    {
      description: 'Get the detected technology stack: language, framework, database, testing tools, and more',
    },
    async () => {
      const raw = db.getStackInfo('stack');

      if (!raw) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'Stack info not indexed yet. Run the indexer first.' }),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: raw,
          },
        ],
      };
    },
  );
}
