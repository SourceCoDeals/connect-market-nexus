/**
 * Structured logging utility.
 *
 * Features:
 * - Four log levels: debug, info, warn, error.
 * - Context-aware — every message is tagged with a `source` string
 *   (component name, hook name, module, etc.).
 * - Batch buffering — `debug` and `info` logs are buffered and flushed
 *   periodically (or on demand) to reduce console spam.
 * - In production builds (`import.meta.env.PROD`), `debug` messages are
 *   suppressed entirely.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  source: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Logger implementation
// ---------------------------------------------------------------------------

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private buffer: LogEntry[] = [];
  private readonly maxBufferSize = 50;
  private readonly flushIntervalMs = 5_000; // 5 seconds
  private timerId: ReturnType<typeof setInterval> | null = null;
  private minLevel: LogLevel = 'debug';

  constructor() {
    // In production suppress debug output
    if (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD) {
      this.minLevel = 'info';
    }

    this.startAutoFlush();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  debug(
    message: string,
    source: string,
    data?: Record<string, unknown>,
  ): void {
    this.log('debug', message, source, data);
  }

  info(
    message: string,
    source: string,
    data?: Record<string, unknown>,
  ): void {
    this.log('info', message, source, data);
  }

  warn(
    message: string,
    source: string,
    data?: Record<string, unknown>,
  ): void {
    this.log('warn', message, source, data);
  }

  error(
    message: string,
    source: string,
    data?: Record<string, unknown>,
  ): void {
    this.log('error', message, source, data);
  }

  /** Force-flush all buffered log entries immediately. */
  flush(): void {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    // Group by level for readability
    const grouped = new Map<LogLevel, LogEntry[]>();
    for (const entry of entries) {
      const list = grouped.get(entry.level) ?? [];
      list.push(entry);
      grouped.set(entry.level, list);
    }

    for (const [level, items] of grouped) {
      const writer = this.getConsoleMethod(level);
      if (items.length === 1) {
        const e = items[0];
        writer(
          `[${e.level.toUpperCase()}] [${e.source}] ${e.message}`,
          e.data ?? '',
        );
      } else {
        writer(
          `[${level.toUpperCase()}] Batch (${items.length} entries):`,
          items.map((e) => ({
            source: e.source,
            message: e.message,
            ...(e.data ? { data: e.data } : {}),
            time: e.timestamp,
          })),
        );
      }
    }
  }

  /** Tear down the auto-flush timer (useful in tests). */
  destroy(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.flush();
  }

  /** Return the last `n` entries still in the buffer (for debugging). */
  getRecentEntries(n = 20): ReadonlyArray<LogEntry> {
    return this.buffer.slice(-n);
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private log(
    level: LogLevel,
    message: string,
    source: string,
    data?: Record<string, unknown>,
  ): void {
    // Skip messages below the current threshold
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      source,
      timestamp: new Date().toISOString(),
      data,
    };

    // warn & error are printed immediately — they should never be delayed
    if (level === 'warn' || level === 'error') {
      const writer = this.getConsoleMethod(level);
      writer(
        `[${level.toUpperCase()}] [${source}] ${message}`,
        data ?? '',
      );
      return;
    }

    // debug & info go into the buffer
    this.buffer.push(entry);

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  private getConsoleMethod(
    level: LogLevel,
  ): (...args: unknown[]) => void {
    switch (level) {
      case 'debug':
        return console.debug;
      case 'info':
        return console.info;
      case 'warn':
        return console.warn;
      case 'error':
        return console.error;
    }
  }

  private startAutoFlush(): void {
    if (typeof setInterval === 'undefined') return;

    this.timerId = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);

    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const logger = new Logger();
