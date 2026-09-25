import axios from "axios";
import crypto from "crypto";
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
//   - "ingestion" (default): POSTs a signed telemetry envelope to
//     IOT_SIMULATOR_INGEST_URL, i.e. the same authenticated Worker/ingestion
//     endpoint a real device must call since the V28 telemetry-authentication
//     remediation (security-assessment/remediation/V28-iot-telemetry-authentication.md).
//     The simulator never touches Firebase directly in this mode, exactly like
//     the real micro:bit doesn't.
//   - "direct-firebase": writes straight to the Firebase Realtime Database,
//     bypassing the Worker (and therefore bypassing authentication entirely).
//     A local dashboard-testing fallback only, for when no ingestion endpoint
//     is deployed/reachable — not representative of the authenticated path.
//
// State is in-memory only (Map), by design: this is a disposable test aid,
// not a persisted device registry, and it does not touch the Pet/Mongo
// schema. Restarting the backend clears all simulator devices.
// ---------------------------------------------------------------------------

const SIMULATOR_ID_RANGE_START = 900001;
const DEFAULT_TICK_INTERVAL_MS = 15000; // stays well under the dashboard's 4-minute "disconnected" threshold
const MAX_RUN_MS = 5 * 60 * 1000; // auto-stop a run after 5 minutes so a forgotten/closed tab doesn't keep writing telemetry indefinitely

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

// Shared secret this simulator signs with in "ingestion" mode. Must match the
// Worker's INGEST_SHARED_SECRET (Cloudflare dashboard secret, not this repo)
// for the Worker to accept simulator-originated telemetry. This is the
// documented shared-secret limitation, not per-device identity: it is only
// good enough to let the simulator (which mints arbitrary ad-hoc device IDs
// for testing) prove "I know the ingestion secret", not "I am device X". The
// one real physical tracker should instead be provisioned its own entry in
// the Worker's DEVICE_SECRETS KV binding, keyed by its real Device ID — see
// the Worker's own header comment and the remediation doc.
function getDeviceSharedSecret() {
  const secret = process.env.IOT_SIMULATOR_DEVICE_SECRET;
  if (!secret) {
    throw new Error(
      "IOT_SIMULATOR_DEVICE_SECRET is not set. Add it to backend/.env (see .env.example) — it must match the ingestion Worker's INGEST_SHARED_SECRET to use the authenticated IoT simulator in ingestion mode."
    );
  }
  return secret;
}

function buildCanonicalMessage(deviceId, timestamp, nonce, telemetryRaw) {
  return `${deviceId}\n${timestamp}\n${nonce}\n${telemetryRaw}`;
}

// Signs a telemetry payload into the envelope the authenticated Worker
// expects: { deviceId, timestamp, nonce, telemetry (raw JSON string),
// signature }. The telemetry field is sent as the exact JSON string that was
// signed, not re-parsed/re-serialized, so the Worker verifies the identical
// bytes this function signed.
function signTelemetry(deviceId, telemetryPayload) {
  const secret = getDeviceSharedSecret();
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString("hex");
  const telemetryRaw = JSON.stringify(telemetryPayload);
  const canonicalMessage = buildCanonicalMessage(String(deviceId), timestamp, nonce, telemetryRaw);
  const signature = crypto.createHmac("sha256", secret).update(canonicalMessage).digest("hex");

  return {
    deviceId: String(deviceId),
    timestamp,
    nonce,
    telemetry: telemetryRaw,
    signature,
  };
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
    // "ingestion": sign the telemetry the same way an authenticated device
    // must, then hand the envelope to the configured Worker/ingestion
    // endpoint - no Firebase URL or secret involved on this side.
    const envelope = signTelemetry(deviceId, payload);
    await axios.post(getIngestUrl(), envelope);
  }

  return payload;
}

function createDevice(ownerId) {
  const deviceId = nextDeviceId;
  nextDeviceId += 1;

  devices.set(deviceId, {
    deviceId,
    ownerId: String(ownerId),
    readings: createInitialReadings(),
    intervalId: null,
    autoStopTimeoutId: null,
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

function clearTimers(device) {
  if (device.intervalId) {
    clearInterval(device.intervalId);
    device.intervalId = null;
  }
  if (device.autoStopTimeoutId) {
    clearTimeout(device.autoStopTimeoutId);
    device.autoStopTimeoutId = null;
  }
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

  // Bound how long an unattended/forgotten run can keep writing telemetry
  // (a closed browser tab may also send a best-effort stop, but this timer
  // is the guaranteed backstop regardless of what the client does).
  device.autoStopTimeoutId = setTimeout(() => stopDevice(deviceId), MAX_RUN_MS);

  return device;
}

function stopDevice(deviceId) {
  const device = getDevice(deviceId);
  if (!device) return null;

  clearTimers(device);
  device.running = false;

  return device;
}

function deleteDevice(deviceId) {
  const device = getDevice(deviceId);
  if (!device) return false;

  clearTimers(device);
  devices.delete(device.deviceId);
  return true;
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
  deleteDevice,
  toStatus,
};
