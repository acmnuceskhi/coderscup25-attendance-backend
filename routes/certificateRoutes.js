const express = require("express");
// const { DevDayAttendance, Event } = require("../models/Models");
const {
  generateCertificate,
  generateTeamCertificates,
} = require("../utils/certificateGenerator");
const path = require("path");
const fs = require("fs");

const router = express.Router();

//Certificate download {code} --> certificate generate and return
router.get("/:att_code", async (req, res) => {
  try {
    const { att_code } = req.params;

    if (!att_code) {
      return res.status(400).json({ message: "Attendance code is required" });
    }

    // retrieve team data
    // const team = await DevDayAttendance.findOne({ att_code: att_code });
    // if (!team) {
    //   return res.status(404).json({ message: "Team not found" });
    // }

    // hardcoded team data for testing
    let team;
    if (att_code === "valid_att_code") {
      team = {
        att_code: att_code,
        Leader_name: "Asfand Khanzada",
        mem1_name: "Raahim Irfan",
        mem2_name: "Abdullah Azhar Khan",
        mem3_name: "Sarim Ahmed",
        mem4_name: "Kirish Kumar",
        attendance: true,
        Team_Name: "Team Innovators",
        consumerNumber: "789012",
        Competition: "Speed Debugging",
      };
    } else if (att_code === "invalid_att_code") {
      team = {
        att_code: att_code,
        Leader_name: "Asfand Khanzada",
        mem1_name: "Raahim Irfan",
        mem2_name: "Abdullah Azhar Khan",
        mem3_name: "Sarim Ahmed",
        mem4_name: "Kirish Kumar",
        attendance: false,
        Team_Name: "Team Innovators",
        consumerNumber: "789012",
        Competition: "Speed Debugging",
      };
    } else if (att_code === "event_not_concluded") {
      team = {
        att_code: att_code,
        Leader_name: "Asfand Khanzada",
        mem1_name: "Raahim Irfan",
        mem2_name: "Abdullah Azhar Khan",
        mem3_name: "Sarim Ahmed",
        mem4_name: "Kirish Kumar",
        attendance: true,
        Team_Name: "Team Innovators",
        consumerNumber: "789012",
        Competition: "Speed Debugging",
      };
    } else {
      return res.status(404).json({ message: "Team not found" });
    }

    // verify attendance status
    if (!team.attendance) {
      return res.status(400).json({
        message: "Certificate unavailable: Attendance was not marked",
      });
    }

    // retrieve event details
    // const event = await Event.findOne({ competitionName: team.Competition });
    // if (!event) {
    //   return res.status(404).json({ message: "Event not found" });
    // }

    // hardcoded event data for testing
    const event = {
      competitionName: team.Competition,
      start_time: new Date("2025-03-01T09:00:00Z"),
      end_time:
        att_code === "event_not_concluded"
          ? new Date("2025-03-30T17:00:00Z")
          : new Date("2025-03-01T17:00:00Z"),
    };

    // verify event has concluded
    const now = new Date();
    if (now <= event.end_time) {
      return res.status(400).json({
        message: "Certificates are only available after the event has ended",
      });
    }

    // collect team member names
    const members = [team.Leader_name];

    if (team.mem1_name) {
      members.push(team.mem1_name);
    }
    if (team.mem2_name) {
      members.push(team.mem2_name);
    }
    if (team.mem3_name) {
      members.push(team.mem3_name);
    }
    if (team.mem4_name) {
      members.push(team.mem4_name);
    }

    // Generate certificates for all team members
    const certificatePaths = await generateTeamCertificates(
      members,
      team.Competition,
      team.Team_Name
    );

    // prepare certificate data
    const certificateData = {
      teamName: team.Team_Name,
      consumerNumber: team.consumerNumber,
      members: members,
      competition: team.Competition,
      eventDate: event.start_time,
      certificatePaths: certificatePaths,
    };

    return res.json({
      message: "Certificate generated successfully",
      certificateData,
      downloadUrls: certificatePaths.map(
        (filePath) =>
          `/api/certificates/download/certificate/${path.basename(filePath)}`
      ),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Add a download endpoint for the generated certificates
router.get("/download/certificate/:filename", (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, `../certificates/${filename}`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "Certificate not found" });
  }

  res.download(filePath);
});

module.exports = router;
