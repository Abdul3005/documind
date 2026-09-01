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

// Base Middleware
const allowedOrigins = process.env.CORS_ORIGIN 
  ? [process.env.CORS_ORIGIN, 'http://localhost:5173', 'http://localhost:3000']
  : '*';

app.use(cors({
  origin: allowedOrigins,
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
