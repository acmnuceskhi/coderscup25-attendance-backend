/**
 * Load test script for certificate generation
 * Run with: node scripts/load-test-certificates.js [mode]
 * Modes: 
 *   normal - standard load test (default)
 *   stress - high concurrency stress test
 *   burst - simulates sudden bursts of traffic
 */
const fs = require('fs');
const path = require('path');
const { 
  generateCertificateBuffer, 
  generateTeamCertificateBuffers 
} = require('../utils/certificateGenerator');
const logger = require('../utils/logger')('LoadTest');

// Get test mode from command line
const testMode = process.argv[2] || 'normal';

// Configure test based on mode
let config = {
  // Output directory for test results
  outputDir: path.join(__dirname, '../test-output/load-test'),
  
  // Save generated certificates
  saveCertificates: false,
  
  // Whether to run team certificate test
  testTeamCertificates: true
};

// Test configurations for different modes
const testConfigs = {
  normal: {
    // Number of certificates to generate in parallel
    concurrentRequests: 5,
    
    // Total number of certificates to generate
    totalCertificates: 50,
    
    // Delay between batches in ms
    delayBetweenBatches: 500,
    
    // Team sizes to test
    teamSizes: [1, 2, 3, 5]
  },
  
  stress: {
    // High concurrency for stress testing
    concurrentRequests: 20,
    
    // More certificates to test system limits
    totalCertificates: 100,
    
    // No delay between batches to maximize pressure
    delayBetweenBatches: 0,
    
    // Test larger teams
    teamSizes: [5, 10]
  },
  
  burst: {
    // Initial baseline concurrency
    concurrentRequests: 5,
    
    // Total certificates to generate
    totalCertificates: 150,
    
    // Variable delay between batches
    delayBetweenBatches: 1000,
    
    // Sudden burst settings
    burstConcurrency: 30,
    burstDuration: 3, // How many batches to maintain the burst
    burstStart: 5, // Start burst after this many batches
    
    // Team sizes to test
    teamSizes: [3, 8]
  }
};

// Apply selected configuration
config = { ...config, ...testConfigs[testMode] || testConfigs.normal };

logger.info(`Running certificate load test in ${testMode.toUpperCase()} mode`);

// Create output directory if it doesn't exist
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
}

// Random name generator
function generateRandomName() {
  const firstNames = [
    'John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 
    'Mohammed', 'Sarah', 'David', 'Maria', 'Ahmed', 'Priya', 
    'Zainab', 'Omar', 'Fatima', 'Abdul', 'Chen', 'Li', 'Mei'
  ];
  
  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Khan', 'Singh', 'Patel',
    'Kim', 'Lee', 'Wang', 'Garcia', 'Martinez', 'Rodriguez',
    'Ali', 'Hassan', 'Ibrahim', 'Kamau', 'Okafor', 'Nkosi'
  ];
  
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

// Random competition generator
function generateRandomCompetition() {
  const competitions = [
    'Web Development', 'App Development', 'Game Development', 
    'UI/UX Design', 'Blockchain', 'Artificial Intelligence',
    'Machine Learning', 'Cloud Computing', 'Cybersecurity Challenge'
  ];
  
  return competitions[Math.floor(Math.random() * competitions.length)];
}

// Run single certificate generation test
async function testSingleCertificate(id) {
  const name = generateRandomName();
  const competition = generateRandomCompetition();
  
  logger.info(`[${id}] Generating certificate for ${name}`);
  const startTime = Date.now();
  
  try {
    const buffer = await generateCertificateBuffer(name, competition);
    const endTime = Date.now();
    
    logger.success(`[${id}] Certificate for ${name} generated in ${endTime - startTime}ms (${Math.round(buffer.length / 1024)} KB)`);
    
    if (config.saveCertificates) {
      const filePath = path.join(config.outputDir, `certificate_${id}.pdf`);
      fs.writeFileSync(filePath, buffer);
    }
    
    return {
      success: true,
      time: endTime - startTime,
      size: buffer.length,
      name,
      competition
    };
  } catch (err) {
    const endTime = Date.now();
    logger.error(`[${id}] Failed for ${name}: ${err.message}`);
    
    return {
      success: false,
      time: endTime - startTime,
      error: err.message,
      name,
      competition
    };
  }
}

// Run team certificate generation test
async function testTeamCertificates(teamSize, id) {
  const members = Array(teamSize).fill().map(() => generateRandomName());
  const competition = generateRandomCompetition();
  const teamName = `Team ${id}`;
  
  logger.info(`[${id}] Generating ${teamSize} certificates for ${teamName}`);
  const startTime = Date.now();
  
  try {
    const certificates = await generateTeamCertificateBuffers(members, competition, teamName);
    const endTime = Date.now();
    
    const totalSize = certificates.reduce((sum, cert) => sum + cert.buffer.length, 0);
    logger.success(`[${id}] ${certificates.length} certificates for ${teamName} generated in ${endTime - startTime}ms (${Math.round(totalSize / 1024)} KB)`);
    
    if (config.saveCertificates) {
      certificates.forEach((cert, i) => {
        const filePath = path.join(config.outputDir, `team_${id}_member_${i}.pdf`);
        fs.writeFileSync(filePath, cert.buffer);
      });
    }
    
    return {
      success: true,
      time: endTime - startTime,
      totalSize,
      certificateCount: certificates.length,
      teamName,
      competition
    };
  } catch (err) {
    const endTime = Date.now();
    logger.error(`[${id}] Team ${teamName} failed: ${err.message}`);
    
    return {
      success: false,
      time: endTime - startTime,
      error: err.message,
      teamName,
      competition
    };
  }
}

// Run load test
async function runLoadTest() {
  logger.info('=== Starting Certificate Generator Load Test ===');
  logger.info(`Mode: ${testMode.toUpperCase()}`);
  logger.info(`Concurrent requests: ${config.concurrentRequests}${testMode === 'burst' ? ` (Burst: ${config.burstConcurrency})` : ''}`);
  logger.info(`Total certificates: ${config.totalCertificates}`);
  
  const startTime = Date.now();
  const results = [];
  
  // Process in batches
  let batchIndex = 0;
  for (let i = 0; i < config.totalCertificates;) {
    // Determine current batch concurrency (for burst mode)
    let currentConcurrency = config.concurrentRequests;
    
    // In burst mode, apply high concurrency during burst period
    if (testMode === 'burst') {
      const isBurstPeriod = batchIndex >= config.burstStart && 
                            batchIndex < (config.burstStart + config.burstDuration);
      
      if (isBurstPeriod) {
        currentConcurrency = config.burstConcurrency;
        logger.warn(`BURST MODE ACTIVE - Processing ${currentConcurrency} concurrent requests`);
      }
    }
    
    // Process the current batch
    const batch = [];
    const count = Math.min(currentConcurrency, config.totalCertificates - i);
    
    // Record memory usage before batch
    const beforeMemory = process.memoryUsage();
    
    // Start batch timer
    const batchStartTime = Date.now();
    
    for (let j = 0; j < count; j++) {
      batch.push(testSingleCertificate(i + j + 1));
    }
    
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    
    // Update counter and batch index
    i += count;
    batchIndex++;
    
    // Record batch performance metrics
    const batchEndTime = Date.now();
    const batchTime = batchEndTime - batchStartTime;
    const afterMemory = process.memoryUsage();
    const memoryChange = {
      rss: (afterMemory.rss - beforeMemory.rss) / 1024 / 1024,
      heapTotal: (afterMemory.heapTotal - beforeMemory.heapTotal) / 1024 / 1024,
      heapUsed: (afterMemory.heapUsed - beforeMemory.heapUsed) / 1024 / 1024
    };
    
    // Log batch performance data
    const batchSuccessful = batchResults.filter(r => r.success).length;
    logger.info(`Batch ${batchIndex}: ${batchSuccessful}/${count} certificates in ${batchTime}ms (${(count / (batchTime/1000)).toFixed(2)}/sec)`);
    logger.debug(`Memory change: RSS: ${memoryChange.rss.toFixed(2)}MB, Heap: ${memoryChange.heapUsed.toFixed(2)}MB`);
    
    // Add delay between batches
    if (i < config.totalCertificates) {
      // In burst mode, we might want different delays before/after/during burst
      let currentDelay = config.delayBetweenBatches;
      
      if (testMode === 'burst') {
        // Just finished a burst period, add longer recovery time
        if (batchIndex === config.burstStart + config.burstDuration) {
          currentDelay = config.delayBetweenBatches * 2;
          logger.info(`Burst complete - adding recovery period (${currentDelay}ms)`);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, currentDelay));
    }
  }
  
  // Run team certificate tests
  const teamResults = [];
  if (config.testTeamCertificates) {
    logger.info('=== Starting Team Certificate Tests ===');
    
    for (const teamSize of config.teamSizes) {
      const result = await testTeamCertificates(teamSize, teamSize);
      teamResults.push(result);
      
      // Add delay between team tests
      await new Promise(resolve => setTimeout(resolve, config.delayBetweenBatches));
    }
  }
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  // Analyze results
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  const averageTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
  const averageSize = results.filter(r => r.success).reduce((sum, r) => sum + r.size, 0) / successful;
  
  // Analyze peak performance
  // Group results into batches to identify peak load periods
  const batchedResults = [];
  for (let i = 0; i < results.length; i += config.concurrentRequests) {
    const batchEnd = Math.min(i + config.concurrentRequests, results.length);
    const batchResults = results.slice(i, batchEnd);
    batchedResults.push(batchResults);
  }
  
  // Calculate peak processing time
  const batchTimes = batchedResults.map(batch => {
    const batchStartTime = Math.min(...batch.map(r => r.startTime || 0));
    const batchEndTime = Math.max(...batch.map(r => (r.startTime || 0) + r.time));
    return batchEndTime - batchStartTime;
  });
  
  const peakLoad = {
    batchSize: config.concurrentRequests,
    maxBatchTime: Math.max(...batchTimes),
    averageBatchTime: batchTimes.reduce((sum, time) => sum + time, 0) / batchTimes.length
  };
  
  // Create report
  const report = {
    timestamp: new Date().toISOString(),
    testMode,
    configuration: config,
    summary: {
      totalTime,
      totalCertificates: results.length,
      successful,
      failed,
      successRate: `${(successful / results.length * 100).toFixed(2)}%`,
      averageTimeMs: averageTime.toFixed(2),
      averageSizeKB: (averageSize / 1024).toFixed(2),
      certificatesPerSecond: (successful / (totalTime / 1000)).toFixed(2),
      peakLoad
    },
    teamTests: teamResults.map(r => ({
      teamName: r.teamName,
      members: r.certificateCount,
      success: r.success,
      timeMs: r.time,
      averageTimePerCertificate: r.success ? (r.time / r.certificateCount).toFixed(2) : 'N/A'
    }))
  };
  
  // Save report
  const reportPath = path.join(config.outputDir, `load-test-report-${testMode}-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Print summary
  logger.info('=== Load Test Complete ===');
  logger.info(`Test mode: ${testMode.toUpperCase()}`);
  logger.info(`Total time: ${totalTime}ms`);
  logger.info(`Success rate: ${report.summary.successRate} (${successful}/${results.length})`);
  logger.info(`Average time per certificate: ${report.summary.averageTimeMs}ms`);
  logger.info(`Certificates per second: ${report.summary.certificatesPerSecond}`);
  if (testMode === 'burst') {
    logger.info(`Peak load handled: ${config.burstConcurrency} concurrent requests`);
  }
  logger.info(`Report saved to: ${reportPath}`);
  
  return report;
}

// Execute the load test if this file is being run directly
if (require.main === module) {
  runLoadTest()
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      logger.error(`Load test failed: ${err.message}`);
      process.exit(1);
    });
}

// Export functions for use by other modules
module.exports = {
  runLoadTest,
  testSingleCertificate,
  testTeamCertificates
};
