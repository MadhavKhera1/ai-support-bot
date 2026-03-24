const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const RETRYABLE_STATUS_CODES = new Set([429, 500, 503]);
const MAX_GENERATION_ATTEMPTS = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (error) =>
    RETRYABLE_STATUS_CODES.has(Number(error?.status));

async function generateAIResponse(userMessage){
    const model = genAI.getGenerativeModel({
        model: DEFAULT_MODEL
    });

    //this is a custom prompt so that AI behaves like support assistant
    const prompt = `
    You are a helpful customer support assistant.

    Rules:
    - Give short and clear answers.
    - Maximum 5 sentences unless the context clearly needs more.
    - Use simple language.
    - Avoid long paragraphs.
    - If uploaded document context directly answers the question, use it first.
    - If uploaded document context is only partial, tangential, or does not answer the question, answer from your general knowledge instead.
    - Do not refuse to answer only because the uploaded documents are incomplete.
    - Only mention that the documents do not cover the answer when the user is explicitly asking about the uploaded documents or their contents.
    - If unsure, say "Please contact support."
    User Question:
    ${userMessage}
    `;

    let lastError;

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
        try {
            const result = await model.generateContent(prompt);
            const response = result.response.text();
            return response;
        } catch (error) {
            lastError = error;

            if (!isRetryableError(error) || attempt === MAX_GENERATION_ATTEMPTS) {
                break;
            }

            const retryDelayMs = 700 * attempt;
            console.warn(
                `Gemini generateContent retry ${attempt}/${MAX_GENERATION_ATTEMPTS - 1} after ${error.status}: ${error.statusText || error.message}`
            );
            await wait(retryDelayMs);
        }
    }

    if (isRetryableError(lastError)) {
        return "Actio AI is temporarily under heavy demand right now. Please try again in a moment.";
    }

    throw lastError;

}

module.exports = generateAIResponse;

