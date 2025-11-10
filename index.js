require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const mongoose = require("mongoose");

// Initialize circuit breakers for service reliability
global.circuitBreakers = new Map();
global.circuitBreakers.set("certificate_generator", {
  failureCount: 0,
  failureThreshold: 10,
  resetTimeout: 60000,
  successThreshold: 3,
  successCount: 0,
  isOpen: false,
  isHalfOpen: false,
  resetTime: 0,
  lastAttemptTime: 0,
  totalRequests: 0,
  totalFailures: 0,
  consecutiveFailures: 0,
  consecutiveFailureThreshold: 5,
});

// Safe logger import
let logger;
try {
  logger = require("./utils/logger")("Server");
} catch (e) {
  logger = {
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
    info: (...args) => console.log(...args),
  };
}

// Load routes with error handling
let VerifyJWT, authRoutes, adminRoutes, attendanceRoutes, certificateRoutes, monitoringRoutes;

try {
  VerifyJWT = require("./middleware/AuthJWT");
} catch (e) {
  logger.error("Failed to load VerifyJWT:", e.message);
}

try {
  authRoutes = require("./routes/authRoutes");
} catch (e) {
  logger.error("Failed to load authRoutes:", e.message);
}

try {
  adminRoutes = require("./routes/adminRoutes");
} catch (e) {
  logger.error("Failed to load adminRoutes:", e.message);
}

try {
  attendanceRoutes = require("./routes/attendanceRoutes");
} catch (e) {
  logger.error("Failed to load attendanceRoutes:", e.message);
}

try {
  certificateRoutes = require("./routes/certificateRoutes");
} catch (e) {
  logger.error("Failed to load certificateRoutes:", e.message);
}

try {
  monitoringRoutes = require("./routes/monitoringRoutes");
} catch (e) {
  logger.error("Failed to load monitoringRoutes:", e.message);
}

const app = express();

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

// Middleware to ensure database connection before handling requests
app.use(async (req, res, next) => {
  await connectToDatabase();
  next();
});

// Export mongoose for monitoring routes
global.mongoose = mongoose;

// Configure EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layouts/main");

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173","https://coderscup-attendance-frontend.vercel.app",
      "https://attendance.acmnuceskhi.com","www.attendance.acmnuceskhi.com"],
    credentials: true,
  })
);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Global error handler middleware
app.use((err, req, res, next) => {
  try {
    logger.error(`Unhandled error: ${err.message}`);
    logger.error(err.stack);
  } catch (e) {
    console.error(`Unhandled error: ${err.message}`);
  }

  const path = req.path;
  if (path.includes("/certificates")) {
    const circuitBreaker = global.circuitBreakers.get("certificate_generator");
    if (circuitBreaker) {
      circuitBreaker.failureCount++;
      if (circuitBreaker.failureCount >= circuitBreaker.failureThreshold) {
        circuitBreaker.isOpen = true;
        circuitBreaker.resetTime = Date.now() + circuitBreaker.resetTimeout;
        try {
          logger.warn(
            "Certificate generator circuit breaker opened due to errors"
          );
        } catch (e) {
          console.warn("Certificate generator circuit breaker opened due to errors");
        }
      }
    }
  }

  res.status(500).json({ message: "Internal server error" });
});

app.get("/", (req, res) => {
  res.send("Hello DevDay25!");
});

app.get("/admin", (req, res) => {
  res.redirect("/admin/monitoring/login");
});

// Server health check endpoint
app.get("/health", (req, res) => {
  try {
    let memoryStats = { percentage: 0, heapUsed: 0, rss: 0 };
    try {
      const { memoryMonitor } = require("./utils/memoryMonitor");
      memoryStats = memoryMonitor.getStats();
    } catch (e) {
      // Memory monitor not available in serverless
    }
    
    const dbStatus =
      mongoose.connection.readyState === 1 ? "connected" : "disconnected";

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
  } catch (error) {
    res.json({
      status: "ok",
      database: {
        status: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      },
    });
  }
});

// Register routes only if they loaded successfully
if (authRoutes) {
  app.use("/api/auth", authRoutes);
}

if (VerifyJWT && adminRoutes) {
  app.use("/api/admin", VerifyJWT, adminRoutes);
}

if (attendanceRoutes) {
  app.use("/api/attendance", attendanceRoutes);
}

if (certificateRoutes) {
  app.use("/api/certificates", certificateRoutes);
}

if (monitoringRoutes) {
  app.use("/admin/monitoring", monitoringRoutes);
}

app.post("/addteam", async (req, res) => {
  try {
    const { DevDayAttendance } = require("./models/Models");
    const newAttendance = new DevDayAttendance(req.body);
    const savedAttendance = await newAttendance.save();
    res.status(201).json(savedAttendance);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = app;
