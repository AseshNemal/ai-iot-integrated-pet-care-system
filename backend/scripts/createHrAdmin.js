require('dotenv').config();
const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const Employee = require('../src/API/model/Employee');

async function main() {
  const { MONGODB_URL, HR_ADMIN_USERNAME, HR_ADMIN_EMAIL, HR_ADMIN_PASSWORD } = process.env;
  if (![MONGODB_URL, HR_ADMIN_USERNAME, HR_ADMIN_EMAIL, HR_ADMIN_PASSWORD].every(Boolean)) {
    throw new Error('MONGODB_URL, HR_ADMIN_USERNAME, HR_ADMIN_EMAIL, and HR_ADMIN_PASSWORD are required');
  }
  if (HR_ADMIN_PASSWORD.length < 12) throw new Error('HR_ADMIN_PASSWORD must be at least 12 characters');
  await mongoose.connect(MONGODB_URL);
  if (await Employee.exists({ role: /^admin$/i })) {
    throw new Error('An HR administrator already exists; no account was created');
  }
  await Employee.create({
    employeeId: `EMP-${randomUUID()}`,
    firstName: 'HR',
    lastName: 'Administrator',
    username: HR_ADMIN_USERNAME,
    email: HR_ADMIN_EMAIL,
    password: HR_ADMIN_PASSWORD,
    role: 'Admin'
  });
  console.log('HR administrator created.');
}

main().catch((error) => {
  console.error('HR administrator setup failed:', error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
