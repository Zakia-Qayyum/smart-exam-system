import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
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

class EmailOtpSender implements OtpSender {
  private readonly transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  })

  async send({ to, code, ttlSeconds }: OtpMessage): Promise<void> {
    const recipient = env.SMTP_OVERRIDE_TO || to
    await this.transport.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to: recipient,
      subject: `Your verification code: ${code}`,
      text: `Your verification code is ${code}. It expires in ${ttlSeconds} seconds.`,
      html: `<p>Your verification code is <strong>${code}</strong>. It expires in ${ttlSeconds} seconds.</p>`,
    })
    logger.info({ to: recipient, originalTo: to }, '[otp:email] verification code sent')
  }
}

export function createOtpSender(): OtpSender {
  if (env.OTP_SENDER === 'email') {
    if (!env.SMTP_HOST) {
      logger.warn('[otp] OTP_SENDER=email but SMTP_HOST is empty — falling back to console')
      return new ConsoleOtpSender()
    }
    return new EmailOtpSender()
  }
  return new ConsoleOtpSender()
}
