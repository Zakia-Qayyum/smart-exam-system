import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinoHttp } from 'pino-http'
import { env } from './config/env.js'
import { logger } from './lib/logger.js'
import { ipRateLimit } from './lib/rate-limit.js'
import { healthRouter } from './routes/health.js'
import { authRouter } from './routes/auth.js'
import { schedulingRouter } from './routes/scheduling.js'
import { clashesRouter } from './routes/clashes.js'
import { catalogRouter } from './routes/catalog.js'
import { cyclesRouter } from './routes/cycles.js'
import { invigilatorsRouter } from './routes/invigilators.js'
import { invigilatorAssignmentsRouter } from './routes/invigilator-assignments.js'
import { adminRouter } from './routes/admin.js'
import { overrideRequestsRouter } from './routes/override-requests.js'
import { auditLogRouter } from './routes/audit-log.js'
import { notificationsRouter } from './routes/notifications.js'
import { exportRouter } from './routes/export.js'
import { studentsRouter } from './routes/students.js'
import { HttpError } from './lib/http-error.js'

const isProd = env.NODE_ENV === 'production'

export function createApp() {
  const app = express()

  // ── Security headers ────────────────────────────────────────────────────
  app.disable('x-powered-by')
  app.use(helmet({
    contentSecurityPolicy: isProd ? undefined : false,
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  }))

  // ── HTTP logging ────────────────────────────────────────────────────────
  app.use(pinoHttp({ logger }))

  // ── CORS ────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  )

  app.use(express.json({ limit: '1mb' }))

  // ── Health (unauthenticated, safe) ──────────────────────────────────────
  app.use('/api/health', healthRouter)

  // ── Auth routes (rate-limited at IP level) ──────────────────────────────
  app.use('/api/auth', ipRateLimit(), authRouter)

  // ── Write rate limiter (60 req/min per IP on mutating endpoints) ────────
  const writeRateLimit = ipRateLimit({ max: 60, windowMs: 60_000 })

  // ── Protected API routes ────────────────────────────────────────────────
  // Read routes get standard auth only; write routes also get rate limiting.
  app.use('/api/scheduling', schedulingRouter)
  app.use('/api/clashes', clashesRouter)
  app.use('/api/catalog', catalogRouter)
  app.use('/api/cycles', cyclesRouter)
  app.use('/api/invigilators', invigilatorsRouter)
  app.use('/api/invigilator-assignments', writeRateLimit, invigilatorAssignmentsRouter)
  app.use('/api', adminRouter)
  app.use('/api/override-requests', writeRateLimit, overrideRequestsRouter)
  app.use('/api/audit-log', auditLogRouter)
  app.use('/api/notifications', writeRateLimit, notificationsRouter)
  app.use('/api/export', writeRateLimit, exportRouter)
  app.use('/api/students', studentsRouter)

  // ── Serve frontend static files in production ─────────────────────────
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const publicDir = path.resolve(__dirname, 'public')
  if (isProd) {
    app.use(express.static(publicDir))
  }

  // ── 404 catch-all (no info leak) ────────────────────────────────────────
  app.use((_req, res) => {
    if (isProd) {
      res.sendFile(path.join(publicDir, 'index.html'), (err) => {
        if (err) res.status(404).json({ error: 'Not found' })
      })
    } else {
      res.status(404).json({ error: 'Not found' })
    }
  })

  // ── Global error handler (never leak internals in production) ───────────
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({
        status: err.code,
        error: err.message,
        ...(err.details ? { details: err.details } : {}),
      })
      return
    }
    logger.error({ err }, 'unhandled error')
    res.status(500).json({
      error: 'Internal server error',
      ...(isProd ? {} : { message: err instanceof Error ? err.message : 'Unknown error' }),
    })
  })

  return app
}
