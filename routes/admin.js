const express = require("express");
const LoginLog = require("../models/LoginLog");
const User = require("../models/User");        // ✅ import User model

const { verifyToken, verifyAdmin } = require("../middleware/auth");

const router = express.Router();

// ==========================
// Get all users
// ==========================

router.get("/users", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const users = await User.find({ role: "student" }, "-password");// exclude password and only student
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ==========================
// Remove user permanently
// ==========================
router.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await User.findByIdAndDelete(id);
        await LoginLog.deleteMany({ userId: id }); // also cleanup logs

        res.json({ message: "User removed successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================
// Reset all logs of a user
// ==========================
router.post("/users/:id/reset-logs", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await LoginLog.deleteMany({ userId: id });

        res.json({ message: "User logs reset successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
