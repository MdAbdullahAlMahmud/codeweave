import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CodeweaveDb } from '../../cache/db.js';

function addLineNumbers(content: string): string {
  return content
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(4, ' ')} | ${line}`)
    .join('\n');
}

export function registerGetFile(server: McpServer, db: CodeweaveDb): void {
  server.registerTool(
    'get_file',
    {
      description: 'Get the content of a specific file from the indexed codebase',
      inputSchema: {
        path: z.string().describe('Relative path to the file (e.g. "src/utils/logger.ts")'),
        line_numbers: z.boolean().optional().default(true).describe(
          'Whether to include line numbers in the output (default: true)',
        ),
        start_line: z.number().int().positive().optional().describe(
          'Start line number (1-based) to return a slice of the file',
        ),
        end_line: z.number().int().positive().optional().describe(
          'End line number (1-based, inclusive)',
        ),
      },
    },
    async ({ path, line_numbers, start_line, end_line }) => {
      const file = db.getFile(path);

      if (!file) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'File not found',
                path,
                hint: 'Use get_file_tree to browse available files',
              }),
            },
          ],
          isError: true,
        };
      }

      let content = file.content;

      // Apply line range if requested
      if (start_line != null || end_line != null) {
        const lines = content.split('\n');
        const start = (start_line ?? 1) - 1;
        const end = end_line ?? lines.length;
        content = lines.slice(start, end).join('\n');
      }

      if (line_numbers) {
        const offset = start_line ?? 1;
        content = content
          .split('\n')
          .map((line, i) => `${String(i + offset).padStart(4, ' ')} | ${line}`)
          .join('\n');
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                path: file.path,
                language: file.language,
                sizeBytes: file.size_bytes,
                content,
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

// Export for testing
export { addLineNumbers };
