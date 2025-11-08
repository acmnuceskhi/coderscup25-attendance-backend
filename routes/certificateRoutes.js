const fs = require("fs");
const path = require("path");
const express = require("express");
const crypto = require("crypto");
const { CodersCupAttendance, Event } = require("../models/Models");
const {
  generateTeamCertificateBuffers,
  generateCertificateBuffer,
} = require("../utils/certificateGenerator");
const logger = require("../utils/logger")("CertRoutes");

const router = express.Router();

// Metrics for monitoring
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  generationTimes: [], // Array of generation times in ms
  lastError: null,
  lastErrorTime: null,
};

// Function to calculate average generation time
function getAverageGenerationTime() {
  if (metrics.generationTimes.length === 0) return 0;
  const sum = metrics.generationTimes.reduce((a, b) => a + b, 0);
  return sum / metrics.generationTimes.length;
}

// Health check endpoint
router.get("/health", async (req, res) => {
  try {
    logger.info("Certificate service health check initiated");

    // Check if certificate templates exist
    const primaryTemplate = path.join(
      __dirname,
      "../assets/certificateDesign2025.png"
    );
    const fallbackTemplate = path.join(
      __dirname,
      "../assets/certificateDesign1.png"
    );

    const templateStatus = {
      primaryTemplateExists: fs.existsSync(primaryTemplate),
      fallbackTemplateExists: fs.existsSync(fallbackTemplate),
    };

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const rssUsedMB = Math.round(memoryUsage.rss / 1024 / 1024);
    const resourceStatus = {
      memoryUsage: {
        heapUsedMB,
        heapTotalMB,
        heapUsagePercent: Math.round((heapUsedMB / heapTotalMB) * 100),
        rssUsedMB,
      },
      certificateStore: {
        currentSize: certificateStore.size,
        maxSize: MAX_CERTIFICATE_STORE_SIZE,
        usagePercent: Math.round(
          (certificateStore.size / MAX_CERTIFICATE_STORE_SIZE) * 100
        ),
      },
    };

    // Get circuit breaker status
    const circuitBreakerKey = "certificate_generator";
    const circuitBreaker =
      global.circuitBreakers && global.circuitBreakers.get(circuitBreakerKey);
    const circuitBreakerStatus = circuitBreaker
      ? {
          status: circuitBreaker.isOpen
            ? "open"
            : circuitBreaker.isHalfOpen
            ? "half-open"
            : "closed",
          failureCount: circuitBreaker.failureCount,
          totalRequests: circuitBreaker.totalRequests || 0,
          totalFailures: circuitBreaker.totalFailures || 0,
          failureRate: circuitBreaker.totalRequests
            ? (
                (circuitBreaker.totalFailures / circuitBreaker.totalRequests) *
                100
              ).toFixed(2) + "%"
            : "0%",
          lastAttemptTime: circuitBreaker.lastAttemptTime
            ? new Date(circuitBreaker.lastAttemptTime).toISOString()
            : null,
          resetTime:
            circuitBreaker.isOpen && circuitBreaker.resetTime
              ? new Date(circuitBreaker.resetTime).toISOString()
              : null,
        }
      : { status: "not_configured" };

    // Try to generate a test certificate
    const startTime = Date.now();
    const testBuffer = await generateCertificateBuffer(
      "Health Check",
      "System Test"
    );
    const endTime = Date.now();

    // Record metrics
    const generationTime = endTime - startTime;

    // Prepare health report
    const healthReport = {
      status:
        !templateStatus.primaryTemplateExists &&
        !templateStatus.fallbackTemplateExists
          ? "critical"
          : circuitBreakerStatus.status === "open"
          ? "degraded"
          : "healthy",
      templateStatus,
      resourceStatus,
      circuitBreaker: circuitBreakerStatus,
      certificateGeneration: {
        successful: testBuffer.length > 0,
        generationTimeMs: generationTime,
      },
      metrics: {
        totalRequests: metrics.totalRequests,
        successRate: metrics.totalRequests
          ? (
              (metrics.successfulRequests / metrics.totalRequests) *
              100
            ).toFixed(2) + "%"
          : "No requests yet",
        averageGenerationTimeMs: getAverageGenerationTime().toFixed(2),
        lastError: metrics.lastError,
        lastErrorTime: metrics.lastErrorTime,
      },
      spikeReadiness: {
        rateLimit: {
          limit: RATE_LIMIT_MAX,
          window: RATE_LIMIT_WINDOW / 1000 + " seconds",
        },
        certificateStore: {
          ttl: CERTIFICATE_TTL / 1000 + " seconds",
          maxSize: MAX_CERTIFICATE_STORE_SIZE,
        },
        memoryUtilization:
          resourceStatus.memoryUsage.heapUsagePercent < 80 ? "good" : "warning",
        circuitBreakerConfigured: circuitBreaker ? "yes" : "no",
        readiness:
          templateStatus.primaryTemplateExists ||
          templateStatus.fallbackTemplateExists
            ? resourceStatus.memoryUsage.heapUsagePercent < 80
              ? "ready"
              : "limited"
            : "not_ready",
      },
      recommendations: [],
    };

    // Add recommendations based on health check
    if (!templateStatus.primaryTemplateExists) {
      healthReport.recommendations.push(
        "Primary certificate template missing - add or verify certificateDesign2025.png"
      );
    }
    if (!templateStatus.fallbackTemplateExists) {
      healthReport.recommendations.push(
        "Backup certificate template missing - add certificateDesign1.png as fallback"
      );
    }
    if (resourceStatus.memoryUsage.heapUsagePercent > 80) {
      healthReport.recommendations.push(
        "High memory usage - consider scaling horizontally for traffic spikes"
      );
    }
    if (metrics.averageGenerationTimeMs > 1000) {
      healthReport.recommendations.push(
        "Certificate generation is slower than optimal - consider optimizing PDF generation"
      );
    }

    logger.info(`Health check completed: ${JSON.stringify(healthReport)}`);
    return res.json(healthReport);
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
    return res.status(500).json({
      status: "unhealthy",
      error: error.message,
      metrics: {
        totalRequests: metrics.totalRequests,
        successRate: metrics.totalRequests
          ? (
              (metrics.successfulRequests / metrics.totalRequests) *
              100
            ).toFixed(2) + "%"
          : "No requests yet",
        lastError: metrics.lastError,
        lastErrorTime: metrics.lastErrorTime,
      },
    });
  }
});

// in-memory storage for certificates with TTL (1 minute)
const certificateStore = new Map();
const CERTIFICATE_TTL = 1 * 60 * 1000; // 1 minute in milliseconds
const MAX_CERTIFICATE_STORE_SIZE = 1000; // Maximum number of certificates to store

// clean expired certificates periodically (every 15 seconds)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let expiredCount = 0;

  // First clean expired certificates
  for (const [token, cert] of certificateStore.entries()) {
    if (now > cert.expiry) {
      certificateStore.delete(token);
      expiredCount++;
    }
  }

  // If still over max size after cleaning expired ones, remove oldest entries
  if (certificateStore.size > MAX_CERTIFICATE_STORE_SIZE) {
    // Convert to array to sort by expiry
    const entries = Array.from(certificateStore.entries());
    entries.sort((a, b) => a[1].expiry - b[1].expiry);

    // Remove oldest entries until under the limit
    const entriesToRemove = entries.slice(
      0,
      certificateStore.size - MAX_CERTIFICATE_STORE_SIZE
    );
    entriesToRemove.forEach(([token]) => {
      certificateStore.delete(token);
      expiredCount++;
    });
  }

  if (expiredCount > 0) {
    logger.info(`Cleaned up ${logger.val(expiredCount)} expired certificates`);
  }
}, 15000);

// generate secure token for certificate access
function generateSecureToken() {
  return crypto.randomBytes(16).toString("hex");
}

// Rate limiting configuration
const requestCounts = new Map(); // IP -> count
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20; // Maximum requests per window

// Rate limiting middleware
function rateLimiter(req, res, next) {
  const ip = req.ip;
  const now = Date.now();

  // Clean up expired entries
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 0, resetAt: now + RATE_LIMIT_WINDOW });
  } else if (requestCounts.get(ip).resetAt < now) {
    // Reset counter if window expired
    requestCounts.set(ip, { count: 0, resetAt: now + RATE_LIMIT_WINDOW });
  }

  // Check and increment counter
  const record = requestCounts.get(ip);
  if (record.count >= RATE_LIMIT_MAX) {
    logger.warn(`Rate limit exceeded for IP: ${ip}`);
    return res.status(429).json({
      message: "Too many requests, please try again later",
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    });
  }

  // Increment counter and proceed
  record.count++;
  requestCounts.set(ip, record);
  next();
}

// Apply rate limiting to certificate routes
router.post("/", rateLimiter, async (req, res) => {
  const startTime = Date.now();
  metrics.totalRequests++;

  try {
    // Get circuit breaker to update metrics
    const circuitBreakerKey = "certificate_generator";
    const circuitBreaker =
      global.circuitBreakers && global.circuitBreakers.get(circuitBreakerKey);

    if (circuitBreaker) {
      circuitBreaker.totalRequests++;
      circuitBreaker.lastAttemptTime = Date.now();

      // Check if circuit is open
      if (circuitBreaker.isOpen) {
        // Check if it's time to try again (half-open state)
        if (Date.now() > circuitBreaker.resetTime) {
          circuitBreaker.isOpen = false;
          circuitBreaker.isHalfOpen = true;
          logger.info(
            "Certificate circuit half-open, testing with this request"
          );
        } else {
          const retryAfter = Math.ceil(
            (circuitBreaker.resetTime - Date.now()) / 1000
          );
          logger.warn(
            `Circuit breaker open: certificate generation temporarily unavailable`
          );
          metrics.failedRequests++;
          return res.status(503).json({
            message:
              "Certificate generation temporarily unavailable due to system load",
            retryAfter: retryAfter > 0 ? retryAfter : 30,
          });
        }
      }
    }

    const { att_code } = req.body;

    if (!att_code) {
      logger.error(`Missing attendance code`);
      metrics.failedRequests++;
      return res.status(400).json({ message: "Attendance code is required" });
    }

    logger.info(
      `Certificate request received, attendance code: ${logger.val(att_code)}`
    );
    const team = await CodersCupAttendance.findOne({ att_code: att_code });
    if (!team) {
      logger.error(`Team not found with code ${logger.val(att_code)}`);
      metrics.failedRequests++;
      return res.status(404).json({ message: "Team not found" });
    }

    // // verify attendance status
    // if (!team.attendance) {
    //   logger.warn(
    //     `Request denied: ${logger.val(
    //       team.Team_Name
    //     )} - attendance wasn't marked`
    //   );
    //   metrics.failedRequests++;
    //   return res.status(400).json({
    //     message: "Certificate unavailable: Attendance was not marked",
    //   });
    // }

    // retrieve event details
    const event = await Event.findOne({ competitionName: team.Competition });
    if (!event) {
      logger.error(`Competition ${logger.val(team.Competition)} not found`);
      metrics.failedRequests++;
      return res.status(404).json({ message: "Event not found" });
    }

    // verify event has concluded
    const now = new Date();
    if (now <= event.end_time) {
      logger.warn(
        `Request denied: ${logger.val(team.Competition)} hasn't ended yet`
      );
      metrics.failedRequests++;
      return res.status(400).json({
        message: "Certificates are only available after the event has ended",
      });
    }

    // collect team member names
    const members = [team.Leader_name];
    if (team.mem1_name) members.push(team.mem1_name);
    if (team.mem2_name) members.push(team.mem2_name);
    if (team.mem3_name) members.push(team.mem3_name);
    if (team.mem4_name) members.push(team.mem4_name);

    logger.info(
      `Requesting ${logger.val(members.length)} certificates for ${logger.val(
        team.Team_Name
      )}`
    );

    // generate certificates in memory
    const certificates = await generateTeamCertificateBuffers(
      members,
      team.Competition,
      team.Team_Name
    );

    logger.success(
      `${logger.val(team.Team_Name)}: ${logger.val(
        certificates.length
      )} certificates ready`
    );

    // If we get here in half-open state, record the success
    if (circuitBreaker && circuitBreaker.isHalfOpen) {
      circuitBreaker.successCount++;
      if (circuitBreaker.successCount >= circuitBreaker.successThreshold) {
        // Reset circuit breaker after enough consecutive successes
        circuitBreaker.isHalfOpen = false;
        circuitBreaker.failureCount = 0;
        circuitBreaker.consecutiveFailures = 0;
        circuitBreaker.successCount = 0;
        logger.info(
          "Certificate circuit breaker closed after successful recovery"
        );
      }
    }

    // store certificates with tokens and prepare response
    const downloadTokens = certificates.map((cert, index) => {
      const token = generateSecureToken();
      const expiry = Date.now() + CERTIFICATE_TTL;

      certificateStore.set(token, {
        buffer: cert.buffer,
        name: cert.name,
        contentType: "application/pdf",
        filename: `${cert.name.replace(/\s+/g, "-")}-Certificate.pdf`,
        expiry: expiry,
      });

      return {
        memberName: cert.name,
        memberIndex: index,
        downloadUrl: `/api/certificates/download/${token}`,
      };
    });

    // prepare certificate data for response
    const certificateData = {
      teamName: team.Team_Name,
      consumerNumber: team.consumerNumber,
      members: members,
      competition: team.Competition,
      eventDate: event.start_time,
    };

    // Update metrics
    const endTime = Date.now();
    metrics.successfulRequests++;
    metrics.generationTimes.push(endTime - startTime);
    // Keep only the last 100 generation times to avoid memory issues
    if (metrics.generationTimes.length > 100) {
      metrics.generationTimes.shift();
    }

    return res.json({
      message: "Certificate generated successfully",
      certificateData,
      downloadTokens,
    });
  } catch (err) {
    // Update metrics
    metrics.failedRequests++;
    metrics.lastError = err.message;
    metrics.lastErrorTime = new Date().toISOString();

    // Update circuit breaker
    const circuitBreakerKey = "certificate_generator";
    const circuitBreaker =
      global.circuitBreakers && global.circuitBreakers.get(circuitBreakerKey);

    if (circuitBreaker) {
      circuitBreaker.failureCount++;
      circuitBreaker.totalFailures++;
      circuitBreaker.consecutiveFailures++;

      // Check if circuit should open based on consecutive failures (faster response)
      if (
        circuitBreaker.consecutiveFailures >=
        circuitBreaker.consecutiveFailureThreshold
      ) {
        circuitBreaker.isOpen = true;
        circuitBreaker.isHalfOpen = false;
        circuitBreaker.resetTime = Date.now() + circuitBreaker.resetTimeout;
        logger.warn(
          `Certificate circuit breaker opened due to ${circuitBreaker.consecutiveFailures} consecutive failures`
        );
      }
      // Or based on total failure count (slower response but more tolerant of intermittent issues)
      else if (circuitBreaker.failureCount >= circuitBreaker.failureThreshold) {
        circuitBreaker.isOpen = true;
        circuitBreaker.isHalfOpen = false;
        circuitBreaker.resetTime = Date.now() + circuitBreaker.resetTimeout;
        logger.warn(
          `Certificate circuit breaker opened due to failure threshold (${circuitBreaker.failureCount}/${circuitBreaker.failureThreshold})`
        );
      }
    }

    logger.error(`Error processing certificate request: ${err.message}`);
    return res.status(500).json({ message: "Error generating certificate" });
  }
});

// download certificate endpoint
router.get("/download/:token", rateLimiter, (req, res) => {
  const { token } = req.params;
  const tokenPreview = token.substring(0, 8);
  logger.info(`Download requested with token ${logger.val(tokenPreview)}...`);

  if (!certificateStore.has(token)) {
    logger.error(
      `Invalid token ${logger.val(
        tokenPreview
      )}... - certificate not found or expired`
    );
    return res
      .status(404)
      .json({ message: "Certificate not found or expired (Refresh page)" });
  }

  const certificate = certificateStore.get(token);
  logger.success(`Delivering certificate for ${logger.val(certificate.name)}`);

  // set appropriate headers
  res.setHeader("Content-Type", certificate.contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${certificate.filename}"`
  );
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  // directly send the buffer to the client
  res.end(certificate.buffer);
});

// Initialize circuit breaker if it doesn't exist
if (!global.circuitBreakers) {
  global.circuitBreakers = new Map();
}

// Create circuit breaker for certificate generation if it doesn't exist
if (!global.circuitBreakers.has("certificate_generator")) {
  global.circuitBreakers.set("certificate_generator", {
    failureCount: 0,
    failureThreshold: 5, // Number of failures before opening circuit
    resetTimeout: 30000, // 30 seconds timeout before trying again
    isOpen: false,
    resetTime: 0,
  });
}

// Export objects for testing
module.exports = router;
module.exports.cleanupInterval = cleanupInterval;
module.exports.metrics = metrics; // Export metrics for monitoring
