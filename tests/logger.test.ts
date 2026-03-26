import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '../src/utils/logger.js';

describe('logger', () => {
  beforeEach(() => {
    logger.setVerbose(false);
    vi.restoreAllMocks();
  });

  it('writes info to stdout', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.info('hello info');
    expect(spy).toHaveBeenCalledOnce();
    expect(String(spy.mock.calls[0][0])).toContain('hello info');
    expect(String(spy.mock.calls[0][0])).toContain('info');
  });

  it('writes success to stdout', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.success('all good');
    expect(spy).toHaveBeenCalledOnce();
    expect(String(spy.mock.calls[0][0])).toContain('all good');
  });

  it('writes warn to stdout', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.warn('careful');
    expect(spy).toHaveBeenCalledOnce();
    expect(String(spy.mock.calls[0][0])).toContain('careful');
    expect(String(spy.mock.calls[0][0])).toContain('warn');
  });

  it('writes error to stderr', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger.error('boom');
    expect(spy).toHaveBeenCalledOnce();
    expect(String(spy.mock.calls[0][0])).toContain('boom');
    expect(String(spy.mock.calls[0][0])).toContain('error');
  });

  it('appends error message when err is an Error', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger.error('context', new Error('root cause'));
    const output = String(spy.mock.calls[0][0]);
    expect(output).toContain('context');
    expect(output).toContain('root cause');
  });

  it('does not write verbose when not in verbose mode', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.verbose('secret debug info');
    expect(spy).not.toHaveBeenCalled();
  });

  it('writes verbose when verbose mode is on', () => {
    logger.setVerbose(true);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.verbose('debug output');
    expect(spy).toHaveBeenCalledOnce();
    expect(String(spy.mock.calls[0][0])).toContain('debug output');
  });

  it('isVerbose reflects setVerbose', () => {
    logger.setVerbose(false);
    expect(logger.isVerbose()).toBe(false);
    logger.setVerbose(true);
    expect(logger.isVerbose()).toBe(true);
  });

  it('log writes a plain line', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.log('plain line');
    expect(String(spy.mock.calls[0][0])).toBe('plain line\n');
  });
});
