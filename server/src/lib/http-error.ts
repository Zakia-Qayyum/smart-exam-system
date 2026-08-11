/**
 * HTTP-aware domain error. Services throw these for expected failures
 * (missing resources, capacity violations, blocking clashes) and the app's
 * error middleware maps them onto structured JSON responses with the proper
 * status code. Anything else falls through to a generic 500.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}
