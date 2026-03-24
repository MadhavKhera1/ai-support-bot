const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    conversationId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true
    },

    role:{
        type: String,
        enum: ["user","bot"],
        required: true
    },

    groundingSource: {
        type: String,
        enum: ["none", "faq", "documents", "general"],
        default: "none"
    },

    content: {
        type: String,
        required: true
    },

    sources: {
        type: [
            {
                documentTitle: {
                    type: String,
                    required: true
                },
                chunkIndex: {
                    type: Number,
                    required: true
                },
                similarity: {
                    type: Number,
                    required: true
                },
                scope: {
                    type: String,
                    enum: ["global", "conversation"],
                    default: "global"
                }
            }
        ],
        default: []
    }
}, { timestamps: true});

const Message = mongoose.model("Message",messageSchema);

module.exports = Message;
