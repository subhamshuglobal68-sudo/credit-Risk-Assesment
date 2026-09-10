import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});

export const otpRequestLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Max 10 OTP requests per 5 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many OTP requests from this IP. Please wait a few minutes before trying again.',
  },
});
