import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import documentRoutes from './routes/document.routes.js';
import chatRoutes from './routes/chat.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

const app = express();
app.set("trust proxy", 1);

// Base Middleware
const originSetting = process.env.CORS_ORIGIN;
const allowedOrigins = originSetting
  ? originSetting.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman, health checks)
    if (!origin) return callback(null, true);
    if (
      process.env.CORS_ORIGIN === '*' ||
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(origin) ||
      process.env.NODE_ENV !== 'production' ||
      origin.endsWith('.vercel.app')
    ) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy violation: Origin not allowed.'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/documents', chatRoutes);

// Health-Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'DocuMind API is running',
    timestamp: new Date().toISOString(),
  });
});

// Centralized Error Handler (must be registered after routes)
app.use(errorHandler);

export default app;
