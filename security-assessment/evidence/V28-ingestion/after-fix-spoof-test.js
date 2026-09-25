/**
 * AFTER-FIX evidence for V28 — Unauthenticated IoT Telemetry Ingestion / Spoofing.
 *
 * Controlled, localhost-only reproduction. Loads the FIXED
 * `Pet Health Tracker/worker(cloudflare).js` (the live, remediated source —
 * not a snapshot) and repeats the exact same fabricated, unsigned payload used
 * in before-fix-spoof-test.js, then demonstrates the fix's other hardening
 * (HTTP method restriction, request-size limiting) and, for completeness,
 * a properly authenticated request to confirm legitimate telemetry still works.
 *
 * `fetch` (the outbound call the worker makes to Firebase) is stubbed so this
 * test never contacts any real Firebase project. Requests are built as real
 * Fetch API `Request` objects (Node's global `Request`), not ad hoc stubs,
 * because the Worker reads `request.method` and streams `request.body` via
 * `getReader()`.
 */

const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const WORKER_PATH = path.join(__dirname, "..", "..", "..", "Pet Health Tracker", "worker(cloudflare).js");
const backendDir = path.join(__dirname, "..", "..", "..", "backend");

function loadBabel() {
  const babelCorePath = require.resolve("@babel/core", { paths: [backendDir] });
  const presetEnvPath = require.resolve("@babel/preset-env", { paths: [backendDir] });
  return { babel: require(babelCorePath), presetEnvPath };
}

function loadWorkerModule() {
  const { babel, presetEnvPath } = loadBabel();
  const source = require("fs").readFileSync(WORKER_PATH, "utf8");
  const { code } = babel.transform(source, {
    filename: WORKER_PATH,
    presets: [[presetEnvPath, { modules: "commonjs", targets: { node: "current" } }]],
    babelrc: false,
    configFile: false,
  });

  const wrapped = vm.runInThisContext(
    `(function(exports, require, module, __filename, __dirname) {\n${code}\n});`,
    { filename: WORKER_PATH }
  );
  const mod = { exports: {} };
  wrapped(mod.exports, require, mod, WORKER_PATH, path.dirname(WORKER_PATH));
  return mod.exports;
}

const SHARED_SECRET = "evidence-shared-secret-do-not-use-in-prod";
const FABRICATED_PAYLOAD = {
  "Device ID": "1001", // the exact same spoofed device ID used in the before-fix test
  Latitude: 6.9271,
  Longitude: 79.8612,
  Battery: 100,
  Temperature: 45.0,
  hartrate: 220,
  step: 999999,
  timestamp: "24/09/2026, 00:00:00",
};

function buildSignedEnvelope(deviceId, telemetry, secret) {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString("hex");
  const telemetryRaw = JSON.stringify(telemetry);
  const canonicalMessage = `${deviceId}\n${timestamp}\n${nonce}\n${telemetryRaw}`;
  const signature = crypto.createHmac("sha256", secret).update(canonicalMessage).digest("hex");
  return { deviceId: String(deviceId), timestamp, nonce, telemetry: telemetryRaw, signature };
}

function requestFor(bodyValue, { method = "POST" } = {}) {
  const init = { method };
  if (bodyValue !== undefined) {
    init.body = typeof bodyValue === "string" ? bodyValue : JSON.stringify(bodyValue);
  }
  return new Request("https://ingest.invalid/telemetry", init);
}

async function run() {
  const worker = loadWorkerModule().default;
  const env = {
    FIREBASE_URL: "https://example-test.firebasedatabase.app/petcare.json",
    FIREBASE_SECRET: "test-firebase-secret",
    INGEST_SHARED_SECRET: SHARED_SECRET,
  };

  let firebaseCallCount = 0;
  global.fetch = async (url, options) => {
    firebaseCallCount += 1;
    console.log("  (stubbed Firebase call would have been made with body:", options.body, ")");
    return { status: 200, json: async () => ({ name: "-StubbedFirebasePushId" }) };
  };

  console.log("=== V28 AFTER-FIX reproduction #1: exact same spoofing attempt as before ===");
  console.log("Request body (identical fabricated payload, no auth fields):");
  console.log(JSON.stringify(FABRICATED_PAYLOAD, null, 2));

  const spoofResponse = await worker.fetch(requestFor(FABRICATED_PAYLOAD), env);
  const spoofBody = await spoofResponse.json();

  console.log("");
  console.log(`Worker response status: ${spoofResponse.status}`);
  console.log("Worker response body:", JSON.stringify(spoofBody));
  console.log(`Outbound calls to Firebase so far: ${firebaseCallCount}`);
  console.log("");

  if (spoofResponse.status !== 200 && firebaseCallCount === 0) {
    console.log("RESULT #1: FIXED — the fabricated, unsigned payload was rejected before reaching Firebase.");
  } else {
    console.log("RESULT #1: UNEXPECTED — the spoofed request was not rejected. Investigate before proceeding.");
    process.exitCode = 1;
  }

  console.log("");
  console.log("=== V28 AFTER-FIX reproduction #2a: unsupported HTTP method (GET) ===");
  const getResponse = await worker.fetch(requestFor(undefined, { method: "GET" }), env);
  const getBody = await getResponse.json();
  console.log(`Worker response status: ${getResponse.status}, Allow header: ${getResponse.headers.get("Allow")}`);
  console.log("Worker response body:", JSON.stringify(getBody));
  console.log(`Outbound calls to Firebase so far: ${firebaseCallCount}`);
  if (getResponse.status === 405 && firebaseCallCount === 0) {
    console.log("RESULT #2a: unsupported method rejected with 405, never reached Firebase.");
  } else {
    console.log("RESULT #2a: UNEXPECTED — a non-POST method was not rejected as expected.");
    process.exitCode = 1;
  }

  console.log("");
  console.log("=== V28 AFTER-FIX reproduction #2b: oversized request body ===");
  const oversizedBody = "x".repeat(64 * 1024); // 64 KiB, above the 32 KiB default limit
  const sizeResponse = await worker.fetch(requestFor(oversizedBody), env);
  const sizeBody = await sizeResponse.json();
  console.log(`Worker response status: ${sizeResponse.status}`);
  console.log("Worker response body:", JSON.stringify(sizeBody));
  console.log(`Outbound calls to Firebase so far: ${firebaseCallCount}`);
  if (sizeResponse.status === 413 && firebaseCallCount === 0) {
    console.log("RESULT #2b: oversized request rejected with 413, never reached Firebase.");
  } else {
    console.log("RESULT #2b: UNEXPECTED — an oversized request was not rejected as expected.");
    process.exitCode = 1;
  }

  console.log("");
  console.log("=== V28 AFTER-FIX reproduction #3: legitimate, correctly signed request ===");
  const legitimateTelemetry = { "Device ID": "1001", Latitude: 6.9271, Longitude: 79.8612, Battery: 97, Temperature: 38.3, hartrate: 420, step: 1250, timestamp: "24/09/2026, 00:00:00" };
  const signedEnvelope = buildSignedEnvelope("1001", legitimateTelemetry, SHARED_SECRET);
  console.log("Signed envelope sent to the worker:");
  console.log(JSON.stringify(signedEnvelope, null, 2));

  const legitResponse = await worker.fetch(requestFor(signedEnvelope), env);
  const legitBody = await legitResponse.json();

  console.log("");
  console.log(`Worker response status: ${legitResponse.status}`);
  console.log("Worker response body:", JSON.stringify(legitBody));
  console.log(`Outbound calls to Firebase total: ${firebaseCallCount}`);

  if (legitResponse.status === 200 && firebaseCallCount === 1) {
    console.log("");
    console.log("RESULT #3: legitimate, correctly authenticated telemetry still reaches Firebase normally.");
  } else {
    console.log("");
    console.log("RESULT #3: UNEXPECTED — a validly signed request was not accepted. Investigate before proceeding.");
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error("Test script error:", err);
  process.exitCode = 1;
});
