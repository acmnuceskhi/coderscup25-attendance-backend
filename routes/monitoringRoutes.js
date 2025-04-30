const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const { memoryMonitor } = require("../utils/memoryMonitor");
const logger = require("../utils/logger")("MonitoringRoutes");
const VerifyJWT = require("../middleware/AuthJWT");

// Login page - public route, no auth required
router.get("/login", (req, res) => {
  res.render("login", { layout: "layouts/main" });
});

// Check auth status
router.get("/auth-status", (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ isAuthenticated: false });
    }
    // If we get here, there's a token (actual verification happens in VerifyJWT middleware)
    return res.json({ isAuthenticated: true });
  } catch (error) {
    return res.status(500).json({ error: "Error checking auth status" });
  }
});

// Apply VerifyJWT middleware to all protected routes
router.use(VerifyJWT);

// Protected routes below
// Monitoring dashboard - Main page
router.get("/", (req, res) => {
  res.render("dashboard");
});

// Logs view page
router.get("/logs", (req, res) => {
  res.render("logs");
});

// Certificate stats page
router.get("/certificates", (req, res) => {
  res.render("certificates");
});

// API - Dashboard data
router.get("/data", async (req, res) => {
  try {
    // Get health data
    const healthData = await getHealthData();

    // Get certificate data
    const certificateData = getCertificateData();

    // Get recent errors
    const recentErrors = await getRecentErrors();

    res.json({
      health: healthData,
      certificates: certificateData,
      recentErrors: recentErrors,
    });
  } catch (error) {
    logger.error(`Error fetching monitoring data: ${error.message}`);
    res.status(500).json({ error: "Failed to fetch monitoring data" });
  }
});

// API - Get logs
router.get("/logs/data", async (req, res) => {
  try {
    const { module, level, search, page = 1, limit = 100 } = req.query;
    const logEntries = await getLogEntries(module, level, search, page, limit);

    res.json({
      logs: logEntries.entries,
      total: logEntries.total,
      page: parseInt(page),
      totalPages: Math.ceil(logEntries.total / limit),
      modules: logEntries.availableModules,
    });
  } catch (error) {
    logger.error(`Error fetching logs: ${error.message}`);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// API - Get certificate metrics
router.get("/certificates/data", async (req, res) => {
  try {
    const certificateData = await getDetailedCertificateData();
    res.json(certificateData);
  } catch (error) {
    logger.error(`Error fetching certificate metrics: ${error.message}`);
    res.status(500).json({ error: "Failed to fetch certificate metrics" });
  }
});

// Helper function to get health data
async function getHealthData() {
  // Get server health data
  const memoryStats = memoryMonitor.getStats();
  const dbStatus =
    global.mongoose && global.mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected";

  // Check circuit breakers
  const circuitBreakerStatus = {};
  if (global.circuitBreakers) {
    for (const [key, breaker] of global.circuitBreakers.entries()) {
      circuitBreakerStatus[key] = {
        status: breaker.isOpen ? "open" : "closed",
        failureCount: breaker.failureCount || 0,
        willResetAt: breaker.isOpen ? breaker.resetTime : null,
      };
    }
  }

  return {
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
  };
}

// Helper function to get certificate data
function getCertificateData() {
  // Get certificate metrics from the certificate routes
  const certificateRoutes = require("./certificateRoutes");
  const metrics = certificateRoutes.metrics || {};

  // Get certificate store info
  let certificateStore = { currentSize: 0, maxSize: 1000 };
  if (certificateRoutes.certificateStore) {
    certificateStore = {
      currentSize: certificateRoutes.certificateStore.size || 0,
      maxSize: certificateRoutes.MAX_CERTIFICATE_STORE_SIZE || 1000,
    };
  }

  return {
    totalRequests: metrics.totalRequests || 0,
    successfulRequests: metrics.successfulRequests || 0,
    failedRequests: metrics.failedRequests || 0,
    averageGenerationTimeMs:
      metrics.generationTimes && metrics.generationTimes.length > 0
        ? metrics.generationTimes.reduce((a, b) => a + b, 0) /
          metrics.generationTimes.length
        : 0,
    lastError: metrics.lastError,
    lastErrorTime: metrics.lastErrorTime,
    certificateStore: certificateStore,
  };
}

// Helper function to get detailed certificate data
async function getDetailedCertificateData() {
  const basicData = getCertificateData();

  // Add more detail about certificate environment
  const certificateTemplates = [];
  const templatePaths = [
    {
      name: "Primary Template",
      path: path.join(__dirname, "../assets/certificateDesign2025.png"),
    },
    {
      name: "Fallback Template",
      path: path.join(__dirname, "../assets/certificateDesign1.png"),
    },
  ];

  for (const template of templatePaths) {
    try {
      const exists = fs.existsSync(template.path);
      certificateTemplates.push({
        name: template.name,
        exists: exists,
      });
    } catch (err) {
      certificateTemplates.push({
        name: template.name,
        exists: false,
        error: err.message,
      });
    }
  }

  // Certificate rate limiting and TTL info
  const certificateRoute = require("./certificateRoutes");
  const rateLimiting = {
    maxRequests: certificateRoute.RATE_LIMIT_MAX || 20,
    windowSeconds: certificateRoute.RATE_LIMIT_WINDOW
      ? certificateRoute.RATE_LIMIT_WINDOW / 1000
      : 60,
    ttlSeconds: certificateRoute.CERTIFICATE_TTL
      ? certificateRoute.CERTIFICATE_TTL / 1000
      : 60,
  };

  return {
    ...basicData,
    environment: {
      templates: certificateTemplates,
      nodeVersion: process.version,
    },
    rateLimiting: rateLimiting,
  };
}

// Helper function to get recent errors
async function getRecentErrors(limit = 5) {
  try {
    const errors = [];

    // Get log files
    const logDir = path.join(__dirname, "../logs");
    if (fs.existsSync(logDir)) {
      const files = fs.readdirSync(logDir);

      for (const file of files) {
        if (file.endsWith(".log")) {
          const filePath = path.join(logDir, file);
          const content = fs.readFileSync(filePath, "utf8");

          // Extract error lines
          const lines = content
            .split("\n")
            .filter((line) => line.includes("[ERROR]"));
          for (const line of lines.slice(-limit)) {
            if (line.trim()) {
              const parts = line.split("│");
              if (parts.length >= 2) {
                const timestampMatch = parts[0].match(/\[(.*?)\]/);
                const timestamp = timestampMatch
                  ? timestampMatch[1]
                  : new Date().toISOString();
                const message = parts[1].trim();

                errors.push({
                  timestamp,
                  message,
                  source: file.replace(".log", ""),
                });
              }
            }
          }
        }
      }
    }

    // Sort by timestamp (newest first) and limit
    errors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return errors.slice(0, limit);
  } catch (error) {
    logger.error(`Error reading error logs: ${error.message}`);
    return [];
  }
}

// Helper function to get log entries
async function getLogEntries(
  moduleFilter,
  levelFilter,
  searchFilter,
  page,
  limit
) {
  try {
    const entries = [];
    const availableModules = new Set();

    // Get log files
    const logDir = path.join(__dirname, "../logs");
    if (fs.existsSync(logDir)) {
      const files = fs.readdirSync(logDir);

      for (const file of files) {
        if (file.endsWith(".log")) {
          const filePath = path.join(logDir, file);
          const content = fs.readFileSync(filePath, "utf8");

          // Process each line
          const lines = content.split("\n");
          for (const line of lines) {
            if (line.trim()) {
              // Parse log entry
              const entry = parseLogEntry(line, file);
              if (entry) {
                // Add to available modules
                availableModules.add(entry.module);

                // Apply filters
                if (
                  shouldIncludeLogEntry(
                    entry,
                    moduleFilter,
                    levelFilter,
                    searchFilter
                  )
                ) {
                  entries.push(entry);
                }
              }
            }
          }
        }
      }
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedEntries = entries.slice(startIndex, endIndex);

    return {
      entries: paginatedEntries,
      total: entries.length,
      availableModules: Array.from(availableModules),
    };
  } catch (error) {
    logger.error(`Error reading logs: ${error.message}`);
    return { entries: [], total: 0, availableModules: [] };
  }
}

// Helper function to parse a log entry
function parseLogEntry(line, filename) {
  try {
    // Our log format is [timestamp] [level] [module] │ message
    const parts = line.split("│");
    if (parts.length < 2) return null;

    const metadataPart = parts[0];
    const messagePart = parts[1].trim();

    // Extract metadata
    const timestampMatch = metadataPart.match(/\[(.*?)\]/);
    const levelMatch = metadataPart.match(
      /\[(INFO|SUCCESS|WARN|ERROR|DEBUG)\]/i
    );
    const moduleMatch = metadataPart.match(/\[([\w]+)\](?!.*\[)/);

    return {
      timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString(),
      level: levelMatch ? levelMatch[1].toUpperCase() : "INFO",
      module: moduleMatch ? moduleMatch[1] : filename.replace(".log", ""),
      message: messagePart,
      source: filename,
    };
  } catch (error) {
    return null;
  }
}

// Helper function to apply log filters
function shouldIncludeLogEntry(entry, moduleFilter, levelFilter, searchFilter) {
  // Module filter
  if (moduleFilter && entry.module !== moduleFilter) {
    return false;
  }

  // Level filter
  if (levelFilter && entry.level !== levelFilter) {
    return false;
  }

  // Search filter
  if (
    searchFilter &&
    !entry.message.toLowerCase().includes(searchFilter.toLowerCase())
  ) {
    return false;
  }

  return true;
}

module.exports = router;
