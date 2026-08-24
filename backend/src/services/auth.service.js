import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Generate JWT token signed with secret and expiration
 */
export const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET || 'documind_v2_default_jwt_secret_dev_key';
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
