import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['cjs'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: true,
  splitting: false,
  bundle: true,
  external: ['better-sqlite3'],
  noExternal: [
    '@modelcontextprotocol/sdk',
    'commander',
    'fast-glob',
    'simple-git',
    'chokidar',
    'zod',
    'js-yaml',
    'ignore',
  ],
  banner: {
    js: '// codeweave — Make any repo instantly AI-ready via MCP',
  },
});
