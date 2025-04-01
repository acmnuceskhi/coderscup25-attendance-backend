const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const logger = require("./logger")("CertGenerator");

/**
 * Generate a PDF certificate in memory
 * @param {string} name - Recipient name
 * @param {string} competition - Competition name
 * @param {string} teamName - Team name (for metadata)
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
      const imagePath = path.join(__dirname, "../assets/certificateDesign.jpg");
      doc.image(imagePath, 0, 0, { width, height });

      // calculate font size based on competition length
      let fontSize = 26.64; // 0.37in in points
      if (competition.length > 19) {
        fontSize = 23.76; // 0.33in in points
      }

      // register fonts
      doc.font(
        path.join(__dirname, "../assets/fonts/PlayfairDisplay-Italic.ttf")
      );

      // position for recipient name
      doc
        .fontSize(26.64)
        .fillColor("rgba(0, 0, 0, 0.863)")
        .text(name, 3.1 * 72, 2.65 * 72, {
          width: 4.4 * 72,
          align: "center",
        });

      // position for competition name
      doc.fontSize(fontSize).text(competition, 4 * 72, 3.3 * 72, {
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
 * Generate certificates for multiple team members
 * @param {Array<string>} members - Array of member names
 * @param {string} competition - Competition name
 * @param {string} teamName - Team name for metadata
 * @returns {Promise<Array<{name: string, buffer: Buffer}>>} - Named certificate buffers
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

module.exports = {
  generateCertificateBuffer,
  generateTeamCertificateBuffers,
};
