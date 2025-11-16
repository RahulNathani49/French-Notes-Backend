const mongoose = require("mongoose");

const contentSchema = new mongoose.Schema({
        title: { type: String, required: true },
        type: {
            type: String,
            enum: ["writing", "speaking", "reading", "listening","exam-based"],
            required: true
        },
        text: { type: String },

        // Optional media
        imageUrl: { type: String },
        audioUrl: { type: String },
        videoUrl: { type: String },  // (future-proof: if you ever upload videos)
    },
    { timestamps: true });

module.exports = mongoose.model("Content", contentSchema);
