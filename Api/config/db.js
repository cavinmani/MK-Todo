import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env or atlas-credentials.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, '..', 'atlas-credentials.env') });
}

// Disable buffering so queries fail fast when DB is disconnected
mongoose.set('bufferCommands', false);

export const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not defined in environment variables.');
    }

    if (!uri.includes('mktodo') && !uri.includes('?')) {
      uri = `${uri}/mktodo?retryWrites=true&w=majority`;
    }

    console.log('[MongoDB] Attempting connection to Atlas cluster...');
    const conn = await mongoose.connect(uri, {
      dbName: 'mktodo',
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.warn(`[MongoDB] Atlas connection warning: ${error.message}`);
    console.warn(`[MongoDB] TIP: Ensure your IP address is whitelisted in MongoDB Atlas (Security -> Network Access).`);
    return null;
  }
};
