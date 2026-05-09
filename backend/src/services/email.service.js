import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { db } from '../db/postgres.js';
import { systemSettings } from '../db/drizzle/schema.js';
import { eq } from 'drizzle-orm';

dotenv.config();

// Helper to get a setting from DB or ENV
const getSetting = async (key, envFallback) => {
  try {
    const setting = await db.select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1)
      .then(r => r[0]);
    
    return setting ? setting.value : envFallback;
  } catch (err) {
    return envFallback;
  }
};

const createTransporter = async () => {
  const host = await getSetting('SMTP_HOST', process.env.SMTP_HOST);
  const port = parseInt(await getSetting('SMTP_PORT', process.env.SMTP_PORT || '587'));
  const user = await getSetting('SMTP_USER', process.env.SMTP_USER);
  const pass = await getSetting('SMTP_PASS', process.env.SMTP_PASS);
  const secure = (await getSetting('SMTP_SECURE', process.env.SMTP_SECURE)) === 'true';

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

export const send2FACode = async (to, code) => {
  const sender = await getSetting('SMTP_FROM', process.env.SMTP_FROM || 'SmartPark <noreply@smartpark.com>');
  
  const mailOptions = {
    from: sender,
    to: to,
    subject: 'Your SmartPark Security Code',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #4f46e5; margin: 0;">SmartPark</h1>
          <p style="color: #64748b; font-size: 14px;">Identity Verification</p>
        </div>
        <p style="color: #1e293b; font-size: 16px;">Hello,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.5;">
          Someone is trying to log into your SmartPark account. If this is you, use the following verification code to complete your login:
        </p>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 2px; color: #4f46e5;">SMART-${code}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          This code will expire in 10 minutes. If you didn't request this, please ignore this email or change your password.
        </p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="color: #cbd5e1; font-size: 10px; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
          &copy; 2026 SmartPark AI System. All rights reserved.
        </p>
      </div>
    `,
  };

  try {
    const transporter = await createTransporter();
    console.log(`[MAIL] Attempting to send email to ${to} using ${sender}...`);

    // Check if we're using placeholder credentials or missing config
    const smtpUser = await getSetting('SMTP_USER', process.env.SMTP_USER);
    const isPlaceholder = smtpUser === 'your-email@gmail.com' || !smtpUser;
    
    if (isPlaceholder && process.env.NODE_ENV === 'development') {
      console.warn('------------------------------------------------------------');
      console.warn('[MAIL_MOCK] SMTP credentials not configured correctly.');
      console.warn(`[MAIL_MOCK] VERIFICATION CODE FOR ${to}: ${code}`);
      console.warn('------------------------------------------------------------');
      return true;
    }

    await transporter.sendMail(mailOptions);
    console.log(`[MAIL] Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('[MAIL_ERROR] Detailed failure:', {
      message: error.message,
      code: error.code,
      command: error.command,
      host: process.env.SMTP_HOST
    });

    // Fallback for development: log the code so the user can still proceed
    if (process.env.NODE_ENV === 'development') {
      console.warn('------------------------------------------------------------');
      console.warn('[MAIL_DEV_FALLBACK] Mail delivery failed but providing code for development:');
      console.warn(`[MAIL_DEV_FALLBACK] VERIFICATION CODE FOR ${to}: ${code}`);
      console.warn('------------------------------------------------------------');
      return true;
    }

    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};
