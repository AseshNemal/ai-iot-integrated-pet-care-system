# V28 Runtime Evidence — Unauthorized Pet Tracker Direct Access

**Student:** Asesh Nemal
**Student ID:** IT23236264
**Module:** SE4030 Secure Software Development
**Project:** AI- and IoT-Integrated Pet Care System
**Status:** Before Remediation

> **Classification note:** This document covers the runtime/access-control aspect of the
> existing **V28 — Unauthenticated IoT Telemetry Ingestion / Sensor Data Spoofing** finding
> in `security-assessment/report.html`. It does **not** introduce a new vulnerability number,
> and it does **not** claim the whole V28 finding is resolved. V28 also covers unauthenticated
> ingestion/spoofing via the Cloudflare Worker, which is explicitly out of scope for this
> remediation (see **Remaining Scope** below, added after the fix).

## Vulnerability

The Pet Tracker dashboard can be accessed directly using a device ID in
the URL without requiring the visitor to authenticate or proving that
the requested device belongs to one of their pets.

Example local route:

```
/pet/1001
```

## Security Impact

An unauthorized person who knows or guesses a valid device ID may be
able to view health, activity and location telemetry belonging to
another pet/device.

## Root Cause

Confirmed by inspecting the current code (not assumed):

- **Frontend route protection** — `frontend/src/App.js:72` registers
  `<Route path="/pet/:deviceId" element={<DeviceData />} />` with no route guard,
  no authentication check, and no wrapper component of any kind. It is a bare
  public route, identical in protection level to `/AboutUs`.
- **`deviceData.js`** — `frontend/src/components/deviceData.js:46-94` opens a
  direct Firebase Realtime Database listener (`ref(realtimeDB, "petcare")` +
  `onValue`) as soon as the component mounts. It reads the **entire** `petcare`
  node into the browser, then filters the already-downloaded records client-side
  by matching `DeviceID` against the `deviceId` route param (`useParams()`). There
  is no call to any authentication API, no session check, and no reference to
  `req.user`/`/get-session` anywhere in this file.
- **Firebase RTDB reads** — `frontend/database.rules.json` (the rules source
  checked into this repository, referenced by `frontend/firebase.json`) is:
  ```json
  { "rules": { ".read": true, ".write": true } }
  ```
  i.e. the `petcare` node is configured for fully public, unauthenticated read
  **and** write access at the database-rules level. This is a separate,
  deployment-side control from the frontend/backend code (see **Firebase Rules**
  below) — whether this exact ruleset is what is actually deployed to the live
  Firebase project could not be confirmed from the repository alone.
- **Pet/device ownership model** — `backend/src/API/model/pet.js` stores
  `userId` (the owning user's Mongo `_id`, as a string — confirmed by how
  `frontend/src/components/addPet.js` populates it from `/get-session`) and
  `deviceId` (Number) on each `Pet` document. This ownership link **exists** in
  the data model, but nothing in the telemetry read path (`deviceData.js`) ever
  queries it.
- **Backend pet routes** — `backend/src/API/routes/pets.js` already applies the
  `authenticate` middleware (`backend/src/API/middleware/auth.middlewere.js`) to
  every CRUD route, but it exposes **no telemetry endpoint at all**. There are two
  other route files that look telemetry-related:
  - `backend/src/API/routes/pet_tracker.js` — has no `authenticate` middleware
    and is dead code: it references an undefined `Pet` (never imported) and,
    more importantly, **is never mounted** in `backend/src/app.js`.
  - `backend/src/API/routes/dataRoutes.js` — also unauthenticated, also **not
    mounted** in the current `backend/src/app.js` (it was present in
    `app_backup_full.js`/`app_corrupted.js` but is absent from the live `app.js`).
  So today, the *only* way telemetry reaches the dashboard is the direct,
  unauthenticated client-side Firebase read in `deviceData.js`.
- **Session/authentication middleware** — `backend/src/API/middleware/auth.middlewere.js`
  exports a working `authenticate` (session- or Passport-based) and `authorizeRoles`
  middleware, already used successfully elsewhere (e.g. `pets.js`, `employeeRoutes.js`).
  Nothing wires this middleware, or any equivalent check, into the pet-tracker
  telemetry path.

**Conclusion:** the root cause is that the Pet Tracker dashboard's data path
bypasses the backend entirely. The frontend reads Firebase Realtime Database
directly from the browser with the public Web SDK config, and authorizes
*only* by client-side filtering on a value taken from the URL — which the
visitor fully controls and which is never checked against any session or
ownership record.

## Before-Remediation Test

Environment: localhost/test environment only.

1. Log out completely.
2. Open a private/incognito browser session.
3. Navigate directly to `/pet/<controlled-test-device-id>`.
4. Record whether telemetry is rendered without authentication.
5. If safe and using only controlled test data, repeat using another
   known test device ID.

## Expected Secure Behaviour

Access should be allowed only when:

- the user is authenticated; and
- the requested device is associated with a pet owned by that user.

Otherwise:

- unauthenticated request → 401 / login;
- authenticated user requesting another user's device → 403.

## Actual Before-Fix Behaviour

Tested against the running local dev stack (`backend` on `:8090`,
`frontend` on `:3000`, both already running in this environment) using a
**controlled test device** created specifically for this assessment —
**not** any real user's paired tracker.

1. Created a fresh, disposable simulator device via the backend's own test
   scaffolding: `POST http://localhost:8090/api/simulator/devices` →
   `{"deviceId":900001}`. Device `900001` is **not** paired to any `Pet`
   document — it exists only as live telemetry in Firebase.
2. Started it: `POST http://localhost:8090/api/simulator/devices/900001/start`.
   Within one tick, `GET .../devices/900001/status` confirmed real telemetry
   was written into the exact same `petcare` Realtime Database node that
   `deviceData.js` reads (`lastTelemetry` populated with `Device ID: "900001"`,
   coordinates, battery, temperature, heart rate, step count, timestamp).
3. Source-level confirmation (see **Root Cause**) that:
   - `frontend/src/App.js` mounts `/pet/:deviceId` with **no** authentication
     guard of any kind, and
   - `deviceData.js` will render **any** telemetry whose `Device ID` matches
     the URL's `deviceId` param, regardless of whether the visitor is logged in,
     because it never checks a session and never checks ownership.
   - `frontend/database.rules.json` grants `.read: true` to any caller with no
     Firebase Authentication at all, so the underlying data source imposes no
     access control of its own for this app to lean on.
4. **Full UI reproduction — confirmed.** Loaded `http://localhost:3000/pet/900001`
   in a fresh, logged-out browser tab (no session cookie for the app; the header
   shows a **"Login"** link, confirming the unauthenticated state). The Pet
   Tracker dashboard rendered immediately with live telemetry for device
   `900001` — body temperature 37.7°C, heart rate 97 BPM, battery 97.6%, 1,704
   steps today, marked "Live" — with no login prompt, no redirect, and no error
   of any kind. Screenshot saved to
   `security-assessment/evidence/V28/before-unauthenticated-direct-access.jpg`.
   A direct unauthenticated fetch against the live Firebase REST endpoint
   (`.../petcare.json`) was deliberately **not** performed separately, because
   that node also contains other, real telemetry records and pulling it in full
   would expose data outside the scope of this controlled test (this repo's own
   `database.rules.json` shows it is not filterable by device without an index)
   — the rendered dashboard above is sufficient, in-scope evidence on its own.
5. **Cross-user scenario (authenticated user A → user B's device):** not
   independently reproduced with two live logged-in sessions in this session,
   because the app's only end-user login is Google OAuth against real Google
   accounts, which is not appropriate to script/automate here. This is not
   forced as a separately-confirmed result. However, it follows directly from
   the same source-level finding: `deviceData.js` and the `/pet/:deviceId`
   route contain **no** reference to authentication state or to `Pet.userId`
   at all, so the component's behaviour cannot differ based on who (if anyone)
   is logged in — an authenticated user viewing another user's device would
   hit the exact same unguarded code path as an unauthenticated visitor.

**Result: the "before" behaviour matches the vulnerability as described,
confirmed live in a logged-out browser.** Nothing in the current render path
stopped an unauthenticated visitor from seeing device telemetry, and nothing
in the code would behave any differently for an authenticated user viewing a
device that isn't theirs.

## Evidence

- Test URL: `http://localhost:3000/pet/900001`
- Controlled test device: `900001` (created via
  `POST /api/simulator/devices`, a disposable in-memory test fixture — see
  `backend/src/services/iotSimulatorService.js`; not linked to any real `Pet`
  document or real user)
- Authentication state tested: logged out (no session cookie; nav bar shows
  "Login", not a user profile)
- Response/result: full Pet Tracker dashboard rendered with live telemetry —
  no login prompt, no redirect, no access-denied state
- Screenshot: `security-assessment/evidence/V28/before-unauthenticated-direct-access.jpg`
- Backend telemetry status response (own test fixture only, no other user's
  data), confirming live data in the shared `petcare` node:
  ```json
  {
    "deviceId": 900001,
    "running": true,
    "mode": "direct-firebase",
    "lastTelemetry": {
      "Device ID": "900001",
      "Latitude": 6.928956926167911,
      "Longitude": 79.8574954464499,
      "Battery": 99.9,
      "Temperature": 38.4,
      "hartrate": 442,
      "step": 5,
      "timestamp": "24/09/2026, 23:36:23"
    }
  }
  ```
- Relevant source locations reviewed as evidence: `frontend/src/App.js:72`,
  `frontend/src/components/deviceData.js:46-94`, `frontend/database.rules.json`,
  `backend/src/API/routes/pets.js`, `backend/src/API/routes/pet_tracker.js`,
  `backend/src/app.js`.
- No credentials, cookies, tokens, or real user/pet data are recorded in this
  document. Device `900001` is disposable test scaffolding created solely for
  this assessment.

## Planned Remediation

- require authentication;
- perform device ownership authorization server-side;
- derive the user from the authenticated session;
- reject access to devices not owned by that user;
- avoid relying solely on a React route guard;
- prevent the frontend from obtaining all tracker data and filtering
  ownership only in the browser;
- review Firebase RTDB access controls separately.

## After-Remediation Verification

Pending.
