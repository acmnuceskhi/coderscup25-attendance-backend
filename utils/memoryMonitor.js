const logger = require("./logger")("MemoryMonitor");

/**
 * A utility to monitor memory usage and help prevent out-of-memory crashes
 */
class MemoryMonitor {
  constructor(options = {}) {
    this.options = {
      warningThreshold: options.warningThreshold || 80, // 80% of available memory
      criticalThreshold: options.criticalThreshold || 90, // 90% of available memory
      checkIntervalMs: options.checkIntervalMs || 60000, // Check every minute
      onWarning: options.onWarning || this._defaultOnWarning,
      onCritical: options.onCritical || this._defaultOnCritical,
      enabled: options.enabled !== undefined ? options.enabled : true,
    };

    this.lastUsage = {
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
      percentage: 0,
      timestamp: Date.now(),
    };

    this.checkInterval = null;
    this.paused = false;

    if (this.options.enabled) {
      this.start();
    }
  }

  /**
   * Start memory monitoring
   */
  start() {
    if (this.checkInterval) {
      return;
    }

    logger.info("Memory monitoring started");
    this.checkInterval = setInterval(
      () => this.checkMemory(),
      this.options.checkIntervalMs
    );

    // Perform initial check
    this.checkMemory();
  }

  /**
   * Stop memory monitoring
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info("Memory monitoring stopped");
    }
  }

  /**
   * Pause memory monitoring temporarily (e.g., during garbage collection)
   */
  pause() {
    this.paused = true;
  }

  /**
   * Resume memory monitoring after pause
   */
  resume() {
    this.paused = false;
  }

  /**
   * Force garbage collection if available (requires --expose-gc flag)
   * @returns {boolean} Whether GC was triggered
   */
  forceGC() {
    if (global.gc) {
      logger.info("Forcing garbage collection");
      global.gc();
      return true;
    }
    return false;
  }

  /**
   * Check memory usage and trigger callbacks if thresholds are exceeded
   */
  checkMemory() {
    if (this.paused) {
      return;
    }

    const memoryUsage = process.memoryUsage();
    const v8 = require("v8");
    const heapStats = v8.getHeapStatistics();

    // Calculate percentage of used heap
    const usedPercentage = Math.round(
      (memoryUsage.heapUsed / heapStats.heap_size_limit) * 100
    );

    // Update last usage stats
    this.lastUsage = {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      percentage: usedPercentage,
      timestamp: Date.now(),
    };

    // Log memory usage for monitoring
    logger.debug(
      `Memory usage: ${usedPercentage}% (${Math.round(
        memoryUsage.heapUsed / 1024 / 1024
      )} MB / ${Math.round(heapStats.heap_size_limit / 1024 / 1024)} MB)`
    );

    // Check thresholds
    if (usedPercentage >= this.options.criticalThreshold) {
      logger.error(`CRITICAL MEMORY USAGE: ${usedPercentage}% of heap used`);
      this.options.onCritical(this.lastUsage, this);
    } else if (usedPercentage >= this.options.warningThreshold) {
      logger.warn(`HIGH MEMORY USAGE: ${usedPercentage}% of heap used`);
      this.options.onWarning(this.lastUsage, this);
    }
  }

  /**
   * Get current memory usage stats
   * @returns {Object} Memory usage stats
   */
  getStats() {
    this.checkMemory(); // Update stats
    return this.lastUsage;
  }

  /**
   * Default warning handler
   * @private
   */
  _defaultOnWarning(usage, monitor) {
    // Try to free memory
    monitor.forceGC();
  }

  /**
   * Default critical handler
   * @private
   */
  _defaultOnCritical(usage, monitor) {
    // Try to free memory more aggressively
    monitor.forceGC();

    // Log memory details for debugging
    const v8 = require("v8");
    const heapStats = v8.getHeapStatistics();
    const heapInfo = {
      totalHeapSize:
        Math.round(heapStats.total_heap_size / 1024 / 1024) + " MB",
      totalHeapSizeExecutable:
        Math.round(heapStats.total_heap_size_executable / 1024 / 1024) + " MB",
      totalPhysicalSize:
        Math.round(heapStats.total_physical_size / 1024 / 1024) + " MB",
      totalAvailableSize:
        Math.round(heapStats.total_available_size / 1024 / 1024) + " MB",
      usedHeapSize: Math.round(heapStats.used_heap_size / 1024 / 1024) + " MB",
      heapSizeLimit:
        Math.round(heapStats.heap_size_limit / 1024 / 1024) + " MB",
      mallocedMemory:
        Math.round(heapStats.malloced_memory / 1024 / 1024) + " MB",
      peakMallocedMemory:
        Math.round(heapStats.peak_malloced_memory / 1024 / 1024) + " MB",
    };

    logger.error(`Detailed heap stats: ${JSON.stringify(heapInfo, null, 2)}`);

    // Update circuit breaker if globally available
    if (
      global.circuitBreakers &&
      global.circuitBreakers.has("certificate_generator")
    ) {
      const circuitBreaker = global.circuitBreakers.get(
        "certificate_generator"
      );
      if (!circuitBreaker.isOpen) {
        logger.warn("Opening circuit breaker due to memory pressure");
        circuitBreaker.isOpen = true;
        circuitBreaker.resetTime = Date.now() + circuitBreaker.resetTimeout;
      }
    }
  }
}

// Create singleton instance with default settings
const memoryMonitor = new MemoryMonitor();

module.exports = {
  MemoryMonitor,
  memoryMonitor, // Export the singleton for easy use
};
