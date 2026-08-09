import app from './src/app.js';
import { connectDB } from './src/config/db.js';

const PORT = process.env.PORT || 5000;

// Connect to Database first, then launch HTTP server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[DocuMind Server] Listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
};

startServer();
