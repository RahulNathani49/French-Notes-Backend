const express = require("express");
const LoginLog = require("../models/LoginLog");
const { verifyToken, verifyAdmin } = require("../middleware/auth");

const router = express.Router();

// ==========================
// Get all pending login requests
// ==========================
router.get("/login-logs", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const logs = await LoginLog.find()
            .populate("userId", "username email name"); // ✅ include all fields you need

        res.json(logs);
    } catch (err) {
        console.error("Login Logs Error:", err);
        res.status(500).json({ error: err.message });
    }
});


// ==========================
// Approve or deny a login
// ==========================
router.post("/login-logs/:id", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { status } = req.body; // expected values: "approved" or "denied"

        if (!["approved", "denied"].includes(status)) {
            return res.status(400).json({ error: "Invalid status value" });
        }

        const log = await LoginLog.findById(req.params.id);
        if (!log) {
            return res.status(404).json({ error: "Login log not found" });
        }

        if (status === "approved") {
            // Count existing approved devices for this student
            const approvedCount = await LoginLog.countDocuments({
                userId: log.userId,
                status: "approved"
            });

            // Prevent more than 2 approved devices
            if (approvedCount >= 2) {
                return res.status(403).json({
                    error: "Student already has 2 approved devices. Cannot approve more."
                });
            }
        }

        log.status = status;
        await log.save();

        res.json({ message: `Login ${status}` });
    } catch (err) {
        console.error("Approve/Deny Error:", err);
        res.status(500).json({ error: "Failed to update login log" });
    }
});



module.exports = router;
