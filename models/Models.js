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
  team_info: { type: String, default: "" },
  team_name: { type: String, required: true },
  vjudge_username: { type: String, default: "" },
  competitionName: {type:String,default: ""},
  leader_name: { type: String, required: true },
  leader_email: { type: String, required: true },
  leader_section: { type: String, default: "" },
  leader_cnic: { type: String, default: "" },
  leader_phone: { type: String, default: "" },

  member1_name: { type: String, default: "" },
  member1_email: { type: String, default: "" },
  member1_section: { type: String, default: "" },

  member2_name: { type: String, default: "" },
  member2_email: { type: String, default: "" },
  member2_section: { type: String, default: "" },
  att_code: { type: String, unique: true },
  attendance: { type: Boolean, default: false },
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
