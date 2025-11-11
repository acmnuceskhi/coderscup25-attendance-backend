// Local development server entry point
const app = require("./app");
const mongoose = require("mongoose");
const { memoryMonitor } = require("./utils/memoryMonitor");
const logger = require("./utils/logger")("Server");

// Process termination handling
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

function gracefulShutdown() {
  logger.info("Received shutdown signal, gracefully shutting down");

  // Stop the memory monitor
  memoryMonitor.stop();

  // Close MongoDB connection
  mongoose.connection
    .close()
    .then(() => {
      logger.info("MongoDB connection closed");
      process.exit(0);
    })
    .catch((err) => {
      logger.error(`Error during shutdown: ${err.message}`);
      process.exit(1);
    });

  // If MongoDB doesn't close in 5 seconds, force exit
  setTimeout(() => {
    logger.error(
      "Could not close MongoDB connection in time, forcing shutdown"
    );
    process.exit(1);
  }, 5000);
}

// Export mongoose for monitoring routes
global.mongoose = mongoose;

// Connect to MongoDB for local development
async function connectToDatabase() {
  try {
    if (!process.env.MONGO_URI) {
      logger.warn("MONGO_URI not set, running without database");
      return;
    }
    
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("Database connected successfully");
    
    // Start the memory monitor after database is connected
    memoryMonitor.start();
    logger.info("Memory monitoring activated");
  } catch (error) {
    logger.error(`Database connection failed: ${error.message}`);
  }
}

// Connect to database and start server for local development
connectToDatabase().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
  });
});
