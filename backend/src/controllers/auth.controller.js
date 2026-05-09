import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as otplib from 'otplib';
const { authenticator } = otplib;
import qrcode from 'qrcode';
import { eq, or } from 'drizzle-orm';
import { db } from '../db/postgres.js';
import { users, userActivities } from '../db/drizzle/schema.js';
import config from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as emailService from '../services/email.service.js';

export const register = asyncHandler(async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existingUser.length > 0) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [newUser] = await db
    .insert(users)
    .values({
      username,
      email,
      password_hash: passwordHash,
      role: role || 'user',
      language: req.body.language || 'en'
    })
    .returning();

  const token = jwt.sign(
    { id: newUser.id, username: newUser.username, role: newUser.role },
    config.jwtSecret,
    { expiresIn: '24h' }
  );

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      language: newUser.language,
      token,
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  const identifier = email || username;

  if (!identifier) {
    return res.status(400).json({ error: 'Email or username is required' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, identifier), eq(users.username, identifier)))
    .limit(1);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'Account is deactivated' });
  }

  // CHECK 2FA
  if (user.two_factor_enabled) {
    // If method is email, send code now
    if (user.two_factor_method === 'email') {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await db.update(users)
        .set({ 
          two_factor_email_code: code,
          two_factor_email_expires: expires
        })
        .where(eq(users.id, user.id));

      try {
        await emailService.send2FACode(user.email, code);
      } catch (err) {
        return res.status(500).json({ error: 'Failed to send verification email' });
      }
    }

    const mfaToken = jwt.sign(
      { id: user.id, purpose: 'mfa_verification' },
      config.jwtSecret,
      { expiresIn: '10m' }
    );

    return res.status(200).json({
      success: true,
      requires2FA: true,
      mfaMethod: user.two_factor_method,
      mfaToken,
      message: `Two-factor authentication required via ${user.two_factor_method}`
    });
  }

  // Regular Login
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, security_stamp: user.security_stamp },
    config.jwtSecret,
    { expiresIn: '24h' }
  );

  // Log successful login
  try {
    await db.insert(userActivities).values({
      user_id: user.id,
      action: 'login',
      device_info: req.headers['user-agent'] || 'Unknown Device',
      ip_address: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    });
  } catch (err) {
    console.error('[LOGIN_LOG_ERROR]', err.message);
  }

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      language: user.language,
    },
  });
});

export const setup2FA = asyncHandler(async (req, res) => {
  const { method } = req.body; // 'totp' or 'email'
  const user = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1).then(r => r[0]);
  
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (method === 'email') {
    // Generate and send code for setup verification
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await db.update(users)
      .set({ 
        two_factor_email_code: code,
        two_factor_email_expires: expires
      })
      .where(eq(users.id, user.id));

    try {
      await emailService.send2FACode(user.email, code);
      return res.json({ success: true, message: 'Verification code sent to your email' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to send email. Check your SMTP settings in .env' });
    }
  }

  // Default setup is for TOTP (QR Code)
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, 'SmartPark AI', secret);
  const qrCodeData = await qrcode.toDataURL(otpauth);

  await db.update(users).set({ two_factor_secret: secret }).where(eq(users.id, user.id));

  res.json({
    success: true,
    data: {
      qrCode: qrCodeData,
      secret: secret
    }
  });
});

export const verify2FASetup = asyncHandler(async (req, res) => {
  const { token, method } = req.body; 
  const user = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1).then(r => r[0]);

  if (!user) return res.status(404).json({ error: 'User not found' });

  if (method === 'email') {
    // Verify email code before enabling
    if (user.two_factor_email_code === token && user.two_factor_email_expires > new Date()) {
      await db.update(users)
        .set({ 
          two_factor_enabled: true,
          two_factor_method: 'email',
          two_factor_email_code: null,
          two_factor_email_expires: null
        })
        .where(eq(users.id, user.id));
    } else {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }
  } else {
    // TOTP verification
    if (!user.two_factor_secret) return res.status(400).json({ error: 'TOTP setup not initiated' });
    
    const isValid = authenticator.verify({
      token,
      secret: user.two_factor_secret
    });

    if (!isValid) return res.status(400).json({ error: 'Invalid verification code' });

    await db.update(users)
      .set({ 
        two_factor_enabled: true, 
        two_factor_method: 'totp' 
      })
      .where(eq(users.id, user.id));
  }

  res.json({
    success: true,
    message: `Two-factor authentication enabled via ${method || 'totp'}`
  });
});

export const authenticate2FA = asyncHandler(async (req, res) => {
  const { token, mfaToken } = req.body;

  try {
    const decoded = jwt.verify(mfaToken, config.jwtSecret);
    if (decoded.purpose !== 'mfa_verification') throw new Error('Invalid token');

    const [user] = await db.select().from(users).where(eq(users.id, decoded.id)).limit(1);
    if (!user || !user.two_factor_enabled) {
      return res.status(400).json({ error: '2FA not enabled for this user' });
    }

    let isValid = false;

    if (user.two_factor_method === 'email') {
      // Check email code
      if (user.two_factor_email_code === token && user.two_factor_email_expires > new Date()) {
        isValid = true;
        // Clear code after use
        await db.update(users)
          .set({ two_factor_email_code: null, two_factor_email_expires: null })
          .where(eq(users.id, user.id));
      }
    } else {
      // Check TOTP
      isValid = authenticator.verify({
        token,
        secret: user.two_factor_secret
      });
    }

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired 2FA code' });
    }

    const finalToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, security_stamp: user.security_stamp },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: '2FA Authentication successful',
      data: {
        token: finalToken,
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        language: user.language
      }
    });

  } catch (err) {
    return res.status(401).json({ error: 'MFA session expired or invalid' });
  }
});

export const resend2FACode = asyncHandler(async (req, res) => {
  const { mfaToken } = req.body;

  try {
    const decoded = jwt.verify(mfaToken, config.jwtSecret);
    const [user] = await db.select().from(users).where(eq(users.id, decoded.id)).limit(1);

    if (!user || user.two_factor_method !== 'email') {
      return res.status(400).json({ error: 'Email 2FA not active for this session' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await db.update(users)
      .set({ two_factor_email_code: code, two_factor_email_expires: expires })
      .where(eq(users.id, user.id));

    await emailService.send2FACode(user.email, code);

    res.json({ success: true, message: 'New code sent to your email' });
  } catch (err) {
    res.status(401).json({ error: 'Invalid MFA session' });
  }
});

export const update2FAMethod = asyncHandler(async (req, res) => {
  const { method } = req.body; // 'totp' or 'email'
  
  if (!['totp', 'email'].includes(method)) {
    return res.status(400).json({ error: 'Invalid 2FA method' });
  }

  await db.update(users)
    .set({ two_factor_method: method })
    .where(eq(users.id, req.user.id));

  res.json({ success: true, message: `2FA method updated to ${method}` });
});

export const getProfile = asyncHandler(async (req, res) => {
  const [user] = await db
    .select({ 
      id: users.id, 
      username: users.username, 
      email: users.email, 
      role: users.role,
      full_name: users.full_name,
      two_factor_enabled: users.two_factor_enabled,
      two_factor_method: users.two_factor_method
    })
    .from(users)
    .where(eq(users.id, req.user.id))
    .limit(1);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ success: true, data: user });
});
