import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

import { connectDB } from './config/db.js';
import authRoutes, { seedDefaultUser } from './routes/authRoutes.js';
import folderRoutes, { seedDefaultFolders } from './routes/folderRoutes.js';
import noteRoutes, { seedDefaultNotes } from './routes/noteRoutes.js';
import eventRoutes, { seedDefaultEvents } from './routes/eventRoutes.js';
import todoRoutes, { seedDefaultTodos } from './routes/todoRoutes.js';
import photoRoutes from './routes/photoRoutes.js';
import photoFolderRoutes from './routes/photoFolderRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, 'atlas-credentials.env') });
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      status: statusMap[dbStatus] || 'unknown',
      host: mongoose.connection.host || 'Atlas Cluster',
      name: mongoose.connection.name || 'mktodo',
    },
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/photo-folders', photoFolderRoutes);

// Root fallback
app.get('/', (req, res) => {
  res.json({
    message: 'MK Todo Backend API is running.',
    healthEndpoint: '/api/health',
    endpoints: ['/api/auth/login', '/api/folders', '/api/notes', '/api/events', '/api/todos'],
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error Handler]', err);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

// Start server
const startServer = async () => {
  try {
    const conn = await connectDB();
    if (conn) {
      await seedDefaultUser();
      await seedDefaultFolders();
      await seedDefaultNotes();
      await seedDefaultEvents();
      await seedDefaultTodos();
    } else {
      console.warn('[MongoDB] Database connection pending. Starting server with fallback resilience.');
    }

    app.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`🚀 MK Todo Backend running on port ${PORT}`);
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`❤️ Health Check: http://localhost:${PORT}/api/health`);
      console.log(`=========================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

startServer();
