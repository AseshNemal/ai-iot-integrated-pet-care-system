/**
 * Tests for the authenticated IoT telemetry ingestion Worker
 * (`Pet Health Tracker/worker(cloudflare).js`), added for the V28
 * telemetry-authentication remediation
 * (security-assessment/remediation/V28-iot-telemetry-authentication.md).
 *
 * The Worker lives outside this package (it is a standalone, single-file
 * Cloudflare Worker script with no bundler/imports, deployed by pasting it
 * into the Cloudflare dashboard) and is authored as an ES module
 * (`export default { fetch }`) so it can read Worker secrets/KV bindings via
 * its `env` parameter. Jest's automatic babel-jest transform only applies
 * within this package's boundary, so this file loads and transpiles the
 * Worker source itself with @babel/core (already a devDependency here) and
 * executes it in a throwaway CommonJS module, rather than changing Jest's
 * root/transform config to reach outside the backend package.
 *
 * Covers the required ingestion-authentication scenarios: missing auth,
 * wrong signature, tampered payload, stale timestamp, replay, a valid
 * authenticated device, per-device secret authority (DEVICE_SECRETS never
 * silently falls back to the shared secret for an unknown device), HTTP
 * method restriction, and request-size limiting — confirming in each rejected
 * case that Firebase is never called.
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const babel = require("@babel/core");
const Module = require("module");

const WORKER_PATH = path.resolve(__dirname, "../../../../..", "Pet Health Tracker", "worker(cloudflare).js");
const SHARED_SECRET = "test-shared-secret-do-not-use-in-prod";
const DEVICE_ID = "1001";

// Loads and transpiles the standalone Worker source (see file header) and runs
// it via indirect eval (not vm.runInThisContext/Module.prototype._compile,
// both of which Jest's Node test environment runs in a *different* realm from
// this test file). Indirect eval always executes in the global scope of
// whichever realm looked `eval` up — this file's — so the Worker's bare
// global references (fetch, crypto) resolve against the same `global.fetch =
// fetchMock` this file sets below, instead of Node's real process-global fetch.
function loadWorkerModule() {
  const source = fs.readFileSync(WORKER_PATH, "utf8");
  const { code } = babel.transform(source, {
    filename: WORKER_PATH,
    presets: [[require.resolve("@babel/preset-env"), { modules: "commonjs", targets: { node: "current" } }]],
    babelrc: false,
    configFile: false,
  });

  const wrapped = `(function(exports, require, module, __filename, __dirname) {\n${code}\n});`;
  // eslint-disable-next-line no-eval
  const compiledWrapper = (0, eval)(wrapped);
  const mod = { exports: {} };
  const req = Module.createRequire(WORKER_PATH);
  compiledWrapper(mod.exports, req, mod, WORKER_PATH, path.dirname(WORKER_PATH));
  return mod.exports;
}

function buildEnvelope({ deviceId = DEVICE_ID, secret = SHARED_SECRET, telemetry, timestamp, nonce, signatureOverride } = {}) {
  const ts = timestamp ?? Date.now();
  const n = nonce ?? crypto.randomBytes(8).toString("hex");
  const telemetryRaw = JSON.stringify(telemetry ?? { "Device ID": deviceId, Temperature: 38.2, hartrate: 420 });
  const canonicalMessage = `${deviceId}\n${ts}\n${n}\n${telemetryRaw}`;
  const signature = signatureOverride ?? crypto.createHmac("sha256", secret).update(canonicalMessage).digest("hex");

  return { deviceId, timestamp: ts, nonce: n, telemetry: telemetryRaw, signature };
}

// Real Fetch API Request objects (Node's global Request/undici), not ad hoc
// mocks — the Worker now reads `request.method` and streams `request.body`
// via getReader() (to enforce the size limit against actual bytes received,
// not the Content-Length header), so a plain `{ text: async () => ... }`
// stub is no longer sufficient to exercise it faithfully.
function requestFor(bodyValue, { method = "POST" } = {}) {
  const init = { method };
  if (bodyValue !== undefined) {
    init.body = typeof bodyValue === "string" ? bodyValue : JSON.stringify(bodyValue);
  }
  return new Request("https://ingest.invalid/telemetry", init);
}

function makeDeviceSecretsKV(secretsByDeviceId) {
  return {
    get: async (deviceId) =>
      Object.prototype.hasOwnProperty.call(secretsByDeviceId, deviceId) ? secretsByDeviceId[deviceId] : null,
  };
}

describe("Authenticated IoT ingestion Worker", () => {
  let worker;
  let env;
  let fetchMock;

  beforeEach(() => {
    worker = loadWorkerModule().default;
    fetchMock = jest.fn(async () => ({
      status: 200,
      json: async () => ({ name: "-MockedFirebasePushId" }),
    }));
    global.fetch = fetchMock;
    env = {
      FIREBASE_URL: "https://example-test.firebasedatabase.app/petcare.json",
      FIREBASE_SECRET: "test-firebase-secret",
      INGEST_SHARED_SECRET: SHARED_SECRET,
    };
  });

  test("missing authentication fields is rejected and never reaches Firebase", async () => {
    const request = requestFor({ telemetry: JSON.stringify({ "Device ID": DEVICE_ID }) });

    const res = await worker.fetch(request, env);

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("wrong signature is rejected and never reaches Firebase", async () => {
    const envelope = buildEnvelope({ signatureOverride: "0".repeat(64) });

    const res = await worker.fetch(requestFor(envelope), env);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/signature/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("payload modified after signing is rejected and never reaches Firebase", async () => {
    const envelope = buildEnvelope();
    // Tamper with the telemetry after the signature was computed over the original bytes.
    envelope.telemetry = JSON.stringify({ "Device ID": DEVICE_ID, Temperature: 99.9, hartrate: 999 });

    const res = await worker.fetch(requestFor(envelope), env);

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("stale timestamp is rejected and never reaches Firebase", async () => {
    const staleTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago, outside the 5-minute window
    const envelope = buildEnvelope({ timestamp: staleTimestamp });

    const res = await worker.fetch(requestFor(envelope), env);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/timestamp/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("replayed request is rejected on the second delivery and never reaches Firebase twice", async () => {
    const envelope = buildEnvelope();
    const request = requestFor(envelope);

    const first = await worker.fetch(request, env);
    expect(first.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const replay = await worker.fetch(requestFor(envelope), env);

    expect(replay.status).toBe(401);
    const body = await replay.json();
    expect(body.error).toMatch(/replay/i);
    expect(fetchMock).toHaveBeenCalledTimes(1); // still just the first, legitimate call
  });

  test("DEVICE_SECRETS absent + valid shared secret is accepted and forwarded to Firebase", async () => {
    const telemetry = { "Device ID": DEVICE_ID, Temperature: 38.4, hartrate: 440, step: 12 };
    const envelope = buildEnvelope({ telemetry });

    const res = await worker.fetch(requestFor(envelope), env);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [firebaseUrl, firebaseOptions] = fetchMock.mock.calls[0];
    expect(firebaseUrl).toBe(`${env.FIREBASE_URL}?auth=${env.FIREBASE_SECRET}`);
    const forwardedBody = JSON.parse(firebaseOptions.body);
    expect(forwardedBody["Device ID"]).toBe(DEVICE_ID);
    expect(forwardedBody.Temperature).toBe(38.4);
    expect(forwardedBody.Time).toBeDefined(); // Sri Lanka timestamp still added, as before the fix
  });

  test("telemetry claiming a different Device ID than the authenticated envelope is rejected", async () => {
    const envelope = buildEnvelope({
      deviceId: DEVICE_ID,
      telemetry: { "Device ID": "9999", Temperature: 38.0 }, // mismatched claim inside the signed telemetry
    });

    const res = await worker.fetch(requestFor(envelope), env);

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("DEVICE_SECRETS configured + known device + correct per-device secret is accepted", async () => {
    const perDeviceSecret = "per-device-secret-for-2002";
    const deviceSecretsEnv = { ...env, DEVICE_SECRETS: makeDeviceSecretsKV({ "2002": perDeviceSecret }) };
    const envelope = buildEnvelope({
      deviceId: "2002",
      secret: perDeviceSecret,
      telemetry: { "Device ID": "2002", Temperature: 38.1 },
    });

    const res = await worker.fetch(requestFor(envelope), deviceSecretsEnv);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("DEVICE_SECRETS configured + unknown device is rejected even though a shared secret is also set", async () => {
    const perDeviceSecret = "per-device-secret-for-2002";
    // INGEST_SHARED_SECRET is present on `env` (from beforeEach) alongside
    // DEVICE_SECRETS here — proving the rejection below is because "9999" has
    // no DEVICE_SECRETS entry, not because no shared secret exists at all.
    const deviceSecretsEnv = { ...env, DEVICE_SECRETS: makeDeviceSecretsKV({ "2002": perDeviceSecret }) };
    const envelope = buildEnvelope({
      deviceId: "9999", // not provisioned in DEVICE_SECRETS
      secret: env.INGEST_SHARED_SECRET, // signed with the shared secret, which must NOT be accepted here
      telemetry: { "Device ID": "9999", Temperature: 38.1 },
    });

    const res = await worker.fetch(requestFor(envelope), deviceSecretsEnv);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unknown device/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each(["GET", "PUT", "PATCH", "DELETE"])(
    "%s requests are rejected with 405 and never reach Firebase",
    async (method) => {
      const res = await worker.fetch(requestFor(undefined, { method }), env);

      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("POST");
      const body = await res.json();
      expect(body.error).toMatch(/method not allowed/i);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  test("a request body over the default size limit is rejected with 413 and never reaches Firebase", async () => {
    const oversizedBody = "x".repeat(64 * 1024); // 64 KiB, above the 32 KiB default

    const res = await worker.fetch(requestFor(oversizedBody), env);

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toMatch(/payload too large/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a request body within a custom configured size limit is still processed normally", async () => {
    const envelope = buildEnvelope();
    const serializedSize = Buffer.byteLength(JSON.stringify(envelope), "utf8");
    const customEnv = { ...env, MAX_INGEST_BODY_BYTES: String(serializedSize + 100) };

    const res = await worker.fetch(requestFor(envelope), customEnv);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Simulator + Worker interoperability", () => {
  // Regression guard for the fact that the simulator's signing logic
  // (backend/src/services/iotSimulatorService.js) and the Worker's
  // verification logic are two independent implementations (the Worker is a
  // standalone, unbundled Cloudflare script with no shared import path) that
  // must agree on the exact same canonical-message construction to interoperate.
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
    delete global.fetch;
  });

  test("an envelope actually produced by the simulator's ingestion mode is accepted by the Worker", async () => {
    jest.resetModules();
    jest.doMock("axios");

    process.env.IOT_SIMULATOR_MODE = "ingestion";
    process.env.IOT_SIMULATOR_INGEST_URL = "http://fake-worker.invalid/ingest";
    process.env.IOT_SIMULATOR_DEVICE_SECRET = SHARED_SECRET;

    const axios = require("axios");
    let capturedEnvelope = null;
    axios.post.mockImplementation(async (_url, envelope) => {
      capturedEnvelope = envelope;
      return { data: {} };
    });

    const simulator = require("../../../services/iotSimulatorService");
    const deviceId = simulator.createDevice();
    simulator.startDevice(deviceId, 60_000);

    // publishTelemetry's first tick is fired (not awaited) synchronously
    // inside startDevice; let its promise chain (through the mocked axios
    // call) settle before asserting on it.
    for (let i = 0; i < 5 && !capturedEnvelope; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    simulator.stopDevice(deviceId);

    expect(capturedEnvelope).not.toBeNull();
    expect(capturedEnvelope.deviceId).toBe(String(deviceId));

    const worker = loadWorkerModule().default;
    const firebaseFetchMock = jest.fn(async () => ({
      status: 200,
      json: async () => ({ name: "-MockedFirebasePushId" }),
    }));
    global.fetch = firebaseFetchMock;
    const workerEnv = {
      FIREBASE_URL: "https://example-test.firebasedatabase.app/petcare.json",
      FIREBASE_SECRET: "test-firebase-secret",
      INGEST_SHARED_SECRET: SHARED_SECRET,
    };

    const res = await worker.fetch(requestFor(capturedEnvelope), workerEnv);

    expect(res.status).toBe(200);
    expect(firebaseFetchMock).toHaveBeenCalledTimes(1);
    const forwardedBody = JSON.parse(firebaseFetchMock.mock.calls[0][1].body);
    expect(forwardedBody["Device ID"]).toBe(String(deviceId));
  });
});
