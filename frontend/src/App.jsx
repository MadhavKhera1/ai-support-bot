import "./App.css";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import ChatSidebar from "./components/ChatSidebar";
import { FaBars } from "react-icons/fa";

import Login from "./pages/Login";

function App() {

  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(
    !!localStorage.getItem("token")
  );

  const token = localStorage.getItem("token");

if (token) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

  const chatEndRef = useRef(null);

  const fetchConversations = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/conversations");
      setConversations(res.data);
    } catch (error) {
      console.error("Failed to fetch conversations", error);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const startNewConversation = () => {
    setConversationId(null);
    setChat([]);
  };

  const sendMessage = async (customMessage) => {

    const textToSend = customMessage || message;

    if (!textToSend.trim()) return;

    setMessage("");

    setChat(prev => [...prev, { sender: "user", text: textToSend }]);

    setLoading(true);

    try {

      const res = await axios.post("http://localhost:5000/api/chat", {
        message: textToSend,
        conversationId
      });

      const botReply = res.data.reply;

      if (!conversationId) {

        const newConversationId = res.data.conversationId;

        setConversationId(newConversationId);

        setConversations(prev => [
          { _id: newConversationId, title: textToSend.slice(0, 40) },
          ...prev
        ]);
      }

      setChat(prev => [...prev, { sender: "bot", text: botReply }]);

    } catch (error) {

      console.error("API Error:", error);

      setChat(prev => [...prev, {
        sender: "bot",
        text: "Something went wrong. Please try again."
      }]);

    }

    setLoading(false);
  };

  const loadConversation = async (id) => {

    try {

      const res = await axios.get(
        `http://localhost:5000/api/messages/${id}`
      );

      const messages = res.data.map(msg => ({
        sender: msg.role,
        text: msg.content
      }));

      setConversationId(id);
      setChat(messages);
      setSidebarOpen(false);

    } catch (error) {

      console.error("Failed to load conversation", error);

    }

  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  //auth check
  if (!isLoggedIn) {
    return <Login setIsLoggedIn={setIsLoggedIn} />;
  }
  return (

    <div className="app-layout">

      <button
        className="hamburger"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <FaBars />
      </button>

      <div className={`sidebar-wrapper ${sidebarOpen ? "open" : ""}`}>
        <ChatSidebar
          conversations={conversations}
          loadConversation={loadConversation}
          setConversations={setConversations}
          conversationId={conversationId}
          setConversationId={setConversationId}
          setChat={setChat}
        />
      </div>

      <div className="container">
        <div className="chat-area">

          <h2 className="title">AI Support Bot</h2>

          <button className="new-chat-btn" onClick={startNewConversation}>
            + New Chat
          </button>

          <div className="chat-box">

            {chat.length === 0 && (
  <div className="welcome-layout">

    <div className="welcome-left">

      <h3>Start a conversation 👋</h3>
      <p>Try asking one of these questions:</p>

      <div className="suggestions">

        <button onClick={() => sendMessage("What is Machine Learning?")}>
          What is Machine Learning?
        </button>

        <button onClick={() => sendMessage("Explain Deep Learning simply")}>
          Explain Deep Learning simply
        </button>

        <button onClick={() => sendMessage("Examples of AI applications")}>
          Examples of AI applications
        </button>

        <button onClick={() => sendMessage("How to become a Data Analyst?")}>
          How to become a Data Analyst?
        </button>

      </div>

    </div>

    <div className="welcome-right">

      <h3>AI Support Bot</h3>

      <div className="feature">
        ⚡ Instant Answers  
        <p>Ask technical questions and get quick explanations.</p>
      </div>

      <div className="feature">
        📚 Learning Assistant  
        <p>Understand AI, machine learning, and programming concepts.</p>
      </div>

      <div className="feature">
        💬 Smart Conversations  
        <p>The bot remembers context during your chat.</p>
      </div>

    </div>

  </div>
)}

            {chat.map((msg, index) => (
              <div
                key={index}
                className={`message ${msg.sender === "user" ? "user" : "bot"}`}
              >
                {msg.text}
              </div>
            ))}

            {loading && (
              <div className="message bot">Bot is typing...</div>
            )}

            <div ref={chatEndRef}></div>

          </div>

          <div className="input-area">

            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask a question..."
            />

            <button onClick={() => sendMessage()}>Send</button>

          </div>

        </div>

      </div>

    </div>
  );
}

export default App;