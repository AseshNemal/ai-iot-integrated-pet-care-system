const router = require("express").Router();
import simulator from "../../services/iotSimulatorService";
import { authenticate } from "../middleware/auth.middlewere";

// IoT Pet Health Tracker simulator API (SE4030 test/demo aid).
// Only mounted when ENABLE_IOT_SIMULATOR=true (see backend/src/app.js).
// See docs/IOT_SIMULATOR.md for the full explanation and usage.
//
// Every route requires a session, and every device lookup is scoped to the
// session's own user (the device's ownerId, set at creation) — one user's
// simulator device cannot be started, stopped, read, or deleted by another
// user, even if they know or guess its numeric ID.

function requesterId(req) {
  return String(req.user?._id || req.user?.id || "");
}

function loadOwnedDevice(req, res, deviceId) {
  const device = simulator.getDevice(deviceId);
  if (!device) {
    res.status(404).json({ error: `Simulator device ${deviceId} not found` });
    return null;
  }
  if (device.ownerId !== requesterId(req)) {
    res.status(403).json({ error: "You do not have access to this simulator device" });
    return null;
  }
  return device;
}

router.route("/devices").post(authenticate, (req, res) => {
  const deviceId = simulator.createDevice(requesterId(req));
  res.status(201).json({ deviceId });
});

router.route("/devices/:deviceId/start").post(authenticate, (req, res) => {
  const { deviceId } = req.params;
  const { intervalMs } = req.body || {};

  if (!loadOwnedDevice(req, res, deviceId)) return;

  const device = simulator.startDevice(deviceId, intervalMs);
  res.json(simulator.toStatus(device));
});

router.route("/devices/:deviceId/stop").post(authenticate, (req, res) => {
  const { deviceId } = req.params;

  if (!loadOwnedDevice(req, res, deviceId)) return;

  const device = simulator.stopDevice(deviceId);
  res.json(simulator.toStatus(device));
});

router.route("/devices/:deviceId/status").get(authenticate, (req, res) => {
  const { deviceId } = req.params;

  const device = loadOwnedDevice(req, res, deviceId);
  if (!device) return;

  res.json(simulator.toStatus(device));
});

router.route("/devices/:deviceId").delete(authenticate, (req, res) => {
  const { deviceId } = req.params;

  if (!loadOwnedDevice(req, res, deviceId)) return;

  simulator.deleteDevice(deviceId);
  res.status(204).end();
});

module.exports = router;
