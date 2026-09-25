# HR security setup

The employee login now creates a server-side session. Employee and expense management
require an employee with the `Admin` role; other employees can access `/employee/me`
and their dashboard. The React frontend sends the session cookie with HR requests.
The `/api/appointments/all` report endpoint also requires an HR Admin session.
Public booking uses `/employee/service-providers`, which returns only the names,
roles, and IDs of vets and groomers.
Set `FRONTEND_URL` to the frontend origin in production and configure the existing
session and CORS settings for that origin.

Before enabling the updated application against an existing database, back up the
database and run the password migration from `backend/` with `MONGODB_URL` set:

```sh
node scripts/migrateEmployeePasswords.js
```

The script hashes legacy plaintext employee passwords and can be rerun safely.
Successful login also upgrades a remaining legacy record, but the one-time migration
is needed to protect accounts that have not logged in. Ask employees to reset any
passwords that may have been exposed through the old list API.

For a fresh database with no Admin employee, set `HR_ADMIN_USERNAME`,
`HR_ADMIN_EMAIL`, and a unique `HR_ADMIN_PASSWORD` of at least 12 characters in
the process environment, then run:

```sh
node scripts/createHrAdmin.js
```

The setup script refuses to create another Admin if one already exists. Do not add
these values to tracked files. Employee login attempts are limited in memory per
server process; use a shared rate-limit store when deploying multiple API instances.

Run the focused route tests from the repository root with
`node --test backend/test/hrSecurity.test.js`. These tests use mocked database
records. Complete validation still requires a disposable MongoDB and browser
session checks before deployment. The production frontend build compiles with
`DISABLE_ESLINT_PLUGIN=true`; the default build currently stops at the existing
ESLint configuration error `Environment key "jest/globals" is unknown`.
