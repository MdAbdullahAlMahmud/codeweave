#!/usr/bin/env node
import('../dist/cli/index.js').then(({ main }) => main()).catch((err) => {
  console.error('codeweave: fatal error', err);
  process.exit(1);
});
