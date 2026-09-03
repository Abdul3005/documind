import mongoose from 'mongoose';
import dns from 'dns';

/**
 * Connect to MongoDB Atlas / Database
 */
export const connectDB = async () => {
  try {
    // Only set custom DNS servers in local development if explicitly requested,
    // avoiding breaking native cloud container (Render) DNS proxies.
    if (process.env.NODE_ENV !== 'production' && process.env.CUSTOM_DNS === 'true') {
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
      } catch (dnsErr) {
        // Fallback if setServers fails in custom environments
      }
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`[MongoDB] Connected successfully to database: ${conn.connection.name} (${conn.connection.host})`);
  } catch (error) {
    console.error(`[MongoDB Error] Connection failed: ${error.message}`);
    process.exit(1);
  }
};
