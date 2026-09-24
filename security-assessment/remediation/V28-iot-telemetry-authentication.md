# V28 Remediation — Unauthenticated IoT Telemetry Ingestion / Spoofing

**Student:** Asesh Nemal
**Student ID:** IT23236264
**Module:** SE4030 Secure Software Development
**Project:** AI- and IoT-Integrated Pet Care System
**Finding:** V28 — Unauthenticated IoT Telemetry Ingestion / Spoofing
**Status:** Before Remediation

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

---

*(Sections below — Remediation Implemented, After-Remediation Test, Results,
Security Result, Remaining Limitations — are added once the fix is
implemented and verified.)*
