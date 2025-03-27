const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { Readable } = require("stream");

// log file setup
const logFilePath = path.join(__dirname, "../logs/certificateGenerator.log");
if (!fs.existsSync(path.dirname(logFilePath))) {
  fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
}
if (!fs.existsSync(logFilePath)) {
  fs.writeFileSync(logFilePath, ""); // create an empty log file if it doesn't exist
}

function logMessage(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  fs.appendFileSync(logFilePath, formattedMessage + "\n");
}

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
      logMessage(`Starting certificate generation for: ${name}`);
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
        logMessage(`Certificate generated successfully for: ${name}`);
        resolve(Buffer.concat(chunks));
      });
      doc.on("error", (err) => {
        logMessage(`Error generating certificate for ${name}: ${err.message}`);
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
      logMessage(
        `Unexpected error during certificate generation: ${err.message}`
      );
      reject(err);
    }
  });
}

/**
 * Create a readable stream from a certificate buffer
 * @param {Buffer} buffer - Certificate PDF buffer
 * @returns {Readable} - Readable stream
 */
function createCertificateStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
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
  logMessage(`Generating certificates for team: ${teamName}`);
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
      logMessage(
        `Failed to generate certificate for ${member}: ${err.message}`
      );
    }
  }

  logMessage(`Completed certificate generation for team: ${teamName}`);
  return certificates;
}

module.exports = {
  generateCertificateBuffer,
  generateTeamCertificateBuffers,
  createCertificateStream,
};
