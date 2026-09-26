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
