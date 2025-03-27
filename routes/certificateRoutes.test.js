const request = require("supertest");
const express = require("express");
const path = require("path");

// Mock the models
jest.mock("../models/Models", () => ({
  DevDayAttendance: {
    findOne: jest.fn().mockImplementation(({ att_code }) => {
      if (att_code === "AUTOMATION25") {
        return Promise.resolve({
          consumerNumber: "CN-002",
          Team_Name: "Team Automation",
          Leader_name: "Asfand Khanzada",
          Leader_email: "asfand.khanzada@example.com",
          mem1_name: "Raahim Irfan",
          mem1_email: "raahim.irfan@example.com",
          mem2_name: "Abdullah Azhar Khan",
          mem2_email: "abdullah.azhar.khan@example.com",
          mem3_name: "Sarim Ahmed",
          mem3_email: "sarim.ahmed@example.com",
          mem4_name: "Kirish Kumar",
          mem4_email: "kirish.kumar@example.com",
          att_code: "AUTOMATION25",
          Competition: "SQL Saga",
          attendance: true,
        });
      } else if (att_code === "invalid_att_code") {
        return Promise.resolve({
          // Same as above but with attendance: false
          attendance: false,
        });
      } else if (att_code === "event_not_concluded") {
        return Promise.resolve({
          // Same team data but with a future event
          attendance: true,
          Competition: "Future SQL Saga",
        });
      }
      return Promise.resolve(null);
    }),
  },
  // In the Event mock for "SQL Saga", change the end_time to a past date:

  Event: {
    findOne: jest.fn().mockImplementation(({ competitionName }) => {
      if (competitionName === "SQL Saga") {
        return Promise.resolve({
          competitionName: "SQL Saga",
          start_time: new Date("2023-04-17T05:00:00.000+00:00"), // Changed to 2023
          end_time: new Date("2023-04-17T07:00:00.000+00:00"), // Changed to 2023
          updatedAt: new Date("2023-03-25T12:32:56.604+00:00"), // Changed to 2023
        });
      } else if (competitionName === "Future SQL Saga") {
        // Keep this one in the future
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        return Promise.resolve({
          competitionName: "Future SQL Saga",
          start_time: new Date("2025-04-17T05:00:00.000+00:00"),
          end_time: futureDate,
          updatedAt: new Date(),
        });
      }
      return Promise.resolve(null);
    }),
  },
}));

// Mock the certificate generator functions
jest.mock("../utils/certificateGenerator", () => ({
  generateCertificate: jest
    .fn()
    .mockImplementation((name, competition, teamName = "") => {
      const sanitizedName = name.replace(/\s+/g, "-");
      const sanitizedTeam = teamName.replace(/\s+/g, "-");
      return Promise.resolve(
        `d:\\path\\to\\certificates\\${sanitizedName}-${sanitizedTeam}.pdf`
      );
    }),
  generateTeamCertificates: jest
    .fn()
    .mockImplementation((members, competition, teamName = "") => {
      const sanitizedTeam = teamName.replace(/\s+/g, "-");
      return Promise.resolve(
        members.map(
          (name) =>
            `d:\\path\\to\\certificates\\${name.replace(
              /\s+/g,
              "-"
            )}-${sanitizedTeam}.pdf`
        )
      );
    }),
}));

const certificateRoutes = require("../routes/certificateRoutes");

const app = express();
app.use(express.json());
app.use("/api/certificates", certificateRoutes);

describe("GET /:att_code", () => {
  it("should return certificate data if attendance is marked", async () => {
    const response = await request(app).get("/api/certificates/AUTOMATION25");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("certificateData");
    expect(response.body).toHaveProperty("downloadUrls");
    expect(response.body.message).toBe("Certificate generated successfully");

    expect(response.body.certificateData).toMatchObject({
      teamName: "Team Automation",
      consumerNumber: "CN-002",
      members: [
        "Asfand Khanzada",
        "Raahim Irfan",
        "Abdullah Azhar Khan",
        "Sarim Ahmed",
        "Kirish Kumar",
      ],
      competition: "SQL Saga",
      eventDate: new Date("2023-04-17T05:00:00.000+00:00").toISOString(), // Changed from 2025 to 2023
    });

    // Verify certificate paths and download URLs
    expect(response.body.certificateData).toHaveProperty("certificatePaths");
    expect(Array.isArray(response.body.certificateData.certificatePaths)).toBe(
      true
    );
    expect(response.body.certificateData.certificatePaths.length).toBe(5);

    expect(Array.isArray(response.body.downloadUrls)).toBe(true);
    expect(response.body.downloadUrls.length).toBe(5);
    response.body.downloadUrls.forEach((url) => {
      expect(url).toMatch(
        /^\/api\/certificates\/download\/certificate\/.+-Team-Automation\.pdf$/
      );
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

  it("should return 404 if team is not found", async () => {
    const response = await request(app).get(
      "/api/certificates/nonexistent_code"
    );
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Team not found");
  });
});

describe("GET /download/certificate/:filename", () => {
  it("should handle certificate download requests", async () => {
    const fs = require("fs");
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    const response = await request(app).get(
      "/api/certificates/download/certificate/Asfand-Khanzada-The-Innovators.pdf"
    );
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Certificate not found");

    fs.existsSync.mockRestore();
  });
});
