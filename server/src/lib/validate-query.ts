import type { Request, RequestHandler, NextFunction, Response } from 'express'

export function validateIdParam(paramName = 'id'): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const val = String(req.params[paramName] ?? '')
    if (!val || val.length > 100 || /[<>"'`;]/.test(val)) {
      res.status(400).json({ status: 'validation_error', error: `Invalid ${paramName} parameter` })
      return
    }
    next()
  }
}

export function validatePagination(req: Request, _res: Response, next: NextFunction) {
  const q = req.query as Record<string, string | undefined>
  if (q.page) {
    const p = Number.parseInt(q.page, 10)
    if (Number.isNaN(p) || p < 1 || p > 1_000_000) {
      _res.status(400).json({ status: 'validation_error', error: 'Invalid page parameter' })
      return
    }
  }
  if (q.page_size) {
    const ps = Number.parseInt(q.page_size, 10)
    if (Number.isNaN(ps) || ps < 1 || ps > 500) {
      _res.status(400).json({ status: 'validation_error', error: 'Invalid page_size parameter' })
      return
    }
  }
  next()
}

export function rejectUnknownBodyFields(allowedFields: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
      const extra = Object.keys(req.body).filter((k) => !allowedFields.includes(k))
      if (extra.length > 0) {
        res.status(400).json({ status: 'validation_error', error: `Unexpected fields: ${extra.join(', ')}` })
        return
      }
    }
    next()
  }
}
