import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'

export interface PasswordRule {
  label: string
  met: boolean
}

/**
 * Mirrors the password policy the frontend enforces on the auth screens
 * (see frontend/src/lib/validators.ts). Keep the two in sync.
 */
export function passwordRules(password: string): PasswordRule[] {
  return [
    { label: `At least ${env.PASSWORD_MIN_LENGTH} characters`, met: password.length >= env.PASSWORD_MIN_LENGTH },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One digit', met: /\d/.test(password) },
    { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
  ]
}

export function meetsPasswordPolicy(password: string): boolean {
  return passwordRules(password).every((rule) => rule.met)
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10)

export const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash)
