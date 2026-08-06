import pino from 'pino'
import { env } from '../config/env.js'

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'smart-exam-server' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'password_hash',
      'code',
    ],
    censor: '[REDACTED]',
  },
})
