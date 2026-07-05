const { ZodError } = require('zod')

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      // ponytail: location FormData wraps payload in req.body.data
      if (source === 'body' && typeof req.body?.data === 'string') {
        try {
          const unwrapped = JSON.parse(req.body.data)
          req.body = { ...req.body, ...unwrapped }
          delete req.body.data
        } catch {
          return res.status(400).json({
            success: false,
            message: 'Invalid JSON in body.data'
          })
        }
      }
      const parsed = schema.parse(req[source])
      req[source] = parsed
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }))
        return res.status(400).json({
          success: false,
          message: messages.map((m) => `${m.field}: ${m.message}`).join('; '),
          errors: messages
        })
      }
      next(error)
    }
  }
}

module.exports = { validate }
