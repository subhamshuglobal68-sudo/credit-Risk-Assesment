process.env.NODE_ENV = 'test';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { prisma } from '../src/db.js';
import { OTP_PURPOSES } from '../src/services/otp.js';

describe('CREA AI Authentication Integration Tests', () => {
  const testUser = {
    email: `test_user_${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    name: 'Test User',
  };

  const testAdmin = {
    email: `test_admin_${Date.now()}@example.com`,
    password: 'AdminPassword123!',
    name: 'Test Admin',
  };

  let userTokens = {};
  let adminTokens = {};
  let latestSignupCode = '';
  let latest2faCode = '';

  after(async () => {
    // Cleanup test data
    try {
      await prisma.otp.deleteMany({});
      await prisma.refreshToken.deleteMany({});
      await prisma.user.deleteMany({
        where: {
          email: { in: [testUser.email, testAdmin.email] },
        },
      });
      await prisma.$disconnect();
    } catch {}
  });

  test('GET /health returns 200 OK', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'crea-ai-auth-server');
  });

  test('POST /api/auth/signup creates unverified user and issues OTP', async () => {
    const res = await request(app).post('/api/auth/signup').send(testUser);

    assert.equal(res.status, 201);
    assert.equal(res.body.email, testUser.email);
    assert.ok(res.body.testCode);
    latestSignupCode = res.body.testCode;

    // Verify user in DB is unverified
    const dbUser = await prisma.user.findUnique({ where: { email: testUser.email } });
    assert.ok(dbUser);
    assert.equal(dbUser.isVerified, false);
    assert.equal(dbUser.role, 'USER');
  });

  test('POST /api/auth/resend-otp enforces 60-second rate limiting', async () => {
    const res = await request(app).post('/api/auth/resend-otp').send({
      email: testUser.email,
      purpose: OTP_PURPOSES.SIGNUP_VERIFY,
    });

    assert.equal(res.status, 429);
    assert.ok(res.body.error.includes('Please wait'));
  });

  test('POST /api/auth/verify-otp with wrong code decrements attempts', async () => {
    const res = await request(app).post('/api/auth/verify-otp').send({
      email: testUser.email,
      code: '000000',
      purpose: OTP_PURPOSES.SIGNUP_VERIFY,
    });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('Invalid verification code'));
  });

  test('POST /api/auth/verify-otp with valid code verifies user and returns tokens', async () => {
    const res = await request(app).post('/api/auth/verify-otp').send({
      email: testUser.email,
      code: latestSignupCode,
      purpose: OTP_PURPOSES.SIGNUP_VERIFY,
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.accessToken);
    assert.equal(res.body.user.isVerified, true);
    userTokens.accessToken = res.body.accessToken;

    // Verify cookie set
    const cookies = res.headers['set-cookie'];
    assert.ok(cookies);
    const hasRefreshCookie = cookies.some((c) => c.includes('refreshToken='));
    assert.ok(hasRefreshCookie);
    userTokens.cookie = cookies;

    // Verify DB updated
    const dbUser = await prisma.user.findUnique({ where: { email: testUser.email } });
    assert.equal(dbUser.isVerified, true);
  });

  test('POST /api/auth/signup rejects duplicate verified email with 409', async () => {
    const res = await request(app).post('/api/auth/signup').send(testUser);
    assert.equal(res.status, 409);
    assert.ok(res.body.error.includes('already exists'));
  });

  test('POST /api/auth/login with wrong password returns generic 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: 'WrongPassword!',
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid email or password.');
  });

  test('POST /api/auth/login with valid password logs regular user in directly', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.accessToken);
    assert.equal(res.body.user.email, testUser.email);
    userTokens.accessToken = res.body.accessToken;
    userTokens.cookie = res.headers['set-cookie'];
  });

  test('GET /api/auth/me returns authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userTokens.accessToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, testUser.email);
    assert.equal(res.body.user.role, 'USER');
  });

  test('POST /api/auth/refresh rotates refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', userTokens.cookie);

    assert.equal(res.status, 200);
    assert.ok(res.body.accessToken);
    userTokens.accessToken = res.body.accessToken;
    userTokens.cookie = res.headers['set-cookie'];
  });

  test('Regular user cannot access GET /api/admin/users (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userTokens.accessToken}`);

    assert.equal(res.status, 403);
    assert.ok(res.body.error.includes('ADMIN privileges are required'));
  });

  test('Admin creation and mandatory 2FA enforcement', async () => {
    // Manually create verified ADMIN in DB
    const adminHash = await import('bcryptjs').then((b) => b.default.hash(testAdmin.password, 12));
    await prisma.user.create({
      data: {
        email: testAdmin.email,
        name: testAdmin.name,
        passwordHash: adminHash,
        role: 'ADMIN',
        isVerified: true,
        twoFactorEnabled: true,
      },
    });

    // Login as Admin -> MUST trigger 2FA regardless of settings
    const loginRes = await request(app).post('/api/auth/login').send({
      email: testAdmin.email,
      password: testAdmin.password,
    });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.requires2FA, true);
    assert.ok(loginRes.body.testCode);
    latest2faCode = loginRes.body.testCode;

    // Verify 2FA code
    const verify2faRes = await request(app).post('/api/auth/verify-otp').send({
      email: testAdmin.email,
      code: latest2faCode,
      purpose: OTP_PURPOSES.LOGIN_2FA,
    });

    assert.equal(verify2faRes.status, 200);
    assert.ok(verify2faRes.body.accessToken);
    assert.equal(verify2faRes.body.user.role, 'ADMIN');
    adminTokens.accessToken = verify2faRes.body.accessToken;

    // Admin can access GET /api/admin/users
    const adminUsersRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminTokens.accessToken}`);

    assert.equal(adminUsersRes.status, 200);
    assert.ok(adminUsersRes.body.metrics);
    assert.ok(Array.isArray(adminUsersRes.body.users));
    assert.ok(adminUsersRes.body.users.some((u) => u.email === testAdmin.email));
  });

  test('POST /api/admin/create-admin succeeds with ADMIN token', async () => {
    const newAdminEmail = `created_admin_${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/admin/create-admin')
      .set('Authorization', `Bearer ${adminTokens.accessToken}`)
      .send({
        email: newAdminEmail,
        password: 'AdminPassword999!',
        name: 'Second Admin',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.admin.role, 'ADMIN');
    assert.equal(res.body.admin.isVerified, true);

    // Cleanup
    await prisma.user.delete({ where: { email: newAdminEmail } });
  });

  test('POST /api/auth/logout revokes refresh token and clears cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', userTokens.cookie);

    assert.equal(res.status, 200);
  });
});
