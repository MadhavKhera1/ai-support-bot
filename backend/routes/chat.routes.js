const express = require('express');
const router = express.Router();

const generateAIResponse = require("../services/gemini.service");

const Chat = require("../models/chat.model");
const FAQ = require("../models/faq.model");


router.post("/chat", async (req, res) => {

    try {

        const { message } = req.body;

        // check FAQ first
        const faq = await FAQ.findOne({
            question: { $regex: message, $options: "i" }
        });

        let response;

        if (faq) {

            response = faq.answer;

        } else {

            // get last 5 chat messages
            const previousChats = await Chat.find()
                .sort({ createdAt: -1 })
                .limit(5);

            let conversationHistory = "";

            previousChats.reverse().forEach(chat => {
                conversationHistory += `User: ${chat.userMessage}\n`;
                conversationHistory += `Bot: ${chat.botResponse}\n`;
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

        // save chat history
        const chat = new Chat({
            userMessage: message,
            botResponse: response,
            needsHumanSupport
        });

        await chat.save();

        res.json({
            reply: response,
            needsHumanSupport
        });

    } catch (error) {

        console.error(error);
        res.status(500).json({ error: "Server error" });

    }

});


// get recent chats
router.get("/chats", async (req, res) => {

    try {

        const chats = await Chat.find()
            .sort({ createdAt: -1 })
            .limit(20);

        res.json(chats);

    } catch (error) {

        console.error(error);
        res.status(500).json({ error: "Failed to fetch chats" });

    }

});

module.exports = router;