const express = require("express");
// const { DevDayAttendance, Event } = require("../models/Models");

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

    // certificate generation logic would be implemented here

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

    // prepare certificate data
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
      // downloadUrl: `/download/certificate/${team.att_code}.pdf`
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
