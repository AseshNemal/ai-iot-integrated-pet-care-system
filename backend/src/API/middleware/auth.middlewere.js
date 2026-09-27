const Employee = require('../model/Employee');

const authenticate = async (req, res, next) => {
    // Employee/admin logins use the same server-side session store as Passport.
    // Current HR sessions store the employee ID. Older sessions may still contain
    // an employee object, so accept both formats during the transition.
    if (req.session?.employeeId) {
        try {
            const employee = await Employee.findById(req.session.employeeId);
            if (employee) {
                req.user = employee;
                return next();
            }
            delete req.session.employeeId;
        } catch (error) {
            return next(error);
        }
    }

    if (req.session?.employee) {
        req.user = req.session.employee;
        return next();
    }

    const hasPassportSession =
        typeof req.isAuthenticated === "function" && req.isAuthenticated();

    if (hasPassportSession && req.user) {
        return next();
    }

    // A missing session is expected request flow, not a backend failure.
    return res.status(401).json({ error: "User is not authenticated. Please log in." });
};

const authorizeRoles = (...allowedRoles) => {
    const normalizedRoles = allowedRoles.map((role) => role.toLowerCase());

    return (req, res, next) => {
        const userRole = req.user?.role;

        if (!userRole || !normalizedRoles.includes(userRole.toLowerCase())) {
            return res.status(403).json({ error: "You do not have permission to access this resource." });
        }

        next();
    };
};

export { authenticate, authorizeRoles };
