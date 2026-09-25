/**
 * Regression tests for V05: mass assignment in update handlers.
 */

const express = require("express");
const request = require("supertest");

jest.mock("../../model/pet");
jest.mock("../../model/MedicalRecord");
jest.mock("../../middleware/auth.middlewere", () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { _id: "user-a", role: "User" };
    next();
  }),
}));

const Pet = require("../../model/pet").default;
const MedicalRecord = require("../../model/MedicalRecord");
const petRouter = require("../pets");
const medicalRecordRouter = require("../medicalRecords");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/pet", petRouter);
  app.use("/medical", medicalRecordRouter);
  return app;
}

describe("update-handler field allowlists", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  test("pet updates use $set and ignore ownership and unexpected fields", async () => {
    Pet.findByIdAndUpdate.mockResolvedValue({
      _id: "pet-a",
      userId: "user-a",
      petName: "Updated name",
    });

    const res = await request(app)
      .put("/pet/update/pet-a")
      .send({
        petName: "Updated name",
        deviceId: 42,
        userId: "attacker-controlled-owner",
        _id: "attacker-controlled-id",
        unexpectedField: "attacker-controlled-value",
      });

    expect(res.status).toBe(200);
    expect(Pet.findByIdAndUpdate).toHaveBeenCalledWith(
      "pet-a",
      { $set: { petName: "Updated name", deviceId: 42 } },
      { new: true, runValidators: true }
    );
  });

  test("medical-record updates use $set and cannot reassign the pet", async () => {
    MedicalRecord.findByIdAndUpdate.mockResolvedValue({
      _id: "record-a",
      petId: "pet-a",
      diagnosis: "Updated diagnosis",
    });

    const res = await request(app)
      .put("/medical/record-a")
      .send({
        diagnosis: "Updated diagnosis",
        notes: "Updated notes",
        petId: "attacker-controlled-pet",
        createdAt: "2000-01-01T00:00:00.000Z",
        unexpectedField: "attacker-controlled-value",
      });

    expect(res.status).toBe(200);
    expect(MedicalRecord.findByIdAndUpdate).toHaveBeenCalledWith(
      "record-a",
      { $set: { diagnosis: "Updated diagnosis", notes: "Updated notes" } },
      { new: true, runValidators: true }
    );
  });
});
