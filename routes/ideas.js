const express = require('express');
const router = express.Router();
const multer = require("multer");
const Idea = require('../models/Ideas');
const { verifyToken, verifyAdmin} = require('../middleware/auth');
const cloudinary = require("../config/cloudinary");

// Use memory storage to handle file buffers
const storage = multer.memoryStorage();
const upload = multer({ storage });

// GET All Ideas
// This route fetches all ideas and is accessible to any authenticated user.
router.get('/', verifyToken, async (req, res) => {
    try {
        const ideas = await Idea.find().populate('submittedBy', 'username');
        res.json(ideas);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error. Failed to retrieve ideas.' });
    }
});

// POST New Idea with Cloudinary Upload
router.post('/submit', verifyToken, upload.single('file'), async (req, res) => {
    try {
        const { title, body } = req.body;
        const userId = req.user.id;
        let fileUrl = null;

        // If a file was uploaded, handle the stream upload to Cloudinary
        if (req.file) {
            try {
                fileUrl = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        {
                            folder: 'ideas', // Specify a folder for the upload
                            resource_type: "auto" // Cloudinary will auto-detect the file type
                        },
                        (error, result) => {
                            if (error) {
                                console.error("Cloudinary upload error:", error);
                                return reject(error);
                            }
                            resolve(result.secure_url);
                        }
                    );
                    // Pass the file buffer to the upload stream
                    stream.end(req.file.buffer);
                });
            } catch (uploadErr) {
                console.error("❌ Cloudinary file upload failed:", uploadErr);
                return res.status(500).json({ error: "File upload failed." });
            }
        }

        const newIdea = new Idea({
            title,
            body,
            submittedBy: userId,
            filePath: fileUrl, // Save the Cloudinary URL
        });

        await newIdea.save();
        res.status(201).json({ message: 'Idea submitted successfully!', idea: newIdea });
    } catch (err) {
        console.error("Error saving idea:", err);
        res.status(500).json({ error: 'Server error. Failed to submit idea.' });
    }
});

// DELETE Idea (Admin Only)
router.delete('/:id', verifyAdmin,verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin access required.' });
        }
        const deletedIdea = await Idea.findByIdAndDelete(req.params.id);
        if (!deletedIdea) {
            return res.status(404).json({ error: 'Idea not found.' });
        }
        res.json({ message: 'Idea deleted successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error. Failed to delete idea.' });
    }
});

module.exports = router;