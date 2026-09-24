# V28 Remediation — Unauthenticated IoT Telemetry Ingestion / Spoofing

**Student:** Asesh Nemal
**Student ID:** IT23236264
**Module:** SE4030 Secure Software Development
**Project:** AI- and IoT-Integrated Pet Care System
**Finding:** V28 — Unauthenticated IoT Telemetry Ingestion / Spoofing
**Status:** Remediated and Verified

> **Classification note:** V28 has two independent halves. The dashboard/read-access
> half (an unauthenticated visitor viewing another pet's telemetry) was already fixed
> and verified in `security-assessment/remediation/V28-pet-tracker-access-control.md`
> and is **preserved, unmodified, by this remediation**. This document covers the
> remaining half: the **ingestion** side — nothing proves that a telemetry POST
> actually came from the legitimate physical tracker for the claimed Device ID.

## Vulnerability

The Cloudflare Worker that relays telemetry into Firebase
(`Pet Health Tracker/worker(cloudflare).js`) accepts **any** POST body from **any**
caller and forwards it to the Firebase Realtime Database `petcare` node, with no
signature, token, or device-identity check of any kind. An attacker able to reach
the Worker's public URL can submit a payload claiming any `Device ID` — including
one already paired to another user's pet — and have it written to Firebase as if
it came from the real tracker.

## Security Impact

- Fabricated health/location telemetry (temperature, heart rate, GPS, battery,
  step count) can be injected for any Device ID, reaching the owner's dashboard
  as if it were genuine sensor data.
- Because the previous access-control fix now correctly binds a device to its
  owner for **reads**, injected data under a legitimate Device ID lands directly
  in front of that device's real, authorized owner — the write-side gap is not
  neutralized by the read-side fix.
- A pet owner could misjudge their pet's real medical condition (e.g. a spoofed
  normal heart rate masking a real emergency, or a spoofed abnormal reading
  causing unnecessary alarm).

## Root Cause

Confirmed by inspecting the current code (not assumed):

- **`Pet Health Tracker/worker(cloudflare).js`** — `handleRequest()` reads the
  raw request body, adds a server-side timestamp, and immediately `POST`s it to
  the Firebase REST URL. There is no header, field, or token expected or checked
  before that write. The Firebase database secret used for the *outbound* write
  is a hardcoded placeholder string in the source
  (`const FIREBASE_SECRET = "your_database_secret";`), which is itself the wrong
  place for real verification material even before considering the *inbound* side.
- **`backend/src/services/iotSimulatorService.js`** — in `ingestion` mode (the
  mode documented as representative of the real device), `publishTelemetry()`
  POSTs the raw telemetry object straight to `IOT_SIMULATOR_INGEST_URL` with
  `axios.post(getIngestUrl(), payload)` — no signing, no auth headers. This
  intentionally mirrors the real device's current (vulnerable) behavior, per
  `docs/IOT_SIMULATOR.md`'s existing "Security posture — nothing here was fixed"
  section.
- **`backend/src/API/routes/dataRoutes.js`** — confirmed dead code: it is not
  `require`d anywhere in the live `backend/src/app.js` (only in the unused
  `app_backup_full.js` / `app_corrupted.js`), and its single route
  (`GET /pets`, a Firestore `pets` collection read) is unrelated to telemetry
  ingestion. It is not part of the active ingestion path and needed no changes
  for this finding.
- **`docs/IOT_SIMULATOR.md`** — already documents, accurately, that "No device
  authentication, signing, API keys, or replay protection were added to the
  simulated telemetry path" and that the Worker "accepts any POST body from any
  caller with no device authentication." This confirms the gap was known and
  intentionally left for this remediation phase.
- **Physical device firmware** — the repository contains no firmware *source*
  for the micro:bit/SIM800L tracker, only a compiled binary
  (`Pet Health Tracker/microbit-Pet-Helath-Tracker.hex`) and a plain-text
  hardware/protocol description (`Pet Health Tracker/PetHealthTracker`). There is
  no MakeCode/Arduino project, `.ts`/`.py`/`.cpp` source, or build config in this
  repository for that firmware. This is confirmed by directory listing, not
  assumed — see **Remaining Limitations** below for what this means for scope.

**Conclusion:** the ingestion endpoint trusts the caller unconditionally. Nothing
in the request — not a header, not a shared value, not a timestamp — is checked
against anything the legitimate device alone would know before the payload is
written to the shared `petcare` node.

## Before-Remediation Test

Environment: localhost/controlled test only. No production or third-party system
was contacted.

Script: `security-assessment/evidence/V28-ingestion/before-fix-spoof-test.js`,
run against a frozen snapshot of the pre-fix Worker source taken from this
branch before any remediation code was written
(`security-assessment/evidence/V28-ingestion/worker-before-fix.snapshot.js`,
byte-identical to `Pet Health Tracker/worker(cloudflare).js` at commit
`339e2ac` — confirmed with `diff` before capturing this evidence).

The script:

1. Registers the global `addEventListener("fetch", ...)` the Worker installs at
   load time (reproducing exactly how Cloudflare's runtime dispatches a request
   to it), and stubs the outbound `fetch()` call the Worker makes to Firebase so
   this test never contacts any real Firebase project.
2. Dispatches a fabricated telemetry payload claiming `"Device ID": "1001"` — a
   device this script does not own or control — with **no** signature, nonce,
   timestamp, or authentication field of any kind, and no headers or tokens.
3. Records whether the fabricated request reaches the Firebase write, and with
   what body.

## Actual Before-Fix Behaviour

```
$ node before-fix-spoof-test.js
=== V28 BEFORE-FIX reproduction: unauthenticated telemetry spoofing ===
Request body sent to the worker (no auth fields present):
{
  "Device ID": "1001",
  "Latitude": 6.9271,
  "Longitude": 79.8612,
  "Battery": 100,
  "Temperature": 45,
  "hartrate": 220,
  "step": 999999,
  "timestamp": "24/09/2026, 00:00:00"
}

Worker response status/body: {"name":"-StubbedFirebasePushId"}

Outbound calls to Firebase (stubbed): 1
Firebase call URL: https://pet******-16b82-default-rtdb.firebaseio.com/petcare.json?auth=your_database_secret
Firebase call body: {"Device ID":"1001","Latitude":6.9271,"Longitude":79.8612,"Battery":100,"Temperature":45,"hartrate":220,"step":999999,"timestamp":"24/09/2026, 00:00:00","Time":"25/09/2026, 00:22:37"}

RESULT: VULNERABLE — the fabricated payload for spoofed Device ID "1001" reached the Firebase write with zero authentication, signature, or ownership checks of any kind.
```

Full captured output:
`security-assessment/evidence/V28-ingestion/before-fix-spoof-test-output.txt`

**Result: the "before" behaviour matches the vulnerability as described.** A
completely fabricated payload for a spoofed Device ID, carrying no proof of
device identity whatsoever, was accepted and forwarded to the Firebase write
step without a single check standing in its way.

## Evidence

- Reproduction script:
  `security-assessment/evidence/V28-ingestion/before-fix-spoof-test.js`
- Frozen pre-fix Worker snapshot used by the script:
  `security-assessment/evidence/V28-ingestion/worker-before-fix.snapshot.js`
- Captured output:
  `security-assessment/evidence/V28-ingestion/before-fix-spoof-test-output.txt`
- Relevant source locations reviewed as evidence:
  `Pet Health Tracker/worker(cloudflare).js`,
  `backend/src/services/iotSimulatorService.js`, `docs/IOT_SIMULATOR.md`,
  `backend/src/API/routes/dataRoutes.js`, `backend/src/app.js`.
- No real Firebase project, real device secret, or real user/pet data was
  contacted or recorded. Device ID `1001` is a fabricated value chosen for this
  test only.

## Planned Remediation

- Require every ingestion request to carry a Device ID, timestamp, nonce, and
  an HMAC-SHA256 signature over a canonical representation of those fields plus
  the telemetry payload.
- Verify the signature against a device secret held only by the Worker
  (Cloudflare secret / KV binding), never by the frontend or in Git history.
- Reject missing/invalid signatures, stale timestamps, and replayed
  (deviceId, nonce) pairs — all before any Firebase write is attempted.
- Update the simulator's `ingestion` mode to sign its requests the same way a
  legitimate device would, without weakening the Worker's verification to make
  the simulator's job easier.
- Document, rather than silently work around, the physical firmware's source
  unavailability and any shared-secret (vs. true per-device) limitation.

## Remediation Implemented

**`Pet Health Tracker/worker(cloudflare).js`** (rewritten as a Cloudflare
"ES Module" Worker — `export default { fetch(request, env) }` — instead of the
legacy service-worker `addEventListener("fetch", ...)` style, specifically so
its secrets/KV bindings are read from `env` rather than hardcoded/global
values; still a single self-contained file with no imports, matching how it is
pasted into the Cloudflare dashboard today):

Every ingestion request must now be an authentication envelope, not a bare
telemetry POST:

```json
{
  "deviceId": "1001",
  "timestamp": 1735113600000,
  "nonce": "6f1c9e2a...",
  "telemetry": "{\"Device ID\":\"1001\",...}",
  "signature": "b6e1c4..."
}
```

`handleRequest()` now, in order, before ever calling Firebase:

1. Rejects (401) if `deviceId`, `timestamp`, `nonce`, `telemetry`, or
   `signature` is missing or the wrong type.
2. Resolves the device's secret: a per-device secret from the optional
   `DEVICE_SECRETS` KV binding if one is provisioned for that `deviceId`,
   otherwise the shared `INGEST_SHARED_SECRET`. Rejects (500) if neither
   resolves.
3. Recomputes the canonical message
   (`deviceId + "\n" + timestamp + "\n" + nonce + "\n" + telemetry`, using the
   *raw* telemetry string as received, never a re-serialized copy — this
   avoids a valid signature being broken by JSON key-reordering) and verifies
   the HMAC-SHA256 signature against it using `crypto.subtle.verify()` —
   SubtleCrypto's own verify, not a hand-rolled comparison, satisfying "compare
   signatures safely". Rejects (401) on mismatch.
4. Rejects (401) if `|Date.now() - timestamp| > 5 minutes`.
5. Rejects (401) if `deviceId:nonce` has been seen before — checked/recorded
   in the optional `NONCE_STORE` KV binding (durable, TTL'd) if configured, or
   an in-memory per-isolate `Map` fallback otherwise (see **Remaining
   Limitations**).
6. Parses the (now-verified) `telemetry` JSON and rejects (401) if its own
   `"Device ID"` field doesn't match the authenticated `deviceId` — defense in
   depth against a validly-signed envelope for one device smuggling a
   different device's identity into the stored record.
7. Only now adds the Sri Lanka timestamp and forwards to Firebase, exactly as
   before.

**`backend/src/services/iotSimulatorService.js`:** `ingestion` mode now signs
its telemetry into the envelope above (`signTelemetry()` — new) before
POSTing, using a new required `IOT_SIMULATOR_DEVICE_SECRET` env var as the
HMAC key. `direct-firebase` mode is unchanged (it bypasses the Worker and
therefore authentication entirely, exactly as already documented — not the
mode used for SE4030 security testing).

**`backend/.env.example` / `docs/IOT_SIMULATOR.md`:** documented the new
`IOT_SIMULATOR_DEVICE_SECRET` variable and updated the security-posture and
payload-schema sections to describe the now-authenticated `ingestion` mode.

**`backend/src/API/routes/dataRoutes.js`:** left unchanged. Confirmed (again)
to be dead code — not `require`d anywhere in the live `backend/src/app.js` —
and unrelated to telemetry ingestion (its one route reads a Firestore `pets`
collection, not device telemetry). Not part of this finding's active code
path; removing dead code was not requested and is outside this remediation's
scope.

### Hardening added after internal security review (before commit)

Three issues found in a self-review of the first draft of this fix were
corrected before committing anything:

1. **Per-device secret fallback was not authoritative.** The original
   `resolveDeviceSecret()` fell through to `INGEST_SHARED_SECRET` whenever a
   claimed `deviceId` had no entry in `DEVICE_SECRETS`, even when
   `DEVICE_SECRETS` was configured. That meant anyone who knew the shared
   secret could still impersonate an *unregistered* device ID, defeating the
   purpose of provisioning per-device secrets at all. Fixed in
   `Pet Health Tracker/worker(cloudflare).js:136-151`: once `DEVICE_SECRETS`
   is configured (`isDeviceSecretsConfigured()`), it is now **authoritative**
   — a missing entry resolves to `null` and is rejected (`:211-220`, `401
   "Unknown device"`), with **no fallback** to the shared secret. The shared
   secret is only ever consulted when `DEVICE_SECRETS` is not configured at
   all.
2. **No HTTP method restriction.** Any method (GET/PUT/PATCH/DELETE/...)
   carrying a validly-signed body would previously be processed identically
   to POST. Fixed at `worker(cloudflare).js:180-182`: any non-POST method is
   rejected immediately with `405` and an `Allow: POST` header, before any
   body is read.
3. **No request-size limit.** `request.text()` would buffer and then
   HMAC-verify an arbitrarily large body before any rejection could occur —
   a resource-consumption gap, even though an unauthenticated oversized body
   still couldn't reach Firebase. Fixed with `readBodyWithLimit()`
   (`worker(cloudflare).js:70-100`), which streams the body in via
   `request.body.getReader()` and aborts as soon as the configured limit is
   exceeded (default 32 KiB, overridable per-Worker via
   `MAX_INGEST_BODY_BYTES`) — enforced against bytes actually received, not
   the client-supplied `Content-Length` header, so a missing or false
   `Content-Length` cannot bypass it. Oversized requests get `413` before
   JSON parsing or HMAC verification.

This satisfies the required design:

```
Worker requires method === POST                    → other method     → 405 (Allow: POST)
        ↓
Worker streams the body up to MAX_INGEST_BODY_BYTES → oversized        → 413
        ↓
Worker requires all auth fields present             → missing/malformed → 401
        ↓
Worker resolves the device's secret:
  - DEVICE_SECRETS configured -> per-device lookup ONLY (no fallback)
        ↓ no entry for this deviceId                 → 401 "Unknown device"
  - DEVICE_SECRETS not configured -> shared secret
        ↓ neither configured                         → 500 (server misconfigured)
        ↓
Worker recomputes HMAC-SHA256 and verifies it       → mismatch          → 401
        ↓
Worker checks |now - timestamp| <= 5 minutes        → stale/future      → 401
        ↓
Worker checks deviceId:nonce not already seen       → replay            → 401
        ↓
Worker checks telemetry's own Device ID matches     → mismatch          → 401
        ↓ all checks pass
Worker adds server timestamp, forwards to Firebase  → 200 (or Firebase's status)
```

## Physical Device Firmware

The repository contains **no firmware source** for the micro:bit/SIM800L
tracker — only a compiled binary
(`Pet Health Tracker/microbit-Pet-Helath-Tracker.hex`) and a plain-text
hardware/protocol note (`Pet Health Tracker/PetHealthTracker`). There is no
MakeCode project, `.ts`/`.py`/`.cpp`/`.ino` source, or build configuration
checked in for it anywhere in this repository. Confirmed by directory listing
before starting this remediation, not assumed.

**No firmware source was changed, because none exists in this repository to
change.** What this remediation instead does for the physical device:

- Documents the exact protocol the firmware would need to implement (this
  document's **Remediation Implemented** section above): compute
  `HMAC-SHA256(secret, deviceId + "\n" + timestamp + "\n" + nonce + "\n" +
  telemetryJson)` and send it as the envelope shown above, instead of the bare
  telemetry POST it currently sends.
- Recommends the real tracker be provisioned its **own** entry in the Worker's
  `DEVICE_SECRETS` KV binding (true per-device credential, and practical here
  specifically because there is exactly one physical unit), rather than
  sharing the simulator's `INGEST_SHARED_SECRET`.
- Whoever holds the actual MakeCode/Arduino project used to produce
  `microbit-Pet-Helath-Tracker.hex` (outside this repository) would need to
  add HMAC-SHA256 signing (or a pre-computed per-boot signature if the
  microcontroller cannot do HMAC directly — the SIM800L's host MCU is the
  micro:bit itself, which does have enough compute for this) using the steps
  above before that binary can pass the now-enforced Worker verification.

**Runtime verification for this remediation used the simulator, not the
physical prototype, because the physical prototype is unavailable during this
assessment** (consistent with `docs/IOT_SIMULATOR.md`'s existing statement to
that effect for the whole assignment). No claim of physical-device runtime
verification is made.

## After-Remediation Test

Repeated the exact same spoofing test used before, against the fixed
`Pet Health Tracker/worker(cloudflare).js` (the live, remediated source — not
a snapshot).

Script: `security-assessment/evidence/V28-ingestion/after-fix-spoof-test.js`.

## After-Remediation Results

```
$ node after-fix-spoof-test.js
=== V28 AFTER-FIX reproduction #1: exact same spoofing attempt as before ===
Request body (identical fabricated payload, no auth fields):
{
  "Device ID": "1001",
  ...
}

Worker response status: 401
Worker response body: {"error":"Missing or invalid authentication fields"}
Outbound calls to Firebase so far: 0

RESULT #1: FIXED — the fabricated, unsigned payload was rejected before reaching Firebase.

=== V28 AFTER-FIX reproduction #2a: unsupported HTTP method (GET) ===
Worker response status: 405, Allow header: POST
Worker response body: {"error":"Method Not Allowed"}
Outbound calls to Firebase so far: 0
RESULT #2a: unsupported method rejected with 405, never reached Firebase.

=== V28 AFTER-FIX reproduction #2b: oversized request body ===
Worker response status: 413
Worker response body: {"error":"Payload Too Large"}
Outbound calls to Firebase so far: 0
RESULT #2b: oversized request rejected with 413, never reached Firebase.

=== V28 AFTER-FIX reproduction #3: legitimate, correctly signed request ===
...
Worker response status: 200
Worker response body: {"name":"-StubbedFirebasePushId"}
Outbound calls to Firebase total: 1

RESULT #3: legitimate, correctly authenticated telemetry still reaches Firebase normally.
```

Full captured output:
`security-assessment/evidence/V28-ingestion/after-fix-spoof-test-output.txt`

Automated test coverage — `backend/src/API/routes/__tests__/workerIngestionAuth.test.js`
(Jest, loads and executes the actual Worker source via a transpile-and-eval
harness against real Fetch API `Request` objects, not a reimplementation):

| Scenario | Expected | Result |
|---|---|---|
| Missing authentication fields | 401, Firebase never called | **Pass** |
| Wrong signature | 401, Firebase never called | **Pass** |
| Payload modified after signing | 401, Firebase never called | **Pass** |
| Stale timestamp (10 min old) | 401, Firebase never called | **Pass** |
| Replayed request (same deviceId+nonce twice) | 1st: 200; 2nd: 401, Firebase called only once total | **Pass** |
| Telemetry `Device ID` mismatched vs. authenticated `deviceId` | 401, Firebase never called | **Pass** |
| `DEVICE_SECRETS` absent + valid shared secret | 200, forwarded to Firebase with `Time` added | **Pass** |
| `DEVICE_SECRETS` configured + known device + correct per-device secret | 200, forwarded to Firebase | **Pass** |
| `DEVICE_SECRETS` configured + unknown device (shared secret also present) | 401 "Unknown device", Firebase never called — **no fallback** | **Pass** |
| GET / PUT / PATCH / DELETE (4 cases) | 405, `Allow: POST`, Firebase never called | **Pass** (×4) |
| Request body over the default 32 KiB limit | 413, Firebase never called | **Pass** |
| Request body within a custom `MAX_INGEST_BODY_BYTES` | 200, forwarded to Firebase | **Pass** |
| Simulator-produced envelope verified by the real Worker (interoperability) | 200, forwarded to Firebase | **Pass** |

```
$ npx jest
Test Suites: 2 passed, 2 total
Tests:       20 passed, 20 total
```

(2 suites = this file's 16 tests plus the pre-existing, unchanged
`petTracker.test.js` 4 tests from the earlier V28 access-control remediation —
confirming that fix is still intact.)

## Security Result

A caller that does not know a device's secret (per-device or the shared
fallback) can no longer inject telemetry for that device: the Worker rejects
missing signatures, wrong signatures, tampered payloads, stale timestamps, and
replayed requests before ever writing to Firebase. The exact fabricated,
zero-authentication payload that previously reached the Firebase write step
unconditionally is now rejected with 401 and never reaches it. Legitimate,
correctly signed telemetry (from the simulator's `ingestion` mode, and by
design from the real device once its firmware implements the documented
protocol) continues to flow through unchanged.

## Remaining Limitations

- **Shared secret, not universal per-device identity — but never a silent
  downgrade.** When `DEVICE_SECRETS` is **not configured at all**,
  `INGEST_SHARED_SECRET` is a single value shared by every device: it proves
  only "knows the secret", not distinct per-device identity, and a leaked
  shared secret compromises every device relying on it. This is the
  explicitly-allowed "simpler shared ingestion secret" fallback, documented
  here as a limitation rather than presented as per-device identity. Once
  `DEVICE_SECRETS` **is** configured, it is authoritative: a `deviceId` with
  no entry in it is rejected (`401 "Unknown device"`) and never silently
  falls back to the shared secret, even if `INGEST_SHARED_SECRET` also
  happens to be set (`Pet Health Tracker/worker(cloudflare).js:136-151`,
  `:211-220`) — verified in
  `backend/src/API/routes/__tests__/workerIngestionAuth.test.js` by a test
  that configures both simultaneously and confirms the unregistered device is
  still rejected. The one real physical tracker should be provisioned its own
  `DEVICE_SECRETS` entry; the simulator (arbitrary ad-hoc device IDs) is
  expected to keep using the shared-secret path by not having
  `DEVICE_SECRETS` configured for it at all.
- **Best-effort replay protection, not atomic.** If `NONCE_STORE` is not
  configured, replay protection falls back to an in-memory `Map` scoped to a
  single Worker isolate (`worker(cloudflare).js:56-59`) — it will not catch a
  replay routed to a different edge location or after an isolate restart.
  **Even with `NONCE_STORE` configured, protection is not atomic**:
  `isReplay()` (`worker(cloudflare).js:153-170`) performs a `get()` followed
  by a separate `put()` on the KV namespace, with no compare-and-set. Two
  requests carrying the identical `deviceId:nonce` arriving concurrently (a
  genuine retry, or a deliberate race by an attacker who captured a valid
  request) can both observe "not seen yet" before either write lands, so both
  could be accepted. Cloudflare KV has no atomic check-and-set primitive;
  closing this would require a Durable Object (or an equivalent atomic store)
  serializing nonce checks per device. **A Durable Object was deliberately
  not added in this remediation** (out of scope for this branch). This
  remediation does **not** claim complete protection against concurrent
  replay — only against a replay that arrives after the first request has
  already been recorded.
- **No physical-device runtime verification.** As documented above, the
  physical micro:bit/SIM800L prototype was not run as part of this
  remediation because it is unavailable during this assessment, and no
  firmware source exists in this repository to modify. Verification used the
  simulator only.
- **Firebase RTDB rules unchanged and unverified.** As already noted in
  `docs/IOT_SIMULATOR.md` and the prior access-control remediation, this
  repository does not define Firebase Realtime Database security rules, and
  whatever is actually deployed could not be confirmed from source. This
  remediation authenticates the *path into* Firebase (the Worker) but does not
  change or verify database-level rules.
- **`backend/src/API/routes/dataRoutes.js` and `pet_tracker.js`** remain
  unauthenticated, unmounted dead code, unchanged by this fix (confirmed not
  part of the active ingestion path — see **Root Cause**).
- **Pet Tracker dashboard/read-access authorization** — unchanged and
  preserved exactly as fixed in
  `security-assessment/remediation/V28-pet-tracker-access-control.md`; not
  touched by this remediation.

**Remediation owner / verification owner:**
Asesh Nemal — IT23236264
