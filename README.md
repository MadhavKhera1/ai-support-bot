# Actio AI
AI that acts, not just responds.

Actio AI is a full-stack AI support assistant built with React, Node.js, Express, and MongoDB.
It started as a simple chatbot, but the goal was to push it further toward something that can actually **do things**, not just answer prompts.

The application combines conversational AI with an agent-style interaction layer, allowing certain user inputs to trigger real actions inside the system.

The current version also includes a practical RAG layer, so users can upload documents and ask grounded questions from:
- a personal knowledge base
- chat-specific attached files

The system follows a simple agent-style flow:
**User input -> intent detection -> decision -> AI response or action execution**

## Live Demo 🚀

- Frontend: [https://actio-ai.vercel.app](https://actio-ai.vercel.app)
- Backend: [https://actio-ai-backend.onrender.com](https://actio-ai-backend.onrender.com)

## Screenshots 🖼️

### Home 🏠
![Home](assets/screenshots/home.png)

### Chat 💬
![Chat](assets/screenshots/chat.png)

### Login 🔐
![Login](assets/screenshots/login.png)

### Signup 📝
![Signup](assets/screenshots/signup.png)

### Forgot Password 🔑
![Forgot Password](assets/screenshots/forgot_pwd.png)

### Settings ⚙️
![Settings](assets/screenshots/settings.png)

### Help Guide 🧠
![Help Guide](assets/screenshots/help_guide.png)

## Features / What It Does ✨

Along with AI chat, the application can interpret user intent and perform actions such as:

- starting a new chat
- renaming or deleting conversations
- clearing all chats
- exporting chats as PDF or TXT
- opening settings
- regenerating responses

It also supports full account flows including authentication, profile updates, and password reset via email.

## RAG / Document Support 📄

The current version includes a practical RAG (Retrieval-Augmented Generation) layer that allows the AI to answer based on user-provided documents.

- Upload documents to a personal knowledge base
- Attach documents directly to a specific chat
- Supports PDF, TXT, and Markdown files
- Extracts and splits content into manageable chunks
- Retrieves relevant context at query time
- Generates responses grounded in document content
- Separates document-grounded answers from general AI answers
- Shows source-aware responses in chat

This enables the system to provide context-aware answers instead of generic responses.

## How It Works 🔄

At a high level, the system follows this flow:

`User input -> intent detection -> decision -> either execute an action or generate an AI response`

When documents are involved:

`User query -> retrieve relevant chunks -> augment prompt -> AI response`

## Tech Stack 🛠️

**Frontend**
- React
- Vite
- Axios
- React Markdown
- jsPDF

**Backend**
- Node.js
- Express
- MongoDB + Mongoose
- JWT
- bcrypt
- multer
- pdf-parse

**AI / Services**
- Gemini API
- Resend for password reset emails

**Deployment**
- Vercel for frontend
- Render for backend
- MongoDB Atlas for database

## Project Structure 📁

```text
actio-ai/
  backend/
    config/
    middleware/
    models/
    routes/
    services/
    server.js

  frontend/
    src/
      components/
      pages/
      App.jsx
      main.jsx
```

## Running Locally 💻

### 1. Clone the repository 📥

```bash
git clone https://github.com/your-username/actio-ai.git
cd actio-ai
```

### 2. Backend setup 🧩

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/` using `backend/.env.example`.

Start the backend:

```bash
npm run dev
```

### 3. Frontend setup 🎨

Open a new terminal:

```bash
cd frontend
npm install
```

Create a `.env` file inside `frontend/` using `frontend/.env.example`.

Start the frontend:

```bash
npm run dev
```

## Environment Variables 🔐

### Backend 🖥️

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_FALLBACK_MODEL=gemini-2.5-flash
FRONTEND_URL=http://localhost:5173
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=onboarding@resend.dev
```

### Frontend 🌐

```env
VITE_API_BASE_URL=http://localhost:5000
```

## Implementation Notes 🧠

- The frontend uses environment-based API configuration, so local and deployed setups can use different backend URLs cleanly.
- Password reset email delivery is handled through Resend because free Render services do not support outbound SMTP traffic reliably.
- The app includes an agentic command layer on top of the chat UI, so some user messages trigger actions instead of normal AI replies.
- The current RAG implementation uses semantic similarity over stored embeddings in MongoDB. It is designed to stay simple and practical on a free-tier setup.
- General concept questions can bypass document retrieval, while profile or document-targeted questions prefer uploaded context.
- The Gemini service includes retry and fallback handling for temporary model overload or rate-limit issues.

## Why This Project 🎯

The goal was to explore how AI systems can move beyond traditional chat interfaces and interact with real application logic.
Instead of just generating text, the system is designed to:

- understand intent
- take action
- integrate AI into real application workflows

It also demonstrates a lightweight and practical approach to RAG without overcomplicating the stack.

## Current Status 📌

The project is deployed and working end-to-end with the following capabilities:

- signup / login with authentication
- AI chat with persistent conversations
- agentic command handling such as rename, delete, export, and navigation
- previous conversations and chat history
- password reset via email
- settings and account management
- global knowledge-base document upload
- chat-specific document attachments
- semantic retrieval with source-aware RAG responses

The system can interpret certain user inputs as actions instead of just queries, making it behave like a simple AI agent rather than a standard chatbot.
