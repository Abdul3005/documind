import rateLimit from 'express-rate-limit';

/**
 * Authentication Rate Limiter
 * Restricts auth attempts (register, login) to 10 requests per 15 minutes per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Document Upload Rate Limiter
 * Restricts document uploads to 10 requests per 15 minutes per IP.
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 upload requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Upload limit reached. Maximum 10 document uploads per 15 minutes per IP.',
  },
  skip: () => process.env.NODE_ENV === 'test',
});
