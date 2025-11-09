require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const { DevDayAttendance } = require("./models/Models");
const { memoryMonitor } = require("./utils/memoryMonitor");
const logger = require("./utils/logger")("Server");

// Initialize circuit breakers for service reliability
global.circuitBreakers = new Map();
global.circuitBreakers.set("certificate_generator", {
  failureCount: 0,
  failureThreshold: 10, // Increased from 5 to handle more intermittent failures
  resetTimeout: 60000, // Increased from 30s to 60s to give system more time to recover
  successThreshold: 3, // Number of consecutive successes needed to close circuit
  successCount: 0,
  isOpen: false,
  isHalfOpen: false,
  resetTime: 0,
  lastAttemptTime: 0,
  totalRequests: 0,
  totalFailures: 0,
  consecutiveFailures: 0, // Track consecutive failures for faster tripping
  consecutiveFailureThreshold: 5, // Trip after 5 consecutive failures
});

const VerifyJWT = require("./middleware/AuthJWT");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const certificateRoutes = require("./routes/certificateRoutes");
const monitoringRoutes = require("./routes/monitoringRoutes");

const app = express();

// Configure EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layouts/main");

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173","https://coderscup-attendance-frontend.vercel.app"], // Frontend URLs
    credentials: true, // Allow credentials (cookies, authorization headers)
  })
);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

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

// Root redirects to monitoring login
app.get("/admin", (req, res) => {
  res.redirect("/admin/monitoring/login");
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
app.use("/api/certificates", certificateRoutes);
// Monitoring routes handle their own auth internally
app.use("/admin/monitoring", monitoringRoutes);

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

// Export mongoose for monitoring routes
global.mongoose = mongoose;

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
