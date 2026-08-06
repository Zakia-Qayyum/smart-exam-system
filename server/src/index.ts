import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './lib/logger.js'
import { prisma } from './lib/prisma.js'

const app = createApp()

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, nodeEnv: env.NODE_ENV, logLevel: env.LOG_LEVEL },
    'smart-exam-server listening',
  )
})

async function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, 'shutting down smart-exam-server')
  server.close(async () => {
    await prisma.$disconnect()
    logger.info('shutdown complete')
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
