const { expect } = require("chai");
const sinon = require("sinon");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const {
  generateCertificateBuffer,
  generateTeamCertificateBuffers,
  _setMockImplementation,
  _resetMockImplementation,
} = require("../utils/certificateGenerator");

describe("Certificate Generator", function () {
  // Set longer timeout for PDF generation tests
  this.timeout(10000);

  let sandbox;

  beforeEach(() => {
    // Create a sandbox for stub/spy/mock
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    // Restore all stubs/spies/mocks
    sandbox.restore();
    // Reset any mock implementations
    _resetMockImplementation();
  });

  describe("generateCertificateBuffer", () => {
    it("should generate a valid PDF buffer", async () => {
      const buffer = await generateCertificateBuffer(
        "Test User",
        "Web Development"
      );
      expect(buffer).to.be.instanceOf(Buffer);
      expect(buffer.length).to.be.greaterThan(1000); // PDF should have reasonable size
    });

    it("should handle special characters in names properly", async () => {
      const buffer = await generateCertificateBuffer(
        "Jöhn Dôé-Smith!",
        "Web Development"
      );
      expect(buffer).to.be.instanceOf(Buffer);
      expect(buffer.length).to.be.greaterThan(1000);
    });

    it("should handle very long names", async () => {
      const longName =
        "Pneumonoultramicroscopicsilicovolcanoconiosis Supercalifragilisticexpialidocious";
      const buffer = await generateCertificateBuffer(
        longName,
        "Web Development"
      );
      expect(buffer).to.be.instanceOf(Buffer);
      expect(buffer.length).to.be.greaterThan(1000);
    });

    it("should reject with error for invalid inputs", async () => {
      try {
        await generateCertificateBuffer("", "Web Development");
        expect.fail("Should have thrown an error for empty name");
      } catch (err) {
        expect(err.message).to.include("Invalid recipient name");
      }

      try {
        await generateCertificateBuffer("John Doe", "");
        expect.fail("Should have thrown an error for empty competition");
      } catch (err) {
        expect(err.message).to.include("Invalid competition name");
      }
    });

    it("should handle missing certificate template gracefully", async () => {
      // Temporarily disable access to the certificate template
      const existsSyncStub = sandbox.stub(fs, "existsSync");
      existsSyncStub
        .withArgs(sinon.match(/certificateDesign2025\.png$/))
        .returns(false);
      existsSyncStub
        .withArgs(sinon.match(/certificateDesign1\.png$/))
        .returns(true);

      // Should still work using fallback template
      const buffer = await generateCertificateBuffer(
        "Test User",
        "Web Development"
      );
      expect(buffer).to.be.instanceOf(Buffer);
      expect(buffer.length).to.be.greaterThan(1000);

      // Assert fallback was used
      expect(existsSyncStub.calledWith(sinon.match(/certificateDesign1\.png$/)))
        .to.be.true;
    });

    it("should retry on PDF generation errors", async () => {
      // Create a stub that fails the first time but succeeds the second time
      let attempt = 0;
      const pdfDocStub = sandbox
        .stub(PDFDocument.prototype, "end")
        .callsFake(function () {
          if (attempt === 0) {
            attempt++;
            this.emit("error", new Error("Simulated PDF error"));
          } else {
            this.emit("end");
          }
        });

      const buffer = await generateCertificateBuffer(
        "Test User",
        "Web Development"
      );
      expect(buffer).to.be.instanceOf(Buffer);
      expect(pdfDocStub.calledTwice).to.be.true;
    });
  });

  describe("generateTeamCertificateBuffers", () => {
    it("should generate certificates for all team members", async () => {
      const members = ["John Doe", "Jane Smith", "Bob Johnson"];
      const certificates = await generateTeamCertificateBuffers(
        members,
        "Web Development",
        "Team Alpha"
      );

      expect(certificates).to.have.lengthOf(3);
      certificates.forEach((cert, i) => {
        expect(cert.name).to.equal(members[i]);
        expect(cert.buffer).to.be.instanceOf(Buffer);
        expect(cert.buffer.length).to.be.greaterThan(1000);
      });
    });

    it("should continue processing despite individual failures", async () => {
      // Configure mock implementation
      _setMockImplementation((name, competition, teamName) => {
        if (name === "Jane Smith") {
          return Promise.reject(new Error("Simulated failure"));
        } else {
          return Promise.resolve(Buffer.from("test-buffer"));
        }
      });

      const members = ["John Doe", "Jane Smith", "Bob Johnson"];
      const certificates = await generateTeamCertificateBuffers(
        members,
        "Web Development",
        "Team Alpha"
      );

      // Should only have John Doe and Bob Johnson (Jane Smith fails)
      expect(certificates).to.have.lengthOf(2);
      expect(certificates[0].name).to.equal("John Doe");
      expect(certificates[1].name).to.equal("Bob Johnson");
    });

    it("should throw if all certificates fail", async () => {
      // Configure mock implementation that always fails
      _setMockImplementation(() => {
        return Promise.reject(new Error("Simulated failure"));
      });

      try {
        await generateTeamCertificateBuffers(
          ["John Doe", "Jane Smith"],
          "Web Development",
          "Team Alpha"
        );
        expect.fail("Should have thrown an error when all certificates fail");
      } catch (err) {
        expect(err.message).to.equal(
          "Certificate generation failed for all team members"
        );
      }
    });

    it("should return empty array for invalid members input", async () => {
      const certificates = await generateTeamCertificateBuffers(
        [],
        "Web Development",
        "Team Alpha"
      );
      expect(certificates).to.be.an("array").that.is.empty;

      const certificates2 = await generateTeamCertificateBuffers(
        null,
        "Web Development",
        "Team Alpha"
      );
      expect(certificates2).to.be.an("array").that.is.empty;
    });
  });

  // Test performance and resource usage
  describe("Performance", () => {
    it("should generate certificates within reasonable time", async () => {
      const startTime = Date.now();
      await generateCertificateBuffer("Test User", "Web Development");
      const duration = Date.now() - startTime;

      // Should generate within 2 seconds
      expect(duration).to.be.lessThan(2000);
    });

    it("should handle multiple team certificates efficiently", async () => {
      const startTime = Date.now();
      const members = Array(5)
        .fill()
        .map((_, i) => `Team Member ${i + 1}`);
      await generateTeamCertificateBuffers(
        members,
        "Web Development",
        "Team Alpha"
      );
      const duration = Date.now() - startTime;

      // 5 certificates should generate within 5 seconds
      expect(duration).to.be.lessThan(5000);
    });
  });
});
