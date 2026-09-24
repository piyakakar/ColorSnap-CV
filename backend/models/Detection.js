const mongoose = require('mongoose');

const detectionSchema = new mongoose.Schema({
  color: {
    type: String,
    required: true,
    trim: true,
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  hexCode: {
    type: String,
    default: '#000000',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Detection', detectionSchema);
