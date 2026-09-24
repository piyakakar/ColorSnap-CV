const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const detectionRoutes = require('./routes/detectionRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/colorsnap';

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
    serverSelectionTimeoutMS: 3000,
  })
  .then(() => {
    console.log(`✅ MongoDB connected successfully to ${MONGODB_URI}`);
  })
  .catch((err) => {
    console.warn(`⚠️ MongoDB connection warning: ${err.message}`);
    console.warn('ℹ️ Running backend with in-memory persistence fallback.');
  });

app.listen(PORT, () => {
  console.log(`🚀 ColorSnap server is running on http://localhost:${PORT}`);
});
