const request = require("supertest");
const express = require("express");
const path = require("path");

// Mock the certificate generator functions
jest.mock("../utils/certificateGenerator", () => ({
  generateCertificate: jest
    .fn()
    .mockImplementation((name, competition, teamName = "") => {
      const sanitizedName = name.replace(/\s+/g, "-");
      const sanitizedTeam = teamName.replace(/\s+/g, "-");
      return Promise.resolve(
        `d:\\path\\to\\certificates\\${sanitizedName}-${sanitizedTeam}-Certificate-DevDay25.pdf`
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
            )}-${sanitizedTeam}-Certificate-DevDay25.pdf`
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
    const response = await request(app).get("/api/certificates/valid_att_code");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("certificateData");
    expect(response.body).toHaveProperty("downloadUrls");
    expect(response.body.message).toBe("Certificate generated successfully");

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
        /^\/api\/certificates\/download\/certificate\/.+-Team-Innovators-Certificate-DevDay25\.pdf$/
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
    // We can't fully test the download without mocking the fs module,
    // but we can at least ensure the route exists
    const fs = require("fs");
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    const response = await request(app).get(
      "/api/certificates/download/certificate/Asfand-Khanzada-Team-Innovators-Certificate-DevDay25.pdf"
    );
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Certificate not found");

    fs.existsSync.mockRestore();
  });
});
