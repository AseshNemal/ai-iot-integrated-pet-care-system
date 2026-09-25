# HR Management Security Remediation

This document records the security vulnerabilities identified in the HR Management scope and explains how they were fixed. The scope covers employee authentication, employee administration, expense management, the HR appointment report, and the related frontend routes.

## Identified Vulnerabilities and Fixes

### V02: Broken Access Control

**Issue identified:** Employee and expense APIs allowed unauthenticated users to list, create, update, and delete HR records. The HR appointment report was also publicly accessible. This allowed a user to perform administrative operations without proving their identity or role.

**How it was fixed:**

- Employee, expense, and HR appointment-report endpoints now require a valid server-side employee session.
- Administrative operations require the authenticated employee to have the `Admin` role.
- Unauthenticated requests receive `401 Unauthorized`.
- Authenticated employees without the Admin role receive `403 Forbidden`.
- The frontend uses an `HrAdminGuard` to prevent unauthorized users from opening protected HR, finance, and administration pages.
- The backend repeats every authorization check so frontend route protection cannot be bypassed by calling the API directly.

### V06: Plaintext Employee Passwords

**Issue identified:** Employee passwords were stored and compared as plaintext. Anyone who obtained database access could immediately read and reuse every employee password.

**How it was fixed:**

- Passwords are hashed with bcrypt before they are saved.
- Login verifies passwords using `bcrypt.compare`.
- A migration script hashes existing plaintext employee passwords.
- A successful login also upgrades a remaining legacy plaintext password to a bcrypt hash.
- A setup script creates the initial HR Admin account without placing its password in source code.

### V07: Password Exposure Through API Responses

**Issue identified:** Employee API responses included the password field. An unauthenticated employee-list request could expose the credentials of all employees.

**How it was fixed:**

- The employee model excludes the password field from queries by default.
- Employee creation, listing, update, and login responses remove password data.
- The public appointment-booking flow uses a limited service-provider endpoint that returns only the provider ID, name, and role.

### V08: Hardcoded Admin Credentials

**Issue identified:** The frontend contained a hardcoded `admin/admin` login. Authentication occurred entirely in the browser, so anyone who inspected the source could obtain the credentials and access the Admin interface.

**How it was fixed:**

- The hardcoded browser-side credential check was removed.
- Admin login now calls the backend employee login endpoint.
- Access requires a real Admin employee account and a valid server session.
- Admin credentials are supplied through environment variables only when running the Admin setup script.

### V09: Client-Side Authorization Using `localStorage`

**Issue identified:** The employee dashboard trusted employee identity and role data saved in `localStorage`. A user could edit this data in the browser and impersonate an Admin.

**How it was fixed:**

- The application obtains the current employee identity from the protected `/employee/me` endpoint.
- The frontend sends the session cookie with HR requests.
- Protected pages verify the server-backed session through `HrAdminGuard`.
- The backend independently verifies the session and Admin role for every protected request.
- Logout destroys the server session instead of only deleting browser data.

### V21: Username Enumeration

**Issue identified:** Employee login returned different errors when a username did not exist and when a password was incorrect. Attackers could use these responses to discover valid employee usernames.

**How it was fixed:**

- Both failure cases return the same `Invalid username or password` message and status code.
- A dummy bcrypt comparison is performed for unknown accounts to reduce observable timing differences.

### V22: Missing Login Rate Limiting

**Issue identified:** The employee login endpoint allowed unlimited attempts, making automated password guessing and credential-stuffing attacks easier.

**How it was fixed:**

- Failed logins are rate limited by both source IP address and username.
- Requests exceeding the configured threshold receive `429 Too Many Requests`.
- Successful authentication clears the relevant failed-attempt state.

For deployment across multiple backend instances, the in-memory limiter should be replaced with a shared store such as Redis.

### Session and Request Integrity

**Issue identified:** Employee login did not establish reliable server-verifiable authorization, logout did not consistently invalidate server state, and sensitive cross-origin HR requests were not restricted.

**How it was fixed:**

- Login regenerates the session identifier before storing the authenticated employee identity.
- Logout destroys the server-side session and clears its cookie.
- The frontend includes the session cookie in authenticated requests.
- Sensitive write operations accept requests only from the configured frontend origin.

## Validation Performed

The remediation was checked using:

- Focused HR route security tests.
- An integration test against a disposable MongoDB database.
- Browser tests covering Admin access, staff denial, route redirection, and logout invalidation.
- Direct API tests confirming `401`, `403`, and `429` responses where required.
- A successful frontend production build with the existing ESLint plugin disabled because the repository's current ESLint configuration contains an unrelated `jest/globals` environment error.

Detailed test evidence is available in [HR validation evidence](../hr-validation-evidence.md).

## Deployment Steps

Before connecting the updated application to an existing database, back up the database and run the following command from the `backend` directory:

```bash
node scripts/migrateEmployeePasswords.js
```

The migration can be run more than once safely. Employees whose plaintext passwords may have been exposed through the previous API should also reset their passwords, because hashing a stored password cannot invalidate copies that were already disclosed.

For configuration and Admin account setup instructions, see [HR security setup](../../backend/HR_SECURITY.md).
