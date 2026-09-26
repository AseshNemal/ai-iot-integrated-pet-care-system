# V01 — Secrets Committed to Source Control

Student: Asesh Nemal

Student ID: IT23236264

Module: SE4030 Secure Software Development

## Before Remediation

`backend/.env.production` was tracked in the repository and exposed sensitive production configuration. Committing environment files containing credentials creates a security risk because repository readers and copies can retain the exposed values.

The affected credentials were identified and rotated/revoked, as confirmed by the student before this remediation. Credential-provider rotation was not independently verified during this repository change.

A sanitized evidence copy is retained at `security-assessment/evidence/V01/backend.env.production.before.txt` only for assignment/audit evidence. It records the original variable names with every value redacted and omits the original comments. No active credentials or historical secret values are included in the evidence.

## Planned Remediation

- Preserve sanitized BEFORE evidence.
- Remove `backend/.env.production` from the active repository.
- Confirm environment-file patterns in `.gitignore` prevent tracking real environment files while allowing `.env.example` templates.
- Retain safe `backend/.env.example` and `frontend/.env.example` templates with their required variable names.
- Require production secrets to be supplied through runtime/deployment environment variables.
- Preserve Git history without rewriting it for assignment/audit purposes.

## Remediation Implemented

- The affected credentials were rotated/revoked before this change, as confirmed by the student.
- `backend/.env.production` was removed from the active repository and source tree.
- Existing environment-file patterns in the root `.gitignore` were confirmed: `.env`, `.env.*`, and `!.env.example`, with equivalent backend/frontend rules. These already cover production and local environment files, so no rule changes were necessary.
- Safe `backend/.env.example` and `frontend/.env.example` templates were reviewed and retained with their existing variable names. Their values are blank, explicit placeholders, or development defaults.
- Production secrets must now be supplied through runtime/deployment environment variables rather than the removed tracked file. Existing application environment-variable reads were retained.
- Git history was intentionally preserved. The previous file remains in historical commits for audit/assignment purposes.

## After Remediation

- `git ls-files backend/.env.production` returns no output: the production environment file is no longer tracked.
- `backend/.env.production` has been deleted from the active source tree.
- `git check-ignore -v backend/.env.production` confirms the root `.gitignore` rule `backend/.env.*` ignores this path. Backend/frontend local and production/development/test environment-file paths are also ignored.
- Only `backend/.env.example` and `frontend/.env.example` remain tracked as environment templates. Both remain allowed by the ignore rules and unchanged from the baseline.
- The affected credentials were rotated/revoked before remediation, as confirmed by the student. Provider-side rotation was not independently verified here.
- The sanitized BEFORE snapshot remains tracked only for assignment/audit evidence. Verification confirmed every value is `[REDACTED]` and the variable names match the original tracked file.
- Git history remains preserved: the original baseline commit is still an ancestor of this branch. Historical commits were not rewritten or cleaned.
- `git diff --check` and the comparison against the baseline both passed.

### Safe tracked-secret review

A heuristic review examined 193 current tracked text files for credential assignments, environment fallbacks, credential-bearing URLs, common API/token formats, and private-key markers. It omitted 26 binary files, did not scan historical commits, and did not query credential providers. Fetch credential options and dependency metadata were classified as non-secret. No credential values were printed or copied into this report.

| File | Variable/key | Appears to contain a real credential? |
| --- | --- | --- |
| `backend/src/API/routes/__tests__/workerIngestionAuth.test.js` | `perDeviceSecret` | No: apparent unit-test fixture. |
| `security-assessment/evidence/V28-ingestion/after-fix-spoof-test.js` | `SHARED_SECRET` | Uncertain: literal in existing assignment test evidence; validity was not checked. |

These pre-existing locations were left unchanged to keep this remediation limited to V01. This heuristic review does not establish that every tracked file is free of secrets.

### Tests and build impact

`cd backend && npm test -- --runInBand` passed: 5 test suites, 38 tests, and 0 snapshots. Output was filtered to avoid exposing credential values. No application source, dependencies, ignore rules, or environment templates were changed. The frontend build was not run. No deployment or live-runtime verification was performed; deployment must provide the required secrets through runtime environment variables.

Command results, the sanitized review, and test summaries are retained in `security-assessment/evidence/V01/after-verification.json`.

## Security Result

The active production environment file is no longer stored in source control. Previously exposed credentials were rotated/revoked, as confirmed by the student. Future secrets must be supplied using deployment/runtime environment variables or a secret-management mechanism.

Git history was intentionally preserved for audit/assignment purposes. The three commits record BEFORE evidence, the security fix, and AFTER verification in order. Nothing has been pushed; pushing requires the student's approval.
