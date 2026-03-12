const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    conversationId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        required: True
    },

    role:{
        type: String,
        enum: ["user","bot"],
        required: true
    },

    content: {
        type: String,
        required: true
    }
}, { timestamps: true});

const Message = mongoose.model("Message",messageSchema);

module.exports = Message;
