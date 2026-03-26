/**
 * Lightweight token count estimator (cl100k_base approximation).
 * Rule of thumb: ~4 characters per token for English/code text.
 */

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateTokensForFiles(files: Array<{ content: string }>): number {
  return files.reduce((sum, f) => sum + estimateTokens(f.content), 0);
}

export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}
