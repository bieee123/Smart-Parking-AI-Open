import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq, or } from 'drizzle-orm';
import { db } from '../db/postgres.js';
import { users } from '../db/drizzle/schema.js';
import config from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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
      token,
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  // Determine login identifier: accept "email" field OR "username" field
  const identifier = email || username;

  if (!identifier) {
    return res.status(400).json({ error: 'Email or username is required' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  console.log(`[LOGIN] Attempting login for identifier: "${identifier}"`);

  // Query user by email OR username
  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, identifier), eq(users.username, identifier)))
    .limit(1);

  if (!user) {
    console.log(`[LOGIN] User not found for identifier: "${identifier}"`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  console.log(`[LOGIN] User found: id=${user.id}, username="${user.username}", email="${user.email}", role="${user.role}", isActive=${user.is_active}`);

  // Bcrypt comparison
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  console.log(`[LOGIN] Bcrypt comparison result for user "${user.username}": ${isValidPassword}`);

  if (!isValidPassword) {
    console.log(`[LOGIN] Invalid password for user "${user.username}"`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.is_active) {
    console.log(`[LOGIN] Account is deactivated for user "${user.username}"`);
    return res.status(403).json({ error: 'Account is deactivated' });
  }

  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: '24h' }
  );

  console.log(`[LOGIN] Login successful for user "${user.username}", token generated`);

  // Return response in format frontend expects: { success: true, data: { token, id, username, email, role } }
  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
});

export const getProfile = asyncHandler(async (req, res) => {
  const [user] = await db
    .select({ id: users.id, username: users.username, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, req.user.id))
    .limit(1);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ success: true, data: user });
});
