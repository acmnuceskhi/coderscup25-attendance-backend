const express = require("express");
const { DevDayAttendance, Event } = require("../models/Models");

const router = express.Router();

//Certificate download {code} --> certificate generate and return
router.get("/certificates/:att_code", async (req, res) => {
  try {
    const { att_code } = req.params;

    if (!att_code) {
      return res.status(400).json({ message: "Attendance code is required" });
    }

    // retrieve team data
    const team = await DevDayAttendance.findOne({ att_code: att_code });
    if (!team) {
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
