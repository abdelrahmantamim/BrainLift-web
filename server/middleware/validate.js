import { ZodError } from 'zod';

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * On success the parsed (and potentially transformed) body replaces req.body.
 * On failure a 400 response is returned with structured error details.
 */
export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (e) {
    if (e instanceof ZodError) {
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          details: e.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
      });
    }
    next(e);
  }
};
