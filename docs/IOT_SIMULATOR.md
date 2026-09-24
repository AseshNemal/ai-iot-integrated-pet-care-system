# IoT Pet Health Tracker Simulator (SE4030 test/demo aid)

The original system used a physical micro:bit/SIM800L-based Pet Health Tracker. Because the physical prototype is not available during the current SE4030 security assessment, a software simulator is provided to reproduce the original telemetry format and device behavior for repeatable testing. The simulator does not replace the original implementation and does not remediate existing security vulnerabilities. Security issues are intentionally preserved for baseline testing and will be addressed separately during the remediation phase.

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

- **`ingestion`** (default, the documented assignment mode) — the simulator POSTs telemetry to `IOT_SIMULATOR_INGEST_URL`, i.e. the same Worker/ingestion endpoint the physical device would call. The simulator never talks to Firebase directly in this mode, exactly like the real micro:bit doesn't.
- **`direct-firebase`** — the simulator writes straight to the Firebase Realtime Database `petcare` node, bypassing the Worker entirely. This is a **local dashboard-testing fallback only**, for when no ingestion endpoint is deployed or reachable — it is not the mode used for SE4030 security testing.

```
ENABLE_IOT_SIMULATOR=true

# default, documented assignment mode
IOT_SIMULATOR_MODE=ingestion
IOT_SIMULATOR_INGEST_URL=https://<your-worker>.workers.dev

# only read when IOT_SIMULATOR_MODE=direct-firebase
IOT_SIMULATOR_FIREBASE_DATABASE_URL=https://<your-database-name>.firebasedatabase.app
IOT_SIMULATOR_FIREBASE_DATABASE_SECRET=            # optional, only if your RTDB rules require it
```

These are new, optional, simulator-only variables — no existing required variable was changed, and no real project credentials are included in this repo; you supply your own ingestion URL / database URL / secret locally.

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

This same payload is sent regardless of mode — in `ingestion` mode it is the POST body sent to `IOT_SIMULATOR_INGEST_URL`, unmodified by the simulator itself (the Worker is expected to add its own `Time` field and forward to Firebase, exactly as it does for the real device); in `direct-firebase` mode it is written straight to the `petcare` node.

Two behaviors were matched deliberately so simulated data renders correctly, per the "necessary for compatibility" allowance:

- **`timestamp` format**: `DD/MM/YYYY, HH:MM:SS` (`Date.toLocaleString("en-GB", { timeZone: "Asia/Colombo" })`), the same format the Cloudflare Worker produces and the same format `deviceData.js` parses via string-splitting.
- **`Device ID` type**: written as a **string**. `deviceData.js` compares `rawData[key]["Device ID"] === selectedDeviceId`, and `selectedDeviceId` comes from `useParams()`, which is always a string. Writing a number here would silently break the device-filtering/"Device Details" view for simulated devices (strict `===`), so it is written as a string to match.

Generated values are randomised walks around plausible baselines (e.g. body temperature ~38°C, heart rate raw value ~350-600 so the dashboard's `hartrate/5` display lands around 70-120 BPM, battery slowly draining from 100%, GPS drifting slightly around a fixed origin) — realistic enough for dashboard/chart demonstration, not a scientific sensor model.

## Security posture — nothing here was fixed

This branch is explicitly **not** security remediation. To keep the vulnerable baseline intact for before/after evidence:

- The simulator's own HTTP API (`/api/simulator/*`) has no authentication, authorization, rate limiting, or CSRF protection.
- No device authentication, signing, API keys, or replay protection were added to the simulated telemetry path (in either mode), matching the real device's current behavior.
- No existing authentication, session, Passport, Firebase rule, CORS, or rate-limiting behavior was changed anywhere in the codebase.
- In `ingestion` mode the simulator holds no Firebase credentials at all — it only knows the ingestion URL, the same as the real device — so it introduces no new path to Firebase beyond what already exists.
- The `ENABLE_IOT_SIMULATOR` + `NODE_ENV != production` mounting guard is protection for this new testing utility only (keeping it from ever running where real users are), not a remediation of any vulnerability in the original application.
- Pre-existing weaknesses observed while building this (documented here, intentionally left as-is):
  - The Firebase Realtime Database `petcare` node has no server-side ownership check — anything that can reach it (the real worker, a simulator running in `direct-firebase` mode, or any other client with the database URL) can write telemetry under any `Device ID`, including one already paired to another user's pet. Firebase RTDB security rules are not defined in this repository (see main `README.md`).
  - `deviceData.js` fetches the entire `petcare` node on every page load and filters client-side; it does not scope the read to the requested device server-side.
  - The Cloudflare Worker relay (`Pet Health Tracker/worker(cloudflare).js`) embeds a placeholder legacy database secret directly in the worker source as a comment/example, and accepts any POST body from any caller with no device authentication — reflecting the same "no real device auth" pattern the `ingestion` mode simulator deliberately does not touch.

These items are candidates for the later remediation phase, not for this branch.

## Known limitations of the simulator itself

- In-memory device registry only — no persistence across backend restarts, and no cross-process sharing if the backend is horizontally scaled.
- No validation that a created simulator `deviceId` is actually linked to a `Pet` document; starting a device that was never paired simply writes telemetry no dashboard currently reads.
- No automatic cleanup of `petcare` history; simulated readings accumulate in Firebase like real ones would, so periodically clearing test data is left to the operator.
- `ingestion` mode (the default) requires a reachable `IOT_SIMULATOR_INGEST_URL` (e.g. a deployed copy of `Pet Health Tracker/worker(cloudflare).js`). If none is available, switch `IOT_SIMULATOR_MODE=direct-firebase` for local dashboard testing only — that mode is not representative of the real ingestion path and should not be used as the basis for SE4030 findings.
