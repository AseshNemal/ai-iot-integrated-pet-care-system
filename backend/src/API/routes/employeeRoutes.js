const express = require('express');
const router = express.Router();
const Employee = require('../model/Employee');
const AppointmentData = require('../model/AppointmentData');
const bcrypt = require('bcrypt');
const { timingSafeEqual } = require('node:crypto');
const { publicEmployee, requireEmployee, requireHrAdmin, requireTrustedOrigin } = require('../middleware/employeeAuth');
const employeeLoginLimit = require('../middleware/employeeLoginLimit');

const invalidCredentials = { error: 'Invalid username or password' };
const isBcryptHash = (value) => /^\$2[aby]\$\d\d\$/.test(value);
const dummyHash = bcrypt.hashSync('unusable-dummy-password', 12);

router.post('/login', requireTrustedOrigin, employeeLoginLimit, async (req, res) => {
    try {
        const { username: suppliedUsername, password } = req.body;
        if (typeof suppliedUsername !== 'string' || typeof password !== 'string' || !suppliedUsername || !password) {
            return res.status(400).json(invalidCredentials);
        }
        const username = suppliedUsername.trim().replace(/[^A-Za-z0-9._-]/g, '');
        if (!username || username.length > 64 || username !== suppliedUsername.trim()) {
            return res.status(400).json(invalidCredentials);
        }
        const employee = await Employee.findOne({ username }).select('+password');
        if (!employee) await bcrypt.compare(password, dummyHash);
        const valid = employee && (isBcryptHash(employee.password)
            ? await bcrypt.compare(password, employee.password)
            : Buffer.byteLength(password) === Buffer.byteLength(employee.password) &&
              timingSafeEqual(Buffer.from(password), Buffer.from(employee.password)));
        if (!valid) {
            req.recordFailedEmployeeLogin();
            return res.status(401).json(invalidCredentials);
        }

        // Upgrade existing plaintext records on their first successful login.
        if (!isBcryptHash(employee.password)) {
            employee.password = password;
            await employee.save();
        }
        req.session.regenerate((error) => {
            if (error) return res.status(500).json({ error: 'Login failed' });
            req.session.employeeId = employee.id;
            req.session.save((saveError) => {
                if (saveError) return res.status(500).json({ error: 'Login failed' });
                req.clearFailedEmployeeLogin();
                res.json({ message: 'Login successful', user: publicEmployee(employee) });
            });
        });
    } catch (error) {
        console.error('Employee login failed:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

router.get('/me', requireEmployee, (req, res) => res.json({ user: publicEmployee(req.employee) }));
router.post('/logout', requireTrustedOrigin, requireEmployee, (req, res) => {
    req.session.destroy((error) => {
        if (error) return res.status(500).json({ error: 'Logout failed' });
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out' });
    });
});

// Booking needs a public directory, never the full HR employee record.
router.get('/service-providers', async (req, res) => {
    try {
        const providers = await Employee.find({ role: { $in: ['Vet', 'Groomer'] } })
            .select('_id firstName lastName role');
        res.json(providers);
    } catch (error) {
        console.error('Failed to fetch service providers:', error);
        res.status(500).json({ error: 'Failed to fetch service providers' });
    }
});

// Public booking catalogue. Exposes only the fields customers need to select
// a service provider; the full employee records remain authenticated.
router.get('/booking-options', async (req, res) => {
    try {
        const employees = await Employee.find({
            role: { $in: ['Groomer', 'Vet'] }
        }).select('_id firstName lastName role');

        res.status(200).json(employees);
    } catch (error) {
        console.error('Error fetching booking options:', error);
        res.status(500).json({ error: 'Failed to fetch booking options.' });
    }
});

router.use(requireEmployee, requireHrAdmin);
router.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return requireTrustedOrigin(req, res, next);
    next();
});

// Create Employee
router.post('/create', async (req, res) => {
    try {
        const { firstName, lastName, username, email, password, role } = req.body;

        // Generate employeeId automatically
        const employeeCount = await Employee.countDocuments();
        const employeeId = `EMP${String(employeeCount + 1).padStart(3, '0')}`; // e.g., EMP001, EMP002

        const employee = new Employee({
            employeeId,
            firstName,
            lastName,
            username,
            email,
            password,
            role,
            availability: []
        });

        await employee.save();
        const totalCount = await Employee.countDocuments(); // Get updated count
        res.status(201).send({ employee: publicEmployee(employee), totalCount });
    } catch (error) {
        console.error('Error creating employee:', error);
        res.status(400).send({ error: error.message });
    }
});

// Retrieve All Employees
router.get('/', async (req, res) => {
    try {
        const employees = await Employee.find().select('-password');
        const totalCount = employees.length; // Include count in response
        res.status(200).json(employees);
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(400).send({ error: error.message });
    }
});

router.get('/get', async (req, res) => {
    try {
        const employees = await Employee.find().select('-password');
        const totalCount = employees.length; // Include count in response
        res.status(200).json({ employees, totalCount });
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(400).send({ error: error.message });
    }
});

// Get Total Employee Count
router.get('/count', async (req, res) => {
    try {
        const totalCount = await Employee.countDocuments();
        res.status(200).json({ totalCount });
    } catch (error) {
        console.error('Error fetching employee count:', error);
        res.status(400).send({ error: error.message });
    }
});

// Delete Employee
router.delete('/:id', async (req, res) => {
    try {
        const employee = await Employee.findByIdAndDelete(req.params.id);
        if (!employee) {
            return res.status(404).send("Employee not found");
        }
        const totalCount = await Employee.countDocuments(); // Get updated count
        res.status(200).send({ message: "Employee deleted", totalCount });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(400).send({ error: error.message });
    }
});

// Update Employee
router.put('/:id', async (req, res) => {
    try {
        const { firstName, lastName, username, email, password, role } = req.body;
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).send("Employee not found");
        }

        if (password) {
            employee.password = password;
        }

        employee.firstName = firstName || employee.firstName;
        employee.lastName = lastName || employee.lastName;
        employee.username = username || employee.username;
        employee.email = email || employee.email;
        employee.role = role || employee.role;

        await employee.save();
        const totalCount = await Employee.countDocuments(); // Include count in response
        res.status(200).send({ employee: publicEmployee(employee), totalCount });
    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(400).send({ error: error.message });
    }
});

// Add Appointment
router.post('/appointment', async (req, res) => {
    try {
        const { employeeId, petName, appointmentDate } = req.body;

        if (!employeeId || !petName || !appointmentDate) {
            return res.status(400).send({ error: "employeeId, petName, and appointmentDate are required" });
        }

        const employee = await Employee.findOne({ employeeId });
        if (!employee) {
            return res.status(404).send({ error: "Employee not found" });
        }

        employee.appointments.push({
            petName,
            appointmentDate: new Date(appointmentDate),
        });

        await employee.save();
        res.status(201).send({ message: "Appointment added successfully", employee: publicEmployee(employee) });
    } catch (error) {
        console.error('Error adding appointment:', error);
        res.status(400).send({ error: error.message });
    }
});

// Get Appointment Counts per Employee
router.get('/appointment-counts', async (req, res) => {
    try {
        const employees = await Employee.find().select('employeeId firstName lastName role appointments');
        const appointmentCounts = employees.map(employee => ({
            employeeId: employee.employeeId,
            name: `${employee.firstName} ${employee.lastName}`,
            role: employee.role,
            totalAppointments: employee.appointments.length,
            appointments: employee.appointments
        }));

        appointmentCounts.sort((a, b) => b.totalAppointments - a.totalAppointments);
        res.status(200).json(appointmentCounts);
    } catch (error) {
        console.error('Error fetching appointment counts:', error);
        res.status(400).send({ error: error.message });
    }
});

// SECTION 1: RECEIVING APPOINTMENT DATA FROM APPOINTMENT SCHEDULING STUDENT
router.post('/receive-appointment-data', async (req, res) => {
    try {
        console.log('Received data:', req.body);
        const { employeeId, name, role, appointmentCount } = req.body;

        if (!employeeId || !name || !role || appointmentCount === undefined) {
            return res.status(400).send({ error: "employeeId, name, role, and appointmentCount are required" });
        }

        const appointmentData = await AppointmentData.findOneAndUpdate(
            { employeeId },
            { $set: { name, role, appointmentCount, createdAt: Date.now() } },
            { upsert: true, new: true, runValidators: true }
        );

        res.status(201).send({ message: "Appointment data received successfully", appointmentData });
    } catch (error) {
        console.error('Error saving appointment data:', error);
        res.status(400).send({ error: error.message });
    }
});

// SECTION 2: PROVIDING SORTED APPOINTMENT DATA FOR FINANCE MANAGEMENT STUDENT
router.get('/sorted-appointment-data', async (req, res) => {
    try {
        const appointmentData = await AppointmentData.find().sort({ appointmentCount: -1 });
        res.status(200).json(appointmentData);
    } catch (error) {
        console.error('Error fetching sorted appointment data:', error);
        res.status(400).send({ error: error.message });
    }
});

// SECTION 3: CLEARING APPOINTMENT DATA BEFORE UPLOADING SORTED DATA
router.delete('/sorted-appointment-data', async (req, res) => {
    try {
        console.log('Clearing AppointmentData collection');
        await AppointmentData.deleteMany({});
        res.status(200).send({ message: "Appointment data cleared successfully" });
    } catch (error) {
        console.error('Error clearing appointment data:', error);
        res.status(400).send({ error: error.message });
    }
});

module.exports = router;
