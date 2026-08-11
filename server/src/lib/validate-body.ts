import type { Request, RequestHandler, NextFunction, Response } from 'express'
import type { ZodType } from 'zod'

export function validateBody(schema: ZodType): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ status: 'validation_error', error: 'Invalid request body', details: parsed.error.flatten() })
      return
    }
    req.body = parsed.data
    next()
  }
}
