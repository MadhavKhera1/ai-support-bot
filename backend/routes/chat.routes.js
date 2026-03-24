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

        if (faq) {

            response = faq.answer;

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

            if (relevantChunks.length) {
                sources = relevantChunks.map((chunk) => {
                    return {
                        documentTitle: chunk.documentTitle,
                        chunkIndex: chunk.chunkIndex,
                        similarity: Number(chunk.similarity.toFixed(4))
                    };
                });
            }

            const retrievalContext = relevantChunks.length
                ? relevantChunks
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

        }

        // Escalation Detection
        const escalationPhrases = [
            "i'm not sure",
            "cannot find information",
            "please contact support"
        ];

        let needsHumanSupport = false;

        for (let phrase of escalationPhrases) {

            if (response.toLowerCase().includes(phrase)) {

                needsHumanSupport = true;
                break;

            }

        }

        // save bot response
        const botMessage = new Message({
            conversationId: conversation._id,
            role: "bot",
            content: response
        });

        await botMessage.save();

        res.json({
            reply: response,
            conversationId: conversation._id,
            needsHumanSupport,
            sources
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
