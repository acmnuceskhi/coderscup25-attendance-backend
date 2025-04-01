const fs = require("fs");
const path = require("path");
const express = require("express");
const crypto = require("crypto");
const { DevDayAttendance, Event } = require("../models/Models");
const {
  generateTeamCertificateBuffers,
} = require("../utils/certificateGenerator");
const logger = require("../utils/logger")("CertRoutes");

const router = express.Router();

// in-memory storage for certificates with TTL (1 minute)
const certificateStore = new Map();
const CERTIFICATE_TTL = 1 * 60 * 1000; // 1 minute in milliseconds

// clean expired certificates periodically (every 15 seconds)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let expiredCount = 0;

  for (const [token, cert] of certificateStore.entries()) {
    if (now > cert.expiry) {
      certificateStore.delete(token);
      expiredCount++;
    }
  }

  if (expiredCount > 0) {
    logger.info(`Cleaned up ${logger.val(expiredCount)} expired certificates`);
  }
}, 15000);

// generate secure token for certificate access
function generateSecureToken() {
  return crypto.randomBytes(16).toString("hex");
}

// certificate generation endpoint
router.post("/", async (req, res) => {
  try {
    logger.info(`Certificate request received`);
    const { att_code } = req.body;

    if (!att_code) {
      logger.error(`Missing attendance code`);
      return res.status(400).json({ message: "Attendance code is required" });
    }

    logger.info(`Looking up team with code ${logger.val(att_code)}`);
    const team = await DevDayAttendance.findOne({ att_code: att_code });
    if (!team) {
      logger.error(`Team not found with code ${logger.val(att_code)}`);
      return res.status(404).json({ message: "Team not found" });
    }

    // verify attendance status
    if (!team.attendance) {
      logger.warn(
        `Request denied: ${logger.val(team.Team_Name)} has no attendance record`
      );
      return res.status(400).json({
        message: "Certificate unavailable: Attendance was not marked",
      });
    }

    // retrieve event details
    const event = await Event.findOne({ competitionName: team.Competition });
    if (!event) {
      logger.error(`Competition ${logger.val(team.Competition)} not found`);
      return res.status(404).json({ message: "Event not found" });
    }

    // verify event has concluded
    const now = new Date();
    if (now <= event.end_time) {
      logger.warn(
        `Request denied: ${logger.val(team.Competition)} hasn't ended yet`
      );
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

    logger.info(
      `Requesting ${logger.val(
        members.length
      )} certificates for team ${logger.val(team.Team_Name)}`
    );

    // generate certificates in memory
    const certificates = await generateTeamCertificateBuffers(
      members,
      team.Competition,
      team.Team_Name
    );

    logger.success(
      `${logger.val(team.Team_Name)}: ${logger.val(
        certificates.length
      )} certificates ready`
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
    logger.error(`Error processing certificate request: ${err.message}`);
    return res.status(500).json({ message: "Error generating certificate" });
  }
});

// download certificate endpoint
router.get("/download/:token", (req, res) => {
  const { token } = req.params;
  const tokenPreview = token.substring(0, 8);
  logger.info(`Download requested with token ${logger.val(tokenPreview)}...`);

  if (!certificateStore.has(token)) {
    logger.error(
      `Invalid token ${logger.val(tokenPreview)}... - certificate not found`
    );
    return res
      .status(404)
      .json({ message: "Certificate not found or expired" });
  }

  const certificate = certificateStore.get(token);
  logger.success(`Delivering certificate for ${logger.val(certificate.name)}`);

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
