# CREA AI &mdash; Production Authentication System

A production-ready authentication and authorization system for **CREA AI** featuring User and Admin roles, email-based OTP verification, JWT access/refresh token rotation, bcrypt password hashing, and role-based route guards.

---

## 1. Features

- **Dual User Roles**: `USER` (Regular user) and `ADMIN` (Administrator with user management access).
- **Mandatory Admin 2FA**: Admin sign-ins always require email-based OTP verification before access tokens are granted.
- **Email-based OTP Verification**:
  - Purpose segregation: `SIGNUP_VERIFY`, `LOGIN_2FA`, and `PASSWORD_RESET`.
  - Cryptographically random 6-digit codes.
  - Salted bcrypt hashing in database (never stored in plain text).
  - 10-minute expiry with 5-attempt brute-force lockout.
  - 60-second cooldown rate limit.
- **Enterprise JWT Architecture**:
  - Access Token: short-lived (15 minutes), kept in-memory only (React state).
  - Refresh Token: long-lived (7 days), hashed in database, transmitted only in secure `httpOnly` SameSite cookies.
  - Automatic token rotation on refresh.
- **Database & Prisma ORM**:
  - PostgreSQL datasource (`schema.prisma`) for production.
  - Zero-config development SQLite schema (`schema.sqlite.prisma`) included for offline development/testing.
- **Nodemailer Delivery**:
  - SMTP / SendGrid / AWS SES support.
  - Automatic Ethereal email preview links generated when SMTP credentials are blank in development.

---

## 2. Environment Variables

Create `.env` inside `server/` (see `.env.example`):

```bash
PORT=5002
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# PostgreSQL connection string:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crea_ai?schema=public"
# Or SQLite for local development:
# DATABASE_URL="file:./dev.db"

JWT_ACCESS_SECRET="your_long_random_access_secret_key"
JWT_REFRESH_SECRET="your_long_random_refresh_secret_key"
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# SMTP Settings (optional in dev; uses Ethereal test inbox if blank):
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM="CREA AI Security <security@crea-ai.internal>"
```

---

## 3. Setup and Run

### Step 1: Install Dependencies
```bash
cd server
npm install
```

### Step 2: Database Setup & Migration

For PostgreSQL:
```bash
npx prisma db push --schema=prisma/schema.prisma
```

For zero-config SQLite local testing:
```bash
npx prisma db push --schema=prisma/schema.sqlite.prisma
```

### Step 3: Seed Default Admin and User
```bash
node src/seed.js
```
Pre-seeded accounts:
- **Admin**: `admin@crea-ai.com` | `Admin@CreaAI2026!` (Mandatory 2FA OTP)
- **User**: `user@crea-ai.com` | `User@CreaAI2026!`

### Step 4: Run Server
```bash
# Start server (port 5002):
npm start
# Or development mode with file watching:
npm run dev
```

### Step 5: Run Automated Tests
```bash
npm test
```
All 14 integration tests will execute against live database queries and OTP flows.

---

## 4. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Register new user, hashes password, emails 6-digit OTP |
| `POST` | `/api/auth/verify-otp` | Validates OTP for signup, 2FA, or password reset |
| `POST` | `/api/auth/resend-otp` | Resend OTP code (60-second cooldown rate limited) |
| `POST` | `/api/auth/login` | Validates credentials; returns 2FA prompt for Admin / 2FA users |
| `POST` | `/api/auth/forgot-password` | Dispatches password reset OTP |
| `POST` | `/api/auth/reset-password` | Verifies reset OTP, updates password, revokes sessions |
| `POST` | `/api/auth/oauth/google` | Verifies Google profile, auto-creates verified user |
| `POST` | `/api/auth/oauth/apple` | Verifies Apple profile, auto-creates verified user |
| `POST` | `/api/auth/refresh` | Rotates refresh token from httpOnly cookie -> fresh access token |
| `POST` | `/api/auth/logout` | Revokes refresh token in database, clears cookie |
| `GET` | `/api/auth/me` | Returns profile of current authenticated user |
| `POST` | `/api/auth/toggle-2fa` | Toggles optional 2FA for regular users |
| `GET` | `/api/admin/users` | (Admin Only) Returns user directory and metric counts |
| `POST` | `/api/admin/create-admin` | (Admin Only) Provisions a new Administrator account |
| `GET` | `/health` | Healthcheck endpoint |
