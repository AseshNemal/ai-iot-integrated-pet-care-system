/**
 * Regression tests for V3: object-level authorization on appointment routes.
 */

const express = require("express");
const request = require("supertest");

jest.mock("axios");
jest.mock("../../model/Appointment");
jest.mock("../../middleware/auth.middlewere", () => {
  const actualMiddleware = jest.requireActual("../../middleware/auth.middlewere");

  return {
    ...actualMiddleware,
    authenticate: jest.fn((req, res) =>
      res.status(401).json({ error: "User is not authenticated. Please log in." })
    ),
  };
});

const Appointment = require("../../model/Appointment").default;
const { authenticate } = require("../../middleware/auth.middlewere");
const appointmentRouter = require("../appointmentRoutes").default;

function asUser(user) {
  authenticate.mockImplementation((req, res, next) => {
    req.user = user;
    next();
  });
}

function loggedOut() {
  authenticate.mockImplementation((req, res) =>
    res.status(401).json({ error: "User is not authenticated. Please log in." })
  );
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/appointments", appointmentRouter);
  return app;
}

describe("appointment object-level authorization", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  test("GET /user/:userId rejects unauthenticated requests", async () => {
    loggedOut();

    const res = await request(app).get("/api/appointments/user/user-a");

    expect(res.status).toBe(401);
    expect(Appointment.find).not.toHaveBeenCalled();
  });

  test("GET /user/:userId rejects a different authenticated user", async () => {
    asUser({ _id: "user-a", role: "User" });

    const res = await request(app).get("/api/appointments/user/user-b");

    expect(res.status).toBe(403);
    expect(Appointment.find).not.toHaveBeenCalled();
  });

  test("GET /user/:userId returns appointments for the authenticated identity", async () => {
    asUser({ _id: "user-a", role: "User" });
    const sort = jest.fn().mockResolvedValue([{ _id: "appointment-a" }]);
    Appointment.find.mockReturnValue({ sort });

    const res = await request(app).get("/api/appointments/user/user-a");

    expect(res.status).toBe(200);
    expect(Appointment.find).toHaveBeenCalledWith({
      $or: [{ petOwnerId: "user-a" }, { employeeId: "user-a" }],
    });
    expect(res.body).toEqual([{ _id: "appointment-a" }]);
  });

  test("PUT /:id rejects an authenticated non-participant without saving", async () => {
    asUser({ _id: "user-b", role: "User" });
    const save = jest.fn();
    Appointment.findById.mockResolvedValue({
      _id: "appointment-a",
      petOwnerId: "user-a",
      employeeId: "employee-a",
      save,
    });

    const res = await request(app)
      .put("/api/appointments/appointment-a")
      .send({ appointmentTime: "12:00" });

    expect(res.status).toBe(403);
    expect(save).not.toHaveBeenCalled();
  });

  test("PUT /:id allows the owner but ignores ownership reassignment fields", async () => {
    asUser({ _id: "user-a", role: "User" });
    const appointment = {
      _id: "appointment-a",
      petOwnerId: "user-a",
      employeeId: "employee-a",
      employeeFirstName: "Original employee",
      employeeRole: "Groomer",
      appointmentTime: "10:00",
      createdAt: "original-created-at",
      updatedAt: "original-updated-at",
      save: jest.fn().mockResolvedValue(),
      toObject() {
        return {
          _id: this._id,
          petOwnerId: this.petOwnerId,
          employeeId: this.employeeId,
          appointmentTime: this.appointmentTime,
        };
      },
    };
    Appointment.findById.mockResolvedValue(appointment);

    const res = await request(app)
      .put("/api/appointments/appointment-a")
      .send({
        appointmentTime: "12:00",
        status: "Completed",
        petOwnerId: "attacker-controlled-owner",
        employeeId: "attacker-controlled-employee",
        employeeFirstName: "Attacker-controlled name",
        employeeRole: "Admin",
        createdAt: "2000-01-01T00:00:00.000Z",
        updatedAt: "2000-01-01T00:00:00.000Z",
        unexpectedField: "attacker-controlled-value",
      });

    expect(res.status).toBe(200);
    expect(appointment.petOwnerId).toBe("user-a");
    expect(appointment.employeeId).toBe("employee-a");
    expect(appointment.employeeFirstName).toBe("Original employee");
    expect(appointment.employeeRole).toBe("Groomer");
    expect(appointment.appointmentTime).toBe("12:00");
    expect(appointment.status).toBeUndefined();
    expect(appointment.createdAt).toBe("original-created-at");
    expect(appointment.updatedAt).toBeInstanceOf(Date);
    expect(appointment.updatedAt.toISOString()).not.toBe("2000-01-01T00:00:00.000Z");
    expect(appointment.unexpectedField).toBeUndefined();
    expect(appointment.save).toHaveBeenCalledTimes(1);
  });

  test("PUT /:id rejects a present but empty appointment date", async () => {
    asUser({ _id: "user-a", role: "User" });
    const save = jest.fn();
    Appointment.findById.mockResolvedValue({
      _id: "appointment-a",
      petOwnerId: "user-a",
      employeeId: "employee-a",
      appointmentDate: new Date("2030-01-01"),
      save,
    });

    const res = await request(app)
      .put("/api/appointments/appointment-a")
      .send({ appointmentDate: null });

    expect(res.status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });

  test("PUT /:id allows the assigned employee to update appointment status", async () => {
    asUser({ _id: "employee-a", role: "Groomer" });
    const appointment = {
      _id: "appointment-a",
      petOwnerId: "user-a",
      employeeId: "employee-a",
      status: "Scheduled",
      save: jest.fn().mockResolvedValue(),
    };
    Appointment.findById.mockResolvedValue(appointment);

    const res = await request(app)
      .put("/api/appointments/appointment-a")
      .send({ status: "Completed", petName: "Attacker-controlled name" });

    expect(res.status).toBe(200);
    expect(appointment.status).toBe("Completed");
    expect(appointment.petName).toBeUndefined();
    expect(appointment.save).toHaveBeenCalledTimes(1);
  });

  test("DELETE /:id rejects an authenticated non-participant without deleting", async () => {
    asUser({ _id: "user-b", role: "User" });
    const deleteOne = jest.fn();
    Appointment.findById.mockResolvedValue({
      _id: "appointment-a",
      petOwnerId: "user-a",
      employeeId: "employee-a",
      deleteOne,
    });

    const res = await request(app).delete("/api/appointments/appointment-a");

    expect(res.status).toBe(403);
    expect(deleteOne).not.toHaveBeenCalled();
  });

  test("DELETE /:id allows the assigned employee", async () => {
    asUser({ _id: "employee-a", role: "Groomer" });
    const deleteOne = jest.fn().mockResolvedValue();
    Appointment.findById.mockResolvedValue({
      _id: "appointment-a",
      petOwnerId: "user-a",
      employeeId: "employee-a",
      deleteOne,
    });

    const res = await request(app).delete("/api/appointments/appointment-a");

    expect(res.status).toBe(200);
    expect(deleteOne).toHaveBeenCalledTimes(1);
  });

  test("GET /all rejects a non-admin authenticated user", async () => {
    asUser({ _id: "user-a", role: "User" });

    const res = await request(app).get("/api/appointments/all");

    expect(res.status).toBe(403);
    expect(Appointment.find).not.toHaveBeenCalled();
  });

  test("GET /all allows an authenticated admin", async () => {
    asUser({ _id: "admin-a", role: "Admin" });
    const sort = jest.fn().mockResolvedValue([{ _id: "appointment-a" }]);
    Appointment.find.mockReturnValue({ sort });

    const res = await request(app).get("/api/appointments/all");

    expect(res.status).toBe(200);
    expect(Appointment.find).toHaveBeenCalledWith({});
  });
});
