// Cloudflare Worker — authenticated IoT telemetry ingestion (SE4030 V28 remediation).
//
// Verifies that a telemetry POST really originates from a device that knows the
// configured device secret, checks the request hasn't expired or been replayed,
// and only then forwards it to Firebase. See docs/IOT_SIMULATOR.md and
// security-assessment/remediation/V28-iot-telemetry-authentication.md for the
// full design, setup steps, and before/after test evidence.
//
// Deploy this as an "ES Module" Worker (Cloudflare dashboard: Quick Edit ->
// make sure the format is Module, not the legacy Service Worker format), since
// it needs `env` for its secrets/bindings. It remains a single self-contained
// file with no imports, matching how it is pasted into the dashboard today.
//
// Expected request body (JSON):
//   {
//     "deviceId": "1001",              // sending device's ID (string)
//     "timestamp": 1735113600000,      // Date.now() in ms when the request was signed
//     "nonce": "6f1c9e2a...",          // random per-request string, unique per device
//     "telemetry": "{\"Device ID\":\"1001\",...}", // RAW JSON string of the telemetry payload
//     "signature": "b6e1c4..."         // hex HMAC-SHA256 over deviceId+"\n"+timestamp+"\n"+nonce+"\n"+telemetry
//   }
//
// The telemetry field is signed and transmitted as a literal JSON *string*
// (not a nested object) so the exact bytes that were signed are the exact
// bytes verified here — re-serializing a parsed object could reorder keys and
// break a perfectly valid signature.
//
// Configuration (Cloudflare dashboard -> Worker -> Settings -> Variables and Bindings):
//   FIREBASE_URL          - full Realtime Database REST URL for the "petcare" node (variable or secret)
//   FIREBASE_SECRET       - Firebase legacy database secret / auth token (secret)
//   INGEST_SHARED_SECRET  - fallback HMAC secret, used ONLY when DEVICE_SECRETS is not configured at all (secret)
//   DEVICE_SECRETS        - optional KV namespace binding: per-device secrets, key = deviceId, value = secret.
//                           Once this binding is present it is AUTHORITATIVE: a deviceId with no entry in it
//                           is rejected outright and never falls back to INGEST_SHARED_SECRET (that fallback
//                           would let anyone who knows the shared secret impersonate an unregistered device,
//                           defeating the point of per-device secrets). Practical for the one physical tracker
//                           (a single KV entry keyed by its real Device ID). Do not configure this binding at
//                           all if you want every device (e.g. the simulator's ad-hoc device IDs) to use the
//                           shared secret below.
//   NONCE_STORE           - optional KV namespace binding: recently-seen "deviceId:nonce" keys, for replay
//                           protection that survives across requests/isolates. Without it, replay protection
//                           falls back to an in-memory, per-isolate cache (best-effort only — see Remaining
//                           Limitations in the remediation doc). Even with this binding, protection is
//                           best-effort, not atomic — see Remaining Limitations.
//   MAX_INGEST_BODY_BYTES - optional: maximum request body size in bytes (default 32 KiB). Enforced while
//                           streaming the body in, not just via the (spoofable) Content-Length header.
//
// Only POST requests are accepted; anything else gets 405.
//
// Security posture / limitations: see "Remaining Limitations" in the remediation doc.

const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_TTL_SECONDS = 10 * 60; // 10 minutes
const DEFAULT_MAX_BODY_BYTES = 32 * 1024; // 32 KiB

// Best-effort fallback nonce cache, only used when no NONCE_STORE KV binding is
// configured. Scoped to this isolate's lifetime; not durable and not shared
// across edge locations or isolate restarts.
const inMemoryNonces = new Map();

function resolveMaxBodyBytes(env) {
  const configured = Number(env.MAX_INGEST_BODY_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_BODY_BYTES;
}

// Reads the request body up to maxBytes, aborting mid-stream the moment that
// limit is exceeded — this is enforced against the bytes actually received,
// not against the (client-supplied, spoofable) Content-Length header, so a
// missing or false Content-Length cannot bypass it.
async function readBodyWithLimit(request, maxBytes) {
  if (!request.body) return { tooLarge: false, text: "" };

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // best-effort cancellation only
      }
      return { tooLarge: true, text: null };
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { tooLarge: false, text: new TextDecoder().decode(combined) };
}

function hexToBytes(hex) {
  if (typeof hex !== "string" || hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function buildCanonicalMessage(deviceId, timestamp, nonce, telemetryRaw) {
  return `${deviceId}\n${timestamp}\n${nonce}\n${telemetryRaw}`;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

// Uses SubtleCrypto's own verify() rather than a manual byte comparison, so the
// signature check itself is not a hand-rolled (and easily timing-unsafe) equality.
async function verifySignature(secret, canonicalMessage, signatureHex) {
  const signatureBytes = hexToBytes(signatureHex);
  if (!signatureBytes) return false;
  const key = await importHmacKey(secret);
  return crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(canonicalMessage));
}

function isDeviceSecretsConfigured(env) {
  return Boolean(env.DEVICE_SECRETS && typeof env.DEVICE_SECRETS.get === "function");
}

async function resolveDeviceSecret(env, deviceId) {
  if (isDeviceSecretsConfigured(env)) {
    // DEVICE_SECRETS is authoritative once configured: a deviceId with no
    // entry is unknown and must be rejected, never silently downgraded to
    // the shared secret.
    return (await env.DEVICE_SECRETS.get(deviceId)) || null;
  }
  // DEVICE_SECRETS is not configured at all: every device shares one secret.
  // Documented limitation: this proves only "knows the shared secret", not
  // distinct per-device identity. See remediation doc.
  return env.INGEST_SHARED_SECRET || null;
}

async function isReplay(env, deviceId, nonce) {
  const key = `${deviceId}:${nonce}`;

  if (env.NONCE_STORE && typeof env.NONCE_STORE.get === "function") {
    const seen = await env.NONCE_STORE.get(key);
    if (seen) return true;
    await env.NONCE_STORE.put(key, "1", { expirationTtl: NONCE_TTL_SECONDS });
    return false;
  }

  const now = Date.now();
  for (const [k, expiresAt] of inMemoryNonces) {
    if (expiresAt <= now) inMemoryNonces.delete(k);
  }
  if (inMemoryNonces.has(key)) return true;
  inMemoryNonces.set(key, now + NONCE_TTL_SECONDS * 1000);
  return false;
}

function jsonResponse(status, body, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(extraHeaders || {}) },
  });
}

async function handleRequest(request, env) {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed" }, { Allow: "POST" });
  }

  const maxBodyBytes = resolveMaxBodyBytes(env);
  const { tooLarge, text: rawBody } = await readBodyWithLimit(request, maxBodyBytes);
  if (tooLarge) {
    return jsonResponse(413, { error: "Payload Too Large" });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const { deviceId, timestamp, nonce, telemetry, signature } = body || {};

  if (
    typeof deviceId !== "string" || deviceId.length === 0 ||
    typeof timestamp !== "number" || !Number.isFinite(timestamp) ||
    typeof nonce !== "string" || nonce.length === 0 ||
    typeof telemetry !== "string" || telemetry.length === 0 ||
    typeof signature !== "string" || signature.length === 0
  ) {
    // Reject before any secret lookup or Firebase call — an incomplete
    // request never gets far enough to learn anything from timing.
    return jsonResponse(401, { error: "Missing or invalid authentication fields" });
  }

  const secret = await resolveDeviceSecret(env, deviceId);
  if (!secret) {
    if (isDeviceSecretsConfigured(env)) {
      // DEVICE_SECRETS is authoritative and this device has no entry in it —
      // an expected, attacker-reachable rejection, not a server misconfiguration.
      return jsonResponse(401, { error: "Unknown device" });
    }
    console.error("Ingestion is not configured: no DEVICE_SECRETS binding and no INGEST_SHARED_SECRET");
    return jsonResponse(500, { error: "Ingestion not configured" });
  }

  const canonicalMessage = buildCanonicalMessage(deviceId, timestamp, nonce, telemetry);
  const signatureValid = await verifySignature(secret, canonicalMessage, signature);
  if (!signatureValid) {
    return jsonResponse(401, { error: "Invalid signature" });
  }

  if (Math.abs(Date.now() - timestamp) > MAX_TIMESTAMP_SKEW_MS) {
    return jsonResponse(401, { error: "Timestamp outside acceptable window" });
  }

  if (await isReplay(env, deviceId, nonce)) {
    return jsonResponse(401, { error: "Replayed request" });
  }

  let telemetryPayload;
  try {
    telemetryPayload = JSON.parse(telemetry);
  } catch {
    return jsonResponse(400, { error: "Invalid telemetry JSON" });
  }

  if (String(telemetryPayload["Device ID"]) !== deviceId) {
    return jsonResponse(401, { error: "Telemetry device ID does not match authenticated device" });
  }

  if (!env.FIREBASE_URL) {
    console.error("FIREBASE_URL is not configured");
    return jsonResponse(500, { error: "Ingestion not configured" });
  }

  // Get current time in Sri Lanka Standard Time (UTC+5:30), same as before this fix.
  const sriLankaTime = new Date().toLocaleString("en-GB", { timeZone: "Asia/Colombo" });
  telemetryPayload.Time = sriLankaTime;

  const firebaseUrl = env.FIREBASE_SECRET
    ? `${env.FIREBASE_URL}?auth=${env.FIREBASE_SECRET}`
    : env.FIREBASE_URL;

  const firebaseResponse = await fetch(firebaseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(telemetryPayload),
  });

  const result = await firebaseResponse.json();
  return jsonResponse(firebaseResponse.status, result);
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};

// Exported for unit testing only (see
// backend/src/API/routes/__tests__/workerIngestionAuth.test.js). Cloudflare's
// runtime only ever calls the default export's fetch().
export const __testables__ = {
  buildCanonicalMessage,
  verifySignature,
  resolveDeviceSecret,
  isReplay,
  handleRequest,
};
