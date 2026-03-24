const express = require("express");
const router = express.Router();

const generateAIResponse = require("../services/gemini.service");

const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const FAQ = require("../models/faq.model");
const Document = require("../models/document.model");
const DocumentChunk = require("../models/documentChunk.model");
const authMiddleware = require("../middleware/auth.middleware");
const { retrieveRelevantChunks } = require("../services/document.service");

const DOCUMENT_GROUNDING_THRESHOLD = 0.42;
const DOCUMENT_STRONG_MATCH_THRESHOLD = 0.5;
const DOCUMENT_CONCEPT_MATCH_THRESHOLD = 0.62;
const MAX_GROUNDED_CHUNKS = 3;
const MAX_GROUNDED_DOCUMENTS = 2;
const DOCUMENT_SIMILARITY_WINDOW = 0.04;

const CONCEPT_QUESTION_PATTERNS = [
    /^what is\b/i,
    /^what do you mean by\b/i,
    /^define\b/i,
    /^explain\b/i,
    /^tell me about\b/i
];

const DOCUMENT_TARGET_PATTERNS = [
    /\bmadhav\b/i,
    /\bresume\b/i,
    /\bcv\b/i,
    /\bdocument\b/i,
    /\bpdf\b/i,
    /\bfile\b/i,
    /\babcid\b/i,
    /\bemail\b/i,
    /\bdob\b/i,
    /\beducation\b/i,
    /\bexperience\b/i,
    /\bskill\b/i,
    /\bexposure\b/i,
    /\bhis\b/i,
    /\bher\b/i,
    /\btheir\b/i,
    /\bmy\b/i
];

const isConceptQuestion = (text = "") =>
    CONCEPT_QUESTION_PATTERNS.some((pattern) => pattern.test(text.trim()));

const isDocumentTargetedQuestion = (text = "") =>
    DOCUMENT_TARGET_PATTERNS.some((pattern) => pattern.test(text));

const pickGroundedChunks = (scoredChunks = [], options = {}) => {
    const { preferGeneralKnowledge = false } = options;
    const topChunk = scoredChunks[0] || null;

    if (!topChunk) {
        return [];
    }

    if (
        preferGeneralKnowledge &&
        topChunk.similarity < DOCUMENT_CONCEPT_MATCH_THRESHOLD
    ) {
        return [];
    }

    const hasStrongDocumentMatch =
        topChunk.similarity >= DOCUMENT_STRONG_MATCH_THRESHOLD ||
        scoredChunks.filter(
            (chunk) => chunk.similarity >= DOCUMENT_GROUNDING_THRESHOLD
        ).length >= 2;

    if (!hasStrongDocumentMatch) {
        return [];
    }

    const documentsByStrength = new Map();

    scoredChunks.forEach((chunk) => {
        if (chunk.similarity < DOCUMENT_GROUNDING_THRESHOLD) {
            return;
        }

        const documentKey = String(chunk.documentId);
        const existing = documentsByStrength.get(documentKey);

        if (!existing || chunk.similarity > existing.bestSimilarity) {
            documentsByStrength.set(documentKey, {
                documentKey,
                bestSimilarity: chunk.similarity
            });
        }
    });

    const strongestDocuments = [...documentsByStrength.values()]
        .sort((a, b) => b.bestSimilarity - a.bestSimilarity)
        .filter(
            (document, index, sortedDocuments) =>
                index === 0 ||
                document.bestSimilarity >=
                    sortedDocuments[0].bestSimilarity - DOCUMENT_SIMILARITY_WINDOW
        )
        .slice(0, MAX_GROUNDED_DOCUMENTS);

    const allowedDocumentKeys = new Set(
        strongestDocuments.map((document) => document.documentKey)
    );

    return scoredChunks
        .filter(
            (chunk) =>
                chunk.similarity >= DOCUMENT_GROUNDING_THRESHOLD &&
                allowedDocumentKeys.has(String(chunk.documentId))
        )
        .slice(0, MAX_GROUNDED_CHUNKS);
};

// POST /api/chat
router.post("/chat",authMiddleware, async (req, res) => {

    try {

        const { message, conversationId } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }
        let conversation;

        if (!conversationId) {

            conversation = new Conversation({
                title: message.substring(0, 40),
                userId: req.user.id   // important for user based chats
            });

            await conversation.save();

        } else {

            conversation = await Conversation.findById(conversationId);

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

        // save user message
        const userMessage = new Message({
            conversationId: conversation._id,
            role: "user",
            content: message
        });

        await userMessage.save();

        // check FAQ
        const faq = await FAQ.findOne({
            question: { $regex: message, $options: "i" }
        });

        let response;
        let sources = [];
        let groundingSource = "general";

        if (faq) {

            response = faq.answer;
            groundingSource = "faq";

        } else {

            // fetch previous messages for context
            const previousMessages = await Message.find({
                conversationId: conversation._id
            })
                .sort({ createdAt: 1 })
                .limit(10);

            let conversationHistory = "";

            previousMessages.forEach(msg => {

                conversationHistory += `${msg.role}: ${msg.content}\n`;

            });

            const relevantChunks = await retrieveRelevantChunks({
                userId: req.user.id,
                query: message,
                conversationId: conversation._id,
                limit: 4
            });

            const scoredChunks = relevantChunks.filter(
                (chunk) => Number.isFinite(chunk.similarity)
            );
            const preferGeneralKnowledge =
                isConceptQuestion(message) && !isDocumentTargetedQuestion(message);
            const groundedChunks = pickGroundedChunks(scoredChunks, {
                preferGeneralKnowledge
            });

            if (groundedChunks.length) {
                groundingSource = "documents";
                sources = groundedChunks.map((chunk) => {
                    return {
                        documentTitle: chunk.documentTitle,
                        chunkIndex: chunk.chunkIndex,
                        similarity: Number(chunk.similarity.toFixed(4)),
                        scope: chunk.scope || "global"
                    };
                });
            }

            const retrievalContext = groundedChunks.length
                ? groundedChunks
                    .map(
                        (chunk, index) =>
                            `[Source ${index + 1} | ${chunk.documentTitle} | chunk ${chunk.chunkIndex + 1}]\n${chunk.content}`
                    )
                    .join("\n\n")
                : "No uploaded document context was found.";

            const fullPrompt = `
Previous conversation:
${conversationHistory}

Relevant uploaded document context:
${retrievalContext}

Current user question:
${message}
`;

            response = await generateAIResponse(fullPrompt);

            if (typeof response !== "string" || !response.trim()) {
                response = "I could not generate a response right now. Please try again.";
                groundingSource = "general";
                sources = [];
            }

        }

        // Escalation Detection
        const escalationPhrases = [
            "i'm not sure",
            "cannot find information",
            "please contact support"
        ];

        let needsHumanSupport = false;

        for (let phrase of escalationPhrases) {

            if (typeof response === "string" && response.toLowerCase().includes(phrase)) {

                needsHumanSupport = true;
                break;

            }

        }

        // save bot response
        const botMessage = new Message({
            conversationId: conversation._id,
            role: "bot",
            content: response,
            sources,
            groundingSource
        });

        await botMessage.save();

        res.json({
            reply: response,
            conversationId: conversation._id,
            needsHumanSupport,
            sources,
            groundingSource
        });

    } catch (error) {

        console.error(error);
        res.status(500).json({ error: "Server error" });

    }

});


// GET all conversations for sidebar
router.get("/conversations", authMiddleware,async (req, res) => {

    try {

        const conversations = await Conversation.find({
            userId: req.user.id
        }).sort({createdAt: -1});

        res.json(conversations);

    } catch (error) {

        console.error(error);
        res.status(500).json({ error: "Server Error" });

    }

});

router.post("/conversations", authMiddleware, async (req, res) => {

  try {

    const title =
      typeof req.body?.title === "string" && req.body.title.trim()
        ? req.body.title.trim().slice(0, 80)
        : "New conversation";

    const conversation = new Conversation({
      title,
      userId: req.user.id
    });

    await conversation.save();

    res.status(201).json(conversation);

  } catch (error) {

    console.error("CREATE CONVERSATION ERROR:", error);
    res.status(500).json({ error: "Failed to create conversation" });

  }

});


// get messages of a specific conversation
router.get("/messages/:conversationId", authMiddleware, async (req, res) => {

  try {

    const conversationId = req.params.conversationId; // ✅ correct

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found"
      });
    }

    // 🔐 security check
    if (conversation.userId.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    const messages = await Message.find({
      conversationId: conversationId
    }).sort({ createdAt: 1 });

    res.json(messages);

  } catch (error) {

    console.error("GET MESSAGES ERROR:", error);

    res.status(500).json({
      error: "Server error"
    });

  }

});

// delete a conversation
router.delete("/conversation/:id", authMiddleware, async (req, res) => {

  try {

    const conversationId = req.params.id;

    // find conversation
    const conversation = await Conversation.findById(conversationId);

    // check if exists
    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found"
      });
    }

    // check ownership
    if (conversation.userId.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    // delete all messages
    await Message.deleteMany({ conversationId });

    const documents = await Document.find({
      userId: req.user.id,
      scope: "conversation",
      conversationId
    }).select("_id");

    const documentIds = documents.map((doc) => doc._id);

    if (documentIds.length) {
      await DocumentChunk.deleteMany({
        userId: req.user.id,
        documentId: { $in: documentIds }
      });
    }

    await Document.deleteMany({
      userId: req.user.id,
      scope: "conversation",
      conversationId
    });

    // delete conversation
    await Conversation.findByIdAndDelete(conversationId);

    res.json({
      message: "Conversation deleted successfully"
    });

  } catch (error) {

    console.error("DELETE CONVERSATION ERROR:", error);

    res.status(500).json({
      error: "Failed to delete conversation"
    });

  }

});

// rename a conversation title
router.put("/conversation/:id/title", authMiddleware, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { title } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Title is required" });
    }

    const normalizedTitle = title.trim().slice(0, 80);

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // ownership check
    if (conversation.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    conversation.title = normalizedTitle;
    await conversation.save();

    res.json({
      message: "Conversation title updated successfully",
      conversation,
    });
  } catch (error) {
    console.error("RENAME CONVERSATION ERROR:", error);
    res.status(500).json({ error: "Failed to rename conversation" });
  }
});

// clear all conversations for a user
router.delete("/conversations/clear-all", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all conversations for this user
    const conversations = await Conversation.find({ userId });
    
    if (conversations.length === 0) {
      return res.json({
        message: "No conversations to clear",
        deletedConversations: 0,
        deletedMessages: 0
      });
    }

    // Get all conversation IDs
    const conversationIds = conversations.map(conv => conv._id);

    // Delete all messages in these conversations
    const messageDeleteResult = await Message.deleteMany({
      conversationId: { $in: conversationIds }
    });

    const documents = await Document.find({
      userId,
      scope: "conversation",
      conversationId: { $in: conversationIds }
    }).select("_id");

    const documentIds = documents.map((doc) => doc._id);

    if (documentIds.length) {
      await DocumentChunk.deleteMany({
        userId,
        documentId: { $in: documentIds }
      });
    }

    await Document.deleteMany({
      userId,
      scope: "conversation",
      conversationId: { $in: conversationIds }
    });

    // Delete all conversations
    const conversationDeleteResult = await Conversation.deleteMany({
      userId: userId
    });

    res.json({
      message: "All conversations cleared successfully",
      deletedConversations: conversationDeleteResult.deletedCount,
      deletedMessages: messageDeleteResult.deletedCount
    });

  } catch (error) {
    console.error("CLEAR ALL CONVERSATIONS ERROR:", error);
    res.status(500).json({
      error: "Failed to clear conversations"
    });
  }
});

module.exports = router;
