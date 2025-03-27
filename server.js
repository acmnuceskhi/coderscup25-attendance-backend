require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const { DevDayAttendance } = require("./models/Models");

const VerifyJWT = require("./middleware/AuthJWT");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");

const certificateRoutes = require("./routes/certificateRoutes");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:5173", // Frontend URL
    credentials: true, // Allow credentials (cookies, authorization headers)
  })
);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", VerifyJWT, adminRoutes);
app.use("/api/attendance", attendanceRoutes);
// app.use('/api/results', resultsRoutes);
app.use("/api/certificates", certificateRoutes);

// check apis (will be removed)
app.get("/getallteams", async (req, res) => {
  try {
    const attendances = await DevDayAttendance.find();
    res.json(attendances);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
app.post("/addteam", async (req, res) => {
  try {
    const newAttendance = new DevDayAttendance(req.body);
    const savedAttendance = await newAttendance.save();
    res.status(201).json(savedAttendance);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});
// -----------

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log("Connected and listening to requests on", process.env.PORT);
    });
  })
  .catch((error) => {
    console.log(error);
  });
