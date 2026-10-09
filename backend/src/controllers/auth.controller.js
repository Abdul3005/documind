import { asyncHandler } from '../utils/asyncHandler.js';
import {
  registerUser,
  loginUser,
  getUserProfile,
  createRefreshTokenSession,
  rotateRefreshTokenSession,
  revokeRefreshTokenSession,
  REFRESH_TOKEN_COOKIE_NAME,
} from '../services/auth.service.js';

/**
 * Configure cookie options securely based on deployment context.
 * In production: SameSite=None + Secure=true to allow cross-site cookie flow (Vercel -> Render).
 * In development: SameSite=Lax + Secure=false for local HTTP testing.
 */
export const getRefreshCookieOptions = (expiresAt) => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'None' : 'Lax',
    path: '/api/auth',
    expires: expiresAt,
  };
};

/**
 * Attach refresh token cookie to response
 */
const attachRefreshCookie = (res, rawToken, expiresAt) => {
  res.cookie(
    REFRESH_TOKEN_COOKIE_NAME,
    rawToken,
    getRefreshCookieOptions(expiresAt)
  );
};

/**
 * Clear refresh token cookie from response
 */
const clearRefreshCookie = (res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'None' : 'Lax',
    path: '/api/auth',
  });
};

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Please provide name, email, and password.',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 6 characters.',
    });
  }

  const result = await registerUser({ name, email, password });

  // Issue Refresh Token session & set HttpOnly cookie
  const { rawToken, expiresAt } = await createRefreshTokenSession({
    userId: result.user.id,
    userAgent: req.headers['user-agent'] || null,
    ip: req.ip || null,
  });
  attachRefreshCookie(res, rawToken, expiresAt);

  // Preserve exact legacy response shape with `token`
  res.status(201).json({
    success: true,
    user: result.user,
    token: result.token,
  });
});

/**
 * @desc    Login existing user
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Please provide email and password.',
    });
  }

  const result = await loginUser({ email, password });

  // Issue Refresh Token session & set HttpOnly cookie
  const { rawToken, expiresAt } = await createRefreshTokenSession({
    userId: result.user.id,
    userAgent: req.headers['user-agent'] || null,
    ip: req.ip || null,
  });
  attachRefreshCookie(res, rawToken, expiresAt);

  // Preserve exact legacy response shape with `token`
  res.status(200).json({
    success: true,
    user: result.user,
    token: result.token,
  });
});

/**
 * @desc    Refresh access token & rotate refresh token
 * @route   POST /api/auth/refresh
 * @access  Public (Cookie-authenticated)
 */
export const refresh = asyncHandler(async (req, res) => {
  // Enforce exact trusted origin check on browser requests
  const origin = req.headers['origin'];
  const originSetting = process.env.CORS_ORIGIN;
  const allowedOrigins = originSetting
    ? originSetting.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:3000'];

  const customHeader = req.headers['x-requested-with'] || req.headers['x-documind-client'];
  const secFetchSite = req.headers['sec-fetch-site']; // Modern browsers send this (same-origin, cross-site, none)
  const isBrowserRequest = !!origin || !!secFetchSite;

  if (origin) {
    const isAllowed =
      allowedOrigins.includes(origin) ||
      (process.env.NODE_ENV !== 'production' && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')));

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Untrusted origin for refresh request.',
      });
    }
  } else if (secFetchSite === 'cross-site') {
    // Cross-site browser navigation/request omitting origin is untrusted
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Cross-site request rejected.',
    });
  }

  // CSRF Defense:
  // In cross-site cookie architecture (SameSite=None), browser requests must prove client intent
  // through either a custom header (e.g., X-Requested-With, X-DocuMind-Client) or Content-Type: application/json.
  // Standard HTML forms (<form action="..." method="POST">) cannot set custom headers or application/json without
  // triggering a CORS preflight that is rejected by our strict origin check.
  if (isBrowserRequest) {
    const contentType = req.headers['content-type'] || '';
    const hasJsonHeader = contentType.includes('application/json');
    if (!customHeader && !hasJsonHeader) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Missing required client validation header.',
      });
    }
  }

  const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
  if (!rawToken) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized: Refresh token cookie missing.',
    });
  }

  try {
    const rotationResult = await rotateRefreshTokenSession({
      rawToken,
      userAgent: req.headers['user-agent'] || null,
      ip: req.ip || null,
    });

    // If a new refresh token was issued (not just handled in race grace window), attach new cookie
    if (rotationResult.rawRefreshToken) {
      attachRefreshCookie(res, rotationResult.rawRefreshToken, rotationResult.expiresAt);
    }

    // Return new access token
    return res.status(200).json({
      success: true,
      token: rotationResult.accessToken,
      accessToken: rotationResult.accessToken, // Provide both for convenience
    });
  } catch (err) {
    // If refresh fails due to revocation, expiry, or invalid token, clear the cookie
    clearRefreshCookie(res);
    return res.status(err.statusCode || 401).json({
      success: false,
      error: err.message || 'Not authorized, invalid or expired refresh token.',
    });
  }
});

/**
 * @desc    Logout user & invalidate refresh session
 * @route   POST /api/auth/logout
 * @access  Public
 */
export const logout = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
  if (rawToken) {
    await revokeRefreshTokenSession(rawToken);
  }

  clearRefreshCookie(res);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});

/**
 * @desc    Get current logged in user details
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await getUserProfile(req.userId);

  res.status(200).json({
    success: true,
    user,
  });
});
