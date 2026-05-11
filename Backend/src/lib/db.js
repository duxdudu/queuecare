const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    // Don't throw — let the server start so Render health checks pass.
    // Individual requests will fail with 500 if DB is unavailable.
  }
}

module.exports = { connectDB };
