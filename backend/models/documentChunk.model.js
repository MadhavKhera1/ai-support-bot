const mongoose = require("mongoose");

const documentChunkSchema = new mongoose.Schema(
    {
        documentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Document",
            required: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        chunkIndex: {
            type: Number,
            required: true
        },
        content: {
            type: String,
            required: true
        },
        embedding: {
            type: [Number],
            default: []
        }
    },
    { timestamps: true }
);

documentChunkSchema.index({ userId: 1, documentId: 1, chunkIndex: 1 });

module.exports = mongoose.model("DocumentChunk", documentChunkSchema);
