import express from 'express';
import { register, login, getMe, refresh, logout } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rateLimit.middleware.js';

const router = express.Router();

// Auth Routes
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/refresh', authRateLimiter, refresh);
router.post('/logout', logout);
router.get('/me', protect, getMe);

export default router;
