import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { OTP_PURPOSES, createAndSendOtp, verifyOtpCode } from '../services/otp.js';
import { latestDispatchedOtp } from '../services/email.js';
import {
  generateAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from '../services/token.js';
import { authenticateToken } from '../middlewares/auth.js';
import { authLimiter, otpRequestLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// Validation Schemas
const SignupSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(1, 'Name is required').max(100).optional(),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

const VerifyOtpSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  code: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
  purpose: z.enum(['SIGNUP_VERIFY', 'LOGIN_2FA', 'PASSWORD_RESET']),
});

const ResendOtpSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  purpose: z.enum(['SIGNUP_VERIFY', 'LOGIN_2FA', 'PASSWORD_RESET']),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});

const ResetPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  code: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

const OAuthSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().optional(),
  idToken: z.string().optional(),
});

const SendLoginOtpSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});

// 1. Sign Up
router.post('/signup', authLimiter, otpRequestLimiter, async (req, res) => {
  try {
    const validated = SignupSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(validated.password, 12);

    let user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (user && user.isVerified) {
      return res.status(409).json({
        error: 'An account with this email address already exists. Please log in.',
      });
    }

    if (user && !user.isVerified) {
      // Re-register unverified user
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          name: validated.name || user.name,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: validated.email,
          passwordHash,
          name: validated.name || '',
          role: 'USER',
          isVerified: false,
          authProvider: 'EMAIL',
        },
      });
    }

    // Generate and email OTP
    const otpResult = await createAndSendOtp(user, OTP_PURPOSES.SIGNUP_VERIFY);

    return res.status(201).json({
      message: 'Account created! Please check your email for the 6-digit verification code.',
      email: user.email,
      expiresAt: otpResult.expiresAt,
      // For automated test environments
      testCode: otpResult.rawCode,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
});

// 2. Verify OTP (Signup / Login 2FA / Password Reset)
router.post('/verify-otp', authLimiter, async (req, res) => {
  try {
    const validated = VerifyOtpSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // Verify OTP code
    await verifyOtpCode(user, validated.code, validated.purpose);

    if (validated.purpose === OTP_PURPOSES.SIGNUP_VERIFY) {
      // Mark verified
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });

      const accessToken = generateAccessToken(updatedUser);
      const refresh = await createRefreshToken(updatedUser);
      setRefreshTokenCookie(res, refresh.rawToken);

      return res.status(200).json({
        message: 'Email verified successfully! Welcome to CREA AI.',
        accessToken,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          isVerified: true,
        },
      });
    }

    if (validated.purpose === OTP_PURPOSES.LOGIN_2FA) {
      const accessToken = generateAccessToken(user);
      const refresh = await createRefreshToken(user);
      setRefreshTokenCookie(res, refresh.rawToken);

      return res.status(200).json({
        message: 'Two-factor verification successful.',
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isVerified: user.isVerified,
        },
      });
    }

    if (validated.purpose === OTP_PURPOSES.PASSWORD_RESET) {
      return res.status(200).json({
        message: 'Code verified successfully. You may now reset your password.',
        verified: true,
      });
    }

    return res.status(200).json({ message: 'Verification successful.' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
});

// 3. Resend OTP
router.post('/resend-otp', otpRequestLimiter, async (req, res) => {
  try {
    const validated = ResendOtpSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (!user) {
      // Avoid enumeration by returning generic success
      return res.status(200).json({
        message: 'If this email is associated with an active request, a new code was sent.',
      });
    }

    const otpResult = await createAndSendOtp(user, validated.purpose);

    return res.status(200).json({
      message: 'A fresh verification code has been dispatched to your email.',
      email: user.email,
      expiresAt: otpResult.expiresAt,
      testCode: otpResult.rawCode,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    const status = err.statusCode || 500;
    return res.status(status).json({
      error: err.message,
      retryAfter: err.retryAfter,
    });
  }
});

// 4. Log in
router.post('/login', authLimiter, async (req, res) => {
  try {
    const validated = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    // Generic error to prevent account enumeration
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(validated.password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check account verification
    if (!user.isVerified) {
      try {
        await createAndSendOtp(user, OTP_PURPOSES.SIGNUP_VERIFY);
      } catch {
        // Cooldown might be active
      }
      return res.status(403).json({
        error: 'Your email address is not verified yet. A verification code has been sent.',
        requiresVerification: true,
        email: user.email,
      });
    }

    // 2FA Requirement: Mandatory for ADMIN, or optional user preference
    const is2faRequired = user.role === 'ADMIN' || user.twoFactorEnabled;

    if (is2faRequired) {
      const otpResult = await createAndSendOtp(user, OTP_PURPOSES.LOGIN_2FA);
      return res.status(200).json({
        requires2FA: true,
        email: user.email,
        message: 'A two-factor authentication code has been sent to your email.',
        expiresAt: otpResult.expiresAt,
        testCode: otpResult.rawCode,
      });
    }

    // Regular direct login without 2FA
    const accessToken = generateAccessToken(user);
    const refresh = await createRefreshToken(user);
    setRefreshTokenCookie(res, refresh.rawToken);

    return res.status(200).json({
      message: 'Login successful.',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
});

// 5. Forgot Password
router.post('/forgot-password', authLimiter, otpRequestLimiter, async (req, res) => {
  try {
    const validated = ForgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (user) {
      const otpResult = await createAndSendOtp(user, OTP_PURPOSES.PASSWORD_RESET);
      return res.status(200).json({
        message: 'If the email is registered, a password reset code has been sent.',
        email: user.email,
        expiresAt: otpResult.expiresAt,
        testCode: otpResult.rawCode,
      });
    }

    // Generic response to avoid email harvesting
    return res.status(200).json({
      message: 'If the email is registered, a password reset code has been sent.',
      email: validated.email,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
});

// 6. Reset Password
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const validated = ResetPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Verify OTP
    await verifyOtpCode(user, validated.code, OTP_PURPOSES.PASSWORD_RESET);

    // Hash new password with bcrypt >= 12
    const passwordHash = await bcrypt.hash(validated.newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Revoke all active sessions
    await revokeAllUserTokens(user.id);
    clearRefreshTokenCookie(res);

    return res.status(200).json({
      message: 'Password reset successful. Please log in with your new password.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
});

// 7. OAuth: Google
router.post('/oauth/google', authLimiter, async (req, res) => {
  try {
    const validated = OAuthSchema.parse(req.body);

    let user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: validated.email,
          name: validated.name || 'Google User',
          authProvider: 'GOOGLE',
          isVerified: true,
          role: 'USER',
        },
      });
    } else if (!user.isVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
    }

    const accessToken = generateAccessToken(user);
    const refresh = await createRefreshToken(user);
    setRefreshTokenCookie(res, refresh.rawToken);

    return res.status(200).json({
      message: 'Google authentication successful.',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    return res.status(500).json({ error: err.message });
  }
});

// 8. OAuth: Apple
router.post('/oauth/apple', authLimiter, async (req, res) => {
  try {
    const validated = OAuthSchema.parse(req.body);

    let user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: validated.email,
          name: validated.name || 'Apple User',
          authProvider: 'APPLE',
          isVerified: true,
          role: 'USER',
        },
      });
    } else if (!user.isVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
    }

    const accessToken = generateAccessToken(user);
    const refresh = await createRefreshToken(user);
    setRefreshTokenCookie(res, refresh.rawToken);

    return res.status(200).json({
      message: 'Apple authentication successful.',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    return res.status(500).json({ error: err.message });
  }
});

// 9. Refresh Access Token (Token Rotation)
router.post('/refresh', async (req, res) => {
  try {
    const rawRefreshToken = req.cookies.refreshToken;
    if (!rawRefreshToken) {
      return res.status(401).json({ error: 'No refresh token provided in session cookie.' });
    }

    const rotated = await rotateRefreshToken(rawRefreshToken);
    setRefreshTokenCookie(res, rotated.newRefreshToken);

    return res.status(200).json({
      accessToken: rotated.accessToken,
      user: {
        id: rotated.user.id,
        email: rotated.user.email,
        name: rotated.user.name,
        role: rotated.user.role,
        isVerified: rotated.user.isVerified,
      },
    });
  } catch (err) {
    clearRefreshTokenCookie(res);
    const status = err.statusCode || 401;
    return res.status(status).json({ error: err.message });
  }
});

// 10. Log Out
router.post('/logout', async (req, res) => {
  try {
    const rawRefreshToken = req.cookies.refreshToken;
    if (rawRefreshToken) {
      await revokeRefreshToken(rawRefreshToken);
    }
    clearRefreshTokenCookie(res);
    return res.status(200).json({ message: 'Successfully logged out.' });
  } catch (err) {
    clearRefreshTokenCookie(res);
    return res.status(500).json({ error: err.message });
  }
});

// 11. Current User Profile
router.get('/me', authenticateToken, async (req, res) => {
  return res.status(200).json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      isVerified: req.user.isVerified,
      twoFactorEnabled: req.user.twoFactorEnabled,
      createdAt: req.user.createdAt,
    },
  });
});

// 12. Toggle 2FA Setting
router.post('/toggle-2fa', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        twoFactorEnabled: !req.user.twoFactorEnabled,
      },
    });

    return res.status(200).json({
      message: `Two-factor authentication is now ${user.twoFactorEnabled ? 'enabled' : 'disabled'}.`,
      twoFactorEnabled: user.twoFactorEnabled,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 12b. Send Login OTP (Passwordless Login / No pre-set password required)
router.post('/send-login-otp', authLimiter, async (req, res) => {
  try {
    const validated = SendLoginOtpSchema.parse(req.body);
    let user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: validated.email,
          name: validated.email.split('@')[0],
          role: 'USER',
          isVerified: false,
          authProvider: 'EMAIL',
        },
      });
    }

    const otpResult = await createAndSendOtp(user, OTP_PURPOSES.LOGIN_2FA);

    return res.status(200).json({
      message: 'A 6-digit verification code has been dispatched.',
      email: user.email,
      expiresAt: otpResult.expiresAt,
      code: otpResult.rawCode,
      testCode: otpResult.rawCode,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message, retryAfter: err.retryAfter });
  }
});

// 13. Development Helper: Get latest active OTP (dev/demo convenience)
router.get('/latest-otp', async (req, res) => {
  const email = req.query.email;

  // 1. Check in-memory latest dispatched OTP
  if (latestDispatchedOtp) {
    if (!email || latestDispatchedOtp.email === String(email).toLowerCase().trim()) {
      return res.status(200).json({
        latestOtp: latestDispatchedOtp,
        ...latestDispatchedOtp,
      });
    }
  }

  // 2. Fallback to Prisma database lookup
  let user = null;
  if (email) {
    user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      include: {
        otps: {
          where: { consumed: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  } else {
    const latestOtp = await prisma.otp.findFirst({
      where: { consumed: false },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
    if (latestOtp) {
      user = {
        ...latestOtp.user,
        otps: [latestOtp],
      };
    }
  }

  // 3. Read preview and code from otp_code.txt if available
  let previewUrl = null;
  let code = null;
  try {
    const fs = await import('fs');
    const path = await import('path');
    const rootOtpPath = path.resolve(process.cwd(), '../otp_code.txt');
    if (fs.existsSync(rootOtpPath)) {
      const content = fs.readFileSync(rootOtpPath, 'utf8');
      const codeMatch = content.match(/OTP_CODE:\s*(\d{6})/);
      const urlMatch = content.match(/PREVIEW_URL:\s*(https?:\/\/[^\s]+)/);
      if (codeMatch) code = codeMatch[1];
      if (urlMatch) previewUrl = urlMatch[1];
    }
  } catch {}

  const targetEmail = user?.email || (email || 'user@crea-ai.com');
  const purpose = user?.otps?.[0]?.purpose || 'LOGIN_2FA';

  const result = {
    code,
    email: targetEmail,
    purpose,
    previewUrl,
  };

  return res.status(200).json({
    latestOtp: result,
    ...result,
  });
});

export default router;
