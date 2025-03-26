const request = require("supertest");
const express = require("express");
const certificateRoutes = require("../routes/certificateRoutes");

const app = express();
app.use(express.json());
app.use("/api/certificates", certificateRoutes);

describe("GET /:att_code", () => {
  it("should return certificate data if attendance is marked", async () => {
    const response = await request(app).get("/api/certificates/valid_att_code");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("certificateData");
    expect(response.body.certificateData).toMatchObject({
      teamName: "Team Innovators",
      consumerNumber: "789012",
      members: [
        "Asfand Khanzada",
        "Raahim Irfan",
        "Abdullah Azhar Khan",
        "Sarim Ahmed",
        "Kirish Kumar",
      ],
      competition: "Speed Debugging",
      eventDate: new Date("2025-03-01T09:00:00Z").toISOString(),
    });
  });

  it("should return 400 if attendance code is missing", async () => {
    const response = await request(app).get("/api/certificates/");
    expect(response.status).toBe(404); // 404 because the route is not matched
  });

  it("should return 400 if attendance was not marked", async () => {
    const response = await request(app).get(
      "/api/certificates/invalid_att_code"
    );
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Certificate unavailable: Attendance was not marked"
    );
  });

  it("should return 400 if event has not concluded", async () => {
    const response = await request(app).get(
      "/api/certificates/event_not_concluded"
    );
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Certificates are only available after the event has ended"
    );
  });
});
