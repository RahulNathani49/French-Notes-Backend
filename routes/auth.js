const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const LoginLog = require("../models/LoginLog");
const { verifyToken } = require("../middleware/auth");
const nodemailer = require("nodemailer");
require('dotenv').config();  // at the top of the file

const baseUrl = process.env.CLIENT_URL || "http://localhost:3000"; // fallback

const router = express.Router();

// ===================
// Admin Registration
// ===================
router.post("/admin-register", async (req, res) => {
    try {
        const { username, password } = req.body;

        const existing = await User.findOne({ username });
        if (existing) {
            return res.status(400).json({ error: "Username already exists" });
        }

        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({
            username,
            password: hashed,
            role: "admin"
        });

        res.json({ message: "Admin created successfully", user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===================
// Admin Login
// ===================
router.post("/admin-login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username, role: "admin" });
        if (!user) return res.status(400).json({ error: "Invalid admin credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid admin credentials" });

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===================
// Student Login
// ===================
router.post("/student-login", async (req, res) => {
    try {
        const { username, password, deviceId, deviceInfo } = req.body;

        // 1️⃣ Find student
        const user = await User.findOne({ username, role: "student" });
        if (!user) return res.status(400).json({ error: "Invalid student credentials" });

        // 2️⃣ Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid student credentials" });

        // 3️⃣ Check existing device
        let existingDevice = await LoginLog.findOne({ userId: user._id, deviceId });

        // 4️⃣ Count approved devices
        const approvedCount = await LoginLog.countDocuments({ userId: user._id });



        // 5️⃣ Handle existing device
        if (existingDevice) {
            if (existingDevice.status === "approved") {
                // ✅ Issue token for approved device
                const token = jwt.sign(
                    { id: user._id, role: user.role },
                    process.env.JWT_SECRET,
                    { expiresIn: "1d" }
                );
                return res.json({ token, message: "Login successful (approved device)", logId: existingDevice._id });
            } else if (existingDevice.status === "denied") {
                return res.status(403).json({ error: "Access denied for this device. Please contact admin." });
            } else if (existingDevice.status === "pending") {
                return res.json({ message: "Device login is still pending admin approval", logId: existingDevice._id });
            }
        }

        // 6️⃣ Reject if student already has 2 approved devices
        if (approvedCount >= 2) {
            return res.status(403).json({ error: "Login not permitted. Maximum 2 devices are allowed. If you made reset on device contact admin." });
        }

        // 7️⃣ Create a new pending login log if device is new
        const log = await LoginLog.create({
            userId: user._id,
            username: user.username,
            deviceId,
            deviceInfo,
            status: "pending"
        });

        res.json({ message: "Login request pending admin approval", logId: log._id });

    } catch (err) {
        console.error("Student login error:", err);
        res.status(500).json({ error: err.message });
    }
});


// --------------------------------------------------
// Forgot Password (Student Only)
// --------------------------------------------------
router.post("/student-forgot-password", async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email, role: "student" });
        if (!user) return res.status(404).json({ error: "No student account found" });

        // 1️⃣ Generate the token first
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "15m" });

        // 2️⃣ Build the reset link AFTER token exists
        const baseUrl = process.env.FRONTEND_URL;
        const resetLink = `${baseUrl}/reset-password/${token}`;

        // 3️⃣ Send email
        const transporter = nodemailer.createTransport({
            service: "Gmail",
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

       await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "French Notes - Password Reset",
            html: `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Password Reset</title>
<style>
  body {
    background-color: #f5f6fa;
    font-family: Arial, Helvetica, sans-serif;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 480px;
    margin: 40px auto;
    background: #ffffff;
    border-radius: 8px;
    padding: 30px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  h1 {
    color: #333333;
    text-align: center;
    font-size: 22px;
    margin-bottom: 20px;
  }
  p {
    color: #555555;
    line-height: 1.6;
    font-size: 16px;
  }
  .btn {
    display: inline-block;
    background-color: #4a90e2;
    color: #ffffff !important;
    text-decoration: none;
    padding: 12px 20px;
    border-radius: 5px;
    font-weight: bold;
    margin: 20px 0;
  }
  .note {
    font-size: 14px;
    color: #888888;
    margin-top: 20px;
  }
</style>
</head>
<body>
  <div class="container">
    <h1>Password Reset Request</h1>
    <p>Hello <strong>${user.name}</strong>,</p>
    <p>We received a request to reset your password for your French Notes account.</p>
    <p>Please click the button below to set a new password. This link will remain valid for <strong>15 minutes</strong>.</p>
    <p style="text-align:center;">
      <a href="${resetLink}" class="btn">Reset My Password</a>
    </p>
    <p>If you did not request a password reset, you can safely ignore this email.</p>
    <p class="note">This is an automated message—please do not reply directly.</p>
  </div>
</body>
</html>
`

        });


        res.json({ message: "Reset link sent to your email" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// --------------------------------------------------
// Reset Password
// --------------------------------------------------
router.post("/student-reset-password/:token", async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find student by decoded ID
        const student = await User.findOne({ _id: decoded.id, role: "student" });
        if (!student) return res.status(404).json({ error: "Invalid link or student not found" });

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        student.password = await bcrypt.hash(password, salt);
        await student.save();

        res.json({ message: "Password updated successfully" });
    } catch (err) {
        console.error(err);
        return res.status(400).json({ error: "Invalid or expired token" });
    }
});

router.post("/student-register", async (req, res) => {
    try {
        const { username, password, name, email } = req.body;

        // Check if username or email already exists
        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) {
            return res.status(400).json({ error: "Username or email already exists" });
        }

        // Hash the password
        const hashed = await bcrypt.hash(password, 10);

        // Create the student user
        const user = await User.create({
            username,
            password: hashed,
            role: "student",
            name,
            email
        });

        res.json({ message: "Student registered successfully", user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Example Express route
router.get("/profile", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("name username email role");
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});


module.exports = router;
