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

const devDayAttendanceSchema = new mongoose.Schema({
  consumerNumber: { type: String, required: true },
  Team_Name: { type: String, required: true },
  Leader_name: { type: String, required: true },
  Leader_email: { type: String, required: true },
  mem1_name: { type: String, default: "" },
  mem1_email: { type: String, default: "" },
  mem2_name: { type: String, default: "" },
  mem2_email: { type: String, default: "" },
  mem3_name: { type: String, default: "" },
  mem3_email: { type: String, default: "" },
  mem4_name: { type: String, default: "" },
  mem4_email: { type: String, default: "" },
  att_code: { type: String, required: true },
  Competition: { type: String, required: true },
  attendance: { type: Boolean, default: false },
}, { timestamps: true });

const eventSchema = new mongoose.Schema({
  competitionName: { type: String, required: true },
  start_time: { type: Date, required: true },
  end_time: { type: Date, required: true },
}, { timestamps: true });

const DevDayAttendance = mongoose.model("DevDayAttendance", devDayAttendanceSchema);
const Event = mongoose.model("Event", eventSchema);
const Admin = mongoose.model('Admin', adminSchema);
module.exports = { Admin,DevDayAttendance, Event };
