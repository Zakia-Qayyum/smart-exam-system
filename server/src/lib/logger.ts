import pino from 'pino'
import { env } from '../config/env.js'

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'smart-exam-server' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'password', 'password_hash'],
    censor: '[REDACTED]',
  },
})
