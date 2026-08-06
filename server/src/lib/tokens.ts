import { createHash, randomBytes } from 'node:crypto'

export function randomToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
