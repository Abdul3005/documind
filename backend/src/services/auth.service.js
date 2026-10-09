import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';

/**
 * Generate JWT token signed with secret and expiration
 */
export const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is missing.');
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ id: userId }, secret, { expiresIn });
};

/**
 * Register a new user
 */
export const registerUser = async ({ name, email, password }) => {
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    const error = new Error('User already exists with this email address.');
    error.statusCode = 409;
    throw error;
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
  });

  const token = generateToken(user._id);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
    token,
  };
};

/**
 * Authenticate user with credentials
 */
export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const token = generateToken(user._id);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
    token,
  };
};

/**
 * Fetch authenticated user profile by ID
 */
export const getUserProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User profile not found.');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
};

/**
 * ============================================================================
 * Week 5: Refresh Token Foundation Services
 * ============================================================================
 */

export const REFRESH_TOKEN_COOKIE_NAME = 'documind_refresh';

/**
 * Hash raw refresh token with SHA-256
 */
export const hashRefreshToken = (rawToken) => {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

/**
 * Generate cryptographically secure opaque refresh token.
 * Format: `<familyUUID>.<64-byte-random-hex>` (128 random hex characters)
 */
export const generateRefreshToken = (existingFamily = null) => {
  const family = existingFamily || crypto.randomUUID();
  const randomBytes = crypto.randomBytes(64).toString('hex');
  const rawToken = `${family}.${randomBytes}`;
  return { rawToken, family };
};

/**
 * Calculate Refresh Token Expiration Date (default 7 days)
 */
export const getRefreshTokenExpiresAt = () => {
  const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 10) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

/**
 * Issue and persist a new refresh token for a user session.
 */
export const createRefreshTokenSession = async ({ userId, userAgent = null, ip = null, family = null }) => {
  const { rawToken, family: tokenFamily } = generateRefreshToken(family);
  const tokenHash = hashRefreshToken(rawToken);
  const expiresAt = getRefreshTokenExpiresAt();

  await RefreshToken.create({
    userId,
    tokenHash,
    family: tokenFamily,
    expiresAt,
    userAgent,
    ip,
  });

  return { rawToken, expiresAt };
};

/**
 * Rotate an existing refresh token with race condition grace handling and reuse detection.
 */
export const rotateRefreshTokenSession = async ({ rawToken, userAgent = null, ip = null }) => {
  if (!rawToken || typeof rawToken !== 'string') {
    const error = new Error('Refresh token is required.');
    error.statusCode = 401;
    throw error;
  }

  const tokenHash = hashRefreshToken(rawToken);
  const tokenDoc = await RefreshToken.findOne({ tokenHash });

  if (!tokenDoc) {
    const error = new Error('Invalid refresh token.');
    error.statusCode = 401;
    throw error;
  }

  // 1. REUSE DETECTION: If token was already revoked / rotated
  if (tokenDoc.isRevoked) {
    const graceMs = parseInt(process.env.REFRESH_TOKEN_GRACE_MS, 10) || 5000;
    const revokedTimestamp = tokenDoc.revokedAt ? new Date(tokenDoc.revokedAt).getTime() : new Date(tokenDoc.updatedAt).getTime();
    const timeSinceRevocation = Date.now() - revokedTimestamp;

    // Legitimate race condition window (e.g. concurrent browser tabs firing refresh together)
    if (tokenDoc.revokedReason === 'rotated' && timeSinceRevocation <= graceMs && tokenDoc.replacedByTokenHash) {
      const activeReplacement = await RefreshToken.findOne({
        tokenHash: tokenDoc.replacedByTokenHash,
        isRevoked: false,
      });

      if (activeReplacement && activeReplacement.expiresAt > new Date()) {
        const newAccessToken = generateToken(activeReplacement.userId);
        return {
          accessToken: newAccessToken,
          rawRefreshToken: null, // Don't re-rotate, keep current valid token in cookie
          isGracePeriod: true,
          userId: activeReplacement.userId,
        };
      }
    }

    // MALICIOUS REUSE / REPLAY: Outside grace period
    // Invalidate the entire session family to protect user account
    await RefreshToken.updateMany(
      { family: tokenDoc.family },
      { $set: { isRevoked: true, revokedReason: 'reuse_detected', revokedAt: new Date() } }
    );

    const error = new Error('Refresh token reuse detected. All active sessions have been revoked.');
    error.statusCode = 401;
    throw error;
  }

  // 2. EXPIRY CHECK
  if (tokenDoc.expiresAt <= new Date()) {
    tokenDoc.isRevoked = true;
    tokenDoc.revokedReason = 'expired';
    tokenDoc.revokedAt = new Date();
    await tokenDoc.save();

    const error = new Error('Refresh token has expired.');
    error.statusCode = 401;
    throw error;
  }

  // 3. NORMAL ROTATION: Atomically claim and soft-revoke old token
  // Use findOneAndUpdate with condition isRevoked: false so only ONE concurrent request can claim it
  const { rawToken: newRawToken } = generateRefreshToken(tokenDoc.family);
  const newTokenHash = hashRefreshToken(newRawToken);
  const newExpiresAt = getRefreshTokenExpiresAt();

  const claimedToken = await RefreshToken.findOneAndUpdate(
    { _id: tokenDoc._id, isRevoked: false },
    {
      $set: {
        isRevoked: true,
        revokedReason: 'rotated',
        revokedAt: new Date(),
        replacedByTokenHash: newTokenHash,
      },
    },
    { new: false }
  );

  // If another concurrent request already claimed/rotated it in the microsecond race window:
  if (!claimedToken) {
    // Re-query the updated document to serve the race condition within grace window
    const updatedToken = await RefreshToken.findById(tokenDoc._id);
    if (updatedToken && updatedToken.isRevoked && updatedToken.revokedReason === 'rotated' && updatedToken.replacedByTokenHash) {
      const activeReplacement = await RefreshToken.findOne({
        tokenHash: updatedToken.replacedByTokenHash,
        isRevoked: false,
      });

      if (activeReplacement && activeReplacement.expiresAt > new Date()) {
        const newAccessToken = generateToken(activeReplacement.userId);
        return {
          accessToken: newAccessToken,
          rawRefreshToken: null,
          isGracePeriod: true,
          userId: activeReplacement.userId,
        };
      }
    }

    const error = new Error('Token rotation conflict.');
    error.statusCode = 401;
    throw error;
  }

  // Create new active token in the same family
  await RefreshToken.create({
    userId: tokenDoc.userId,
    tokenHash: newTokenHash,
    family: tokenDoc.family,
    parentTokenHash: tokenDoc.tokenHash,
    expiresAt: newExpiresAt,
    userAgent,
    ip,
  });

  // Generate new short-lived access token
  const newAccessToken = generateToken(tokenDoc.userId);

  return {
    accessToken: newAccessToken,
    rawRefreshToken: newRawToken,
    expiresAt: newExpiresAt,
    userId: tokenDoc.userId,
    isGracePeriod: false,
  };
};

/**
 * Revoke refresh token (Server-side logout)
 */
export const revokeRefreshTokenSession = async (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') {
    return false;
  }

  const tokenHash = hashRefreshToken(rawToken);
  const tokenDoc = await RefreshToken.findOne({ tokenHash });

  if (tokenDoc) {
    tokenDoc.isRevoked = true;
    tokenDoc.revokedReason = 'logged_out';
    tokenDoc.revokedAt = new Date();
    await tokenDoc.save();
    return true;
  }

  return false;
};

