import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  JWT_SECRET: z.string().min(1).default('change-me-in-production'),
  JWT_EXPIRES_IN: z.string().min(1).default('8h'),
  OTP_PROVIDER: z.enum(['redis', 'memory']).default('redis'),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:')
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2))
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env
