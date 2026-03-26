import { describe, it, expect } from 'vitest';
import { estimateTokens, estimateTokensForFiles, formatTokenCount } from '../src/utils/tokenEstimator.js';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => expect(estimateTokens('')).toBe(0));
  it('estimates tokens at ~4 chars each', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
  });
  it('rounds up', () => expect(estimateTokens('abc')).toBe(1));
  it('handles a typical code line', () => {
    const line = 'const x = someFunction(arg1, arg2);';
    expect(estimateTokens(line)).toBeGreaterThan(0);
  });
});

describe('estimateTokensForFiles', () => {
  it('sums token estimates across files', () => {
    const files = [{ content: 'abcd' }, { content: 'abcd' }];
    expect(estimateTokensForFiles(files)).toBe(2);
  });
  it('returns 0 for empty array', () => expect(estimateTokensForFiles([])).toBe(0));
});

describe('formatTokenCount', () => {
  it('formats small numbers as-is', () => expect(formatTokenCount(500)).toBe('500'));
  it('formats thousands with K suffix', () => expect(formatTokenCount(1500)).toBe('1.5K'));
  it('formats millions with M suffix', () => expect(formatTokenCount(1_500_000)).toBe('1.5M'));
  it('formats exact 1K', () => expect(formatTokenCount(1000)).toBe('1.0K'));
});
