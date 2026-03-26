import { defineConfig } from 'tsup';

export default defineConfig({
  // Compile every source file individually (no bundling)
  entry: ['src/**/*.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: true,
  splitting: false,
  bundle: false,
  banner: {
    js: '// codeweave — Make any repo instantly AI-ready via MCP',
  },
});
