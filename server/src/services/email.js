import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (config.smtp.host && config.smtp.user) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  } else {
    // Development fallback using Ethereal test account or local mock
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[Email] Initialized test Ethereal transporter: ${testAccount.user}`);
    } catch {
      // Stream transport if network is unreachable
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      console.log('[Email] Fallback to JSON console stream transport');
    }
  }
  return transporter;
}

const PURPOSE_LABELS = {
  SIGNUP_VERIFY: {
    title: 'Verify Your Email Address',
    action: 'completing your CREA AI registration',
  },
  LOGIN_2FA: {
    title: 'Two-Factor Authentication Code',
    action: 'signing in to your CREA AI account',
  },
  PASSWORD_RESET: {
    title: 'Password Reset Request',
    action: 'resetting your CREA AI password',
  },
};

export function buildOtpEmailHtml({ code, purpose, email }) {
  const details = PURPOSE_LABELS[purpose] || {
    title: 'Security Verification Code',
    action: 'authorizing an action on your account',
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your CREA AI Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0efeb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1d1d1d;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0efeb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="540" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e0e0e0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          <!-- Brand Accent Strip -->
          <tr>
            <td style="height: 6px; background-color: #ffe01b;"></td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding: 36px 40px 16px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family: Georgia, serif; font-size: 24px; font-weight: bold; color: #007c89; letter-spacing: -0.5px;">CREA AI</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 10px 40px 30px 40px;">
              <h1 style="font-family: Georgia, serif; font-size: 26px; color: #1d1d1d; margin: 0 0 16px 0; line-height: 1.25;">
                ${details.title}
              </h1>
              <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 24px 0;">
                You requested a verification code for <strong>${details.action}</strong> for <span style="color: #007c89;">${email}</span>. Use the single-use 6-digit code below to continue:
              </p>
              
              <!-- Code Card -->
              <div style="background-color: #f9f9f8; border: 1.5px dashed #007c89; border-radius: 8px; padding: 20px; text-align: center; margin: 28px 0;">
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: bold; letter-spacing: 8px; color: #007c89;">
                  ${code}
                </div>
                <div style="font-size: 13px; color: #767676; margin-top: 8px;">
                  ⏱ Valid for 10 minutes &bull; Single-use only
                </div>
              </div>

              <p style="font-size: 14px; color: #666666; line-height: 1.5; margin: 0 0 16px 0;">
                <strong>Security Notice:</strong> CREA AI staff will never ask you for this verification code. If you did not make this request, you can safely ignore this email — your account remains secure.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #faf9f6; border-top: 1px solid #eeeeee; font-size: 12px; color: #888888; text-align: center;">
              &copy; ${new Date().getFullYear()} CREA AI &mdash; Credit Risk Intelligence Platform. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export let latestDispatchedOtp = null;

export async function sendOtpEmail({ email, code, purpose }) {
  latestDispatchedOtp = {
    email,
    code,
    purpose,
    sentAt: new Date().toISOString(),
    previewUrl: null,
  };

  // Immediate write to otp_code.txt so code is available instantly
  try {
    const fs = await import('fs');
    const path = await import('path');
    const rootOtpPath = path.resolve(process.cwd(), '../otp_code.txt');
    fs.writeFileSync(
      rootOtpPath,
      `EMAIL: ${email}\nOTP_CODE: ${code}\nPURPOSE: ${purpose}\nSENT_AT: ${new Date().toISOString()}\nPREVIEW_URL: Live On-Screen\n`
    );
  } catch (e) {
    console.error('[Email] Failed to write otp_code.txt:', e);
  }

  const mailTransporter = await getTransporter();
  const html = buildOtpEmailHtml({ code, purpose, email });

  const mailOptions = {
    from: config.smtp.from,
    to: email,
    subject: 'Your CREA AI verification code',
    text: `Your CREA AI verification code is: ${code}. This code is valid for 10 minutes. If you did not request this, please ignore this email.`,
    html,
  };

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    if (previewUrl) {
      latestDispatchedOtp.previewUrl = previewUrl;
      try {
        const fs = await import('fs');
        const path = await import('path');
        const rootOtpPath = path.resolve(process.cwd(), '../otp_code.txt');
        fs.writeFileSync(
          rootOtpPath,
          `EMAIL: ${email}\nOTP_CODE: ${code}\nPURPOSE: ${purpose}\nSENT_AT: ${new Date().toISOString()}\nPREVIEW_URL: ${previewUrl}\n`
        );
      } catch (e) {}
    }

    console.log(`\n==================================================`);
    console.log(`[EMAIL DISPATCH] To: ${email} | Purpose: ${purpose}`);
    console.log(`[EMAIL DISPATCH] Code: ${code} (Expires in 10m)`);
    if (previewUrl) {
      console.log(`[EMAIL PREVIEW] Ethereal URL: ${previewUrl}`);
    }
    console.log(`==================================================\n`);

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (err) {
    console.error(`[Email Error] Failed to send email to ${email}:`, err);
    return { success: false, error: err.message };
  }
}
