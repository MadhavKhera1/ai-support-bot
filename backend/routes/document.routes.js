const express = require("express");
const multer = require("multer");

const Document = require("../models/document.model");
const Conversation = require("../models/conversation.model");
const authMiddleware = require("../middleware/auth.middleware");
const {
    ingestDocument,
    deleteDocumentForUser
} = require("../services/document.service");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

router.get("/documents", authMiddleware, async (req, res) => {
    try {
        const { scope, conversationId } = req.query;
        const filter = { userId: req.user.id };

        if (scope === "global") {
            filter.scope = "global";
        }

        if (scope === "conversation") {
            filter.scope = "conversation";
            filter.conversationId = conversationId || null;
        }

        const documents = await Document.find(filter)
            .sort({ createdAt: -1 });

        res.json(documents);
    } catch (error) {
        console.error("GET DOCUMENTS ERROR:", error);
        res.status(500).json({ error: "Failed to fetch documents" });
    }
});

router.post(
    "/documents/upload",
    authMiddleware,
    (req, res, next) => {
        upload.single("file")(req, res, (error) => {
            if (error) {
                console.error("MULTER UPLOAD ERROR:", error);
                return res.status(400).json({
                    error: error.message || "File upload failed"
                });
            }
            next();
        });
    },
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "File is required" });
            }

            const scope = req.body.scope === "conversation" ? "conversation" : "global";
            const conversationId =
                scope === "conversation" ? req.body.conversationId : null;

            if (scope === "conversation") {
                if (!conversationId) {
                    return res.status(400).json({
                        error: "conversationId is required for chat attachments"
                    });
                }

                const conversation = await Conversation.findById(conversationId);

                if (!conversation) {
                    return res.status(404).json({
                        error: "Conversation not found"
                    });
                }

                if (conversation.userId.toString() !== req.user.id) {
                    return res.status(403).json({
                        error: "Access denied"
                    });
                }
            }

            const document = await ingestDocument({
                userId: req.user.id,
                file: req.file,
                scope,
                conversationId
            });

            res.status(201).json({
                message: "Document uploaded successfully",
                document
            });
        } catch (error) {
            console.error("UPLOAD DOCUMENT ERROR:", error);
            res.status(400).json({
                error: error.message || "Failed to upload document"
            });
        }
    }
);

router.delete("/documents/:id", authMiddleware, async (req, res) => {
    try {
        const deleted = await deleteDocumentForUser({
            userId: req.user.id,
            documentId: req.params.id
        });

        if (!deleted) {
            return res.status(404).json({ error: "Document not found" });
        }

        res.json({ message: "Document deleted successfully" });
    } catch (error) {
        console.error("DELETE DOCUMENT ERROR:", error);
        res.status(500).json({ error: "Failed to delete document" });
    }
});

module.exports = router;
