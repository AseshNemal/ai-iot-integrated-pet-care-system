/**
 * Regression tests for V05: mass assignment in update handlers.
 */

const express = require("express");
const request = require("supertest");

jest.mock("../../model/pet");
jest.mock("../../model/MedicalRecord");
jest.mock("../../model/Product");
jest.mock("../../model/Feedback");
jest.mock("../../middleware/auth.middlewere", () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { _id: "user-a", role: "User" };
    next();
  }),
}));

const Pet = require("../../model/pet").default;
const MedicalRecord = require("../../model/MedicalRecord");
const Product = require("../../model/Product");
const Feedback = require("../../model/Feedback");
const petRouter = require("../pets");
const medicalRecordRouter = require("../medicalRecords");
const productRouter = require("../productRoutes");
const feedbackRouter = require("../feedbackRoutes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/pet", petRouter);
  app.use("/medical", medicalRecordRouter);
  app.use("/product", productRouter);
  app.use("/feedback", feedbackRouter);
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

  test("product updates use $set and ignore document metadata", async () => {
    Product.findByIdAndUpdate.mockResolvedValue({
      _id: "product-a",
      name: "Updated product",
      price: 25,
    });

    const res = await request(app)
      .put("/product/update/product-a")
      .send({
        name: "Updated product",
        price: 25,
        _id: "attacker-controlled-id",
        createdAt: "2000-01-01T00:00:00.000Z",
        unexpectedField: "attacker-controlled-value",
      });

    expect(res.status).toBe(200);
    expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
      "product-a",
      { $set: { name: "Updated product", price: 25 } },
      { new: true, runValidators: true }
    );
  });

  test("feedback updates cannot reassign the author or creation time", async () => {
    Feedback.findByIdAndUpdate.mockResolvedValue({
      _id: "feedback-a",
      userId: "user-a",
      feedback: "Updated feedback",
      rating: 5,
    });

    const res = await request(app)
      .put("/feedback/edit/feedback-a")
      .send({
        feedback: "Updated feedback",
        rating: 5,
        userId: "attacker-controlled-owner",
        userName: "Attacker-controlled name",
        createdAt: "2000-01-01T00:00:00.000Z",
      });

    expect(res.status).toBe(200);
    expect(Feedback.findByIdAndUpdate).toHaveBeenCalledWith(
      "feedback-a",
      { $set: { feedback: "Updated feedback", rating: 5 } },
      { new: true, runValidators: true }
    );
  });
});
