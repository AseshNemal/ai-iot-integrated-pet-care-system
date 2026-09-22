const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const Employee = require('../src/API/model/Employee');
const Expense = require('../src/API/model/Expense');

test('new employee passwords are hashed by the model before save', async () => {
  const employee = new Employee({
    employeeId: 'TEST-1', firstName: 'Test', lastName: 'Employee',
    username: 'test', email: 'test@example.com', role: 'Vet',
    password: 'example-password'
  });
  await new Promise((resolve, reject) => {
    Employee.schema.s.hooks.execPre('save', employee, (error) => error ? reject(error) : resolve());
  });
  assert.notEqual(employee.password, 'example-password');
  assert.equal(await bcrypt.compare('example-password', employee.password), true);
});

test('HR sessions enforce role, hide passwords, check origins, and limit login attempts', async () => {
  const admins = {
    admin: { id: 'admin-id', username: 'admin', role: 'Admin', password: await bcrypt.hash('correct-password', 4) },
    staff: { id: 'staff-id', username: 'staff', role: 'Vet', password: await bcrypt.hash('staff-password', 4) },
    legacy: { id: 'legacy-id', username: 'legacy', role: 'Vet', password: 'legacy-password' }
  };
  for (const employee of Object.values(admins)) {
    employee.toObject = () => ({ _id: employee.id, username: employee.username, role: employee.role, password: employee.password });
    employee.save = async () => { employee.password = await bcrypt.hash(employee.password, 4); };
  }
  const originals = {
    findOne: Employee.findOne,
    findById: Employee.findById,
    find: Employee.find,
    expenseFind: Expense.find
  };
  Employee.findOne = ({ username }) => ({ select: async () => admins[username] || null });
  Employee.findById = async (id) => Object.values(admins).find((employee) => employee.id === id) || null;
  Employee.find = () => ({ select: async () => [{ _id: 'admin-id', username: 'admin', role: 'Admin' }] });
  Expense.find = () => ({ sort: async () => [{ itemName: 'Test', totalCost: 10 }] });

  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-session-secret-with-sufficient-length', resave: false, saveUninitialized: false }));
  app.use('/employee', require('../src/API/routes/employeeRoutes'));
  app.use('/api/expenses', require('../src/API/routes/expenseRoutes'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(base + path, options);
  const login = (username, password) => request('/employee/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  try {
    assert.equal((await request('/employee/get')).status, 401);
    assert.equal((await request('/api/expenses')).status, 401);

    const unknown = await login('missing', 'bad-password');
    const wrong = await login('admin', 'bad-password');
    assert.equal(unknown.status, 401);
    assert.deepEqual(await unknown.json(), await wrong.json());

    const staffLogin = await login('staff', 'staff-password');
    assert.equal(staffLogin.status, 200);
    const staffCookie = staffLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/employee/me', { headers: { Cookie: staffCookie } })).status, 200);
    assert.equal((await request('/employee/get', { headers: { Cookie: staffCookie } })).status, 403);

    const adminLogin = await login('admin', 'correct-password');
    assert.equal(adminLogin.status, 200);
    const adminBody = await adminLogin.json();
    assert.equal(Object.hasOwn(adminBody.user, 'password'), false);
    const adminCookie = adminLogin.headers.get('set-cookie').split(';')[0];
    const listing = await request('/employee/get', { headers: { Cookie: adminCookie } });
    assert.equal(listing.status, 200);
    assert.equal(Object.hasOwn((await listing.json()).employees[0], 'password'), false);
    assert.equal((await request('/api/expenses', { headers: { Cookie: adminCookie } })).status, 200);
    assert.equal((await request('/employee/create', {
      method: 'POST', headers: { Cookie: adminCookie, Origin: 'https://untrusted.example' }
    })).status, 403);
    assert.equal((await request('/employee/logout', {
      method: 'POST', headers: { Cookie: adminCookie }
    })).status, 200);
    assert.equal((await request('/employee/me', { headers: { Cookie: adminCookie } })).status, 401);

    const legacyLogin = await login('legacy', 'legacy-password');
    assert.equal(legacyLogin.status, 200);
    assert.equal(Object.hasOwn((await legacyLogin.json()).user, 'password'), false);
    assert.equal(await bcrypt.compare('legacy-password', admins.legacy.password), true);

    for (let i = 0; i < 3; i++) assert.equal((await login('admin', 'bad-password')).status, 401);
    const limited = await login('admin', 'bad-password');
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    Employee.findOne = originals.findOne;
    Employee.findById = originals.findById;
    Employee.find = originals.find;
    Expense.find = originals.expenseFind;
  }
});
