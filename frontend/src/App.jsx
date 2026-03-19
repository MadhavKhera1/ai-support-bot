import "./App.css";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import ChatSidebar from "./components/ChatSidebar";
import { FaBars } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import jsPDF from 'jspdf';

import Login from "./pages/Login";
import Settings from "./pages/Settings";

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
  const [user, setUser] = useState(null);
  const [copiedMessage, setCopiedMessage] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [route, setRoute] = useState(() => window.location.pathname || "/");

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportOptions && !event.target.closest('.export-dropdown')) {
        setShowExportOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportOptions]);

  const token = localStorage.getItem("token");

  const chatEndRef = useRef(null);

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname || "/");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (path) => {
    if (window.location.pathname === path) return;
    window.history.pushState({}, "", path);
    setRoute(path);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    setUser(null);
    setConversations([]);
    setConversationId(null);
    setChat([]);
    setSidebarOpen(false);
    navigate("/");
  };

  const fetchConversations = async () => {
    try {
      const res = await axios.get("/api/conversations");
      setConversations(res.data);
    } catch (error) {
      console.error("Failed to fetch conversations", error);
    }
  };

  

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    if (!isLoggedIn || !token) return;
    Promise.resolve().then(fetchConversations);
  }, [token, isLoggedIn]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {

      const fetchUser = async () => {

        try {
          const res = await axios.get("/api/auth/me");
          setUser(res.data);

        } catch (error) {
          console.error("Failed to fetch user", error);
          // If token is invalid, logout user
          if (error.response?.status === 401) {
            localStorage.removeItem("token");
            setIsLoggedIn(false);
          }
        }

      };

      if (!isLoggedIn || !token) return;
      Promise.resolve().then(fetchUser);

  }, [token, isLoggedIn]);

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

      const res = await axios.post("/api/chat", {
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
        `/api/messages/${id}`
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

  const copyMessage = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessage(index);
      setTimeout(() => setCopiedMessage(null), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1500);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  const exportAsText = () => {
    try {
      let content = '';
      chat.forEach((msg) => {
        const sender = msg.sender === 'user' ? 'You' : 'AI Support Bot';
        content += `${sender}:\n${msg.text}\n\n`;
      });
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExportOptions(false);
    } catch (error) {
      console.error('Failed to export text:', error);
    }
  };

  const exportAsPDF = () => {
    try {
      const doc = new jsPDF();
      let yPosition = 20;
      const lineHeight = 7;
      const pageWidth = doc.internal.pageSize.width - 40;
      
      doc.setFontSize(12);
      
      chat.forEach((msg) => {
        const sender = msg.sender === 'user' ? 'You:' : 'AI Support Bot:';
        const lines = doc.splitTextToSize(msg.text, pageWidth);
        
        // Add sender
        doc.setFont(undefined, 'bold');
        doc.text(sender, 20, yPosition);
        yPosition += lineHeight + 2;
        
        // Add message content
        doc.setFont(undefined, 'normal');
        lines.forEach(line => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, 20, yPosition);
          yPosition += lineHeight;
        });
        
        yPosition += 5;
      });
      
      doc.save(`chat-${new Date().toISOString().slice(0, 10)}.pdf`);
      setShowExportOptions(false);
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  const regenerateResponse = async () => {
    if (chat.length < 2 || loading) return;
    
    // Find the last user message
    const lastUserMessage = [...chat].reverse().find(msg => msg.sender === "user");
    if (!lastUserMessage) return;
    
    // Remove the last bot response
    setChat(prev => prev.slice(0, -1));
    setLoading(true);
    
    try {
      const res = await axios.post("/api/chat", {
        message: lastUserMessage.text,
        conversationId
      });
      
      const botReply = res.data.reply;
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
          user={user}
          onOpenSettings={() => {
            navigate("/settings");
            setSidebarOpen(false);
          }}
          onLogout={handleLogout}
        />
      </div>

      <div className="container">
        {route === "/settings" ? (
          <div className="settings-scroll">
            <Settings
              onBack={() => navigate("/")}
              onLogout={handleLogout}
              onUserUpdated={(updatedUser) => setUser(updatedUser)}
              onChatsCleared={() => {
                setConversations([]);
                setConversationId(null);
                setChat([]);
              }}
            />
          </div>
        ) : (
        <>
        <div className="top-bar">
          <div className="top-bar-spacer"></div>
          <h2 className="title">AI Support Bot</h2>
          <div className="top-bar-actions">
            <div className="export-dropdown">
              <button 
                className="export-btn" 
                onClick={() => setShowExportOptions(!showExportOptions)}
                title="Export Chat"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
              {showExportOptions && (
                <div className="export-options">
                  <button className="export-option" onClick={exportAsText}>
                    📄 Export as Text
                  </button>
                  <button className="export-option" onClick={exportAsPDF}>
                    📄 Export as PDF
                  </button>
                </div>
              )}
            </div>
            <button className="new-chat-btn" onClick={startNewConversation}>
              + New Chat
            </button>
          </div>
        </div>

        <div className="chat-box">
          {chat.length === 0 && (
            <div className="welcome-layout">
              <div className="welcome-left">
                <h3>Start a conversation</h3>
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
              <div className="message-content">
                {msg.sender === "user" ? (
                  msg.text
                ) : (
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                          <div className="code-block-wrapper">
                            <pre className="code-block">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                            <button 
                              className="code-copy-btn"
                              onClick={() => copyCode(String(children).replace(/\n$/, ''))}
                              title="Copy code"
                            >
                              {copiedCode === String(children).replace(/\n$/, '') ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                              )}
                            </button>
                          </div>
                        ) : (
                          <code className="inline-code" {...props}>
                            {children}
                          </code>
                        )
                      },
                      ul({children}) {
                        return <ul className="markdown-list">{children}</ul>
                      },
                      ol({children}) {
                        return <ol className="markdown-list">{children}</ol>
                      },
                      h1({children}) {
                        return <h1 className="markdown-h1">{children}</h1>
                      },
                      h2({children}) {
                        return <h2 className="markdown-h2">{children}</h2>
                      },
                      h3({children}) {
                        return <h3 className="markdown-h3">{children}</h3>
                      },
                      strong({children}) {
                        return <strong className="markdown-bold">{children}</strong>
                      }
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                )}
              </div>
              {msg.sender === "bot" && (
                <div className="message-actions">
                  <button 
                    className="copy-btn"
                    onClick={() => copyMessage(msg.text, index)}
                    title="Copy message"
                  >
                    {copiedMessage === index ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    )}
                  </button>
                </div>
              )}
              {msg.sender === "bot" && index === chat.length - 1 && (
                <div className="regenerate-container">
                  <button 
                    className="regenerate-btn"
                    onClick={regenerateResponse}
                    disabled={loading}
                  >
                    ↻ Regenerate
                  </button>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="message bot">Bot is typing...</div>
          )}

          <div ref={chatEndRef}></div>
        </div>

        <div className="input-area">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask a question"
            className="chat-input"
            rows={1}
            onKeyPress={handleKeyPress}
          />
          <button onClick={sendMessage} className="send-btn" disabled={loading}>
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

export default App;