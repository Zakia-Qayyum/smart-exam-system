export interface PasswordRule {
  label: string
  met: boolean
}

export function passwordRules(password: string): PasswordRule[] {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One digit', met: /\d/.test(password) },
    { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
  ]
}

export function passwordMeetsPolicy(password: string) {
  return passwordRules(password).every((r) => r.met)
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
