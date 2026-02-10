/**
 * Logger Utility
 * Structured JSON logging with Pino
 */

import pino, { Logger } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger: Logger = pino({
  level: isProduction ? 'info' : 'debug',
  transport: isProduction 
    ? undefined 
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      },
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'mep-platform',
    env: process.env.NODE_ENV || 'development',
  },
  serializers: {
    error: pino.stdSerializers.errWithCause,
    request: (req: any) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
      userAgent: req.headers['user-agent'],
    }),
    response: (res: any) => ({
      statusCode: res.statusCode,
      responseTime: res.responseTime,
    }),
  },
});

// Child logger for specific modules
export function createChildLogger(module: string): Logger {
  return logger.child({ module });
}
