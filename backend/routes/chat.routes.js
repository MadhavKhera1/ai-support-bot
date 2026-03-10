const express = require('express');
const router = express.Router();

const Chat = require("../models/chat.model");
const FAQ = require("../models/faq.model");

router.post("/chat", async(req,res)=>{
    try{
        const {message} = req.body;

        //check FAQ first
        const faq = await FAQ.findOne({
            question: {$regex: message, $options: "i"}
        });

        let response;

        if(faq){
            response=faq.answer;
        }
        else{
            response= "I could not find an answer in the knowledge base";
        }

        //save chat history
        const chat = new Chat({
            userMessage: message,
            botResponse: response
        });

        await chat.save();

        res.json({
            reply: response
        });

    } catch(error){
        console.error(error);
        res.status(500).json({ error: "Server error"});
    }
});

module.exports= router;
