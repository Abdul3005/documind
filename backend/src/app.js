import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests without origin (curl, server-to-server, health checks)
    if (!origin) return callback(null, true);

    const currentOriginSetting = process.env.CORS_ORIGIN;
    const dynamicAllowedOrigins = currentOriginSetting
      ? currentOriginSetting.split(',').map((o) => o.trim()).filter(Boolean)
      : ['http://localhost:5173', 'http://localhost:3000'];

    const isExplicitlyAllowed = dynamicAllowedOrigins.includes(origin);
    const isDev = process.env.NODE_ENV !== 'production' && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'));

    if (isExplicitlyAllowed || isDev) {
      // In credentialed CORS, return the exact verified origin
      return callback(null, true);
    }
    const corsErr = new Error('CORS policy violation: Origin not allowed.');
    corsErr.statusCode = 403;
    return callback(corsErr);
  },
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/documents', chatRoutes);

// Health-Check Route
app.get('/api/health', (req, res) => {
  const provider =
    process.env.GEMINI_API_KEY ? 'Gemini 1.5 Flash' :
    process.env.GROQ_API_KEY ? 'Groq GPT-OSS' :
    process.env.OPENAI_API_KEY ? 'OpenAI GPT-4' :
    'DocuMind AI';

  res.status(200).json({
    status: 'ok',
    message: 'DocuMind API is running',
    provider,
    timestamp: new Date().toISOString(),
  });
});

// Centralized Error Handler (must be registered after routes)
app.use(errorHandler);

export default app;
