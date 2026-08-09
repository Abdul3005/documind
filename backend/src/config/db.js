import mongoose from 'mongoose';

/**
 * Connect to MongoDB Atlas / Database
 */
export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`[MongoDB] Connected successfully to database: ${conn.connection.name} (${conn.connection.host})`);
  } catch (error) {
    console.error(`[MongoDB Error] Connection failed: ${error.message}`);
    process.exit(1);
  }
};
