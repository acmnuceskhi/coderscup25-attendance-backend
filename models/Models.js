const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  UserName: {
    type: String,
    required: true
  },
  Password: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

const CodersCupAttendanceSchema = new mongoose.Schema({
  "Team Information": { type: String, default: "" },
  "Team Name": { type: String, required: true },
  "Vjudge username": { type: String, default: "" },
  "Leader Name": { type: String, required: true },
  "Leader Email Address": { type: String, required: true },
  "Leader Section": { type: String, default: "" },
  "Leader CNIC": { type: String, default: "" },
  "Leader Phone Number": { type: String, default: "" },

  "Member 1 Name": { type: String, default: "" },
  "Member 1 Email Address": { type: String, default: "" },
  "Member 1 Section": { type: String, default: "" },

  "Member 2 Name": { type: String, default: "" },
  "Member 2 Email Address": { type: String, default: "" },
  "Member 2 Section": { type: String, default: "" },

  "Att Code": { type: String, unique: true },
  "Attendance Marked": { type: Boolean, default: false },

}, { timestamps: true });

const eventSchema = new mongoose.Schema({
  competitionName: { type: String, required: true },
  start_time: { type: Date, required: true },
  end_time: { type: Date, required: true },
}, { timestamps: true });

const CodersCupAttendance = mongoose.model("CodersCupAttendance", CodersCupAttendanceSchema,"CodersCupAttendance");
const Event = mongoose.model("Event", eventSchema);
const Admin = mongoose.model('Admin', adminSchema,"Admin");
module.exports = { Admin, CodersCupAttendance, Event };
