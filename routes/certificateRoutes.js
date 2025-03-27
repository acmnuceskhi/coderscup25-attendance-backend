const fs = require("fs");
const path = require("path");
const express = require("express");
const crypto = require("crypto");
const { DevDayAttendance, Event } = require("../models/Models");
const {
  generateTeamCertificateBuffers,
} = require("../utils/certificateGenerator");

const router = express.Router();

// log file setup
const logFilePath = path.join(__dirname, "../logs/certificateRoutes.log");
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

// in-memory storage for certificates with TTL (5 minutes)
const certificateStore = new Map();
const CERTIFICATE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// clean expired certificates periodically (every minute)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [token, cert] of certificateStore.entries()) {
    if (now > cert.expiry) {
      certificateStore.delete(token);
    }
  }
}, 60000);

// generate secure token for certificate access
function generateSecureToken() {
  return crypto.randomBytes(16).toString("hex");
}

// certificate generation endpoint
router.post("/", async (req, res) => {
  try {
    logMessage("Received certificate generation request");
    const { att_code } = req.body;

    if (!att_code) {
      logMessage("ERROR: Attendance code is missing in request");
      return res.status(400).json({ message: "Attendance code is required" });
    }

    logMessage(`fetching team data for attendance code: ${att_code}`);
    const team = await DevDayAttendance.findOne({ att_code: att_code });
    if (!team) {
      logMessage(`ERROR: Team not found for attendance code: ${att_code}`);
      return res.status(404).json({ message: "Team not found" });
    }

    // verify attendance status
    if (!team.attendance) {
      return res.status(400).json({
        message: "Certificate unavailable: Attendance was not marked",
      });
    }

    // retrieve event details
    const event = await Event.findOne({ competitionName: team.Competition });
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // verify event has concluded
    const now = new Date();
    if (now <= event.end_time) {
      return res.status(400).json({
        message: "Certificates are only available after the event has ended",
      });
    }

    // collect team member names
    const members = [team.Leader_name];
    if (team.mem1_name) members.push(team.mem1_name);
    if (team.mem2_name) members.push(team.mem2_name);
    if (team.mem3_name) members.push(team.mem3_name);
    if (team.mem4_name) members.push(team.mem4_name);

    logMessage(`Generating certificates for team: ${team.Team_Name}`);
    // generate certificates in memory
    const certificates = await generateTeamCertificateBuffers(
      members,
      team.Competition,
      team.Team_Name
    );

    logMessage(
      `Certificates generated successfully for team: ${team.Team_Name}`
    );
    // store certificates with tokens and prepare response
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

    // prepare certificate data for response
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
    logMessage(`Error during certificate generation: ${err.message}`);
    return res.status(500).json({ message: "Error generating certificate" });
  }
});

// download certificate endpoint (updated to use direct buffer sending)
router.get("/download/:token", (req, res) => {
  const { token } = req.params;
  logMessage(`Received certificate download request for token: ${token}`);

  if (!certificateStore.has(token)) {
    logMessage(`ERROR: Certificate not found or expired for token: ${token}`);
    return res
      .status(404)
      .json({ message: "Certificate not found or expired" });
  }

  const certificate = certificateStore.get(token);
  logMessage(`Sending certificate for token: ${token}`);

  // set appropriate headers
  res.setHeader("Content-Type", certificate.contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${certificate.filename}"`
  );
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  // directly send the buffer to the client
  res.end(certificate.buffer);
});

module.exports = router;
// export the interval ID for testing purposes
module.exports.cleanupInterval = cleanupInterval;
