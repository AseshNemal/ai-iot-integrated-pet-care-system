const Employee = require('../model/Employee');

const publicEmployee = (employee) => {
  const { password, ...safeEmployee } = employee.toObject();
  return safeEmployee;
};

const requireEmployee = async (req, res, next) => {
  if (!req.session?.employeeId) {
    return res.status(401).json({ error: 'Employee login required' });
  }

  try {
    const employee = await Employee.findById(req.session.employeeId);
    if (!employee) {
      delete req.session.employeeId;
      return res.status(401).json({ error: 'Employee login required' });
    }
    req.employee = employee;
    next();
  } catch (error) {
    next(error);
  }
};

const requireHrAdmin = (req, res, next) => {
  if (req.employee.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'HR administrator access required' });
  }
  next();
};

// Browsers include Origin on cross-site writes. Reject writes from other sites when
// production uses a SameSite=None session cookie for the separate React frontend.
const requireTrustedOrigin = (req, res, next) => {
  const origin = req.get('Origin');
  const allowed = [
    process.env.FRONTEND_URL,
    ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000'])
  ]
    .filter(Boolean)
    .map((url) => {
      try { return new URL(url).origin; } catch { return null; }
    });
  if (origin && !allowed.includes(origin)) {
    return res.status(403).json({ error: 'Untrusted request origin' });
  }
  next();
};

module.exports = { publicEmployee, requireEmployee, requireHrAdmin, requireTrustedOrigin };
