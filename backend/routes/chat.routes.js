const express = require("express");
const router = express.Router();

const generateAIResponse = require("../services/gemini.service");

const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const FAQ = require("../models/faq.model");
const authMiddleware = require("../middleware/auth.middleware");


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

            const fullPrompt = `
Previous conversation:
${conversationHistory}

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
            needsHumanSupport
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