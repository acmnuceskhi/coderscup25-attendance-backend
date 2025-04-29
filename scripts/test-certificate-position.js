/**
 * Test script for certificate text positioning
 *
 * Run with: node scripts/test-certificate-position.js
 */

const path = require("path");
const { saveCertificateForTesting } = require("../utils/certificateGenerator");

// Directory where test certificates will be saved
const outputDir = path.join(__dirname, "../test-output");
const fs = require("fs");

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function runTest() {
  try {
    // Test different name lengths to see positioning
    const testCases = [
      {
        name: "Tehreem Ali Khan",
        competition: "Math Olympiad Competition",
      },
      {
        name: "Syed Abdullah Bin Tariq",
        competition: "Fyfy Gjgjgj",
      },
      {
        name: "Syed Abdullah Bin Tariq",
        competition: "Fix Fast",
      },
    ];

    console.log("Generating test certificates...");

    for (const testCase of testCases) {
      const filePath = await saveCertificateForTesting(
        testCase.name,
        testCase.competition,
        outputDir
      );

      console.log(
        `Generated certificate with name "${testCase.name}" and competition "${testCase.competition}"`
      );
      console.log(`Saved to: ${filePath}`);
      console.log("-".repeat(50));
    }

    console.log(`\nAll test certificates saved to: ${outputDir}`);
    console.log(
      "Open these files to check text positioning and make adjustments to the certificate generator as needed."
    );
  } catch (error) {
    console.error("Error generating test certificates:", error);
  }
}

runTest();
