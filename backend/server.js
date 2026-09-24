const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');

// Configure reliable DNS servers for MongoDB Atlas SRV lookup on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if not permitted
}

// Load environment variables from backend/.env or root .env
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const detectionRoutes = require('./routes/detectionRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://piyakakar0901_db_user:qy7HLOMxy6IWf7HK@colorsnap.xhvwgzv.mongodb.net/colorsnap?retryWrites=true&w=majority&appName=ColorSnap';

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', detectionRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    project: 'ColorSnap - Real-Time Color Detector Backend',
    version: '1.0.0',
    dbConnected: mongoose.connection.readyState === 1,
    endpoints: {
      health: 'GET /api/health',
      getDetections: 'GET /api/detections',
      createDetection: 'POST /api/detections',
      clearDetections: 'DELETE /api/detections',
    },
  });
});

// Database connection with non-blocking graceful handling
mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
  })
  .then(() => {
    console.log('✅ MongoDB Atlas connected successfully (Database: colorsnap)');
  })
  .catch((err) => {
    console.warn(`⚠️ MongoDB connection warning: ${err.message}`);
    console.warn('ℹ️ Running backend with in-memory persistence fallback.');
  });

app.listen(PORT, () => {
  console.log(`🚀 ColorSnap server is running on http://localhost:${PORT}`);
});
