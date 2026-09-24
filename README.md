# AI- and IoT-Integrated Pet Care System

AI- and IoT-Integrated Pet Care System is a full-stack platform that combines IoT-based pet monitoring, AI-assisted pet care features, and traditional pet service management (medical records, appointments, adoption, store, HR/finance) within a single system.

This repository is a redevelopment and continuation of an earlier project, **Online System for Pet Care and Treatment Services**. The system is being restructured to provide a cleaner foundation for further development and security-focused improvements while preserving the core functionality of the original project.

## Core Features

### IoT Pet Health & Location Monitoring
- Wearable pet tracker built on a BBC micro:bit (firmware and hardware design files under `Pet Health Tracker/`)
- Sensor data (heart rate, body temperature, step count, ambient temperature/humidity, air quality, battery level, GPS location) relayed through a Cloudflare Worker into Firebase
- Live dashboard (`frontend/src/components/deviceData.js`) showing sensor charts and pet location on Google Maps, backed by the Firebase Realtime Database

### Medical Records & Appointments
- Pet profile management (add/edit/list pets, owner association)
- Medical record creation and editing per pet
- Veterinary appointment scheduling

### AI-Assisted Features
- AI-powered pet training assistant (`backend/src/API/routes/gemini.js`) using the Gemini API to generate behavioral-correction and obedience-training plans from a submitted questionnaire
- Chatbot widget (Botpress webchat) embedded in the frontend for user-facing support and guidance

### Adoption
- Pet adoption listing submission and browsing (`AdoptionPortal`, `PetAd` model/routes)
- Admin review dashboard for adoption ads

### Store, Orders & Payments
- Pet store with product catalog and admin product management
- Order placement and order history ("My Orders")
- Checkout page with client-side card-detail form and validation

  > Note: the payment page currently validates and captures card details in the browser only; no third-party payment gateway (e.g. Stripe/PayPal) is integrated yet.

### Employee, HR & Financial Management
- Employee records and a separate employee login/dashboard
- HR and financial management pages, including expense tracking (`Expense` model, `expenseRoutes`)

### Authentication & Administration

- Google OAuth login (Passport.js) and employee/administrator credential login both use server-side sessions
- Session cookies are managed with `express-session` and a MongoDB-backed session store; the React Axios client sends credentials with API requests
- Privileged pet, medical-record, employee, product, order, expense, feedback, notification, and Gemini endpoints reject unauthenticated requests with HTTP `401`
- Adoption-ad routes under `/PetAd/admin/*` additionally require the authenticated employee to have the `Admin` role and return HTTP `403` for insufficient privileges
- Employee and administrator login regenerates the session before storing identity data, and the stored session/response does not include the password
- Employee and administrator logout clears the server-side employee session as well as the corresponding browser state

### Notifications & Feedback
- In-app notifications
- User feedback submission form

## Technology Stack

**Frontend:** React 18, React Router, React-Bootstrap, Chart.js / Recharts, Google Maps API, Firebase Web SDK

**Backend:** Node.js, Express, Passport.js (Google OAuth), MongoDB with Mongoose

**IoT:** BBC micro:bit firmware, Cloudflare Worker (data relay), Firebase Realtime Database

**AI:** Google Gemini API (pet training assistant), Botpress (chatbot widget)

## Repository Structure

```
backend/     Express API, MongoDB models, auth, routes
frontend/    React application
Pet Health Tracker/   IoT firmware, hardware design files, and the Cloudflare Worker relay script
```

## Getting Started

### Prerequisites
- Node.js and npm
- A MongoDB instance (local or hosted, e.g. MongoDB Atlas)
- A Firebase project with Realtime Database enabled for the IoT dashboard
- A Google Cloud OAuth 2.0 Web client (for Google login)
- A Gemini API key (for the AI training assistant)

### Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in `backend/` using `.env.example` as the template, with values for:
- `PORT`, `NODE_ENV`, `FRONTEND_URL`
- `MONGODB_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL`
- `SESSION_SECRET`, `JWT_SECRET`
- `GEMINI_API_KEY`

Generate separate random values for `SESSION_SECRET` and `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run the command twice and use a different output for each variable.

For MongoDB Atlas, ensure that the database user exists and that the machine running the backend is included in the Atlas IP access list. If the password contains reserved URL characters, encode them in `MONGODB_URL`.

#### Google OAuth Setup

In the Google Cloud project associated with the application:

1. Open **Google Auth Platform > Branding** and set a meaningful application name, such as **AI-IoT Pet Care System**.
2. Under **Audience**, add the required test users while the app remains in testing mode.
3. Under **Clients**, create a **Web application** OAuth client.
4. Add `http://localhost:3000` and `http://localhost:8090` as authorized JavaScript origins.
5. Add the following exact authorized redirect URI (without a trailing slash):

```text
http://localhost:8090/auth/google/callback
```

Copy the resulting client ID and client secret into `backend/.env`. Changing only the OAuth branding name does not require new credentials or environment-variable changes.

Run the API:
```bash
npm run dev    # development, with nodemon
npm start      # run once, without nodemon
```
The server listens on the port in `PORT`, defaulting to `8090`.

#### Employee and Administrator Login

Employee and administrator accounts are read from the MongoDB `Employee` collection. Both interfaces authenticate through `POST /employee/login`, which establishes the server-side session used by protected API routes.

The administrator interface only accepts an employee whose `role` is exactly `Admin`. There are no built-in or client-side `admin`/`admin` credentials. Provision the first administrator through a trusted database or administrative process; do not expose public role assignment or place administrator credentials in this README or an environment file.

After upgrading from the earlier client-only login behavior, log out, clear any stale login data in the browser if necessary, and sign in again so that a valid backend session is created. Direct API clients must retain and send the session cookie with subsequent protected requests. The frontend is already configured to do this.

> **Current limitation:** employee passwords are still stored and compared using the legacy plaintext implementation. Password hashing is a separate unresolved security item and must be implemented before this login is considered production-ready.

### Frontend Setup
```bash
cd frontend
npm install
npm start
```
The frontend expects `REACT_APP_GOOGLE_MAPS_API_KEY` and the Firebase Web App configuration values in `frontend/.env`. Use `frontend/.env.example` as the template. The IoT dashboard uses Firebase Realtime Database; the main application data remains in MongoDB.

#### Firebase Setup

1. Register a Web App in the Firebase project.
2. Enable Realtime Database and copy its exact database URL.
3. Copy the Web App configuration fields into `frontend/.env` using `.env.example` as the template.
4. Restart the frontend after changing environment variables.

Cloud Firestore and a Firebase Admin service-account key are not required by the currently active application routes. The Firebase Web configuration is used by the browser for Realtime Database access. Configure appropriate Realtime Database security rules before production use.

### IoT Device
The `Pet Health Tracker/` directory contains the micro:bit firmware (`.hex`), a hardware/enclosure drawing, and the Cloudflare Worker script that forwards device readings to the Firebase Realtime Database. Update the worker's Firebase URL and authentication for the selected Firebase project before deploying it. These files are provided for reference and are not part of the npm build.

## Secrets and Environment Files

- Keep runtime credentials in `backend/.env` and frontend configuration in `frontend/.env`.
- Never commit `.env`, `.env.production`, service-account JSON files, OAuth client secrets, MongoDB credentials, Gemini API keys, session secrets, or JWT secrets.
- Commit only the provided `.env.example` templates with placeholder values.
- Firebase Web configuration is not an Admin credential, but API keys should still be restricted to the intended APIs and application origins where supported.
- If a secret is committed, rotate or revoke it immediately. Deleting it in a later commit does not remove it from Git history.

## Notes on Current Implementation

- The V02 missing-authentication remediation is applied to the privileged routes listed above. Public browsing and other intentionally public endpoints remain accessible without a session.
- The authentication middleware supports both Passport-based Google sessions and employee/administrator sessions, preventing intermittent `User not authenticated` responses when navigating after a successful employee login.
- The Gemini-based AI assistant currently powers the pet training module only; other AI-labeled features (e.g. the chatbot) do not call Gemini.
- The checkout flow captures payment details in the UI but does not process payments through an external gateway.
- Firebase Realtime Database is used for IoT readings; the application's main records and login sessions remain in MongoDB.
- The Firebase Admin SDK dependency and legacy helper remain in the repository, but no active route currently requires Firestore or a Firebase service account.
- `backend/src/API/routes/pet_tracker.js` exists in the codebase but is not currently wired into `backend/src/app.js`.
- Several legacy backend entry-point files (`app_backup.js`, `app_backup_full.js`, `app_corrupted.js`) remain in `backend/src/` from earlier iterations and are not used by the running app.

This project is under active restructuring; features and setup steps above reflect the current state of the codebase and will be updated as the redevelopment continues.
