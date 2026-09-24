const express = require('express');
const mongoose = require('mongoose');
const Detection = require('../models/Detection');

const router = express.Router();

// In-memory fallback if MongoDB connection is pending/offline
let memoryDetections = [];

// Helper to check if MongoDB is connected
const isDbConnected = () => mongoose.connection.readyState === 1;

// GET /api/health
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ColorSnap API',
    dbConnected: isDbConnected(),
    timestamp: new Date().toISOString(),
  });
});

// GET /api/detections - Retrieve recent detections (limit to 30)
router.get('/detections', async (req, res) => {
  try {
    if (isDbConnected()) {
      const detections = await Detection.find().sort({ timestamp: -1 }).limit(30);
      return res.json({ success: true, data: detections, source: 'mongodb' });
    }
    // Fallback to memory
    return res.json({
      success: true,
      data: memoryDetections.slice(0, 30),
      source: 'memory-fallback',
      note: 'MongoDB offline - storing in memory',
    });
  } catch (error) {
    console.error('Error fetching detections:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve detections' });
  }
});

// POST /api/detections - Save a new meaningful detection
router.post('/detections', async (req, res) => {
  try {
    const { color, confidence, hexCode, timestamp } = req.body;

    if (!color || confidence === undefined) {
      return res.status(400).json({ success: false, error: 'Color and confidence are required' });
    }

    const detectionData = {
      color: String(color).trim(),
      confidence: Math.round(Number(confidence)),
      hexCode: hexCode || '#888888',
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    };

    if (isDbConnected()) {
      const savedDoc = await Detection.create(detectionData);
      return res.status(201).json({ success: true, data: savedDoc, source: 'mongodb' });
    }

    // In-memory fallback
    const memoryRecord = {
      _id: Date.now().toString(),
      ...detectionData,
    };
    memoryDetections.unshift(memoryRecord);
    if (memoryDetections.length > 50) memoryDetections.pop();

    return res.status(201).json({
      success: true,
      data: memoryRecord,
      source: 'memory-fallback',
    });
  } catch (error) {
    console.error('Error saving detection:', error);
    res.status(500).json({ success: false, error: 'Failed to save detection' });
  }
});

// DELETE /api/detections - Clear detection history
router.delete('/detections', async (req, res) => {
  try {
    if (isDbConnected()) {
      await Detection.deleteMany({});
    }
    memoryDetections = [];
    res.json({ success: true, message: 'Detection history cleared successfully' });
  } catch (error) {
    console.error('Error clearing detections:', error);
    res.status(500).json({ success: false, error: 'Failed to clear detections' });
  }
});

module.exports = router;
