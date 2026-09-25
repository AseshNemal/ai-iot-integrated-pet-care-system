/**
 * Regression tests for the appointment booking flow.
 */

const express = require("express");
const request = require("supertest");

jest.mock("../../model/Appointment", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("../../model/Employee", () => ({
  find: jest.fn(),
  findById: jest.fn(),
}));
jest.mock("../../model/Notification", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("../../middleware/auth.middlewere", () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { _id: "507f1f77bcf86cd799439011", role: "User" };
    next();
  }),
  authorizeRoles: () => (req, res, next) => next(),
}));

const Appointment = require("../../model/Appointment").default;
const Employee = require("../../model/Employee");
const Notification = require("../../model/Notification").default;
const appointmentRouter = require("../appointmentRoutes").default;
const employeeRouter = require("../employeeRoutes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/appointments", appointmentRouter);
  app.use("/employee", employeeRouter);
  return app;
}

describe("appointment booking", () => {
  let app;
  let appointmentSave;
  let notificationSave;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-25T12:00:00+05:30"));
    jest.clearAllMocks();
    app = buildApp();

    appointmentSave = jest.fn().mockResolvedValue();
    notificationSave = jest.fn().mockResolvedValue();

    Appointment.mockImplementation((data) => ({
      ...data,
      _id: "507f1f77bcf86cd799439013",
      save: appointmentSave,
    }));
    Notification.mockImplementation((data) => ({
      ...data,
      save: notificationSave,
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("public booking options expose only the projected staff fields", async () => {
    const bookingOptions = [{
      _id: "507f1f77bcf86cd799439012",
      firstName: "Sam",
      lastName: "Perera",
      role: "Groomer",
    }];
    const select = jest.fn().mockResolvedValue(bookingOptions);
    Employee.find.mockReturnValue({ select });

    const res = await request(app).get("/employee/booking-options");

    expect(res.status).toBe(200);
    expect(Employee.find).toHaveBeenCalledWith({
      role: { $in: ["Groomer", "Vet"] },
    });
    expect(select).toHaveBeenCalledWith("_id firstName lastName role");
    expect(res.body).toEqual(bookingOptions);
  });

  test("same-day booking succeeds and derives employee details on the server", async () => {
    const select = jest.fn().mockResolvedValue({
      firstName: "Sam",
      role: "Groomer",
    });
    Employee.findById.mockReturnValue({ select });

    const res = await request(app)
      .post("/api/appointments")
      .send({
        employeeId: "507f1f77bcf86cd799439012",
        employeeFirstName: "Spoofed name",
        employeeRole: "Admin",
        petName: "Milo",
        serviceCategory: "Bath",
        appointmentDate: "2026-09-25",
        appointmentTime: "14:00",
      });

    expect(res.status).toBe(201);
    expect(Appointment).toHaveBeenCalledWith(expect.objectContaining({
      petOwnerId: "507f1f77bcf86cd799439011",
      employeeId: "507f1f77bcf86cd799439012",
      employeeFirstName: "Sam",
      employeeRole: "Groomer",
      petName: "Milo",
    }));
    expect(appointmentSave).toHaveBeenCalledTimes(1);
    expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
      userId: "507f1f77bcf86cd799439011",
      appointmentId: "507f1f77bcf86cd799439013",
      type: "appointment",
    }));
    expect(notificationSave).toHaveBeenCalledTimes(1);
  });

  test("booking rejects an employee that is no longer available", async () => {
    const select = jest.fn().mockResolvedValue(null);
    Employee.findById.mockReturnValue({ select });

    const res = await request(app)
      .post("/api/appointments")
      .send({
        employeeId: "507f1f77bcf86cd799439012",
        petName: "Milo",
        serviceCategory: "Bath",
        appointmentDate: "2026-09-26",
        appointmentTime: "14:00",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Selected employee is not available.");
    expect(Appointment).not.toHaveBeenCalled();
  });
});
