# V28 Runtime Evidence — Unauthorized Pet Tracker Direct Access

**Student:** Asesh Nemal
**Student ID:** IT23236264
**Module:** SE4030 Secure Software Development
**Project:** AI- and IoT-Integrated Pet Care System
**Status:** Remediated and Verified

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

## Remediation Implemented

**Backend — `backend/src/API/routes/pets.js`:** added
`GET /pet/tracker/:deviceId`, guarded by the existing `authenticate` session
middleware (`backend/src/API/middleware/auth.middlewere.js`, already proven
elsewhere in this file):

1. `authenticate` rejects any request without a valid session with **401**
   before any route logic runs.
2. The route derives the caller's identity from `req.user` (never from the
   URL or request body) and looks up the `Pet` document for the requested
   `deviceId`.
3. Unknown device → **404**.
4. Known device whose `Pet.userId` does not match the caller → **403**.
5. Only when the caller owns the device does the server fetch the Realtime
   Database `petcare` node itself (server-to-server, using the same
   `IOT_SIMULATOR_FIREBASE_DATABASE_URL`-style config the simulator already
   used to *write* telemetry — see new `FIREBASE_RTDB_URL` /
   `FIREBASE_RTDB_SECRET` in `backend/.env.example`), filters it down to
   **only** the requested device's records, and returns just those.

**Frontend — `frontend/src/components/deviceData.js`:** removed the direct
`firebase/database` import and the `onValue(ref(realtimeDB, "petcare"), ...)`
listener entirely. The component now polls the authorized backend endpoint
(`axios.get` to `/pet/tracker/:deviceId` every 5s, mirroring the existing poll
pattern in `PetTracker.js`) and renders one of five states: `loading`,
`unauthenticated` (prompts login), `forbidden`, `not-found`, or `ok`
(the existing dashboard UI, now fed only with data the backend already
authorized). This is explicitly a **UX convenience, not the security
boundary** — the boundary is the backend check above, per the instruction to
avoid relying solely on a frontend guard.

This satisfies the required design:

```
User requests tracker for a device
        ↓
Backend requires authenticated session      → no session      → 401
        ↓
Backend derives user ID from req.user
        ↓
Backend verifies a pet owned by req.user has that deviceId
        ↓ no matching Pet                    → 404
        ↓ Pet exists, owned by someone else  → 403
        ↓ Pet exists, owned by req.user      → 200, filtered telemetry only
```

## Automated Tests

Added `backend/src/API/routes/__tests__/petTracker.test.js` (Jest + Supertest,
newly added as backend dev dependencies — no test framework previously
existed in this project). Mocks `Pet` and the RTDB `axios` call so the tests
exercise only the route's own authorization logic:

| Scenario | Expected | Result |
|---|---|---|
| Unauthenticated request | 401, `Pet.findOne` never called | **Pass** |
| Owner requests their own device | 200, only that device's records returned | **Pass** |
| Authenticated user requests another user's device | 403, Firebase never called | **Pass** |
| Unknown/unpaired device | 404, Firebase never called | **Pass** |

```
$ npx jest
Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

## After-Remediation Test

Repeated the same manual test used before the fix, against the same
controlled device (`900001`) on the same running local dev stack.

## After-Remediation Results

- **Logged out → `/pet/900001`:** reproduced live in a logged-out browser tab
  (nav bar shows "Login"). The dashboard no longer renders any telemetry —
  it now shows "Please log in to view this pet's tracker." with a link to
  `/login`, and the network call to the backend returns 401. Screenshot:
  `security-assessment/evidence/V28/after-unauthenticated-blocked.jpg`.
- **Owner → own device** and **authenticated user A → user B's device:**
  verified via the automated test suite above (`petTracker.test.js`), which
  exercises the same `pets.js` route handler and the same `Pet.findOne`
  ownership comparison the live server uses — 200 with only the owner's
  records for the owner, 403 with no Firebase call for a non-owner. As noted
  in **Actual Before-Fix Behaviour**, this project's only end-user login is
  Google OAuth against real Google accounts, which was not scripted against a
  second real account in order to keep all test evidence synthetic; the
  automated tests are the recorded proof for these two scenarios rather than
  a second live browser session, consistent with not forcing a manual
  reproduction that isn't safely scriptable here.
- **Unknown device:** covered by the automated test (404); not separately
  reproduced live for the same reason (would require a live session to reach
  past the 401 check first).

```
logged out              → denied/login   (confirmed live + by design: authenticate runs first)
owner                    → telemetry visible (confirmed by automated test)
other authenticated user → denied             (confirmed by automated test)
unknown device           → denied (404)       (confirmed by automated test)
```

## Security Result

An unauthenticated visitor, or an authenticated user who does not own the
requested device, can no longer obtain any Pet Tracker telemetry by changing
the device ID in the `/pet/:deviceId` URL. The frontend no longer has a code
path that reads the shared `petcare` Realtime Database node directly, so
there is nothing left in the browser for a URL-only attacker to exploit
against this dashboard specifically.

## Remaining Scope

Explicitly **not** addressed by this remediation (tracked separately, still
open):

- **Cloudflare Worker ingestion / spoofing** (the other half of V28): the
  Worker at `Pet Health Tracker/worker(cloudflare).js` still accepts any POST
  body from any caller with no device authentication or payload validation.
  Unchanged by this fix.
- **`frontend/database.rules.json` (`.read: true, .write: true`)** — this
  remains exactly as found. This remediation's new backend endpoint reads the
  RTDB via a plain server-to-server REST call (no Firebase Admin credentials
  are configured in this environment), so it currently relies on the same
  public rules the browser previously used directly — the backend is simply
  the only caller the app itself will make. **Deployment-side Firebase rule
  enforcement could not be verified from repository source and remains a
  separate deployment verification item.** Tightening these rules (e.g. to
  require a Firebase Admin credential or a per-device auth secret for both
  reads and writes) was not done as part of this fix because it would also
  need to keep the legitimate simulator/Worker *write* path working, and
  provisioning that credential is outside this repository and outside what
  could be safely tested here.
- **`backend/src/API/routes/pet_tracker.js` and `dataRoutes.js`** — both
  remain unauthenticated and both remain unmounted in `backend/src/app.js`
  (dead code). Left as-is rather than deleted, since removing dead code was
  not requested and is outside this remediation's scope; flagged here so they
  are not mistaken for an active, authenticated surface.
- **`frontend/src/components/temperatureDatas.js`** — a separate, unrouted
  placeholder component also importing `../firebase` directly (and using an
  incompatible legacy Firebase v8-style call, `realtimeDB.ref(...)`, against
  the v9 modular SDK actually configured in `frontend/src/firebase.js`, so it
  would throw if ever rendered). Not reachable from `App.js`, not part of the
  V28 finding's evidence, and not modified here.
- IoT telemetry request signing, device HMAC authentication, replay
  protection, telemetry range validation, timestamp integrity, and simulator
  security remain out of scope, per the original remediation plan.

**Remediation owner / verification owner:**
Asesh Nemal — IT23236264
