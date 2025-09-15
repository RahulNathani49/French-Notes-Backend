// models/ideaModel.js
const mongoose = require('mongoose');

const ideaSchema = new mongoose.Schema({
    title: { type: String, required: true },
    body: { type: String, required: true },
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to your student model
        required: true,
    },
    filePath: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Ideas', ideaSchema);