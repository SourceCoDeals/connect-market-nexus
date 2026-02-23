type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = import.meta.env.PROD ? 'warn' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatLog(entry: LogEntry): string {
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
  return entry.context
    ? `${prefix} [${entry.context}] ${entry.message}`
    : `${prefix} ${entry.message}`;
}

function log(
  level: LogLevel,
  message: string,
  context?: string,
  data?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    data,
  };

  const formatted = formatLog(entry);

  switch (level) {
    case 'error':
      console.error(formatted, data ?? '');
      break;
    case 'warn':
      console.warn(formatted, data ?? '');
      break;
    case 'info':
      console.info(formatted, data ?? '');
      break;
    case 'debug':
      console.debug(formatted, data ?? '');
      break;
  }
}

/**
 * Structured logger utility with level-based filtering.
 * In production, only `warn` and `error` messages are emitted; in development, all levels are active.
 *
 * @example
 * ```ts
 * logger.info("User logged in", "AuthService", { userId: "abc" });
 * logger.error("Failed to fetch data", "API", { endpoint: "/users" });
 * ```
 */
export const logger = {
  debug: (message: string, context?: string, data?: Record<string, unknown>) =>
    log('debug', message, context, data),
  info: (message: string, context?: string, data?: Record<string, unknown>) =>
    log('info', message, context, data),
  warn: (message: string, context?: string, data?: Record<string, unknown>) =>
    log('warn', message, context, data),
  error: (message: string, context?: string, data?: Record<string, unknown>) =>
    log('error', message, context, data),
};
