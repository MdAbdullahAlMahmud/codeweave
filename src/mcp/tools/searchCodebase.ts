import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CodeweaveDb } from '../../cache/db.js';

export function registerSearchCodebase(server: McpServer, db: CodeweaveDb): void {
  server.registerTool(
    'search_codebase',
    {
      description: 'Full-text search across all indexed files. Returns matching files with context snippets.',
      inputSchema: {
        query: z.string().min(1).describe('Search query (supports FTS5 syntax: "term1 term2", "phrase match", term*)'),
        limit: z.number().int().min(1).max(100).optional().default(20).describe(
          'Maximum number of results to return (default: 20, max: 100)',
        ),
      },
    },
    async ({ query, limit }) => {
      const start = Date.now();
      const results = db.searchFiles(query, limit);
      const elapsed = Date.now() - start;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                query,
                resultCount: results.length,
                elapsedMs: elapsed,
                results,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
