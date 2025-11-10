// This file exports the Express app for Vercel serverless functions
const app = require('../app');
const mongoose = require('mongoose');

// Lazy MongoDB connection for serverless
let isConnected = false;

async function connectToDatabase() {
  if (isConnected) {
    return;
  }

  if (!process.env.MONGO_URI) {
    console.warn('MONGO_URI not set');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error.message);
  }
}

// Export mongoose for monitoring routes
global.mongoose = mongoose;

// Middleware to ensure database connection before handling requests
app.use(async (req, res, next) => {
  await connectToDatabase();
  next();
});

// Export the Express app for Vercel serverless
module.exports = app;

