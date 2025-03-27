const express = require("express");
const crypto = require("crypto");
const { DevDayAttendance, Event } = require("../models/Models");
const {
  generateTeamCertificateBuffers,
  createCertificateStream,
} = require("../utils/certificateGenerator");

const router = express.Router();

// In-memory storage for certificates with TTL (5 minutes)
const certificateStore = new Map();
const CERTIFICATE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Clean expired certificates periodically (every minute)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [token, cert] of certificateStore.entries()) {
    if (now > cert.expiry) {
      certificateStore.delete(token);
    }
  }
}, 60000);

// Generate secure token for certificate access
function generateSecureToken() {
  return crypto.randomBytes(16).toString("hex");
}

// Certificate generation endpoint
router.post("/", async (req, res) => {
  try {
    const { att_code } = req.body;

    if (!att_code) {
      return res.status(400).json({ message: "Attendance code is required" });
    }

    // Retrieve team data
    const team = await DevDayAttendance.findOne({ att_code: att_code });
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Verify attendance status
    if (!team.attendance) {
      return res.status(400).json({
        message: "Certificate unavailable: Attendance was not marked",
      });
    }

    // Retrieve event details
    const event = await Event.findOne({ competitionName: team.Competition });
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Verify event has concluded
    const now = new Date();
    if (now <= event.end_time) {
      return res.status(400).json({
        message: "Certificates are only available after the event has ended",
      });
    }

    // Collect team member names
    const members = [team.Leader_name];
    if (team.mem1_name) members.push(team.mem1_name);
    if (team.mem2_name) members.push(team.mem2_name);
    if (team.mem3_name) members.push(team.mem3_name);
    if (team.mem4_name) members.push(team.mem4_name);

    // Generate certificates in memory
    const certificates = await generateTeamCertificateBuffers(
      members,
      team.Competition,
      team.Team_Name
    );

    // Store certificates with tokens and prepare response
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

    // Prepare certificate data for response
    const certificateData = {
      teamName: team.Team_Name,
      consumerNumber: team.consumerNumber,
      members: members,
      competition: team.Competition,
      eventDate: event.start_time,
    };

    return res.json({
      message: "Certificate generated successfully",
      certificateData,
      downloadTokens,
    });
  } catch (err) {
    console.error("Certificate generation error:", err);
    return res.status(500).json({ message: "Error generating certificate" });
  }
});

// Stream certificate endpoint
router.get("/download/:token", (req, res) => {
  const { token } = req.params;

  if (!certificateStore.has(token)) {
    return res
      .status(404)
      .json({ message: "Certificate not found or expired" });
  }

  const certificate = certificateStore.get(token);

  // Set appropriate headers
  res.setHeader("Content-Type", certificate.contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${certificate.filename}"`
  );
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  // Stream the certificate to the client
  const stream = createCertificateStream(certificate.buffer);
  stream.pipe(res);
});

module.exports = router;
// Export the interval ID for testing purposes
module.exports.cleanupInterval = cleanupInterval;
