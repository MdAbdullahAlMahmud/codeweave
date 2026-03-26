import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CodeweaveDb } from '../../cache/db.js';

interface TreeNode {
  path: string;
  language: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

function buildTree(files: Array<{ path: string; language: string }>): TreeNode[] {
  const root: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();

  // Sort so directories are implicitly created in order
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    const parts = file.path.split('/');
    let parent = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join('/');
      let dir = dirMap.get(dirPath);
      if (!dir) {
        dir = { path: dirPath, language: 'directory', type: 'directory', children: [] };
        dirMap.set(dirPath, dir);
        parent.push(dir);
      }
      parent = dir.children!;
    }

    parent.push({ path: file.path, language: file.language, type: 'file' });
  }

  return root;
}

export function registerGetFileTree(server: McpServer, db: CodeweaveDb): void {
  server.registerTool(
    'get_file_tree',
    {
      description: 'Get the annotated file tree of the indexed codebase',
      inputSchema: {
        include_languages: z.array(z.string()).optional().describe(
          'Filter to only include files of these languages (e.g. ["TypeScript", "Python"])',
        ),
      },
    },
    async ({ include_languages }) => {
      let files = db.getAllFiles().map((f) => ({ path: f.path, language: f.language }));

      if (include_languages && include_languages.length > 0) {
        const langs = new Set(include_languages.map((l) => l.toLowerCase()));
        files = files.filter((f) => langs.has(f.language.toLowerCase()));
      }

      const tree = buildTree(files);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ fileCount: files.length, tree }, null, 2),
          },
        ],
      };
    },
  );
}
