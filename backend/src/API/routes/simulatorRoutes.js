const router = require("express").Router();
import simulator from "../../services/iotSimulatorService";

// IoT Pet Health Tracker simulator API (SE4030 test/demo aid).
// Only mounted when ENABLE_IOT_SIMULATOR=true (see backend/src/app.js).
// See docs/IOT_SIMULATOR.md for the full explanation and usage.

router.route("/devices").post((req, res) => {
  const deviceId = simulator.createDevice();
  res.status(201).json({ deviceId });
});

router.route("/devices/:deviceId/start").post((req, res) => {
  const { deviceId } = req.params;
  const { intervalMs } = req.body || {};

  const device = simulator.startDevice(deviceId, intervalMs);
  if (!device) {
    return res.status(404).json({ error: `Simulator device ${deviceId} not found` });
  }

  res.json(simulator.toStatus(device));
});

router.route("/devices/:deviceId/stop").post((req, res) => {
  const { deviceId } = req.params;

  const device = simulator.stopDevice(deviceId);
  if (!device) {
    return res.status(404).json({ error: `Simulator device ${deviceId} not found` });
  }

  res.json(simulator.toStatus(device));
});

router.route("/devices/:deviceId/status").get((req, res) => {
  const { deviceId } = req.params;

  const device = simulator.getDevice(deviceId);
  if (!device) {
    return res.status(404).json({ error: `Simulator device ${deviceId} not found` });
  }

  res.json(simulator.toStatus(device));
});

module.exports = router;
