type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    meta,
    timestamp: new Date().toISOString(),
  };
}

function output(entry: LogEntry): void {
  const { level, message, meta, timestamp } = entry;
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  switch (level) {
    case "debug":
      console.debug(`${prefix} ${message}${metaStr}`);
      break;
    case "info":
      console.info(`${prefix} ${message}${metaStr}`);
      break;
    case "warn":
      console.warn(`${prefix} ${message}${metaStr}`);
      break;
    case "error":
      console.error(`${prefix} ${message}${metaStr}`);
      break;
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog("debug")) output(formatEntry("debug", message, meta));
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog("info")) output(formatEntry("info", message, meta));
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog("warn")) output(formatEntry("warn", message, meta));
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog("error")) output(formatEntry("error", message, meta));
  },
};