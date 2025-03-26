const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

/**
 * Generate a PDF certificate
 * @param {string} name - Recipient name
 * @param {string} competition - Competition name
 * @param {string} outputPath - Optional custom output path
 * @returns {Promise<string>} - Path to generated PDF file
 */
function generateCertificate(name, competition, outputPath = null) {
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
        },
      });

      // Set output file path
      const certificateFile =
        outputPath ||
        path.join(__dirname, `../certificates/certificate-${Date.now()}.pdf`);

      // Ensure directory exists
      const dir = path.dirname(certificateFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const stream = fs.createWriteStream(certificateFile);

      // Pipe PDF to file
      doc.pipe(stream);

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

      // Return path when complete
      stream.on("finish", () => {
        resolve(certificateFile);
      });

      stream.on("error", (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate certificates for multiple team members
 * @param {Array<string>} members - Array of member names
 * @param {string} competition - Competition name
 * @returns {Promise<Array<string>>} - Paths to generated PDF files
 */
async function generateTeamCertificates(members, competition) {
  const certificatePaths = [];

  for (const member of members) {
    const path = await generateCertificate(member, competition);
    certificatePaths.push(path);
  }

  return certificatePaths;
}

module.exports = {
  generateCertificate,
  generateTeamCertificates,
};
