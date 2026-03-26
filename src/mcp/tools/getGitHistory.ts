import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CodeweaveDb } from '../../cache/db.js';

export function registerGetGitHistory(server: McpServer, db: CodeweaveDb): void {
  server.registerTool(
    'get_git_history',
    {
      description: 'Get recent git commit history, optionally filtered by file path',
      inputSchema: {
        limit: z.number().int().min(1).max(200).optional().default(20).describe(
          'Number of commits to return (default: 20, max: 200)',
        ),
        file_path: z.string().optional().describe(
          'Filter commits that touched this file path',
        ),
      },
    },
    async ({ limit, file_path }) => {
      let commits = db.getCommits(200); // fetch max, then filter

      if (file_path) {
        commits = commits.filter((c) => {
          const files = JSON.parse(c.changed_files) as string[];
          return files.some((f) => f.includes(file_path));
        });
      }

      const sliced = commits.slice(0, limit);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                total: sliced.length,
                commits: sliced.map((c) => ({
                  hash: c.hash,
                  message: c.message,
                  author: c.author,
                  date: c.date,
                  changedFiles: JSON.parse(c.changed_files) as string[],
                })),
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
