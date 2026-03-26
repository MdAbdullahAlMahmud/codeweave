import type { CodeweaveConfig } from './loader.js';

export const DEFAULT_CONFIG: CodeweaveConfig = {
  include: ['.'],
  exclude: [],
  maxFileSizeKB: 100,
  gitDepth: 50,
  port: 3333,
  verbose: false,
};
