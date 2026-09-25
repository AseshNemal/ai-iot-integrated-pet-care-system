# HR security validation evidence

Date: 25 September 2026. Branch: `security-fix/hr-management`.

## Source-level changes checked

| Report finding | HR-specific result |
| --- | --- |
| V02 | Employee and expense management require a server-side employee session and Admin role. The appointment report used by HR now has the same gate. Booking has a separate public provider directory with limited fields. |
| V06 | New employee passwords are hashed with bcrypt before save. A one-time migration script is provided for existing records. |
| V07 | Passwords are excluded from employee queries and serialized employee responses. |
| V08 | The shared login form no longer compares credentials with hardcoded `admin/admin`; it calls the employee login endpoint. |
| V09 | The employee dashboard checks `/employee/me` rather than trusting a `localStorage` identity. |
| V21 | Unknown username and wrong password return the same status and response body. |
| V22 | Login failures are limited by source IP and username in each API process. |

## Automated verification performed

- `node --test backend/test/hrSecurity.test.js`: 2 tests passed. The tests cover password hashing, anonymous and staff denials, Admin access, password-free responses, public provider projection, origin checks, login response consistency, session logout, legacy-password upgrade on login, and rate limiting. Database records are mocked.
- `npm run build` in `frontend/`: stopped at an existing ESLint configuration error: `Environment key "jest/globals" is unknown`.
- Frontend production build with `DISABLE_ESLINT_PLUGIN=true`: compiled successfully. Build output was removed after verification.
- `git diff --check`: no whitespace errors in the HR changes.
- `backend/test/hrMongoIntegration.test.js` passed against a disposable local MongoDB. It verified Admin creation, bcrypt password storage, idempotent plaintext-password migration, Admin/staff authorization, limited public provider data, protected expenses and appointments, password-free responses, and server-side logout invalidation.
- Browser checks against the disposable database verified that `admin/admin` is rejected, a real Admin can open the HR dashboards and finance report, staff is redirected away from Admin routes, and logout invalidates the session.
- A live startup smoke check using the ignored frontend and backend environment files confirmed that the backend connected to MongoDB, the frontend compiled, anonymous HR APIs returned `401`, the public provider endpoint returned only `_id`, `firstName`, `lastName`, and `role`, and `/financial/hr` redirected an anonymous browser session to `/employee-login` without console errors.

## Deployment considerations

- Verify secure production-cookie behavior and the trusted frontend origin in the deployed HTTPS environment.
- If deploying multiple API instances, replace the in-process login limit with a shared store and verify it across instances.
- Reset passwords that may have been exposed by the old employee list API. The migration protects stored values but cannot undo prior disclosure.
