import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import { pinoHttp } from 'pino-http'
import { env } from './config/env.js'
import { logger } from './lib/logger.js'
import { ipRateLimit } from './lib/rate-limit.js'
import { healthRouter } from './routes/health.js'
import { authRouter } from './routes/auth.js'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')

  app.use(pinoHttp({ logger }))
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  app.get('/', (_req, res) => {
    res.json({
      name: 'smart-exam-server',
      message: 'Smart Exam Scheduling & Invigilation Management System',
      health: '/api/health',
    })
  })

  app.use('/api/health', healthRouter)
  app.use('/api/auth', ipRateLimit(), authRouter)

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'unhandled error')
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(500).json({ error: 'Internal server error', message })
  })

  return app
}
