import mongoose from 'mongoose';

/**
 * RefreshToken Schema
 *
 * Stores a SHA-256 hash of an opaque refresh token, scoped to a user and session family.
 * Raw tokens are never persisted — only their SHA-256 digest.
 *
 * Token format (raw, client-visible):  <family-uuid>.<64-byte-random-hex>
 * Stored field (tokenHash):            SHA-256("<family-uuid>.<64-byte-random-hex>")
 *
 * Rotation: each use of /api/auth/refresh atomically deletes the current record
 * and inserts a new one (same family, new random suffix).
 *
 * Reuse / concurrent-race policy (Phase 1):
 *   If findOneAndDelete returns null the caller receives 401.
 *   Family-level invalidation is NOT performed in Phase 1 because a concurrent
 *   two-tab refresh race produces the same findOneAndDelete-null result as a
 *   genuine replay attack, and we cannot reliably distinguish them.
 *   Full reuse detection with family invalidation is a Phase 2 hardening task.
 *
 * TTL: MongoDB removes expired documents automatically via the expiresAt TTL index
 * (expireAfterSeconds: 0). Cleanup granularity is ~60 s.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /**
     * SHA-256 hex digest of the raw opaque token string.
     * Unique index ensures one active token per hash (and enforces collision safety).
     */
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    /**
     * Family UUID shared by all tokens descended from a single login event.
     * Used for future reuse-detection / family-invalidation (Phase 2).
     */
    family: {
      type: String,
      required: true,
      index: true,
    },
    /**
     * Hash of the immediate parent token that this token rotated from.
     * Null for initial tokens created at login/register.
     */
    parentTokenHash: {
      type: String,
      default: null,
      index: true,
    },
    /**
     * Soft revocation flag.
     */
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    /**
     * Stored hash of the replacement token after successful rotation.
     * Allows grace-window or audit tracking.
     */
    replacedByTokenHash: {
      type: String,
      default: null,
    },
    /**
     * Revocation reason: 'rotated', 'logged_out', 'reuse_detected'
     */
    revokedReason: {
      type: String,
      default: null,
    },
    /**
     * Timestamp when the token was rotated or revoked.
     */
    revokedAt: {
      type: Date,
      default: null,
    },
    /**
     * TTL index: MongoDB removes this document automatically once expiresAt passes.
     */
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
    /** Stored for audit / session listing only; not used in token validation. */
    userAgent: {
      type: String,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
  },
  {
    // Enable updatedAt for tracking revocation timestamps
    timestamps: true,
  }
);

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;
