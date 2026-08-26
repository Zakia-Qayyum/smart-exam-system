import { Resend } from 'resend'
import { env } from '../config/env.js'
import { logger } from './logger.js'

export interface OtpMessage {
  to: string
  code: string
  ttlSeconds: number
}

export interface OtpSender {
  send(message: OtpMessage): Promise<void>
}

class ConsoleOtpSender implements OtpSender {
  async send({ to, code, ttlSeconds }: OtpMessage): Promise<void> {
    logger.info(
      { to, ttlSeconds },
      `[otp:console] verification code for ${to}: ${code}`,
    )
  }
}

class EmailOtpSender implements OtpSender {
  private readonly resend = new Resend(env.RESEND_API_KEY)

  async send({ to, code, ttlSeconds }: OtpMessage): Promise<void> {
    const recipient = env.SMTP_OVERRIDE_TO || to

    const { error } = await this.resend.emails.send({
      from: env.SMTP_FROM || 'onboarding@resend.dev',
      to: recipient,
      subject: `Your verification code: ${code}`,
      text: `Your verification code is ${code}. It expires in ${ttlSeconds} seconds.`,
      html: `<p>Your verification code is <strong>${code}</strong>. It expires in ${ttlSeconds} seconds.</p>`,
    })

    if (error) {
      logger.error({ error, to: recipient }, '[otp:email] failed to send')
      throw new Error(`Failed to send OTP email: ${error.message}`)
    }

    logger.info(
      { to: recipient, originalTo: to },
      '[otp:email] verification code sent',
    )
  }
}

export function createOtpSender(): OtpSender {
  if (env.OTP_SENDER === 'email') {
    if (!env.RESEND_API_KEY) {
      logger.warn(
        '[otp] OTP_SENDER=email but RESEND_API_KEY is empty — falling back to console',
      )
      return new ConsoleOtpSender()
    }

    return new EmailOtpSender()
  }

  return new ConsoleOtpSender()
}