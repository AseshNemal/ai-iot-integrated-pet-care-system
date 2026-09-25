require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Employee = require('../src/API/model/Employee');

async function main() {
  if (!process.env.MONGODB_URL) throw new Error('MONGODB_URL is required');
  await mongoose.connect(process.env.MONGODB_URL);
  let migrated = 0;
  for await (const employee of Employee.find().select('+password').cursor()) {
    if (/^\$2[aby]\$\d\d\$/.test(employee.password)) continue;
    const hash = await bcrypt.hash(employee.password, 12);
    const result = await Employee.updateOne(
      { _id: employee._id, password: employee.password },
      { $set: { password: hash } }
    );
    migrated += result.modifiedCount;
  }
  console.log(`Migrated ${migrated} employee password records.`);
}

main().catch((error) => {
  console.error('Employee password migration failed:', error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
