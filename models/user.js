const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["student", "admin"], default: "student" },
    name: { type: String },   // Student’s full name
    email: { type: String, unique: true } // Student’s email (must be unique)
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
