# IoT Pet Health Tracker Simulator (SE4030 test/demo aid)

The original system used a physical micro:bit/SIM800L-based Pet Health Tracker. Because the physical prototype is not available during the current SE4030 security assessment, a software simulator is provided to reproduce the original telemetry format and device behavior for repeatable testing. The simulator does not replace the original implementation.

> **Update (V28 telemetry-authentication remediation):** the Cloudflare Worker
> ingestion endpoint now requires an authenticated, signed request (see
> "Security posture" below and
> `security-assessment/remediation/V28-iot-telemetry-authentication.md`). The
> simulator's `ingestion` mode signs its requests accordingly. The Pet Tracker
> **read/dashboard-access** half of V28 was fixed separately and earlier — see
> `security-assessment/remediation/V28-pet-tracker-access-control.md` — and is
> unaffected by this update.

## Why this exists

The real data path is:

```
Sensors -> micro:bit -> SIM800L/GPRS -> Cloudflare Worker -> Firebase Realtime Database ("petcare" node) -> Pet dashboard
```

The simulator replaces **only the leftmost part of that chain**: the physical sensors, the micro:bit, and the SIM800L/GPRS link. It does not stand in for the Cloudflare Worker or Firebase. In its default mode it POSTs the same telemetry a real device would send, to the same kind of ingestion endpoint (the deployed Worker), and lets the rest of the original chain carry it through to Firebase and the dashboard unchanged.

## Enabling it

Simulator routes are only mounted when both are true:

```
ENABLE_IOT_SIMULATOR=true
NODE_ENV != production
```

The `NODE_ENV` check exists purely to keep this new testing utility from ever coming up in a production deployment, even if `ENABLE_IOT_SIMULATOR` were accidentally left set — it is protection for the simulator itself, not a security fix for the original application. When the simulator is disabled, the existing application's runtime behavior remains unchanged.

### Modes

Set `IOT_SIMULATOR_MODE` in `backend/.env` (see `backend/.env.example`):

- **`ingestion`** (default, the documented assignment mode) — the simulator signs its telemetry and POSTs the signed envelope to `IOT_SIMULATOR_INGEST_URL`, i.e. the same authenticated Worker/ingestion endpoint the physical device must call since the V28 telemetry-authentication remediation. The simulator never talks to Firebase directly in this mode, exactly like the real micro:bit doesn't.
- **`direct-firebase`** — the simulator writes straight to the Firebase Realtime Database `petcare` node, bypassing the Worker (and therefore bypassing authentication) entirely. This is a **local dashboard-testing fallback only**, for when no ingestion endpoint is deployed or reachable — it is not the mode used for SE4030 security testing, and it is not representative of the authenticated path.

```
ENABLE_IOT_SIMULATOR=true

# default, documented assignment mode
IOT_SIMULATOR_MODE=ingestion
IOT_SIMULATOR_INGEST_URL=https://<your-worker>.workers.dev
# Required for ingestion mode. Must match the Worker's own INGEST_SHARED_SECRET
# (a Cloudflare secret, configured in the Cloudflare dashboard — not in this repo).
IOT_SIMULATOR_DEVICE_SECRET=

# only read when IOT_SIMULATOR_MODE=direct-firebase
IOT_SIMULATOR_FIREBASE_DATABASE_URL=https://<your-database-name>.firebasedatabase.app
IOT_SIMULATOR_FIREBASE_DATABASE_SECRET=            # optional, only if your RTDB rules require it
```

These are new, optional, simulator-only variables — no existing required variable was changed, and no real project credentials are included in this repo; you supply your own ingestion URL / database URL / shared secret locally, matching whatever you configure on the Worker side.

## Architecture

- `backend/src/services/iotSimulatorService.js` — all simulator logic: in-memory device registry (a `Map`, not a database table), telemetry generation, start/stop timers, and the two publish modes described above.
- `backend/src/API/routes/simulatorRoutes.js` — thin Express router exposing the HTTP API below. Mounted only when the feature flag is on (and `NODE_ENV != production`).
- Both files are new and isolated from the rest of the application; no existing route, model, or middleware file was changed other than the few lines in `app.js` that conditionally mount `simulatorRoutes.js`.

Device state (position, battery, running interval, etc.) lives only in backend process memory. It is not persisted and is lost on restart — acceptable for a disposable test aid, not intended as a permanent device registry.

## HTTP API

All endpoints are under `/api/simulator` and are unauthenticated (see "Security posture" below).

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/simulator/devices` | — | `{ "deviceId": 900001 }` |
| POST | `/api/simulator/devices/:deviceId/start` | `{ "intervalMs": 15000 }` (optional) | current status |
| POST | `/api/simulator/devices/:deviceId/stop` | — | current status |
| GET | `/api/simulator/devices/:deviceId/status` | — | current status |

Status shape: `{ deviceId, running, intervalMs, startedAt, mode, lastTelemetry, lastError }`. `mode` reflects the active `IOT_SIMULATOR_MODE`.

## Device ID generation and pairing

Creating a device (`POST /api/simulator/devices`) allocates the next ID starting at `900001` and increments from there for the life of the backend process. This reserved range keeps simulator IDs visually distinct from real device IDs while satisfying the existing `Pet.deviceId` schema, which is an unconstrained `Number` (`backend/src/API/model/pet.js`) — no schema change was needed or made.

To pair a simulated device with a pet, use the **existing** pairing UI exactly as you would with a physical tracker:

1. Create a simulator device and note the returned `deviceId`.
2. Open the pet's record (`frontend/src/components/petRecord.js`), enter that numeric ID in the device ID field, and save (this goes through the existing `/pet/update/:id` route — untouched).
3. Start the simulator device so it begins publishing telemetry.
4. Navigate to `/pet/<deviceId>` as usual; `deviceData.js` reads it from Firebase like it would for a real device.

## Telemetry schema and compatibility

The simulator publishes the exact field set `deviceData.js` already expects in each `petcare` child record: `Device ID`, `Latitude`, `Longitude`, `Altitude`, `Battery`, `En_temperature`, `en_humidity`, `AirQuality`, `Temperature`, `hartrate`, `step`, `timestamp`. Field names (including the `hartrate` spelling and `AirQuality`/`en_humidity` casing) were copied as-is from the dashboard's parsing code, not corrected.

This same telemetry field set is used regardless of mode. In `direct-firebase` mode it is written straight to the `petcare` node unmodified. In `ingestion` mode it is no longer sent as a bare POST body: it is signed and wrapped in an authentication envelope —

```json
{
  "deviceId": "900001",
  "timestamp": 1735113600000,
  "nonce": "6f1c9e2a...",
  "telemetry": "{\"Device ID\":\"900001\",\"Latitude\":...}",
  "signature": "b6e1c4..."
}
```

— where `telemetry` is the exact telemetry JSON as a string (see
`buildCanonicalMessage`/`signTelemetry` in `iotSimulatorService.js`), and
`signature` is an HMAC-SHA256 over `deviceId + "\n" + timestamp + "\n" + nonce +
"\n" + telemetry`, keyed by `IOT_SIMULATOR_DEVICE_SECRET`. The Worker verifies
this envelope, and only the inner `telemetry` object (with its own `Time` field
added) is ever forwarded to Firebase — see
`security-assessment/remediation/V28-iot-telemetry-authentication.md` for the
full design.

Two behaviors were matched deliberately so simulated data renders correctly, per the "necessary for compatibility" allowance:

- **`timestamp` format**: `DD/MM/YYYY, HH:MM:SS` (`Date.toLocaleString("en-GB", { timeZone: "Asia/Colombo" })`), the same format the Cloudflare Worker produces and the same format `deviceData.js` parses via string-splitting.
- **`Device ID` type**: written as a **string**. `deviceData.js` compares `rawData[key]["Device ID"] === selectedDeviceId`, and `selectedDeviceId` comes from `useParams()`, which is always a string. Writing a number here would silently break the device-filtering/"Device Details" view for simulated devices (strict `===`), so it is written as a string to match.

Generated values are randomised walks around plausible baselines (e.g. body temperature ~38°C, heart rate raw value ~350-600 so the dashboard's `hartrate/5` display lands around 70-120 BPM, battery slowly draining from 100%, GPS drifting slightly around a fixed origin) — realistic enough for dashboard/chart demonstration, not a scientific sensor model.

## Security posture

- **Ingestion (Worker) authentication — fixed.** The Cloudflare Worker
  (`Pet Health Tracker/worker(cloudflare).js`) now requires a valid HMAC-SHA256
  signature, a fresh timestamp, and a not-previously-seen nonce before it will
  forward any telemetry to Firebase; the simulator's `ingestion` mode signs its
  requests accordingly. See
  `security-assessment/remediation/V28-iot-telemetry-authentication.md` for the
  full design, setup, and before/after test evidence, including the documented
  shared-secret limitation for the simulator's arbitrary ad-hoc device IDs.
- **Pet Tracker dashboard/read-access authorization — fixed separately.** See
  `security-assessment/remediation/V28-pet-tracker-access-control.md`.
- The simulator's own HTTP API (`/api/simulator/*`) still has no authentication,
  authorization, rate limiting, or CSRF protection — it is a disposable local
  test aid, not exposed in production (see the `ENABLE_IOT_SIMULATOR` +
  `NODE_ENV != production` guard below), and was out of scope for the V28 fixes
  above (which concern the *telemetry* ingestion path, not this control API).
- `direct-firebase` mode remains **unauthenticated by design** — it bypasses
  the Worker entirely for local dashboard testing only, and was intentionally
  left unchanged; it is not the mode used for SE4030 security testing.
- The `ENABLE_IOT_SIMULATOR` + `NODE_ENV != production` mounting guard is
  protection for this testing utility only (keeping it from ever running where
  real users are).
- Remaining, still-open items (documented, not fixed by either V28 remediation):
  - Firebase RTDB security rules are not defined in this repository (see main
    `README.md`); deployment-side rule enforcement could not be verified from
    source.
  - `backend/src/API/routes/dataRoutes.js` and `pet_tracker.js` remain
    unauthenticated dead code (not mounted in `backend/src/app.js`).

## Known limitations of the simulator itself

- In-memory device registry only — no persistence across backend restarts, and no cross-process sharing if the backend is horizontally scaled.
- No validation that a created simulator `deviceId` is actually linked to a `Pet` document; starting a device that was never paired simply writes telemetry no dashboard currently reads.
- No automatic cleanup of `petcare` history; simulated readings accumulate in Firebase like real ones would, so periodically clearing test data is left to the operator.
- `ingestion` mode (the default) requires a reachable `IOT_SIMULATOR_INGEST_URL` (e.g. a deployed copy of `Pet Health Tracker/worker(cloudflare).js`) and a matching `IOT_SIMULATOR_DEVICE_SECRET`. If none is available, switch `IOT_SIMULATOR_MODE=direct-firebase` for local dashboard testing only — that mode is not representative of the real (authenticated) ingestion path and should not be used as the basis for SE4030 findings.
- The simulator signs with one shared secret for every device ID it creates. This is a documented limitation (see the remediation doc), not true per-device identity — it is adequate for exercising the Worker's authentication logic in testing, but the one real physical tracker should be provisioned its own per-device secret in the Worker's `DEVICE_SECRETS` KV binding instead.
