import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { sendOtpEmail } from './email.js';

export const OTP_PURPOSES = {
  SIGNUP_VERIFY: 'SIGNUP_VERIFY',
  LOGIN_2FA: 'LOGIN_2FA',
  PASSWORD_RESET: 'PASSWORD_RESET',
};

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_SECONDS = 60;

export function generateCryptoOtp() {
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

/**
 * Creates and dispatches an OTP for a user and purpose.
 * Enforces a 60-second cooldown rate limit.
 */
export async function createAndSendOtp(user, purpose) {
  const now = new Date();

  // 1. Check rate limit (max 1 OTP request per 60 seconds)
  const recentOtp = await prisma.otp.findFirst({
    where: {
      userId: user.id,
      purpose,
      createdAt: {
        gte: new Date(now.getTime() - RATE_LIMIT_SECONDS * 1000),
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (recentOtp) {
    const elapsedSeconds = Math.floor((now.getTime() - new Date(recentOtp.createdAt).getTime()) / 1000);
    const retryAfter = Math.max(1, RATE_LIMIT_SECONDS - elapsedSeconds);
    const error = new Error(`Please wait ${retryAfter} seconds before requesting a new verification code.`);
    error.statusCode = 429;
    error.retryAfter = retryAfter;
    throw error;
  }

  // 2. Mark any previously unconsumed OTPs for this user & purpose as consumed/invalidated
  await prisma.otp.updateMany({
    where: {
      userId: user.id,
      purpose,
      consumed: false,
    },
    data: {
      consumed: true,
    },
  });

  // 3. Generate 6-digit cryptographically secure OTP
  const rawCode = generateCryptoOtp();
  const codeHash = await bcrypt.hash(rawCode, 10);
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // 4. Store in database
  const createdOtp = await prisma.otp.create({
    data: {
      userId: user.id,
      codeHash,
      purpose,
      expiresAt,
      attempts: 0,
      consumed: false,
    },
  });

  // 5. Send email asynchronously
  await sendOtpEmail({
    email: user.email,
    code: rawCode,
    purpose,
  });

  return {
    otpId: createdOtp.id,
    expiresAt,
    email: user.email,
    rawCode: (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') ? rawCode : undefined,
  };
}

/**
 * Validates an OTP code for a user and purpose.
 * Handles expiry, consumption, attempt increments, and lockout after 5 failures.
 */
export async function verifyOtpCode(user, code, purpose) {
  const now = new Date();

  // Find the latest active OTP for this user and purpose
  const otpRecord = await prisma.otp.findFirst({
    where: {
      userId: user.id,
      purpose,
      consumed: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) {
    const error = new Error('No active verification code found. Please request a new one.');
    error.statusCode = 400;
    throw error;
  }

  // Check attempt lockout
  if (otpRecord.attempts >= MAX_ATTEMPTS) {
    // Consume this locked OTP so it can't be retried
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { consumed: true },
    });
    const error = new Error('Too many invalid attempts. This verification code has been locked. Please request a new code.');
    error.statusCode = 429;
    throw error;
  }

  // Check expiry
  if (new Date(otpRecord.expiresAt) < now) {
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { consumed: true },
    });
    const error = new Error('Verification code has expired. Please request a new code.');
    error.statusCode = 400;
    throw error;
  }

  // Compare code hash
  const isValid = await bcrypt.compare(code, otpRecord.codeHash);

  if (!isValid) {
    const updatedAttempts = otpRecord.attempts + 1;
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { attempts: updatedAttempts },
    });

    const remaining = MAX_ATTEMPTS - updatedAttempts;
    let message = 'Invalid verification code.';
    if (remaining > 0) {
      message += ` You have ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`;
    } else {
      message = 'Too many invalid attempts. This code is now locked. Please request a new one.';
    }

    const error = new Error(message);
    error.statusCode = remaining > 0 ? 400 : 429;
    throw error;
  }

  // Code is valid! Mark consumed
  await prisma.otp.update({
    where: { id: otpRecord.id },
    data: { consumed: true },
  });

  return { success: true };
}
