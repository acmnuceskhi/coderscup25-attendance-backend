require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const app = express();

// Lazy MongoDB connection
let isConnected = false;

async function connectToDatabase() {
  if (isConnected) return;
  
  if (!process.env.MONGO_URI) {
    console.warn('MONGO_URI not set');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
    console.log('Database connected');
  } catch (error) {
    console.error('DB connection failed:', error.message);
  }
}

// DB connection middleware
app.use(async (req, res, next) => {
  await connectToDatabase();
  next();
});

// Export mongoose for other modules
global.mongoose = mongoose;

// Basic middleware
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.send("Hello DevDay25!");
});

// Health check
app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: "ok",
    database: dbStatus
  });
});

module.exports = app;
