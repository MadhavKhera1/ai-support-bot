const pdfParse = require("pdf-parse");
const { GoogleGenerativeAI, TaskType } = require("@google/generative-ai");

const Document = require("../models/document.model");
const DocumentChunk = require("../models/documentChunk.model");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({
    model: "gemini-embedding-001"
});

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_CHUNKS_PER_DOCUMENT = 80;
const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;

const hasExtension = (fileName = "", extension = "") =>
    fileName.toLowerCase().endsWith(extension.toLowerCase());

const normalizeText = (text = "") =>
    text
        .replace(/\r/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();

const chunkText = (text) => {
    const normalized = normalizeText(text);
    if (!normalized) return [];

    const chunks = [];
    let start = 0;

    while (start < normalized.length && chunks.length < MAX_CHUNKS_PER_DOCUMENT) {
        let end = Math.min(start + CHUNK_SIZE, normalized.length);

        if (end < normalized.length) {
            const lastBreak = normalized.lastIndexOf("\n", end);
            const lastSentence = normalized.lastIndexOf(". ", end);
            const breakPoint = Math.max(lastBreak, lastSentence);

            if (breakPoint > start + Math.floor(CHUNK_SIZE * 0.5)) {
                end = breakPoint + 1;
            }
        }

        const slice = normalized.slice(start, end).trim();
        if (slice) chunks.push(slice);

        if (end >= normalized.length) break;
        start = Math.max(end - CHUNK_OVERLAP, start + 1);
    }

    return chunks;
};

const extractTextFromFile = async (file) => {
    if (!file) {
        throw new Error("File is required");
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error("File is too large. Maximum size is 5 MB.");
    }

    if (
        file.mimetype === "application/pdf" ||
        hasExtension(file.originalname, ".pdf")
    ) {
        const parsed = await pdfParse(file.buffer);
        return normalizeText(parsed.text || "");
    }

    if (
        file.mimetype === "text/plain" ||
        file.mimetype === "text/markdown" ||
        hasExtension(file.originalname, ".txt") ||
        hasExtension(file.originalname, ".md")
    ) {
        return normalizeText(file.buffer.toString("utf-8"));
    }

    throw new Error("Unsupported file type. Use PDF, TXT, or Markdown.");
};

const embedSingleText = async (text, taskType, title) => {
    const response = await embeddingModel.embedContent({
        content: { parts: [{ text }] },
        taskType,
        ...(title && taskType === TaskType.RETRIEVAL_DOCUMENT ? { title } : {})
    });

    return response.embedding?.values || [];
};

const embedTexts = async (texts, taskType, title) => {
    if (!texts.length) return [];

    return Promise.all(
        texts.map((text) => embedSingleText(text, taskType, title))
    );
};

const cosineSimilarity = (vectorA = [], vectorB = []) => {
    if (!vectorA.length || !vectorB.length || vectorA.length !== vectorB.length) {
        return -1;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i += 1) {
        dot += vectorA[i] * vectorB[i];
        normA += vectorA[i] * vectorA[i];
        normB += vectorB[i] * vectorB[i];
    }

    if (!normA || !normB) return -1;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const ingestDocument = async ({ userId, file }) => {
    const document = await Document.create({
        userId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        title: file.originalname.replace(/\.[^.]+$/, "") || "Untitled document",
        status: "processing"
    });

    try {
        const extractedText = await extractTextFromFile(file);

        if (!extractedText) {
            throw new Error("No readable text found in the uploaded file.");
        }

        const chunks = chunkText(extractedText);
        if (!chunks.length) {
            throw new Error("Document could not be split into chunks.");
        }

        const embeddings = await embedTexts(
            chunks,
            TaskType.RETRIEVAL_DOCUMENT,
            document.title
        );

        await DocumentChunk.insertMany(
            chunks.map((content, index) => ({
                documentId: document._id,
                userId,
                chunkIndex: index,
                content,
                embedding: embeddings[index] || []
            }))
        );

        document.status = "ready";
        document.textLength = extractedText.length;
        document.chunkCount = chunks.length;
        document.errorMessage = null;
        await document.save();

        return document;
    } catch (error) {
        document.status = "failed";
        document.errorMessage = error.message;
        await document.save();
        throw error;
    }
};

const retrieveRelevantChunks = async ({ userId, query, limit = 4 }) => {
    const documents = await Document.find({ userId, status: "ready" })
        .select("_id title")
        .lean();

    if (!documents.length) return [];

    const queryVector = await embedSingleText(query, TaskType.RETRIEVAL_QUERY);
    if (!queryVector.length) return [];

    const chunks = await DocumentChunk.find({ userId })
        .select("documentId chunkIndex content embedding")
        .lean();

    const documentMap = new Map(documents.map((doc) => [String(doc._id), doc]));

    return chunks
        .map((chunk) => ({
            ...chunk,
            similarity: cosineSimilarity(queryVector, chunk.embedding || []),
            documentTitle: documentMap.get(String(chunk.documentId))?.title || "Document"
        }))
        .filter((chunk) => chunk.similarity > 0.2)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
};

const deleteDocumentForUser = async ({ userId, documentId }) => {
    const document = await Document.findOne({ _id: documentId, userId });
    if (!document) return null;

    await DocumentChunk.deleteMany({ documentId: document._id, userId });
    await Document.deleteOne({ _id: document._id, userId });

    return document;
};

module.exports = {
    ingestDocument,
    retrieveRelevantChunks,
    deleteDocumentForUser
};
