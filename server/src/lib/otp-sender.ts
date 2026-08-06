import { logger } from './logger.js'

export interface OtpMessage {
  to: string
  code: string
  ttlSeconds: number
}

/**
 * Delivery of verification codes. The current implementation logs to the
 * server console (development/demo). A real email or SMS provider can be
 * swapped in behind this interface without touching auth logic.
 */
export interface OtpSender {
  send(message: OtpMessage): Promise<void>
}

class ConsoleOtpSender implements OtpSender {
  async send({ to, code, ttlSeconds }: OtpMessage): Promise<void> {
    logger.info({ to, ttlSeconds }, `[otp:console] verification code for ${to}: ${code}`)
  }
}

export function createOtpSender(): OtpSender {
  return new ConsoleOtpSender()
}
