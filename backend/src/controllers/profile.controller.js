import bcrypt from 'bcrypt';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/postgres.js';
import { users, userActivities } from '../db/drizzle/schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Get current user profile details
 */
export const getMyProfile = asyncHandler(async (req, res) => {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      full_name: users.full_name,
      job_title: users.job_title,
      phone: users.phone,
      bio: users.bio,
      avatar_url: users.avatar_url,
      assigned_zones: users.assigned_zones,
      language: users.language,
      created_at: users.created_at,
      updated_at: users.updated_at
    })
    .from(users)
    .where(eq(users.id, req.user.id))
    .limit(1);

  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  res.json({ success: true, data: user });
});

/**
 * Update current user profile
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { full_name, job_title, phone, bio, avatar_url, language } = req.body;

  const [updatedUser] = await db
    .update(users)
    .set({
      full_name,
      job_title,
      phone,
      bio,
      avatar_url,
      language,
      updated_at: new Date()
    })
    .where(eq(users.id, req.user.id))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      full_name: users.full_name,
      job_title: users.job_title,
      phone: users.phone,
      bio: users.bio,
      avatar_url: users.avatar_url,
      language: users.language,
      updated_at: users.updated_at
    });

  if (!updatedUser) {
    return res.status(404).json({ success: false, error: 'User not found or update failed' });
  }

  // Log activity
  await db.insert(userActivities).values({
    user_id: req.user.id,
    action: 'profile_update',
    device_info: req.headers['user-agent'] || 'Unknown Device',
    ip_address: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
  }).catch(e => console.error(e));

  res.json({ 
    success: true, 
    message: 'Profile updated successfully',
    data: updatedUser 
  });
});

/**
 * Change user password
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, error: 'Current and new password are required' });
  }

  // Fetch current user with password hash (using db.select() to get all fields)
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.user.id))
    .limit(1);

  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  // Verify current password
  const isMatch = await bcrypt.compare(current_password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ success: false, error: 'Invalid current password' });
  }

  // Hash new password
  const hashedNewPassword = await bcrypt.hash(new_password, 10);

  // Update password
  await db
    .update(users)
    .set({
      password_hash: hashedNewPassword,
      updated_at: new Date()
    })
    .where(eq(users.id, req.user.id));

  // Log activity
  await db.insert(userActivities).values({
    user_id: req.user.id,
    action: 'password_change',
    device_info: req.headers['user-agent'] || 'Unknown Device',
    ip_address: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
  }).catch(e => console.error(e));

  res.json({ success: true, message: 'Password updated successfully' });
});

/**
 * Get activity logs (Global for Admin, Private for others)
 */
export const getMyActivities = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';

  let query = db
    .select({
      id: userActivities.id,
      user_id: userActivities.user_id,
      action: userActivities.action,
      device_info: userActivities.device_info,
      ip_address: userActivities.ip_address,
      created_at: userActivities.created_at,
      username: users.username,
      role: users.role
    })
    .from(userActivities)
    .leftJoin(users, eq(userActivities.user_id, users.id));

  if (!isAdmin) {
    query = query.where(eq(userActivities.user_id, req.user.id));
  }

  const activities = await query
    .orderBy(desc(userActivities.created_at))
    .limit(100);

  console.log(`[GET_ACTIVITIES] Found ${activities.length} records for role: ${req.user.role}`);

  res.json({ success: true, data: activities });
});

/**
 * Delete current user account
 */
export const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // 1. Delete user activities
  await db.delete(userActivities).where(eq(userActivities.user_id, userId));

  // 2. Delete the user
  const [deletedUser] = await db
    .delete(users)
    .where(eq(users.id, userId))
    .returning();

  if (!deletedUser) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  res.json({ success: true, message: 'Account deleted successfully' });
});

/**
 * Revoke all sessions by updating security stamp
 */
export const revokeAllSessions = asyncHandler(async (req, res) => {
  const { targetUserId, type } = req.body;
  const isAdmin = req.user.role === 'admin';
  
  if (type === 'global' && isAdmin) {
    // Global Nuke: Sign out everyone except Viewers
    await db
      .update(users)
      .set({
        security_stamp: sql`gen_random_uuid()`,
        updated_at: new Date()
      })
      .where(sql`role != 'viewer'`);

    return res.json({ 
      success: true, 
      message: 'Global Reset: All Admins and Operators have been signed out. Viewers remain active.' 
    });
  }

  // Targeted or Self Revocation
  const targetId = (isAdmin && targetUserId) ? targetUserId : req.user.id;

  await db
    .update(users)
    .set({
      security_stamp: sql`gen_random_uuid()`,
      updated_at: new Date()
    })
    .where(eq(users.id, targetId));

  const message = targetId === req.user.id 
    ? 'All your sessions have been revoked. Please log in again.' 
    : 'All sessions for the target user have been revoked successfully.';

  res.json({ success: true, message });
});
