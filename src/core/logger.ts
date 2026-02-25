/**
 * Structured logging with Pino
 * Pretty printing in development, JSON in production
 */

import {
  pino as createPino,
  destination,
  type Logger,
  type LoggerOptions,
  stdTimeFunctions,
} from 'pino';
import { getConfig } from './config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function createLogger(): Logger {
  const config = getConfig();
  const isDev = config.nodeEnv === 'development';

  const pinoConfig: LoggerOptions = {
    level: config.logLevel,
    timestamp: stdTimeFunctions.isoTime,
  };

  // Skip pino-pretty transport in pkg binary (transports don't work with pkg)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isPkg =
    !!(process as unknown as { pkg?: unknown }).pkg || process.execPath !== process.argv[0];

  if (isDev && !isPkg) {
    return createPino(
      {
        ...pinoConfig,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        },
      } as LoggerOptions,
      destination(1)
    );
  }

  return createPino(pinoConfig, destination(1));
}

export const logger = createLogger();

export function createChildLogger(module: string): Logger {
  return logger.child({ module });
}

export type { LogLevel };
