require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const { DevDayAttendance } = require("./models/Models");
const { memoryMonitor } = require("./utils/memoryMonitor");
const logger = require("./utils/logger")("Server");

// Initialize circuit breakers for service reliability
global.circuitBreakers = new Map();
global.circuitBreakers.set("certificate_generator", {
  failureCount: 0,
  failureThreshold: 5, // Number of failures before opening circuit
  resetTimeout: 30000, // 30 seconds timeout before trying again
  isOpen: false,
  resetTime: 0,
});

const VerifyJWT = require("./middleware/AuthJWT");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");

const certificateRoutes = require("./routes/certificateRoutes");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "https://attendance.devday25.com", // Frontend URL
    credentials: true, // Allow credentials (cookies, authorization headers)
  })
);

// Global error handler middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  logger.error(err.stack);

  // Update circuit breaker for appropriate service
  const path = req.path;
  if (path.includes("/certificates")) {
    const circuitBreaker = global.circuitBreakers.get("certificate_generator");
    if (circuitBreaker) {
      circuitBreaker.failureCount++;
      if (circuitBreaker.failureCount >= circuitBreaker.failureThreshold) {
        circuitBreaker.isOpen = true;
        circuitBreaker.resetTime = Date.now() + circuitBreaker.resetTimeout;
        logger.warn(
          "Certificate generator circuit breaker opened due to errors"
        );
      }
    }
  }

  res.status(500).json({ message: "Internal server error" });
});

app.get("/", (req, res) => {
  res.send("Hello DevDay25!");
});

// Server health check endpoint
app.get("/health", (req, res) => {
  const memoryStats = memoryMonitor.getStats();
  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";

  // Check circuit breakers
  const circuitBreakerStatus = {};
  for (const [key, breaker] of global.circuitBreakers.entries()) {
    circuitBreakerStatus[key] = {
      status: breaker.isOpen ? "open" : "closed",
      failureCount: breaker.failureCount,
      willResetAt: breaker.isOpen
        ? new Date(breaker.resetTime).toISOString()
        : null,
    };
  }

  res.json({
    status: "ok",
    uptime: process.uptime(),
    memoryUsage: {
      percentage: memoryStats.percentage,
      heapUsedMB: Math.round(memoryStats.heapUsed / 1024 / 1024),
      rssMB: Math.round(memoryStats.rss / 1024 / 1024),
    },
    database: {
      status: dbStatus,
    },
    circuitBreakers: circuitBreakerStatus,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", VerifyJWT, adminRoutes);
app.use("/api/attendance", attendanceRoutes);
// app.use('/api/results', resultsRoutes);
app.use("/api/certificates", certificateRoutes);

// check apis (will be removed)
app.post("/addteam", async (req, res) => {
  try {
    const newAttendance = new DevDayAttendance(req.body);
    const savedAttendance = await newAttendance.save();
    res.status(201).json(savedAttendance);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});
// -----------

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

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(process.env.PORT, () => {
      logger.info(`Connected and listening to requests on ${process.env.PORT}`);

      // Start the memory monitor after server is running
      memoryMonitor.start();
      logger.info("Memory monitoring activated");
    });
  })
  .catch((error) => {
    logger.error(`Database connection failed: ${error.message}`);
  });
