const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Conversation",
            default: null
        },
        scope: {
            type: String,
            enum: ["global", "conversation"],
            default: "global"
        },
        fileName: {
            type: String,
            required: true
        },
        mimeType: {
            type: String,
            required: true
        },
        fileSize: {
            type: Number,
            required: true
        },
        title: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ["processing", "ready", "failed"],
            default: "processing"
        },
        textLength: {
            type: Number,
            default: 0
        },
        chunkCount: {
            type: Number,
            default: 0
        },
        errorMessage: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

documentSchema.index({ userId: 1, scope: 1, conversationId: 1, createdAt: -1 });

module.exports = mongoose.model("Document", documentSchema);
