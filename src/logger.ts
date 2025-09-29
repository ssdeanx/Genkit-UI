import pino from 'pino';

export type LogLevel = 'log' | 'warn' | 'error';

const isProd = process.env.NODE_ENV === 'production';

// Enhanced Pino configuration with more options
const flowlogger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  name: 'GenKit',
  base: null, // Omit default pid/hostname
  timestamp: pino.stdTimeFunctions.isoTime as unknown as boolean,
  // Add redaction for sensitive data
  redact: ['password', 'apiKey', 'secrets.*'],
  // Custom serializers for errors and requests
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  // Format levels as strings for readability
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Mixin to add environment info
  mixin() {
    return { env: process.env.NODE_ENV };
  },
  // Hooks for custom behavior
  hooks: {
    logMethod(inputArgs, method) {
      // Custom logic, e.g., modify args
      return method.apply(this, inputArgs);
    },
  },
}, isProd ? undefined : pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
  },
}));

export { flowlogger };

// Compatibility wrapper used by existing code paths
export function log(level: LogLevel, message: string, ...args: unknown[]): void {
  const obj = args.length > 0 ? { args } : undefined;
  if (level === 'warn') {
    flowlogger.warn(obj, message);
  } else if (level === 'error') {
    flowlogger.error(obj, message);
  } else {
    flowlogger.info(obj, message);
  }
}
