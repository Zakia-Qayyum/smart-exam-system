/**
 * OTP challenge storage, behind an interface so a Redis/DB-backed store can
 * drop in later. The auth router only ever talks to `OtpStore`, never to the
 * concrete implementation.
 */
export interface OtpChallenge {
  userId: string
  email: string
  codeHash: string
  expiresAt: number
  cooldownUntil: number
  attemptsUsed: number
}

export interface OtpStore {
  save(challenge: OtpChallenge): Promise<void>
  findByEmail(email: string): Promise<OtpChallenge | null>
  delete(email: string): Promise<void>
}

class MemoryOtpStore implements OtpStore {
  private readonly challenges = new Map<string, OtpChallenge>()

  async save(challenge: OtpChallenge): Promise<void> {
    this.challenges.set(challenge.email, challenge)
  }

  async findByEmail(email: string): Promise<OtpChallenge | null> {
    return this.challenges.get(email) ?? null
  }

  async delete(email: string): Promise<void> {
    this.challenges.delete(email)
  }
}

/**
 * Factory. Switch to a Redis-backed store here when one is available — the
 * auth routes do not need to change.
 */
export function createOtpStore(): OtpStore {
  return new MemoryOtpStore()
}
