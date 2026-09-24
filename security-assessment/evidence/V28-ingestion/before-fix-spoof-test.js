/**
 * BEFORE-FIX evidence for V28 — Unauthenticated IoT Telemetry Ingestion / Spoofing.
 *
 * Controlled, localhost-only reproduction. Loads the frozen pre-fix snapshot of
 * `Pet Health Tracker/worker(cloudflare).js` (worker-before-fix.snapshot.js, saved
 * in this same directory before any remediation code was written) and drives it
 * exactly the way Cloudflare's runtime would: registers the global
 * `addEventListener("fetch", ...)` the worker installs, then dispatches a fake
 * FetchEvent carrying a fabricated telemetry payload.
 *
 * The payload:
 *   - claims a "Device ID" (1001) that this script does not own or control
 *   - contains no signature, nonce, or timestamp of any kind
 *   - is sent with no headers, tokens, or credentials
 *
 * `fetch` (the outbound call the worker makes to Firebase) is stubbed so this
 * test never contacts any real Firebase project or third-party system.
 *
 * Expected (vulnerable) result: the worker performs zero authentication checks
 * and forwards the fabricated payload straight to the stubbed Firebase call.
 */

const path = require("path");

const capturedHandlers = {};
global.addEventListener = (type, handler) => {
  capturedHandlers[type] = handler;
};

let firebaseCallCount = 0;
let firebaseCallArgs = null;
global.fetch = async (url, options) => {
  firebaseCallCount += 1;
  firebaseCallArgs = { url, options };
  return {
    json: async () => ({ name: "-StubbedFirebasePushId" }),
  };
};

// Loads and executes the frozen pre-fix worker source, which synchronously
// calls addEventListener("fetch", ...) at module top-level (service-worker style).
require(path.join(__dirname, "worker-before-fix.snapshot.js"));

const fabricatedPayload = {
  "Device ID": "1001", // spoofed: not this script's device, no proof of ownership
  Latitude: 6.9271,
  Longitude: 79.8612,
  Battery: 100,
  Temperature: 45.0, // implausible value — nothing validates this either
  hartrate: 220,
  step: 999999,
  timestamp: "24/09/2026, 00:00:00",
};

async function main() {
  const fakeRequest = {
    text: async () => JSON.stringify(fabricatedPayload),
  };

  let capturedResponsePromise = null;
  const fakeEvent = {
    request: fakeRequest,
    respondWith: (responsePromise) => {
      capturedResponsePromise = responsePromise;
    },
  };

  console.log("=== V28 BEFORE-FIX reproduction: unauthenticated telemetry spoofing ===");
  console.log("Request body sent to the worker (no auth fields present):");
  console.log(JSON.stringify(fabricatedPayload, null, 2));
  console.log("");

  capturedHandlers.fetch(fakeEvent);
  const response = await capturedResponsePromise;
  const responseBody = await response.json();

  console.log("Worker response status/body:", JSON.stringify(responseBody));
  console.log("");
  console.log(`Outbound calls to Firebase (stubbed): ${firebaseCallCount}`);
  if (firebaseCallCount > 0) {
    console.log("Firebase call URL:", firebaseCallArgs.url);
    console.log("Firebase call body:", firebaseCallArgs.options.body);
  }
  console.log("");

  if (firebaseCallCount > 0) {
    console.log(
      "RESULT: VULNERABLE — the fabricated payload for spoofed Device ID \"1001\" " +
        "reached the Firebase write with zero authentication, signature, or " +
        "ownership checks of any kind."
    );
    process.exitCode = 0;
  } else {
    console.log("RESULT: UNEXPECTED — the pre-fix worker rejected the request (should not happen).");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Test script error:", err);
  process.exitCode = 1;
});
