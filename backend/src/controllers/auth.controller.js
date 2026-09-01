import { asyncHandler } from '../utils/asyncHandler.js';
import {
  registerUser,
  loginUser,
  getUserProfile,
} from '../services/auth.service.js';

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

  res.status(200).json({
    success: true,
    user: result.user,
    token: result.token,
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
