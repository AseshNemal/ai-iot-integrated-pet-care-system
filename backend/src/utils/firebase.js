const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const databaseURL = process.env.FIREBASE_DATABASE_URL;

if (!serviceAccountPath || !databaseURL) {
  throw new Error(
    'Set FIREBASE_SERVICE_ACCOUNT_PATH and FIREBASE_DATABASE_URL in backend/.env before starting the server.'
  );
}

const serviceAccount = require(path.resolve(process.cwd(), serviceAccountPath));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL,
});

const db = admin.firestore();

module.exports = { db };
