const { default: mongoose, MongooseError } = require("mongoose");
const { Admin, CodersCupAttendance, Event } = require("../models/Models");
const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ msg: "Admin routes" });
});

function mapTeamToSchema(team) {
  return {
      team_info: team["Team Information"] || "",
      team_name: team["Team Name"] || "",
      vjudge_username: team["Vjudge username"] || "",
      competitionName: team.competitionName || "",
      leader_name: team["Leader Name"] || "",
      leader_email: team["Leader Email Address"] || "",
      leader_section: team["Leader Section"] || "",
      leader_cnic: team["Leader CNIC"] || "",
      leader_phone: team["Leader Phone Number"] || "",

      member1_name: team["Member 1 Name"] || "",
      member1_email: team["Member 1 Email Address"] || "",
      member1_section: team["Member 1 Section"] || "",

      member2_name: team["Member 2 Name"] || "",
      member2_email: team["Member 2 Email Address"] || "",
      member2_section: team["Member 2 Section"] || "",

      att_code: team["Att Code"] || "",
      attendance: team["Attendance Marked"] || false
  };
}
router.post("/markAttendance", async (req, res) => {
  const { att_code } = req.body;
  if (!att_code) {
    return res.status(400).json({ message: "No team code provided" });
  }

  try {
    const team = await CodersCupAttendance.findOne({ "Att Code": att_code });
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    team.attendance = true;
    await team.save();
    return res.json({ message: "Attendance marked successfully",  team: mapTeamToSchema(team)
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post("/unmarkAttendance", async (req, res) => {
  const { att_code } = req.body;
  if (!att_code) {
    return res.status(400).json({ message: "No team code provided" });
  }

  try {
    const team = await CodersCupAttendance.findOne({ "Att Code": att_code });
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    team.attendance = false;
    await team.save();
    return res.json({ message: "Attendance unmarked successfully", team: mapTeamToSchema(team) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post("/updatetime", async (req, res) => {
  const { competitionName, start_time, end_time } = req.body;
  if (!competitionName || !start_time || !end_time) {
    return res.status(400).json({ message: "Required fields missing" });
  }
  const startTimeDate = new Date(start_time);
  const endTimeDate = new Date(end_time);
  // valid times
  if (endTimeDate <= startTimeDate) {
    return res
      .status(400)
      .json({ message: "End time must be after start time" });
  }

  try {
    const event = await Event.findOneAndUpdate(
      { competitionName },
      { start_time: startTimeDate, end_time: endTimeDate },
      { new: true }
    );

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.json({ message: "Time  updated successfully", event });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get("/getAllTeams", async (req, res) => {
  try {
    const attendances = await CodersCupAttendance.find();

    // Map each document to your clean schema
    const mappedTeams = attendances.map(team => mapTeamToSchema(team));

    res.json(mappedTeams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get("/getAllCompetitions", async (req, res) => {
  try {
    const competitions = await Event.find();
    res.json(competitions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res
      .status(404)
      .json({ error: "User name or password missing", emptyFields });

  const salt = await bcrypt.genSalt();
  const bcryptPassword = await bcrypt.hash(password, salt);

  console.log(username, bcryptPassword);

  try {
    const admin = await Admin.create({
      UserName: username,
      Password: bcryptPassword,
    });
    res.status(200).json(admin);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;

// Attendance (PR portal):
// /markattendance - done and checked
// /updatetime - done and checked

// Results:
// /WinnerUpdate
// /WinnerSet
