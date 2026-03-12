const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
    title:{
        type: String,
        default: "New Chat"
    },
}, {timestamps: true});

const Conversation = mongoose.model("Conversation",conversationSchema);

module.exports = Conversation;
