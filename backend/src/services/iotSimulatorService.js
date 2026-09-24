import axios from "axios";
import logger from "../utils/logger";

// ---------------------------------------------------------------------------
// IoT Pet Health Tracker simulator (SE4030 test/demo aid).
//
// Stands in for the physical sensors/micro:bit/SIM800L link only. The rest of
// the original ingestion chain is left untouched:
//
//   [this simulator] -> Cloudflare Worker -> Firebase Realtime Database ("petcare") -> dashboard
//
// Two publish modes (IOT_SIMULATOR_MODE, see docs/IOT_SIMULATOR.md):
//   - "ingestion" (default): POSTs the telemetry payload to IOT_SIMULATOR_INGEST_URL,
//     i.e. the same Worker/ingestion endpoint the real device would call. The
//     simulator never touches Firebase directly in this mode, exactly like the
//     real micro:bit doesn't.
//   - "direct-firebase": writes straight to the Firebase Realtime Database,
//     bypassing the Worker. A local dashboard-testing fallback only, for when
//     no ingestion endpoint is deployed/reachable.
//
// State is in-memory only (Map), by design: this is a disposable test aid,
// not a persisted device registry, and it does not touch the Pet/Mongo
// schema. Restarting the backend clears all simulator devices.
// ---------------------------------------------------------------------------

const SIMULATOR_ID_RANGE_START = 900001;
const DEFAULT_TICK_INTERVAL_MS = 15000; // stays well under the dashboard's 4-minute "disconnected" threshold

let nextDeviceId = SIMULATOR_ID_RANGE_START;
const devices = new Map(); // deviceId (number) -> device state

function getSimulatorMode() {
  const mode = process.env.IOT_SIMULATOR_MODE || "ingestion";
  if (mode !== "ingestion" && mode !== "direct-firebase") {
    throw new Error(`Invalid IOT_SIMULATOR_MODE "${mode}". Use "ingestion" or "direct-firebase".`);
  }
  return mode;
}

function getIngestUrl() {
  const ingestUrl = process.env.IOT_SIMULATOR_INGEST_URL;
  if (!ingestUrl) {
    throw new Error(
      "IOT_SIMULATOR_INGEST_URL is not set. Add it to backend/.env (see .env.example) to use the IoT simulator in ingestion mode."
    );
  }
  return ingestUrl;
}

function getFirebaseRestUrl() {
  const databaseUrl = process.env.IOT_SIMULATOR_FIREBASE_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "IOT_SIMULATOR_FIREBASE_DATABASE_URL is not set. Add it to backend/.env (see .env.example) to use the IoT simulator in direct-firebase mode."
    );
  }
  return `${databaseUrl.replace(/\/$/, "")}/petcare.json`;
}

// Matches the "DD/MM/YYYY, HH:MM:SS" shape produced by the Cloudflare Worker's
// en-GB/Asia-Colombo toLocaleString(), which deviceData.js parses by splitting
// on ", " and "/".
function formatTimestamp(date) {
  return date.toLocaleString("en-GB", { timeZone: "Asia/Colombo" });
}

function randomWalk(current, min, max, maxStep) {
  const next = current + (Math.random() * 2 - 1) * maxStep;
  return Math.min(max, Math.max(min, next));
}

function createInitialReadings() {
  return {
    latitude: 6.9271 + (Math.random() - 0.5) * 0.01,
    longitude: 79.8612 + (Math.random() - 0.5) * 0.01,
    altitude: 5 + Math.random() * 20,
    battery: 100,
    enTemperature: 28,
    enHumidity: 65,
    airQuality: 120,
    temperature: 38.3,
    heartRateRaw: 450, // dashboard divides by 5 -> ~90 BPM
    steps: 0,
  };
}

function stepReadings(readings) {
  readings.latitude = randomWalk(readings.latitude, -90, 90, 0.0008);
  readings.longitude = randomWalk(readings.longitude, -180, 180, 0.0008);
  readings.altitude = randomWalk(readings.altitude, 0, 100, 1.5);
  readings.battery = Math.max(0, readings.battery - Math.random() * 0.15);
  readings.enTemperature = randomWalk(readings.enTemperature, 20, 35, 0.4);
  readings.enHumidity = randomWalk(readings.enHumidity, 40, 90, 1.5);
  readings.airQuality = randomWalk(readings.airQuality, 40, 300, 8);
  readings.temperature = randomWalk(readings.temperature, 37.5, 39.5, 0.15);
  readings.heartRateRaw = randomWalk(readings.heartRateRaw, 350, 600, 12); // ~70-120 BPM displayed
  readings.steps += Math.round(Math.random() * 8);
  return readings;
}

function toTelemetryPayload(deviceId, readings) {
  return {
    "Device ID": String(deviceId), // stored as a string to match the string deviceId from useParams() on /pet/:deviceId
    Latitude: readings.latitude,
    Longitude: readings.longitude,
    Altitude: readings.altitude,
    Battery: Math.round(readings.battery * 10) / 10,
    En_temperature: Math.round(readings.enTemperature * 10) / 10,
    en_humidity: Math.round(readings.enHumidity * 10) / 10,
    AirQuality: Math.round(readings.airQuality),
    Temperature: Math.round(readings.temperature * 10) / 10,
    hartrate: Math.round(readings.heartRateRaw), // field name matches existing schema (device firmware typo, preserved)
    step: readings.steps,
    timestamp: formatTimestamp(new Date()),
  };
}

async function publishTelemetry(deviceId, readings) {
  const payload = toTelemetryPayload(deviceId, readings);
  const mode = getSimulatorMode();

  if (mode === "direct-firebase") {
    const url = getFirebaseRestUrl();
    const authSecret = process.env.IOT_SIMULATOR_FIREBASE_DATABASE_SECRET;
    await axios.post(url, payload, {
      params: authSecret ? { auth: authSecret } : undefined,
    });
  } else {
    // "ingestion": hand the raw telemetry to the configured Worker/ingestion
    // endpoint, same as the real device would - no Firebase URL or secret
    // involved on this side.
    await axios.post(getIngestUrl(), payload);
  }

  return payload;
}

function createDevice() {
  const deviceId = nextDeviceId;
  nextDeviceId += 1;

  devices.set(deviceId, {
    deviceId,
    readings: createInitialReadings(),
    intervalId: null,
    intervalMs: DEFAULT_TICK_INTERVAL_MS,
    running: false,
    startedAt: null,
    lastTelemetry: null,
    lastError: null,
  });

  return deviceId;
}

function getDevice(deviceId) {
  return devices.get(Number(deviceId));
}

function startDevice(deviceId, intervalMs) {
  const device = getDevice(deviceId);
  if (!device) return null;

  if (device.running) return device;

  device.intervalMs = intervalMs && intervalMs >= 1000 ? intervalMs : DEFAULT_TICK_INTERVAL_MS;
  device.running = true;
  device.startedAt = new Date().toISOString();
  device.lastError = null;

  const tick = async () => {
    try {
      stepReadings(device.readings);
      device.lastTelemetry = await publishTelemetry(device.deviceId, device.readings);
      device.lastError = null;
    } catch (err) {
      device.lastError = err.message;
      logger.error(`IoT simulator device ${device.deviceId} failed to publish telemetry: ${err.message}`);
    }
  };

  // Publish immediately so the dashboard has data without waiting a full interval.
  tick();
  device.intervalId = setInterval(tick, device.intervalMs);

  return device;
}

function stopDevice(deviceId) {
  const device = getDevice(deviceId);
  if (!device) return null;

  if (device.intervalId) {
    clearInterval(device.intervalId);
    device.intervalId = null;
  }
  device.running = false;

  return device;
}

function toStatus(device) {
  return {
    deviceId: device.deviceId,
    running: device.running,
    intervalMs: device.intervalMs,
    startedAt: device.startedAt,
    mode: process.env.IOT_SIMULATOR_MODE || "ingestion",
    lastTelemetry: device.lastTelemetry,
    lastError: device.lastError,
  };
}

module.exports = {
  SIMULATOR_ID_RANGE_START,
  createDevice,
  getDevice,
  startDevice,
  stopDevice,
  toStatus,
};
