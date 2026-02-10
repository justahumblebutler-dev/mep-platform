/**
 * Authentication Service
 * Secure JWT-based authentication with bcrypt password hashing
 */

import bcrypt from 'bcryptjs';
import jwt from '@fastify/jwt';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';
const JWT_EXPIRY = '15m'; // Short expiry for security
const REFRESH_EXPIRY = '7d';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  firm?: string;
  role: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}

interface AuthResult {
  success: boolean;
  user?: Omit<User, 'passwordHash'>;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

// In-memory rate limiting (use Redis in production)
const loginAttempts = new Map<string, { attempts: number; lockedUntil?: number }>();

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

/**
 * Check if account is locked
 */
function isLocked(email: string): boolean {
  const attempts = loginAttempts.get(email);
  if (!attempts) return false;
  if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
    return true;
  }
  // Reset if lockout expired
  loginAttempts.delete(email);
  return false;
}

/**
 * Record failed login attempt
 */
function recordFailedAttempt(email: string): void {
  const attempts = loginAttempts.get(email) || { attempts: 0 };
  attempts.attempts += 1;
  
  if (attempts.attempts >= MAX_LOGIN_ATTEMPTS) {
    attempts.lockedUntil = Date.now() + LOCKOUT_DURATION;
  }
  
  loginAttempts.set(email, attempts);
}

/**
 * Clear login attempts on successful login
 */
function clearLoginAttempts(email: string): void {
  loginAttempts.delete(email);
}

/**
 * Generate access token (short-lived)
 */
export function generateAccessToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    type: 'access',
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Generate refresh token (long-lived)
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRY }
  );
}

/**
 * Verify access token
 */
export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const decoded = await jwt.verify<TokenPayload>(token, JWT_SECRET);
    if (decoded.type !== 'access') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Verify refresh token and generate new tokens
 */
export async function refreshTokens(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const decoded = await jwt.verify<{ userId: string; type: string }>(
      refreshToken,
      JWT_SECRET
    );
    
    if (decoded.type !== 'refresh') {
      return null;
    }
    
    // In production: fetch user from DB
    // const user = await getUserById(decoded.userId);
    
    // Generate new tokens
    return {
      accessToken: 'new-access-token', // Would call generateAccessToken(user)
      refreshToken: 'new-refresh-token', // Would call generateRefreshToken(user.id)
    };
  } catch {
    return null;
  }
}

/**
 * Authenticate user login
 */
export async function login(
  email: string,
  password: string,
  getUserByEmail: (email: string) => Promise<User | null>
): Promise<AuthResult> {
  // Check lockout
  if (isLocked(email)) {
    return { 
      success: false, 
      error: 'Account locked. Try again in 15 minutes.' 
    };
  }
  
  // Get user
  const user = await getUserByEmail(email);
  if (!user) {
    // Delay response to prevent timing attacks
    await bcrypt.compare(password, '$2a$12$LEHNJM3eA1e5h2.5t3v.u.1e5h2.5t3v.u.1e5h2.5t3v.u.1e5h2');
    return { success: false, error: 'Invalid email or password' };
  }
  
  // Verify password
  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    recordFailedAttempt(email);
    return { success: false, error: 'Invalid email or password' };
  }
  
  // Success
  clearLoginAttempts(email);
  
  const { passwordHash, ...safeUser } = user;
  
  return {
    success: true,
    user: safeUser,
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user.id),
  };
}

/**
 * Register new user
 */
export async function register(
  email: string,
  password: string,
  name: string,
  firm?: string,
  createUser: (user: Partial<User>) => Promise<User>
): Promise<AuthResult> {
  // Validate password strength
  if (password.length < 12) {
    return { success: false, error: 'Password must be at least 12 characters' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { success: false, error: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/[0-9]/.test(password)) {
    return { success: false, error: 'Password must contain at least one number' };
  }
  
  // Hash password
  const passwordHash = await hashPassword(password);
  
  // Create user
  const user = await createUser({
    id: uuidv4(),
    email: email.toLowerCase(),
    passwordHash,
    name,
    firm,
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  const { passwordHash: _, ...safeUser } = user;
  
  return {
    success: true,
    user: safeUser,
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user.id),
  };
}

/**
 * Change password
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  getUserById: (id: string) => Promise<User | null>,
  updateUserPassword: (id: string, hash: string) => Promise<void>
): Promise<{ success: boolean; error?: string }> {
  const user = await getUserById(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  const validPassword = await verifyPassword(currentPassword, user.passwordHash);
  if (!validPassword) {
    return { success: false, error: 'Current password is incorrect' };
  }
  
  const newHash = await hashPassword(newPassword);
  await updateUserPassword(userId, newHash);
  
  return { success: true };
}

/**
 * Revoke refresh token (logout)
 */
export async function logout(
  refreshToken: string
): Promise<{ success: boolean }> {
  // In production: add token to blacklist in Redis
  // until it naturally expires
  return { success: true };
}
