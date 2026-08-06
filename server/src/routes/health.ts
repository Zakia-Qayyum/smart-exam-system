import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'

export const healthRouter = Router()

healthRouter.get('/', async (_req, res) => {
  const started = process.hrtime.bigint()
  let db: 'up' | 'down' = 'down'
  let dbError: string | undefined

  try {
    await prisma.$queryRaw`SELECT 1`
    db = 'up'
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'unknown database error'
    logger.error({ err }, 'health check failed: database unreachable')
  }

  const latencyMs = Number(process.hrtime.bigint() - started) / 1e6

  res.status(db === 'up' ? 200 : 503).json({
    status: db === 'up' ? 'ok' : 'degraded',
    service: 'smart-exam-server',
    database: db,
    uptimeSeconds: Math.floor(process.uptime()),
    latencyMs: Math.round(latencyMs * 10) / 10,
    timestamp: new Date().toISOString(),
    ...(dbError ? { databaseError: dbError } : {}),
  })
})
