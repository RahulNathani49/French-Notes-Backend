const jwt = require("jsonwebtoken");

// ==========================
// Verify JWT Token Middleware
// ==========================
function verifyToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
        return res.status(401).json({ error: "No token provided" });
    }

    // Expect header format: "Bearer <token>"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({ error: "Invalid token format" });
    }

    const token = parts[1];
    try {
        // Verify JWT using the secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Attach decoded payload to req.user
        next();
    } catch (err) {
        return res.status(403).json({ error: "Token is not valid or expired" });
    }
}

// ==========================
// Verify Admin Role Middleware
// ==========================
function verifyAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
    }
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin access only" });
    }
    next();
}

module.exports = { verifyToken, verifyAdmin };
