import { Router, type Request, type RequestHandler } from 'express'
import { z, type ZodType } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { toFrontendRole } from '../lib/roles.js'
import { comparePassword, hashPassword, meetsPasswordPolicy, passwordRules } from '../lib/password.js'
import { signAccessToken, signMfaToken, verifyMfaToken } from '../lib/jwt.js'
import { createOtpStore, type OtpChallenge } from '../lib/otp-store.js'
import { createOtpSender } from '../lib/otp-sender.js'
import { randomToken, sha256 } from '../lib/tokens.js'
import { REFRESH_COOKIE, clearRefreshCookie, parseCookies, setRefreshCookie } from '../lib/cookies.js'
import { requireAuth, requireOwnership, requireRole } from '../middleware/require-auth.js'

export const authRouter = Router()

// ── Constants ─────────────────────────────────────────────────────────────
const LOGIN_MAX_ATTEMPTS = env.LOGIN_MAX_ATTEMPTS
const LOCKOUT_MS = env.LOCKOUT_MINUTES * 60 * 1000
const OTP_TTL_MS = env.OTP_TTL_SECONDS * 1000
const OTP_MAX_ATTEMPTS = env.OTP_MAX_ATTEMPTS
const RESEND_COOLDOWN_MS = env.OTP_RESEND_COOLDOWN_SECONDS * 1000
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000

// ── Injected services (swappable later, e.g. Redis OTP store / email sender) ──
const otpStore = createOtpStore()
const otpSender = createOtpSender()

// ── Helpers ───────────────────────────────────────────────────────────────

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function publicUser(user: {
  id: string
  name: string
  email: string
  role: string
  department_id: string | null
  must_change_password: boolean
  mfa_enabled: boolean
  department?: { name: string } | null
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: toFrontendRole(user.role),
    department: user.department?.name ?? null,
    mustChangePassword: user.must_change_password,
    mfaEnabled: user.mfa_enabled,
  }
}

function validateBody(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ status: 'validation_error', error: 'Invalid request body', details: parsed.error.flatten() })
      return
    }
    req.body = parsed.data
    next()
  }
}

async function createRefreshSession(userId: string, req: Request) {
  const raw = randomToken(48)
  const hash = sha256(raw)
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
  await prisma.refreshToken.create({
    data: {
      user_id: userId,
      token_hash: hash,
      expires_at: expiresAt,
      user_agent: req.headers['user-agent']?.slice(0, 255) ?? null,
      ip_address: req.ip ?? null,
    },
  })
  return { raw }
}

// ── POST /api/auth/login ──────────────────────────────────────────────────
authRouter.post(
  '/login',
  validateBody(z.object({ email: z.email(), password: z.string().min(1) })),
  async (req, res) => {
    const email = (req.body.email as string).trim().toLowerCase()
    const user = await prisma.user.findUnique({ where: { email }, include: { department: true } })

    if (user && user.locked_until && user.locked_until.getTime() > Date.now()) {
      res.status(423).json({ status: 'locked', email, until: user.locked_until.getTime() })
      return
    }
    if (user && user.status === 'disabled') {
      res.status(423).json({ status: 'locked', email, until: Date.now() + LOCKOUT_MS })
      return
    }

    const passwordOk = user ? await comparePassword(req.body.password as string, user.password_hash) : false

    if (!user || !passwordOk) {
      if (user) {
        const attempts = user.failed_login_attempts + 1
        if (attempts >= LOGIN_MAX_ATTEMPTS) {
          const until = new Date(Date.now() + LOCKOUT_MS)
          await prisma.user.update({
            where: { id: user.id },
            data: { failed_login_attempts: attempts, locked_until: until },
          })
          logger.warn({ userId: user.id, email }, 'account locked after consecutive failed logins')
          res.status(423).json({ status: 'locked', email, until: until.getTime() })
          return
        }
        await prisma.user.update({ where: { id: user.id }, data: { failed_login_attempts: attempts } })
      }
      res.status(401).json({ status: 'invalid_credentials' })
      return
    }

    const frontendRole = toFrontendRole(user.role)
    if (!frontendRole) {
      logger.error({ userId: user.id, role: user.role }, 'user has an unmapped role, refusing login')
      res.status(401).json({ status: 'invalid_credentials' })
      return
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failed_login_attempts: 0, locked_until: null, last_login_at: new Date() },
    })

    const base = { email, role: frontendRole, mustChangePassword: user.must_change_password }

    if (!user.mfa_enabled) {
      // No MFA on this account: issue access + refresh tokens immediately.
      const accessToken = await signAccessToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: frontendRole,
        departmentId: user.department_id,
        mustChangePassword: user.must_change_password,
      })
      const { raw } = await createRefreshSession(user.id, req)
      setRefreshCookie(res, raw)
      res.json({
        status: 'ok',
        ...base,
        requiresMfa: false,
        otpExpiresAt: 0,
        accessToken,
        user: await publicUser(user),
      })
      return
    }

    // MFA path: persist a challenge and "send" the code (console provider).
    const code = randomCode()
    const now = Date.now()
    await otpStore.save({
      userId: user.id,
      email,
      codeHash: sha256(code),
      expiresAt: now + OTP_TTL_MS,
      cooldownUntil: now + RESEND_COOLDOWN_MS,
      attemptsUsed: 0,
    })
    await otpSender.send({ to: email, code, ttlSeconds: env.OTP_TTL_SECONDS })

    const mfaPendingToken = await signMfaToken({ sub: user.id, email: user.email })
    res.json({
      status: 'ok',
      ...base,
      requiresMfa: true,
      otpExpiresAt: now + OTP_TTL_MS,
      mfaPendingToken,
      user: await publicUser(user),
    })
  },
)

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────
authRouter.post(
  '/verify-otp',
  validateBody(
    z.object({
      code: z.string().regex(/^\d{6}$/, 'code must be 6 digits'),
      token: z.string().optional(),
      email: z.email().optional(),
    }),
  ),
  async (req, res) => {
    const { code, token, email } = req.body

    let challenge: OtpChallenge | null = null
    let userId = ''
    let userEmail = ''

    if (token) {
      const claims = await verifyMfaToken(token)
      if (!claims) {
        res.status(410).json({ status: 'expired' })
        return
      }
      userId = claims.sub
      userEmail = claims.email
      challenge = await otpStore.findByEmail(claims.email)
    } else if (email) {
      userEmail = (email as string).trim().toLowerCase()
      challenge = await otpStore.findByEmail(userEmail)
      if (challenge) userId = challenge.userId
    } else {
      res.status(400).json({ status: 'validation_error', error: 'Either token or email is required' })
      return
    }

    if (!challenge) {
      res.status(410).json({ status: 'expired' })
      return
    }

    if (challenge.attemptsUsed >= OTP_MAX_ATTEMPTS) {
      res.status(403).json({ status: 'locked', until: Date.now() + LOCKOUT_MS })
      return
    }
    if (Date.now() > challenge.expiresAt) {
      await otpStore.delete(userEmail)
      res.status(410).json({ status: 'expired' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.status === 'disabled') {
      await otpStore.delete(userEmail)
      res.status(410).json({ status: 'expired' })
      return
    }

    if (sha256(code) !== challenge.codeHash) {
      const attemptsUsed = challenge.attemptsUsed + 1
      if (attemptsUsed >= OTP_MAX_ATTEMPTS) {
        const until = new Date(Date.now() + LOCKOUT_MS)
        await prisma.user.update({
          where: { id: user.id },
          data: { locked_until: until, failed_login_attempts: 0 },
        })
        await otpStore.delete(userEmail)
        logger.warn({ userId: user.id }, 'account locked after OTP failures')
        res.status(403).json({ status: 'locked', until: until.getTime() })
        return
      }
      await otpStore.save({ ...challenge, attemptsUsed })
      res.status(401).json({ status: 'invalid_otp', attemptsRemaining: OTP_MAX_ATTEMPTS - attemptsUsed })
      return
    }

    // Code correct — clear challenge and issue tokens.
    await otpStore.delete(userEmail)
    const frontendRole = toFrontendRole(user.role)
    if (!frontendRole) {
      res.status(401).json({ status: 'invalid_credentials' })
      return
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { failed_login_attempts: 0, locked_until: null, last_login_at: new Date() },
    })
    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: frontendRole,
      departmentId: user.department_id,
      mustChangePassword: user.must_change_password,
    })
    const { raw } = await createRefreshSession(user.id, req)
    setRefreshCookie(res, raw)
    res.json({ status: 'ok', role: frontendRole, accessToken, user: await publicUser(user) })
  },
)

// ── POST /api/auth/resend-otp ─────────────────────────────────────────────
authRouter.post(
  '/resend-otp',
  validateBody(z.object({ token: z.string().optional(), email: z.email().optional() })),
  async (req, res) => {
    let email: string | null = null
    if (req.body.token) {
      const claims = await verifyMfaToken(req.body.token)
      if (!claims) {
        res.status(410).json({ status: 'expired' })
        return
      }
      email = claims.email
    } else if (req.body.email) {
      email = (req.body.email as string).trim().toLowerCase()
    } else {
      res.status(400).json({ status: 'validation_error', error: 'Either token or email is required' })
      return
    }

    const challenge = await otpStore.findByEmail(email)
    if (!challenge) {
      res.status(410).json({ status: 'expired' })
      return
    }

    const now = Date.now()
    if (now < challenge.cooldownUntil) {
      const secondsRemaining = Math.ceil((challenge.cooldownUntil - now) / 1000)
      res.status(429).json({ status: 'cooldown', secondsRemaining })
      return
    }

    const code = randomCode()
    await otpStore.save({
      ...challenge,
      codeHash: sha256(code),
      expiresAt: now + OTP_TTL_MS,
      cooldownUntil: now + RESEND_COOLDOWN_MS,
      attemptsUsed: 0,
    })
    await otpSender.send({ to: email, code, ttlSeconds: env.OTP_TTL_SECONDS })
    res.json({ status: 'ok', expiresAt: now + OTP_TTL_MS })
  },
)

// ── POST /api/auth/refresh ────────────────────────────────────────────────
authRouter.post('/refresh', async (req, res) => {
  const cookies = parseCookies(req)
  const raw = cookies[REFRESH_COOKIE]
  if (!raw) {
    clearRefreshCookie(res)
    res.status(401).json({ status: 'invalid_token', error: 'No refresh token' })
    return
  }

  const session = await prisma.refreshToken.findUnique({ where: { token_hash: sha256(raw) } })
  if (!session || session.revoked_at || session.expires_at.getTime() < Date.now()) {
    clearRefreshCookie(res)
    res.status(401).json({ status: 'invalid_token', error: 'Refresh token invalid or expired' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user_id },
    include: { department: true },
  })
  if (!user || user.status === 'disabled') {
    clearRefreshCookie(res)
    res.status(401).json({ status: 'invalid_token' })
    return
  }

  const frontendRole = toFrontendRole(user.role)
  if (!frontendRole) {
    res.status(401).json({ status: 'invalid_token' })
    return
  }

  // Rotate: revoke the presented token, issue a new one.
  const nextRaw = randomToken(48)
  const nextHash = sha256(nextRaw)
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: session.id },
      data: { revoked_at: new Date(), replaced_by_hash: nextHash },
    }),
    prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: nextHash,
        expires_at: expiresAt,
        user_agent: req.headers['user-agent']?.slice(0, 255) ?? null,
        ip_address: req.ip ?? null,
      },
    }),
  ])
  setRefreshCookie(res, nextRaw)

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: frontendRole,
    departmentId: user.department_id,
    mustChangePassword: user.must_change_password,
  })
  res.json({ status: 'ok', accessToken, role: frontendRole, user: await publicUser(user) })
})

// ── POST /api/auth/logout ─────────────────────────────────────────────────
authRouter.post('/logout', async (req, res) => {
  const cookies = parseCookies(req)
  const raw = cookies[REFRESH_COOKIE]
  if (raw) {
    await prisma.refreshToken.updateMany({
      where: { token_hash: sha256(raw), revoked_at: null },
      data: { revoked_at: new Date() },
    })
  }
  clearRefreshCookie(res)
  res.json({ status: 'ok' })
})

// ── GET /api/auth/me ──────────────────────────────────────────────────────
authRouter.get('/me', requireAuth, async (_req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: res.locals.user.id },
    include: { department: true },
  })
  if (!user) {
    res.status(401).json({ status: 'invalid_token' })
    return
  }
  res.json({ user: await publicUser(user) })
})

// ── POST /api/auth/change-password ────────────────────────────────────────
authRouter.post(
  '/change-password',
  requireAuth,
  validateBody(
    z.object({
      newPassword: z.string().min(1),
      currentPassword: z.string().optional(),
    }),
  ),
  async (req, res) => {
    const { newPassword, currentPassword } = req.body

    if (!meetsPasswordPolicy(newPassword)) {
      res.status(422).json({
        status: 'weak_password',
        error: 'Password does not meet the security policy',
        rules: passwordRules(newPassword),
      })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: res.locals.user.id } })
    if (!user) {
      res.status(401).json({ status: 'invalid_token' })
      return
    }

    if (currentPassword && !(await comparePassword(currentPassword, user.password_hash))) {
      res.status(401).json({ status: 'invalid_credentials', error: 'Current password is incorrect' })
      return
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: await hashPassword(newPassword), must_change_password: false, password_changed_at: new Date() },
    })
    await prisma.auditLog.create({
      data: { action_type: 'auth.password_change', target_type: 'user', target_id: user.id, performed_by: user.id },
    })

    // Re-issue the access token without the mustChangePassword claim so the
    // freshly authenticated client can continue immediately.
    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: toFrontendRole(user.role)!,
      departmentId: user.department_id,
      mustChangePassword: false,
    })
    res.json({ status: 'ok', accessToken })
  },
)

// ── POST /api/auth/forgot-password ────────────────────────────────────────
authRouter.post(
  '/forgot-password',
  validateBody(z.object({ email: z.email() })),
  async (req, res) => {
    const email = (req.body.email as string).trim().toLowerCase()
    const user = await prisma.user.findUnique({ where: { email } })

    // Generic response regardless of whether the account exists — never
    // reveal account existence to unauthenticated callers.
    if (user && user.status === 'active') {
      const raw = randomToken(32)
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)
      await prisma.passwordResetToken.create({
        data: { user_id: user.id, token_hash: sha256(raw), expires_at: expiresAt },
      })
      logger.info({ to: email }, `[reset:console] password reset link: /reset-password?token=${raw}`)
    }
    res.json({ status: 'ok' })
  },
)

// ── POST /api/auth/reset-password ─────────────────────────────────────────
authRouter.post(
  '/reset-password',
  validateBody(z.object({ token: z.string().min(1), newPassword: z.string().min(1) })),
  async (req, res) => {
    const { token, newPassword } = req.body

    if (!meetsPasswordPolicy(newPassword)) {
      res.status(422).json({ status: 'weak_password', error: 'Password does not meet the security policy' })
      return
    }

    const record = await prisma.passwordResetToken.findUnique({ where: { token_hash: sha256(token) } })
    if (!record || record.used_at || record.expires_at.getTime() < Date.now()) {
      res.status(400).json({ status: 'invalid_token', error: 'Reset token is invalid or expired' })
      return
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.user_id },
        data: { password_hash: await hashPassword(newPassword), must_change_password: false, password_changed_at: new Date() },
      }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { used_at: new Date() } }),
    ])
    res.json({ status: 'ok' })
  },
)

// ── GET /api/auth/sessions (admin) ────────────────────────────────────────
authRouter.get('/sessions', requireAuth, requireRole('admin'), async (_req, res) => {
  const sessions = await prisma.refreshToken.findMany({
    where: { revoked_at: null, expires_at: { gt: new Date() } },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { created_at: 'desc' },
    take: 200,
  })
  res.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      user: s.user,
      createdAt: s.created_at,
      expiresAt: s.expires_at,
      ipAddress: s.ip_address,
      userAgent: s.user_agent,
    })),
  })
})

// ── DELETE /api/auth/sessions/:id (owner only) ────────────────────────────
authRouter.delete(
  '/sessions/:id',
  requireAuth,
  requireOwnership(async (req) => {
    const session = await prisma.refreshToken.findUnique({ where: { id: String(req.params.id) } })
    if (!session) return undefined
    return session.user_id
  }),
  async (req, res) => {
    await prisma.refreshToken.update({ where: { id: String(req.params.id) }, data: { revoked_at: new Date() } })
    res.json({ status: 'ok' })
  },
)
