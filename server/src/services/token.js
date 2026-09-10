import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { prisma } from '../db.js';

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateAccessToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
  };

  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
}

export async function createRefreshToken(user) {
  // Generate random token string
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      revoked: false,
    },
  });

  return { rawToken, expiresAt };
}

export async function rotateRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);

  const existingToken = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existingToken) {
    const error = new Error('Invalid refresh token.');
    error.statusCode = 401;
    throw error;
  }

  if (existingToken.revoked) {
    // Possible token reuse attack! Revoke all tokens for this user
    await prisma.refreshToken.updateMany({
      where: { userId: existingToken.userId },
      data: { revoked: true },
    });
    const error = new Error('Compromised refresh token. All active sessions have been terminated.');
    error.statusCode = 401;
    throw error;
  }

  if (new Date(existingToken.expiresAt) < new Date()) {
    await prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { revoked: true },
    });
    const error = new Error('Refresh token has expired. Please log in again.');
    error.statusCode = 401;
    throw error;
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: existingToken.id },
    data: { revoked: true },
  });

  // Issue fresh refresh token & access token
  const newRefresh = await createRefreshToken(existingToken.user);
  const newAccessToken = generateAccessToken(existingToken.user);

  return {
    accessToken: newAccessToken,
    newRefreshToken: newRefresh.rawToken,
    user: existingToken.user,
  };
}

export async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revoked: true },
  });
}

export async function revokeAllUserTokens(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revoked: true },
  });
}

export function setRefreshTokenCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshTokenCookie(res) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
}
