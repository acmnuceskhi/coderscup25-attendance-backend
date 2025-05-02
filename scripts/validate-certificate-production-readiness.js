#!/usr/bin/env node
/**
 * Certificate generator production readiness validator
 * Run with: node scripts/validate-certificate-production-readiness.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { memoryMonitor } = require("../utils/memoryMonitor");
const logger = require("../utils/logger")("ProdValidator");

// Configure validation
const config = {
  runUnitTests: true,
  runLoadTests: true,
  validateResources: true,
  validateEnvironment: true,
  generateReport: true,
  outputDir: path.join(__dirname, "../test-output/validation"),
};

// Create output directory if it doesn't exist
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
}

/**
 * Run a command and return its output
 * @param {string} command Command to run
 * @param {boolean} ignoreErrors Whether to ignore errors
 * @returns {string} Command output
 */
function runCommand(command, ignoreErrors = false) {
  try {
    return execSync(command, { encoding: "utf8" });
  } catch (err) {
    if (ignoreErrors) {
      return err.stdout || "";
    }
    throw err;
  }
}

/**
 * Validate that all required resources exist
 */
function validateResources() {
  logger.info("Validating certificate resources...");

  const results = {
    templates: [],
    fonts: [],
    isValid: true,
  };

  // Check certificate templates
  const templateFiles = [
    {
      name: "Primary Template",
      path: path.join(__dirname, "../assets/certificateDesign2025.png"),
    },
    {
      name: "Fallback Template",
      path: path.join(__dirname, "../assets/certificateDesign1.png"),
    },
  ];

  for (const template of templateFiles) {
    const exists = fs.existsSync(template.path);
    results.templates.push({
      name: template.name,
      path: template.path,
      exists,
    });

    if (!exists) {
      results.isValid = false;
    }
  }

  // Check font files
  const fontFiles = [
    {
      name: "Birthstone",
      path: path.join(__dirname, "../assets/fonts/Birthstone-Regular.ttf"),
    },
  ];

  for (const font of fontFiles) {
    const exists = fs.existsSync(font.path);
    results.fonts.push({
      name: font.name,
      path: font.path,
      exists,
    });

    if (!exists) {
      results.isValid = false;
    }
  }

  if (results.isValid) {
    logger.success("All certificate resources are available");
  } else {
    logger.error("Some certificate resources are missing");
  }

  return results;
}

/**
 * Check environment settings
 */
function validateEnvironment() {
  logger.info("Validating environment settings...");

  const results = {
    node: {},
    dependencies: {},
    isValid: true,
  };

  // Check Node.js version
  const nodeVersion = process.version;
  const nodeVersionOk =
    nodeVersion.startsWith("v14") ||
    nodeVersion.startsWith("v16") ||
    nodeVersion.startsWith("v18") ||
    nodeVersion.startsWith("v20") ||
    nodeVersion.startsWith("v22");

  results.node = {
    version: nodeVersion,
    isValid: nodeVersionOk,
  };

  if (!nodeVersionOk) {
    results.isValid = false;
  }

  // Check required dependencies
  const requiredDeps = ["pdfkit"];

  for (const dep of requiredDeps) {
    try {
      const version = require(`${dep}/package.json`).version;
      results.dependencies[dep] = {
        version,
        isValid: true,
      };
    } catch (err) {
      results.dependencies[dep] = {
        version: null,
        isValid: false,
        error: err.message,
      };
      results.isValid = false;
    }
  }

  // Check memory limits
  const memoryInfo = process.memoryUsage();
  const v8 = require("v8");
  const heapStats = v8.getHeapStatistics();

  results.memory = {
    heapSizeLimitMB: Math.round(heapStats.heap_size_limit / 1024 / 1024),
    isEnough: heapStats.heap_size_limit >= 512 * 1024 * 1024, // At least 512MB
  };

  if (!results.memory.isEnough) {
    results.isValid = false;
  }

  if (results.isValid) {
    logger.success("Environment is valid for certificate generation");
  } else {
    logger.error(
      "Environment has issues that may affect certificate generation"
    );
  }

  return results;
}

/**
 * Run unit tests
 */
async function runUnitTests() {
  logger.info("Running certificate generator unit tests...");

  try {
    // Run the test using Mocha programmatically
    const Mocha = require("mocha");
    const mocha = new Mocha({
      reporter: "spec",
      timeout: 10000,
    });

    // Add the test file
    mocha.addFile(
      path.join(__dirname, "../utils/certificateGenerator.test.js")
    );

    // Run the tests
    return new Promise((resolve) => {
      mocha.run((failures) => {
        const result = {
          success: failures === 0,
          failures,
        };

        if (result.success) {
          logger.success("All certificate generator unit tests passed");
        } else {
          logger.error(
            `Certificate generator tests failed with ${failures} failures`
          );
        }

        resolve(result);
      });
    });
  } catch (err) {
    logger.error(`Error running tests: ${err.message}`);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Run load tests
 */
async function runLoadTests() {
  logger.info("Running certificate generator load tests...");

  try {
    // Execute the load test script
    const { runLoadTest } = require("./load-test-certificates");
    const report = await runLoadTest();

    return {
      success: report.summary.failed === 0,
      report,
    };
  } catch (err) {
    logger.error(`Error running load tests: ${err.message}`);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Validate certificate generator for production use
 */
async function validateProductionReadiness() {
  logger.info("=== Validating Certificate Generator Production Readiness ===");
  const startTime = Date.now();

  const results = {
    timestamp: new Date().toISOString(),
    resourceValidation: null,
    environmentValidation: null,
    unitTests: null,
    loadTests: null,
    isProductionReady: true,
  };

  // Validate resources
  if (config.validateResources) {
    results.resourceValidation = validateResources();
    if (!results.resourceValidation.isValid) {
      results.isProductionReady = false;
    }
  }

  // Validate environment
  if (config.validateEnvironment) {
    results.environmentValidation = validateEnvironment();
    if (!results.environmentValidation.isValid) {
      results.isProductionReady = false;
    }
  }

  // Run unit tests
  if (config.runUnitTests) {
    results.unitTests = await runUnitTests();
    if (!results.unitTests.success) {
      results.isProductionReady = false;
    }
  }

  // Run load tests
  if (config.runLoadTests) {
    results.loadTests = await runLoadTests();
    if (!results.loadTests.success) {
      results.isProductionReady = false;
    }
  }

  const endTime = Date.now();
  results.validationTimeMs = endTime - startTime;

  // Generate report
  if (config.generateReport) {
    const reportPath = path.join(
      config.outputDir,
      `production-readiness-${Date.now()}.json`
    );
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    logger.info(`Validation report saved to: ${reportPath}`);
  }

  // Print summary
  logger.info("=== Production Readiness Validation Complete ===");
  logger.info(`Validation time: ${results.validationTimeMs}ms`);

  if (results.isProductionReady) {
    logger.success("✅ CERTIFICATE GENERATOR IS PRODUCTION READY");
  } else {
    logger.error("❌ CERTIFICATE GENERATOR IS NOT PRODUCTION READY");
    logger.error(
      "Review the validation report for details on what needs to be fixed"
    );
  }

  return results;
}

// Run the validation
validateProductionReadiness()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    logger.error(`Validation failed: ${err.message}`);
    process.exit(1);
  });
