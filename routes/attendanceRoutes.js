const express = require('express');
const { DevDayAttendance } = require('../models/Models');

const router = express.Router();

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

// to mark attendance - for general public
// Attendance marking {location, code}
router.post('/mark', async (req, res) => {
    const { att_code, latitude, longitude } = req.body;
    if (!att_code || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ message: "Parameters missing (att_code, latitude, longitude)" });
    }
    // Fast's coordinates
    const centerLatitude = 24.8568496;
    const centerLongitude = 67.2644237;
    const distance = calculateDistance(latitude, longitude, centerLatitude, centerLongitude);
    if (distance <= 500) {
        try {
            const team = await DevDayAttendance.findOne({ att_code: att_code });
            if (!team) {
                return res.status(404).json({ message: "Team not found" });
            }
            // attendacne is marked already
            if (team.attendance) {
                return res.status(400).json({ message: "Attendance is already marked for this team" });
            }
            team.attendance = true;
            await team.save();
            return res.json({ message: "Attendance marked successfully", team });
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    } else {
        return res.status(400).json({ message: "User is out of allowed range. Attendance not marked." });
    }
});

//Certificate download {code} --> certificate generate and return
router.put('/certificates', (req, res) => {
    res.json({ 'msg': 'Certificate downloaded' })
});

module.exports = router;
