import { SignJWT, jwtVerify } from 'jose'
import { env } from '../config/env.js'
import type { FrontendRole } from './roles.js'

const secret = new TextEncoder().encode(env.JWT_SECRET)

export interface AccessTokenClaims {
  /** user id */
  sub: string
  email: string
  name: string
  role: FrontendRole
  departmentId: string | null
  mustChangePassword: boolean
  typ: 'access'
}

export interface MfaTokenClaims {
  /** user id */
  sub: string
  email: string
  typ: 'mfa_pending'
}

export function signAccessToken(claims: Omit<AccessTokenClaims, 'typ'>): Promise<string> {
  return new SignJWT({ ...claims, typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(secret)
}

export function signMfaToken(payload: { sub: string; email: string }): Promise<string> {
  return new SignJWT({ ...payload, typ: 'mfa_pending' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(env.JWT_MFA_TTL)
    .sign(secret)
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    if (payload.typ !== 'access') return null
    return payload as unknown as AccessTokenClaims
  } catch {
    return null
  }
}

export async function verifyMfaToken(token: string): Promise<MfaTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    if (payload.typ !== 'mfa_pending') return null
    return payload as unknown as MfaTokenClaims
  } catch {
    return null
  }
}
