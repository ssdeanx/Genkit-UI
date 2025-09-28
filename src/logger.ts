import pino from 'pino';

export type LogLevel = 'log' | 'warn' | 'error';

const isProd = process.env.NODE_ENV === 'production';

// Pretty transport in non-production for readable logs
const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  name: 'GenKit',
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime as unknown as boolean
}, isProd ? undefined : pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname'
  }
}));

export { logger };

// Compatibility wrapper used by existing code paths
export function log(level: LogLevel, message: string, ...args: unknown[]): void {
  const obj = args.length > 0 ? { args } : undefined;
  if (level === 'warn') {
    logger.warn(obj, message);
  } else if (level === 'error') {
    logger.error(obj, message);
  } else {
    logger.info(obj, message);
  }
}
