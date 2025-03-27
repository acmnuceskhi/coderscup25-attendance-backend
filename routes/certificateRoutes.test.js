const request = require("supertest");
const express = require("express");

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
          attendance: false,
        });
      } else if (att_code === "event_not_concluded") {
        return Promise.resolve({
          attendance: true,
          Competition: "Future SQL Saga",
          Team_Name: "Team Future",
          Leader_name: "Future Leader",
          consumerNumber: "CN-003",
        });
      }
      return Promise.resolve(null);
    }),
  },
  Event: {
    findOne: jest.fn().mockImplementation(({ competitionName }) => {
      if (competitionName === "SQL Saga") {
        return Promise.resolve({
          competitionName: "SQL Saga",
          start_time: new Date("2023-04-17T05:00:00.000+00:00"),
          end_time: new Date("2023-04-17T07:00:00.000+00:00"),
          updatedAt: new Date("2023-03-25T12:32:56.604+00:00"),
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
jest.mock("../utils/certificateGenerator", () => {
  return {
    generateTeamCertificateBuffers: jest
      .fn()
      .mockImplementation((members, competition, teamName = "") => {
        return Promise.resolve(
          members.map((name) => ({
            name: name,
            buffer: Buffer.from(
              `Mock certificate for ${name} - ${competition} - ${teamName}`
            ),
          }))
        );
      }),
  };
});

const certificateRoutes = require("../routes/certificateRoutes");

const app = express();
app.use(express.json());
app.use("/api/certificates", certificateRoutes);

// Clean up the interval after all tests
afterAll(() => {
  clearInterval(certificateRoutes.cleanupInterval);
});

describe("POST /api/certificates", () => {
  it("should return certificate data if attendance is marked", async () => {
    const response = await request(app)
      .post("/api/certificates")
      .send({ att_code: "AUTOMATION25" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("certificateData");
    expect(response.body).toHaveProperty("downloadTokens");
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
      eventDate: new Date("2023-04-17T05:00:00.000+00:00").toISOString(),
    });

    // Verify download tokens format
    expect(Array.isArray(response.body.downloadTokens)).toBe(true);
    expect(response.body.downloadTokens.length).toBe(5);

    response.body.downloadTokens.forEach((token, index) => {
      expect(token).toHaveProperty("memberName");
      expect(token).toHaveProperty("memberIndex");
      expect(token).toHaveProperty("downloadUrl");
      expect(token.downloadUrl).toMatch(
        /^\/api\/certificates\/download\/[a-f0-9]{32}$/
      );
    });
  });

  it("should return 400 if attendance code is missing", async () => {
    const response = await request(app).post("/api/certificates").send({});
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Attendance code is required");
  });

  it("should return 400 if attendance was not marked", async () => {
    const response = await request(app)
      .post("/api/certificates")
      .send({ att_code: "invalid_att_code" });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Certificate unavailable: Attendance was not marked"
    );
  });

  it("should return 400 if event has not concluded", async () => {
    const response = await request(app)
      .post("/api/certificates")
      .send({ att_code: "event_not_concluded" });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Certificates are only available after the event has ended"
    );
  });

  it("should return 404 if team is not found", async () => {
    const response = await request(app)
      .post("/api/certificates")
      .send({ att_code: "nonexistent_code" });
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Team not found");
  });
});

describe("GET /api/certificates/download/:token", () => {
  it("should return 404 if certificate token is not found", async () => {
    const response = await request(app).get(
      "/api/certificates/download/nonexistent_token"
    );
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Certificate not found or expired");
  });

  // Add test for successful certificate download
  it("should download certificate with valid token", async () => {
    // We need to first generate a valid token by calling the certificate generation endpoint
    const genResponse = await request(app)
      .post("/api/certificates")
      .send({ att_code: "AUTOMATION25" });

    // Extract a token URL from the response
    const downloadUrl = genResponse.body.downloadTokens[0].downloadUrl;
    const token = downloadUrl.split("/").pop();

    // Now request the download with the token
    const downloadResponse = await request(app).get(
      `/api/certificates/download/${token}`
    );

    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.header["content-type"]).toBe("application/pdf");
    expect(downloadResponse.header["content-disposition"]).toMatch(
      /^attachment; filename=".*\.pdf"$/
    );
  });
});
