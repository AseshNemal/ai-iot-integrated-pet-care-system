/**
 * Tests for GET /pet/tracker/:deviceId — the authenticated, ownership-checked
 * telemetry endpoint added to remediate the V28 Pet Tracker access-control
 * finding (security-assessment/remediation/V28-pet-tracker-access-control.md).
 *
 * Covers the four required access scenarios: unauthenticated, owner,
 * authenticated-but-not-owner, and unknown device.
 */

const express = require("express");
const request = require("supertest");

jest.mock("axios");
jest.mock("../../model/pet");
jest.mock("../../middleware/auth.middlewere", () => ({
  authenticate: jest.fn((req, res, next) =>
    res.status(401).json({ error: "User is not authenticated. Please log in." })
  ),
  authorizeRoles: () => (req, res, next) => next(),
}));

const axios = require("axios");
const Pet = require("../../model/pet").default;
const { authenticate } = require("../../middleware/auth.middlewere");
const petsRouter = require("../pets");

function asUser(user) {
  authenticate.mockImplementation((req, res, next) => {
    req.user = user;
    next();
  });
}

function loggedOut() {
  authenticate.mockImplementation((req, res, next) =>
    res.status(401).json({ error: "User is not authenticated. Please log in." })
  );
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/pet", petsRouter);
  return app;
}

describe("GET /pet/tracker/:deviceId", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
    process.env.FIREBASE_RTDB_URL = "https://example-test.firebasedatabase.app";
  });

  test("unauthenticated request is rejected with 401 and never reaches the ownership check", async () => {
    loggedOut();

    const res = await request(app).get("/pet/tracker/900001");

    expect(res.status).toBe(401);
    expect(Pet.findOne).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("owner requesting their own device receives only that device's telemetry", async () => {
    asUser({ _id: "user-a" });
    Pet.findOne.mockResolvedValue({ deviceId: 900001, userId: "user-a" });
    axios.get.mockResolvedValue({
      data: {
        rec1: { "Device ID": "900001", Temperature: 38.2 },
        rec2: { "Device ID": "900002", Temperature: 39.1 }, // a different device in the same shared node
      },
    });

    const res = await request(app).get("/pet/tracker/900001");

    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(1);
    expect(res.body.records[0]["Device ID"]).toBe("900001");
  });

  test("authenticated user requesting another user's device is denied with 403", async () => {
    asUser({ _id: "user-b" });
    Pet.findOne.mockResolvedValue({ deviceId: 900001, userId: "user-a" });

    const res = await request(app).get("/pet/tracker/900001");

    expect(res.status).toBe(403);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("unknown device returns 404", async () => {
    asUser({ _id: "user-a" });
    Pet.findOne.mockResolvedValue(null);

    const res = await request(app).get("/pet/tracker/999999");

    expect(res.status).toBe(404);
    expect(axios.get).not.toHaveBeenCalled();
  });
});
