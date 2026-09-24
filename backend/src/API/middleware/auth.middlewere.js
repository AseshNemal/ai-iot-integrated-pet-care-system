const authenticate = (req, res, next) => {
    console.log("🔒 Checking authentication status:", {
         isAuthenticated: req.isAuthenticated(),
         hasUser: !!req.user,
         sessionID: req.sessionID
     });
    
    if (req.isAuthenticated()) {
        next();
    } else {
        console.error("❌ Authentication failed: User not authenticated");
        res.status(401).json({ error: "User is not authenticated. Please log in." });
    }
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
