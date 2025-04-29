const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const logger = require("./logger")("CertGenerator");

/**
 * generate a PDF certificate in memory
 * @param {string} name - recipient name
 * @param {string} competition - competition name
 * @param {string} teamName - team name (for metadata)
 * @returns {Promise<Buffer>} - PDF buffer
 */
function generateCertificateBuffer(name, competition, teamName = "") {
  return new Promise((resolve, reject) => {
    try {
      logger.info(`Processing certificate for ${logger.val(name)}`);
      // set dimensions (8in × 6.3in converted to points - 72pts per inch)
      const width = 8 * 72; // 576 points
      const height = 6.3 * 72; // 453.6 points

      // create PDF document
      const doc = new PDFDocument({
        size: [width, height],
        margin: 0,
        dpi: 365,
        info: {
          Title: `Certificate of Participation - ${name}`,
          Author: "DevDay 2025",
          Subject: `${teamName} - ${competition}`,
        },
        bufferPages: true,
      });

      // create buffer chunks to store PDF data
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        logger.debug(`Certificate PDF created for ${logger.val(name)}`);
        resolve(Buffer.concat(chunks));
      });
      doc.on("error", (err) => {
        logger.error(
          `PDF creation failed for ${logger.val(name)}: ${err.message}`
        );
        reject(err);
      });

      // add background image
      const imagePath = path.join(
        __dirname,
        "../assets/certificateDesign2025.png"
      );
      doc.image(imagePath, 0, 0, { width, height });

      // register fonts
      doc.font(path.join(__dirname, "../assets/fonts/Birthstone-Regular.ttf"));

      // position for recipient name
      doc
        .fontSize(58.1)
        .fillColor("#8b0d11")
        .text(name, 1 * 72, 2 * 72, {
          width: 5 * 72,
          align: "center",
        });

      // position for competition name
      doc.fontSize(33.5).text(competition, 1.3 * 72, 2.9 * 72, {
        width: 4.1 * 72,
        align: "center",
      });

      // finalize PDF
      doc.end();
    } catch (err) {
      logger.error(`Unexpected error: ${err.message}`);
      reject(err);
    }
  });
}

/**
 * generate certificates for multiple team members
 * @param {Array<string>} members - array of member names
 * @param {string} competition - competition name
 * @param {string} teamName - team name for metadata
 * @returns {Promise<Array<{name: string, buffer: Buffer}>>} - named certificate buffers
 */
async function generateTeamCertificateBuffers(
  members,
  competition,
  teamName = ""
) {
  logger.info(
    `Processing ${logger.val(teamName)} with ${logger.val(
      members.length
    )} members`
  );
  const certificates = [];

  for (const member of members) {
    try {
      const buffer = await generateCertificateBuffer(
        member,
        competition,
        teamName
      );
      certificates.push({
        name: member,
        buffer: buffer,
      });
    } catch (err) {
      logger.error(
        `Failed certificate for ${logger.val(member)}: ${err.message}`
      );
    }
  }

  logger.info(
    `Completed PDF generation for ${logger.val(
      certificates.length
    )} certificates`
  );
  return certificates;
}

/**
 * Save a certificate to a file for testing positioning
 * @param {string} name - recipient name
 * @param {string} competition - competition name
 * @param {string} outputPath - path where to save the certificate
 * @returns {Promise<string>} - path to the saved file
 */
async function saveCertificateForTesting(name, competition, outputPath) {
  try {
    const buffer = await generateCertificateBuffer(name, competition);
    const filePath = path.join(
      outputPath,
      `certificate_test_${Date.now()}.pdf`
    );

    fs.writeFileSync(filePath, buffer);
    logger.info(`Test certificate saved to ${logger.val(filePath)}`);

    return filePath;
  } catch (err) {
    logger.error(`Failed to save test certificate: ${err.message}`);
    throw err;
  }
}

module.exports = {
  generateCertificateBuffer,
  generateTeamCertificateBuffers,
  saveCertificateForTesting,
};
