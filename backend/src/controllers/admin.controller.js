import { eq, ne } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '../db/postgres.js';
import { users } from '../db/drizzle/schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Get all users (Admin only)
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const allUsers = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      full_name: users.full_name,
      job_title: users.job_title,
      is_active: users.is_active,
      created_at: users.created_at,
    })
    .from(users)
    .orderBy(users.created_at);

  res.json({ success: true, data: allUsers });
});

/**
 * Create a new user (Admin only)
 */
export const createUser = asyncHandler(async (req, res) => {
  const { username, email, password, role, full_name } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: 'Username, email, and password are required' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [newUser] = await db
    .insert(users)
    .values({
      username,
      email,
      password_hash: passwordHash,
      role: role || 'user',
      full_name,
      is_active: true,
    })
    .returning();

  res.status(201).json({ success: true, data: newUser });
});

/**
 * Update user (Admin only)
 */
export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, is_active, full_name, job_title, email, password } = req.body;

  const updateData = {
    role,
    is_active,
    full_name,
    job_title,
    email,
    updated_at: new Date(),
  };

  if (password && password.trim() !== '') {
    updateData.password_hash = await bcrypt.hash(password, 10);
  }

  const [updatedUser] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      full_name: users.full_name,
      job_title: users.job_title,
      is_active: users.is_active,
    });

  if (!updatedUser) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  res.json({ success: true, data: updatedUser });
});

/**
 * Delete user (Admin only)
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Prevent admin from deleting themselves
  if (id === req.user.id) {
    return res.status(400).json({ success: false, error: 'You cannot delete your own account' });
  }

  const [deletedUser] = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning();

  if (!deletedUser) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  res.json({ success: true, message: 'User deleted successfully' });
});
