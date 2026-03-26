import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CodeweaveDb } from '../../cache/db.js';

export function registerGetDependencies(server: McpServer, db: CodeweaveDb): void {
  server.registerTool(
    'get_dependencies',
    {
      description: 'Get all dependencies parsed from manifest files (package.json, Cargo.toml, go.mod, etc.)',
      inputSchema: {
        include_dev: z.boolean().optional().default(true).describe(
          'Whether to include dev dependencies (default: true)',
        ),
      },
    },
    async ({ include_dev }) => {
      const raw = db.getStackInfo('manifests');

      if (!raw) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'No dependency data indexed yet. Run the indexer first.' }),
            },
          ],
          isError: true,
        };
      }

      const manifests = JSON.parse(raw) as Array<{
        file: string;
        packageManager: string;
        dependencies: Array<{ name: string; version: string; dev: boolean }>;
      }>;

      const filtered = manifests.map((m) => ({
        ...m,
        dependencies: include_dev
          ? m.dependencies
          : m.dependencies.filter((d) => !d.dev),
      }));

      const totalCount = filtered.reduce((s, m) => s + m.dependencies.length, 0);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ manifestCount: filtered.length, totalDependencies: totalCount, manifests: filtered }, null, 2),
          },
        ],
      };
    },
  );
}
