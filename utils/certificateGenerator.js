const path = require("path");
const PDFDocument = require("pdfkit");
const { Readable } = require("stream");

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
      // Set dimensions (8in × 6.3in converted to points - 72pts per inch)
      const width = 8 * 72; // 576 points
      const height = 6.3 * 72; // 453.6 points

      // Create PDF document
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

      // Create buffer chunks to store PDF data
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Add background image
      const imagePath = path.join(__dirname, "../assets/certificateDesign.jpg");
      doc.image(imagePath, 0, 0, { width, height });

      // Calculate font size based on competition length
      let fontSize = 26.64; // 0.37in in points
      if (competition.length > 19) {
        fontSize = 23.76; // 0.33in in points
      }

      // Register fonts
      doc.font(
        path.join(__dirname, "../assets/fonts/PlayfairDisplay-Italic.ttf")
      );

      // Position for recipient name
      doc
        .fontSize(26.64)
        .fillColor("rgba(0, 0, 0, 0.863)")
        .text(name, 3.1 * 72, 2.65 * 72, {
          width: 4.4 * 72,
          align: "center",
        });

      // Position for competition name
      doc.fontSize(fontSize).text(competition, 4 * 72, 3.3 * 72, {
        width: 4.1 * 72,
        align: "center",
      });

      // Finalize PDF
      doc.end();
    } catch (err) {
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
  const certificates = [];

  for (const member of members) {
    const buffer = await generateCertificateBuffer(
      member,
      competition,
      teamName
    );
    certificates.push({
      name: member,
      buffer: buffer,
    });
  }

  return certificates;
}

// Legacy function for backward compatibility
function generateCertificate(
  name,
  competition,
  teamName = "",
  outputPath = null
) {
  console.warn("Warning: Using deprecated file-based certificate generation");
  const fs = require("fs");
  return new Promise((resolve, reject) => {
    generateCertificateBuffer(name, competition, teamName)
      .then((buffer) => {
        const sanitizedName = name.replace(/\s+/g, "-");
        const sanitizedTeam = teamName.replace(/\s+/g, "-");
        const certificateFile =
          outputPath ||
          path.join(
            __dirname,
            `../certificates/${sanitizedName}-${sanitizedTeam}-Certificate-DevDay25.pdf`
          );

        // Ensure directory exists
        const dir = path.dirname(certificateFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFile(certificateFile, buffer, (err) => {
          if (err) reject(err);
          else resolve(certificateFile);
        });
      })
      .catch(reject);
  });
}

// Legacy function for backward compatibility
async function generateTeamCertificates(members, competition, teamName = "") {
  console.warn(
    "Warning: Using deprecated file-based team certificate generation"
  );
  const certificatePaths = [];

  for (const member of members) {
    const path = await generateCertificate(member, competition, teamName);
    certificatePaths.push(path);
  }

  return certificatePaths;
}

module.exports = {
  generateCertificateBuffer,
  generateTeamCertificateBuffers,
  createCertificateStream,
  // Legacy exports
  generateCertificate,
  generateTeamCertificates,
};
