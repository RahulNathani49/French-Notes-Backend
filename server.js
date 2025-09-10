require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/auth");
const contentRoutes = require("./routes/content");
const adminRoutes = require("./routes/admin");

const app = express();

// =======================
// Middleware (MUST come before routes)
// =======================
app.use(cors({
    origin: "http://localhost:3000", // frontend URL
    credentials: true
}));
app.use(express.json());
app.use(helmet());

// =======================
// Routes
// =======================
app.use("/api/auth", authRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/admin", adminRoutes);

// =======================
// MongoDB connection
// =======================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => console.error("❌ MongoDB connection error:", err));


// Optional: Insert into MongoDB

// =======================
// Health Check
// =======================
app.get("/", (req, res) => {
    res.send("French Notes API is running 🚀");
});

// =======================
// Start Server
// =======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
