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
// PUT Edit an Idea with Cloudinary Upload
router.put('/:id', verifyToken,verifyAdmin, upload.single('file'), async (req, res) => {
    try {
        const getPublicIdFromUrl = (url) => {
            if (!url) return null;
            const parts = url.split('/');
            const publicIdWithExt = parts[parts.length - 1];
            const publicId = publicIdWithExt.split('.')[0];
            const folder = parts[parts.length - 2];
            return `${folder}/${publicId}`;
        };

        const { title, body } = req.body;
        const ideaId = req.params.id;

        const idea = await Idea.findById(ideaId);
        if (!idea) {
            return res.status(404).json({ error: 'Idea not found.' });
        }


        // Handle new file upload and old file deletion if a new file is provided
        if (req.file) {
            let newFileUrl = null;
            // First, delete the old file from Cloudinary if it exists
            if (idea.filePath) {
                // You'll need a helper function to get the public ID from the URL
                const publicId = getPublicIdFromUrl(idea.filePath);
                if (publicId) {
                    await cloudinary.uploader.destroy(publicId);
                    console.log(`✅ Old file ${publicId} deleted from Cloudinary.`);
                }
            }

            // Then, upload the new file
            newFileUrl = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'ideas', resource_type: "auto" },
                    (error, result) => {
                        if (error) {
                            console.error("Cloudinary upload error:", error);
                            return reject(error);
                        }
                        resolve(result.secure_url);
                    }
                );
                stream.end(req.file.buffer);
            });
            idea.filePath = newFileUrl;
        }

        // Update the idea with the new data
        idea.title = title || idea.title;
        idea.body = body || idea.body;
        await idea.save();

        res.json({ message: 'Idea updated successfully!', idea });
    } catch (err) {
        console.error("Error updating idea:", err);
        res.status(500).json({ error: 'Server error. Failed to update idea.' });
    }
});

// DELETE Idea (Admin Only)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const idea = await Idea.findById(id);

        if (!idea) {
            return res.status(404).json({ error: 'Idea not found.' });
        }

        // 1. Delete the file from Cloudinary first, if it exists.
        if (idea.filePath) {
            const parts = idea.filePath.split('/');
            const publicIdWithExtension = parts.pop(); // Get 'publicId.extension'
            const publicId = publicIdWithExtension.split('.')[0]; // Get 'publicId'

            if (publicId) {
                // Determine resource type based on file extension
                const extension = publicIdWithExtension.split('.').pop().toLowerCase();
                const resourceType = ['mp4', 'mov', 'avi'].includes(extension) ? 'video' : 'image';

                await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
                console.log(`✅ File ${publicId} deleted from Cloudinary.`);
            }
        }

        // 2. Now, delete the idea from the database.
        await Idea.findByIdAndDelete(id);

        res.json({ message: 'Idea and associated file deleted successfully.' });
    } catch (err) {
        console.error("Error deleting idea:", err);
        res.status(500).json({ error: 'Server error. Failed to delete idea.' });
    }
});
module.exports = router;