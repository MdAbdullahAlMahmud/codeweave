import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

export const CodeweaveConfigSchema = z.object({
  /** Glob patterns or directories to include (relative to repo root). */
  include: z.array(z.string()).default(['.']),
  /** Additional glob patterns to exclude on top of .gitignore. */
  exclude: z.array(z.string()).default([]),
  /** Max file size to index in KB. Files larger than this are truncated. */
  maxFileSizeKB: z.number().int().positive().default(100),
  /** How many commits to read from git history. */
  gitDepth: z.number().int().positive().default(50),
  /** Port for the MCP server. */
  port: z.number().int().min(1).max(65535).default(3333),
  /** Enable verbose/debug logging. */
  verbose: z.boolean().default(false),
});

export type CodeweaveConfig = z.infer<typeof CodeweaveConfigSchema>;

const CONFIG_FILENAMES = ['codeweave.config.js', 'codeweave.config.mjs', 'codeweave.config.cjs'];

/**
 * Load and validate codeweave config from cwd.
 * Falls back to defaults if no config file is found.
 * Throws a descriptive error if config is invalid.
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<CodeweaveConfig> {
  for (const filename of CONFIG_FILENAMES) {
    const filePath = path.join(cwd, filename);
    if (!fs.existsSync(filePath)) continue;

    logger.verbose(`Loading config from ${filePath}`);

    let raw: unknown;
    try {
      const fileUrl = pathToFileURL(filePath).href;
      const mod = await import(fileUrl);
      raw = mod.default ?? mod;
    } catch (err) {
      throw new Error(
        `Failed to load config file "${filename}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const result = CodeweaveConfigSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid config in "${filename}":\n${issues}`);
    }

    logger.verbose('Config loaded and validated successfully');
    return result.data;
  }

  logger.verbose('No config file found — using defaults');
  const result = CodeweaveConfigSchema.safeParse({});
  // Empty object always passes with defaults
  return result.data!;
}
