const express = require('express');
const CryptoJS = require("crypto-js");
const { CodersCupAttendance, Event } = require('../models/Models');
let uuidv4;
(async () => {
  const { v4 } = await import("uuid");
  uuidv4 = v4;
})();

const router = express.Router();

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


const toRadians = (degrees) => degrees * (Math.PI / 180);
const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371e3; // Earth's radius in meters
    const f1 = toRadians(lat1);
    const f2 = toRadians(lat2);
    const df = toRadians(lat2 - lat1);
    const dl = toRadians(lng2 - lng1);
    const a = Math.sin(df / 2) * Math.sin(df / 2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

router.get('/', (req, res) => {
    res.json({ 'msg': 'Attendance routes' })
});


// // POST /participant-create
// router.post("/participant-create", async (req, res) => {
//   try {
//     const {
//       team_info,
//       team_name,
//       vjudge_username,
//       leader_name,
//       leader_email,
//       leader_section,
//       leader_cnic,
//       leader_phone,
//       member1_name,
//       member1_email,
//       member1_section,
//       member2_name,
//       member2_email,
//       member2_section,
//     } = req.body;

//     // Generate unique attendance code
//     const att_code = `CC-${uuidv4().slice(0, 8)}`;

//     const newParticipant = new CodersCupAttendance({
//       team_info,
//       team_name,
//       vjudge_username,
//       leader_name,
//       leader_email,
//       leader_section,
//       leader_cnic,
//       leader_phone,
//       member1_name,
//       member1_email,
//       member1_section,
//       member2_name,
//       member2_email,
//       member2_section,
//       att_code,
//     });

//     const savedParticipant = await newParticipant.save();

//     res.status(201).json({
//       msg: "Participant created successfully",
//       participant: savedParticipant,
//     });
//   } catch (error) {
//     console.error(error);
//     if (error.code === 11000 && error.keyPattern && error.keyPattern.att_code) {
//       return res.status(400).json({ msg: "Duplicate attendance code, try again" });
//     }
//     res.status(500).json({ msg: "Server error" });
//   }
// });

// to mark attendance - for general public
// Attendance marking {location, code}
router.post('/mark', async (req, res) => {
    // console.log('Request received',req.body);
    const { att_code, coordinates } = req.body;
    // console.log('encryptedCoordinates', encryptedCoordinates);
    if (!att_code || !coordinates) {
        // console.log('missing')
        return res.status(400).json({ message: "Parameters missing (att_code, coordinates)" });
    }
    const secretKey = process.env.COORDS_ENCRYPTION_KEY;
    let decrypted;
    try {
        const bytes = CryptoJS.AES.decrypt(coordinates, secretKey);
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
        decrypted = JSON.parse(decryptedData);
    } catch (err) {
        // console.log('failed to decrypt')
        return res.status(400).json({ message: "Failed to decrypt coordinates" });
    }
    const { latitude, longitude } = decrypted;
    // console.log('decrypted', decrypted);

    // Fast's coordinates
    const centerLatitude = 24.8568496;
    const centerLongitude = 67.2644237;
    const distance = calculateDistance(latitude, longitude, centerLatitude, centerLongitude);
    if (distance <= 2500) {
        try {
            // console.log('checkingg ')
            const team = await CodersCupAttendance.findOne({ "Att Code": att_code });
            if (!team) {
                return res.status(404).json({ message: "Team not found" });
            }

            // check if the team code is valid
            const event = await Event.findOne({ competitionName: "Competitive Programming" });
            if (!event) {
                return res.status(404).json({ message: "Event not found (invalid team code)" });
            }
// console.log('checkingg event')
            // check if the event is not ongoing
            const now = new Date();
            const pakistanTime = new Date(now.getTime() + 5 * 60 * 60 * 1000);
            if (pakistanTime < event.start_time || pakistanTime > event.end_time) {
                return res.status(400).json({ message: "The competition is not currently ongoing! Attendance cannot be marked." });
            }

            // check if the attendance is already marked
            if (team["Attendance Marked"]) {
                console.log('already marked');
                return res.status(409).json({
                    message: "Attendance is already marked for this team",
                    attendanceAlreadyMarked: true,
                    team: mapTeamToSchema(team)
                });
            }
            // console.log('not marked would save here')
            team["Attendance Marked"] = true;
            await team.save();
            
            return res.json({ message: "Attendance marked successfully", 
                team: mapTeamToSchema(team)
            });
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    } else {
        console.log('out of range')
        return res.status(400).json({ message: "Out of allowed range! Attendance cannot be marked." });
    }
});

//Certificate download {code} --> certificate generate and return
router.put('/certificates', (req, res) => {
    res.json({ 'msg': 'Certificate downloaded' })
});

module.exports = router;
