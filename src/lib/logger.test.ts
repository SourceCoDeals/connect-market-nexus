import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test with import.meta.env.PROD = false (default in test),
// which means currentLevel = 'debug', so all log levels should fire.

describe('logger', () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(async () => {
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // We import dynamically to get a fresh module for each test file run
  async function getLogger() {
    const mod = await import('./logger');
    return mod.logger;
  }

  it('logger.debug calls console.debug', async () => {
    const logger = await getLogger();
    logger.debug('debug message');
    expect(consoleSpy.debug).toHaveBeenCalled();
    const msg = consoleSpy.debug.mock.calls[0][0] as string;
    expect(msg).toContain('[DEBUG]');
    expect(msg).toContain('debug message');
  });

  it('logger.info calls console.info', async () => {
    const logger = await getLogger();
    logger.info('info message');
    expect(consoleSpy.info).toHaveBeenCalled();
    const msg = consoleSpy.info.mock.calls[0][0] as string;
    expect(msg).toContain('[INFO]');
    expect(msg).toContain('info message');
  });

  it('logger.warn calls console.warn', async () => {
    const logger = await getLogger();
    logger.warn('warn message');
    expect(consoleSpy.warn).toHaveBeenCalled();
    const msg = consoleSpy.warn.mock.calls[0][0] as string;
    expect(msg).toContain('[WARN]');
    expect(msg).toContain('warn message');
  });

  it('logger.error calls console.error', async () => {
    const logger = await getLogger();
    logger.error('error message');
    expect(consoleSpy.error).toHaveBeenCalled();
    const msg = consoleSpy.error.mock.calls[0][0] as string;
    expect(msg).toContain('[ERROR]');
    expect(msg).toContain('error message');
  });

  it('includes context in log output when provided', async () => {
    const logger = await getLogger();
    logger.info('test message', 'MyComponent');
    const msg = consoleSpy.info.mock.calls[0][0] as string;
    expect(msg).toContain('[MyComponent]');
    expect(msg).toContain('test message');
  });

  it('does not include context brackets when context is omitted', async () => {
    const logger = await getLogger();
    logger.info('no context message');
    const msg = consoleSpy.info.mock.calls[0][0] as string;
    // The format without context is: [timestamp] [LEVEL] message
    // It should NOT have a third bracket group for context
    const bracketGroups = msg.match(/\[.*?\]/g) || [];
    // Should only have timestamp and level brackets
    expect(bracketGroups.length).toBe(2);
  });

  it('passes data as second argument to console method', async () => {
    const logger = await getLogger();
    const data = { userId: 'u1', action: 'click' };
    logger.info('with data', 'Ctx', data);
    expect(consoleSpy.info).toHaveBeenCalledTimes(1);
    const secondArg = consoleSpy.info.mock.calls[0][1];
    expect(secondArg).toEqual(data);
  });

  it('passes empty string as second argument when data is omitted', async () => {
    const logger = await getLogger();
    logger.warn('no data');
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    const secondArg = consoleSpy.warn.mock.calls[0][1];
    expect(secondArg).toBe('');
  });

  it('includes ISO timestamp in log output', async () => {
    const logger = await getLogger();
    logger.debug('timestamp check');
    const msg = consoleSpy.debug.mock.calls[0][0] as string;
    // ISO timestamp pattern: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(msg).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('formats the log entry with correct structure: [timestamp] [LEVEL] [context] message', async () => {
    const logger = await getLogger();
    logger.error('something broke', 'ErrorHandler');
    const msg = consoleSpy.error.mock.calls[0][0] as string;
    // Should match: [<iso-date>] [ERROR] [ErrorHandler] something broke
    expect(msg).toMatch(/^\[.+\] \[ERROR\] \[ErrorHandler\] something broke$/);
  });

  it('formats correctly without context: [timestamp] [LEVEL] message', async () => {
    const logger = await getLogger();
    logger.debug('plain message');
    const msg = consoleSpy.debug.mock.calls[0][0] as string;
    expect(msg).toMatch(/^\[.+\] \[DEBUG\] plain message$/);
  });

  it('all four logger methods are defined', async () => {
    const logger = await getLogger();
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });
});
