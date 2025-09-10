const mongoose = require("mongoose");

const loginLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    username: { type: String, required: true },
    deviceId: { type: String, required: true },
    deviceInfo: { type: String, required: true },
    status: {
        type: String,
        enum: ["pending", "approved", "denied"], // add "denied"
        default: "pending"
    }
}, { timestamps: true });

module.exports = mongoose.model("LoginLog", loginLogSchema);
