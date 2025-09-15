const express = require("express");
const multer = require("multer");
const Content = require("../models/Content");
const { verifyToken, verifyAdmin } = require("../middleware/auth");

const router = express.Router();

// Use memory storage so we can upload buffers directly to Cloudinary
const cloudinary = require("../config/cloudinary");

const storage = multer.memoryStorage();
const upload = multer({ storage });

// -----------------
// GET all content
// -----------------
router.get("/", verifyToken, async (req, res) => {
    try {
        const { type } = req.query;           // read the query param
        const query = type ? { type } : {};   // filter by type if provided
        const contents = await Content.find(query).sort({ createdAt: -1 });
        res.json(contents);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -----------------
// Add new content
// -----------------
router.post(
    "/",
    verifyToken,
    verifyAdmin,
    upload.fields([
        { name: "image", maxCount: 1 },
        { name: "audio", maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            console.log("📩 Incoming request body:", req.body);
            console.log("📩 Incoming files:", req.files);

            const { title, type, text } = req.body;

            if (!title || !type || !text) {
                return res.status(400).json({ error: "Title, type, and text are required." });
            }

            let imageUrl = null;
            let audioUrl = null;

            // If image exists, upload to Cloudinary
            if (req.files?.image) {
                try {
                    imageUrl = await new Promise((resolve, reject) => {
                        const stream = cloudinary.uploader.upload_stream(
                            { resource_type: "image" },
                            (error, result) => {
                                if (error) return reject(error);
                                resolve(result.secure_url);
                            }
                        );
                        stream.end(req.files.image[0].buffer);
                    });
                } catch (uploadErr) {
                    console.error("❌ Cloudinary image upload failed:", uploadErr);
                    return res.status(500).json({ error: "Image upload failed." });
                }
            }

            // If audio exists, upload to Cloudinary
            if (req.files?.audio) {
                try {
                    audioUrl = await new Promise((resolve, reject) => {
                        const stream = cloudinary.uploader.upload_stream(
                            { resource_type: "video" }, // ⚡ Cloudinary treats audio as "video"
                            (error, result) => {
                                if (error) return reject(error);
                                resolve(result.secure_url);
                            }
                        );
                        stream.end(req.files.audio[0].buffer);
                    });
                } catch (uploadErr) {
                    console.error("❌ Cloudinary audio upload failed:", uploadErr);
                    return res.status(500).json({ error: "Audio upload failed." });
                }
            }

            // Save to DB
            const content = await Content.create({
                title,
                type,
                text,
                imageUrl,
                audioUrl,
            });

            res.json(content);
        } catch (err) {
            console.error("❌ Add content error:", err);
            res.status(500).json({ error: err.message });
        }
    }
);



// -----------------
// Delete content
// -----------------

router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const content = await Content.findById(id);

        if (!content) {
            return res.status(404).json({ error: "Content not found" });
        }

        // Delete image from Cloudinary if exists
        if (content.imageUrl) {
            const imagePublicId = content.imageUrl.split("/").pop().split(".")[0];
            await cloudinary.uploader.destroy(imagePublicId, { resource_type: "image" });
        }

        // Delete audio from Cloudinary if exists
        if (content.audioUrl) {
            const audioPublicId = content.audioUrl.split("/").pop().split(".")[0];
            await cloudinary.uploader.destroy(audioPublicId, { resource_type: "video" });
        }

        // Delete content from DB
        await Content.findByIdAndDelete(id);

        res.json({ message: "Content and associated files deleted successfully" });
    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ error: err.message });
    }
});



// Update content by ID
router.put(
    "/:id",
    verifyToken,
    verifyAdmin,
    upload.fields([
        { name: "image", maxCount: 1 },
        { name: "audio", maxCount: 1 }
    ]),
    async (req, res) => {
        try {
            const { title, type, text } = req.body;
            const updateData = { title, type, text };

            // Upload new image if provided
            if (req.files?.image) {
                const imageUrl = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { resource_type: "image" },
                        (error, result) => {
                            if (error) return reject(error);
                            resolve(result.secure_url);
                        }
                    );
                    stream.end(req.files.image[0].buffer);
                });
                updateData.imageUrl = imageUrl;
            }

            // Upload new audio if provided
            if (req.files?.audio) {
                const audioUrl = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { resource_type: "video" }, // Cloudinary handles audio under "video"
                        (error, result) => {
                            if (error) return reject(error);
                            resolve(result.secure_url);
                        }
                    );
                    stream.end(req.files.audio[0].buffer);
                });
                updateData.audioUrl = audioUrl;
            }

            // Update DB
            const updated = await Content.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true }
            );

            if (!updated) {
                return res.status(404).json({ error: "Content not found" });
            }

            res.json(updated);
        } catch (err) {
            console.error("❌ Update content error:", err);
            res.status(500).json({ error: err.message });
        }
    }
);




module.exports = router;
