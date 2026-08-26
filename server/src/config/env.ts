import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  // ── Auth / JWT ──────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(16).default('change-me-in-production'),
  // Access token lifetime (jose ms StringValue, e.g. '15m' | '30m' | '1h' | '8h').
  JWT_ACCESS_TTL: z.string().min(1).default('30m'),
  // How long an MFA-pending token (granted at login) stays valid.
  JWT_MFA_TTL: z.string().min(1).default('10m'),
  // Refresh token lifetime in days.
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(14),

  // ── Password policy & lockout ────────────────────────────────────────────
  PASSWORD_MIN_LENGTH: z.coerce.number().int().positive().default(8),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),

  // ── OTP ──────────────────────────────────────────────────────────────────
  // Storage backend. 'memory' is for development; 'redis' can be added later
  // behind the same OtpStore interface.
  OTP_PROVIDER: z.enum(['memory', 'redis']).default('memory'),
  OTP_SENDER: z.enum(['console', 'email']).default('console'),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(30),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  // ── Email (used when OTP_SENDER=email) ──────────────────────────────────
  RESEND_API_KEY: z.string().default(''),
  SMTP_FROM: z.string().default(''),
  // When set, all OTP emails are redirected to this address instead of the
  // user's database email. Useful for demos where seed emails are fictitious.
  SMTP_OVERRIDE_TO: z.string().default(''),

  // ── Rate limiting (per IP, sliding window) ───────────────────────────────
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
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
