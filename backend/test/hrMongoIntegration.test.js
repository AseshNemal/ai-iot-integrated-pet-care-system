const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Employee = require('../src/API/model/Employee');
const Expense = require('../src/API/model/Expense');

require('@babel/register')({
  presets: [require.resolve('@babel/preset-env')],
  only: [/backend[\\/]src[\\/]/]
});
const Appointment = require('../src/API/model/Appointment').default;

const backendRoot = path.resolve(__dirname, '..');
const runScript = (name, uri, additionalEnv = {}) => spawnSync(
  process.execPath,
  [path.join(backendRoot, 'scripts', name)],
  {
    cwd: backendRoot,
    env: { ...process.env, MONGODB_URL: uri, ...additionalEnv },
    encoding: 'utf8',
    timeout: 30000
  }
);

test('HR flow against a disposable local MongoDB', { skip: !process.env.TEST_MONGODB_URL }, async () => {
  const target = new URL(process.env.TEST_MONGODB_URL);
  assert.equal(target.protocol, 'mongodb:');
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname), 'Only a local MongoDB is allowed');
  target.pathname = `/hr_validation_${process.pid}_${Date.now()}`;
  const uri = target.toString();
  let server;

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    const created = runScript('createHrAdmin.js', uri, {
      HR_ADMIN_USERNAME: 'validation-admin',
      HR_ADMIN_EMAIL: 'validation-admin@example.invalid',
      HR_ADMIN_PASSWORD: 'validation-admin-password'
    });
    assert.equal(created.status, 0, created.stderr);
    const admin = await Employee.findOne({ username: 'validation-admin' }).select('+password');
    assert.equal(await bcrypt.compare('validation-admin-password', admin.password), true);

    const staff = await Employee.create({
      employeeId: 'VALIDATION-STAFF', firstName: 'Test', lastName: 'Vet',
      username: 'validation-vet', email: 'validation-vet@example.invalid',
      password: 'validation-vet-password', role: 'Vet'
    });
    const legacy = await Employee.collection.insertOne({
      employeeId: 'VALIDATION-LEGACY', firstName: 'Old', lastName: 'Staff',
      username: 'validation-legacy', email: 'validation-legacy@example.invalid',
      password: 'legacy-plain-password', role: 'Groomer', availability: [], appointments: []
    });
    const migrated = runScript('migrateEmployeePasswords.js', uri);
    assert.equal(migrated.status, 0, migrated.stderr);
    assert.match(migrated.stdout, /Migrated 1 employee password records/);
    const legacyAfter = await Employee.findById(legacy.insertedId).select('+password');
    assert.equal(await bcrypt.compare('legacy-plain-password', legacyAfter.password), true);
    assert.match(runScript('migrateEmployeePasswords.js', uri).stdout, /Migrated 0 employee password records/);

    await Expense.create({ itemName: 'Test supply', quantity: 1, costPerItem: 10, totalCost: 10 });
    await Appointment.create({
      petOwnerId: new mongoose.Types.ObjectId(), employeeId: staff._id,
      employeeFirstName: staff.firstName, employeeRole: staff.role,
      petName: 'Test pet', serviceCategory: 'Vaccination',
      appointmentDate: new Date('2026-10-01'), appointmentTime: '10:00'
    });

    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'disposable-test-session-secret', resave: false, saveUninitialized: false }));
    app.use('/employee', require('../src/API/routes/employeeRoutes'));
    app.use('/api/expenses', require('../src/API/routes/expenseRoutes'));
    app.use('/api/appointments', require('../src/API/routes/appointmentRoutes').default);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (endpoint, options = {}) => fetch(base + endpoint, options);
    const login = (username, password) => request('/employee/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
      body: JSON.stringify({ username, password })
    });

    assert.equal((await request('/employee/get')).status, 401);
    assert.equal((await request('/api/expenses')).status, 401);
    assert.equal((await request('/api/appointments/all')).status, 401);
    const providerResponse = await request('/employee/service-providers');
    assert.equal(providerResponse.status, 200);
    const providers = await providerResponse.json();
    assert.equal(providers.length, 2);
    assert.equal(providers.every((person) => !('password' in person) && !('email' in person)), true);

    const staffLogin = await login('validation-vet', 'validation-vet-password');
    assert.equal(staffLogin.status, 200);
    const staffCookie = staffLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/employee/get', { headers: { Cookie: staffCookie } })).status, 403);
    assert.equal((await request('/api/expenses', { headers: { Cookie: staffCookie } })).status, 403);
    assert.equal((await request('/api/appointments/all', { headers: { Cookie: staffCookie } })).status, 403);

    const adminLogin = await login('validation-admin', 'validation-admin-password');
    assert.equal(adminLogin.status, 200);
    assert.equal('password' in (await adminLogin.json()).user, false);
    const adminCookie = adminLogin.headers.get('set-cookie').split(';')[0];
    const employees = await request('/employee/get', { headers: { Cookie: adminCookie } });
    assert.equal(employees.status, 200);
    assert.equal((await employees.json()).employees.every((person) => !('password' in person)), true);
    assert.equal((await request('/api/expenses', { headers: { Cookie: adminCookie } })).status, 200);
    assert.equal((await request('/api/appointments/all', { headers: { Cookie: adminCookie } })).status, 200);

    const added = await request('/employee/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: 'http://localhost:3000' },
      body: JSON.stringify({ firstName: 'New', lastName: 'Groomer', username: 'new-groomer',
        email: 'new-groomer@example.invalid', password: 'new-groomer-password', role: 'Groomer' })
    });
    assert.equal(added.status, 201);
    assert.equal('password' in (await added.json()).employee, false);
    const saved = await Employee.findOne({ username: 'new-groomer' }).select('+password');
    assert.equal(await bcrypt.compare('new-groomer-password', saved.password), true);

    assert.equal((await request('/employee/logout', {
      method: 'POST', headers: { Cookie: adminCookie, Origin: 'http://localhost:3000' }
    })).status, 200);
    assert.equal((await request('/employee/get', { headers: { Cookie: adminCookie } })).status, 401);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
