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
- Google OAuth login (Passport.js) alongside a separate employee login flow
- Session-based authentication using `express-session` with a MongoDB-backed session store
- Administrative dashboards for pets, products, and adoption ads

### Notifications & Feedback
- In-app notifications
- User feedback submission form

## Technology Stack

**Frontend:** React, React Router, React-Bootstrap, Chart.js / Recharts, Google Maps API, Firebase SDK

**Backend:** Node.js, Express, Passport.js (Google OAuth), MongoDB with Mongoose, Firebase Admin SDK

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
- Node.js and npm (or yarn)
- A MongoDB instance (local or hosted, e.g. MongoDB Atlas)
- A Firebase project (Realtime Database, and a service account for the backend)
- A Google Cloud OAuth 2.0 client (for Google login)
- A Gemini API key (for the AI training assistant)

### Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in `backend/` using `.env.example` as the template, with values for:
- `MONGODB_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL`
- `FRONTEND_URL`
- `SESSION_SECRET`
- `NODE_ENV`
- `GEMINI_API_KEY`

A Firebase service-account credential is also required by the backend (used by `backend/src/utils/firebase.js`).

Run the API:
```bash
npm run dev    # development, with nodemon
npm start      # production
```
The server listens on the port in `PORT`, defaulting to `8090`.

### Frontend Setup
```bash
cd frontend
npm install
npm start
```
The frontend expects `REACT_APP_GOOGLE_MAPS_API_KEY` to be set for the live location map to render. Firebase client configuration for the IoT dashboard is currently defined directly in `frontend/src/firebase.js`.

### IoT Device
The `Pet Health Tracker/` directory contains the micro:bit firmware (`.hex`), a hardware/enclosure drawing, and the Cloudflare Worker script that forwards device readings to the Firebase Realtime Database. These are provided for reference and are not part of the npm build.

## Notes on Current Implementation
- The Gemini-based AI assistant currently powers the pet training module only; other AI-labeled features (e.g. the chatbot) do not call Gemini.
- The checkout flow captures payment details in the UI but does not process payments through an external gateway.
- `backend/src/API/routes/pet_tracker.js` exists in the codebase but is not currently wired into `backend/src/app.js`.
- Several legacy backend entry-point files (`app_backup.js`, `app_backup_full.js`, `app_corrupted.js`) remain in `backend/src/` from earlier iterations and are not used by the running app.

This project is under active restructuring; features and setup steps above reflect the current state of the codebase and will be updated as the redevelopment continues.
