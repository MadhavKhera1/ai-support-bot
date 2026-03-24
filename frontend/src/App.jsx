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
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpRendered, setHelpRendered] = useState(false);
  const [conversationDocuments, setConversationDocuments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const helpCloseTimeoutRef = useRef(null);

  const openHelp = () => {
    if (helpRendered) {
      setHelpOpen(true);
      return;
    }
    setHelpRendered(true);
    requestAnimationFrame(() => setHelpOpen(true));
  };

  const closeHelp = () => {
    setHelpOpen(false);
    if (helpCloseTimeoutRef.current) clearTimeout(helpCloseTimeoutRef.current);
    helpCloseTimeoutRef.current = setTimeout(
      () => setHelpRendered(false),
      220
    );
  };

  const tryHelpCommand = (cmd) => {
    setMessage(cmd);
    if (chatInputRef.current) chatInputRef.current.focus();
    closeHelp();
  };

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
  const chatInputRef = useRef(null);
  const chatBoxRef = useRef(null);
  const attachmentInputRef = useRef(null);

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
    setConversationDocuments([]);
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

  const fetchConversationDocuments = async (id) => {
    if (!id) {
      setConversationDocuments([]);
      return;
    }

    try {
      const res = await axios.get("/api/documents", {
        params: {
          scope: "conversation",
          conversationId: id
        }
      });
      setConversationDocuments(res.data || []);
    } catch (error) {
      console.error("Failed to fetch conversation documents", error);
    }
  };

  const ensureConversationForAttachment = async (fileName = "New conversation") => {
    if (conversationId) return conversationId;

    const baseTitle =
      fileName.replace(/\.[^.]+$/, "").trim().slice(0, 40) || "New conversation";

    const res = await axios.post("/api/conversations", {
      title: baseTitle
    });

    const nextConversationId = res.data._id;
    setConversationId(nextConversationId);
    setConversations((prev) => [res.data, ...prev]);

    return nextConversationId;
  };

  

  useEffect(() => {
    if (chat.length === 0) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    if (route !== "/") return;
    if (chat.length !== 0) return;
    if (!chatBoxRef.current) return;
    chatBoxRef.current.scrollTop = 0;
  }, [chat.length, route, isLoggedIn]);

  // Close help modal on Escape
  useEffect(() => {
    if (!helpOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        closeHelp();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [helpOpen]);

  // GPT-like UX: typing anywhere focuses the chat input and appends characters.
  useEffect(() => {
    const onGlobalKeyDown = (e) => {
      if (route === "/settings") return;
      if (helpRendered) return;

      const target = e.target;
      const tag = target?.tagName?.toLowerCase?.();
      const isTypingField =
        tag === "textarea" || tag === "input" || tag === "select";
      const isInteractive =
        isTypingField || tag === "button" || tag === "a" || target?.isContentEditable;

      if (isInteractive) return;

      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape" || e.key === "Tab") return;

      // Ensure focus
      if (chatInputRef.current) chatInputRef.current.focus();

      if (e.key === "Backspace") {
        e.preventDefault();
        setMessage((prev) => prev.slice(0, -1));
        return;
      }

      if (e.key.length === 1) {
        e.preventDefault();
        setMessage((prev) => prev + e.key);
      }
    };

    document.addEventListener("keydown", onGlobalKeyDown);
    return () => document.removeEventListener("keydown", onGlobalKeyDown);
  }, [route, helpOpen, helpRendered]);

  useEffect(() => {
    if (!isLoggedIn || !token) return;
    Promise.resolve().then(fetchConversations);
  }, [token, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !token || !conversationId) {
      setConversationDocuments([]);
      return;
    }

    Promise.resolve().then(() => fetchConversationDocuments(conversationId));
  }, [conversationId, isLoggedIn, token]);

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
    setConversationDocuments([]);
  };

  const detectIntent = (text) => {
    const raw = text.toLowerCase().trim();
    const normalizedRaw = raw
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
    const t = normalizedRaw.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ");

    const hasChatWord = /(chat|chats|conversation|conversations|message|messages)/.test(t);
    // Support: delete "something" chat  / remove 'something' conversation
    // Also supports smart quotes (from copy/paste).
    const quotedDeleteMatch = normalizedRaw.match(
      /(delete|remove|clear)\s+["'](.+?)["'](?:\s+(chat|conversation|conversations))?/i
    );

    // Support: delete chat named as "Chat Title"
    const namedAsDeleteMatch = normalizedRaw.match(
      /(delete|remove|clear)\s+(chat|conversation|conversations|message|messages)?\s*(named\s+as|named|titled|called)\s+["'](.+?)["']/i
    );
    const hasSettingsWord =
      /(settings|setting|preferences|profile page|account settings)/.test(t);
    const hasRenameWord =
      /(rename|change title|set title|update title|edit title|retitle)/.test(t);
    const hasExportWord = /(export|download|save|store)/.test(t);
    const wantsPdf = /\bpdf\b/.test(t) || /(as pdf|in pdf|pdf version)/.test(t);
    const wantsText = /\btxt\b/.test(t) || /\btext\b/.test(t) || /(plain|as text|txt version)/.test(t);
    const hasDelete = /(delete|remove|clear|erase|wipe|reset|purge|drop)/.test(t);
    const hasAll = /\b(all|everything|entire|whole|every)\b/.test(t);

    const hasThis = /\b(this|current|active)\b/.test(t);
    const hasLast = /(last|most recent|latest)/.test(t);

    const hasList = /(list|show|previous|recent|what are my chats|my chats)/.test(t);

    const hasRegenerate = /(regenerate|try again|refresh response|redo|re-do|another answer|new answer)/.test(t);
    const wantsSettings =
      hasSettingsWord ||
      /(open settings|go to settings|open profile|edit profile|change profile|update profile|change password|update password)/.test(
        t
      );

    const wantsNewChat =
      /(open new chat|new chat|start new chat|create new chat|begin new chat|start a new conversation|new conversation)/.test(
        t
      );

    // Most destructive/specific first
    if (hasRegenerate) return { type: "REGENERATE_LAST_RESPONSE" };
    if (wantsNewChat) return { type: "OPEN_NEW_CHAT" };
    if (hasChatWord && hasExportWord && wantsPdf) return { type: "EXPORT_PDF" };
    if (hasChatWord && hasExportWord && wantsText) return { type: "EXPORT_TEXT" };
    if (hasChatWord && hasExportWord) return { type: "EXPORT_TEXT" };
    if (hasChatWord && hasDelete && hasAll) return { type: "CLEAR_ALL_CHATS" };
    if (hasChatWord && hasDelete && hasThis) return { type: "DELETE_CURRENT_CHAT" };
    if (hasChatWord && hasDelete && hasLast) return { type: "DELETE_LAST_CHAT" };
    // Don't use generic delete if we have a more specific quoted/named delete match.
    if (hasChatWord && hasDelete && !quotedDeleteMatch && !namedAsDeleteMatch) {
      return { type: "DELETE_CHAT" };
    }

    // "delete "something" chat"
    if (hasChatWord && hasDelete && quotedDeleteMatch) {
      const targetTitle = quotedDeleteMatch[2]?.trim();
      if (targetTitle) return { type: "DELETE_CHAT_BY_TITLE", targetTitle };
    }

    if (namedAsDeleteMatch) {
      const targetTitle = namedAsDeleteMatch[4]?.trim();
      if (targetTitle) return { type: "DELETE_CHAT_BY_TITLE_NAMED", targetTitle };
    }

    if (wantsSettings) return { type: "OPEN_SETTINGS" };

    // Rename chat
    if (hasChatWord && hasRenameWord && hasThis) return { type: "RENAME_CURRENT_CHAT" };
    if (hasChatWord && hasRenameWord) return { type: "RENAME_LAST_CHAT" };

    if (hasChatWord && hasList) return { type: "LIST_CHATS" };

    return { type: "AI_CHAT" };
  };

  const appendBot = (text) => {
    setChat((prev) => [...prev, { sender: "bot", text }]);
  };

  // Used for "agentic" formatting requests like:
  // "give bullet points", "short answer", "explain like I'm 5", "include code"
  const getFormatInstruction = (text) => {
    const t = text.toLowerCase();
    const parts = [];

    if (/(bullet points|bullets|list of|in bullets|point form)/.test(t)) {
      parts.push("Use bullet points.");
    }

    if (/(step-by-step|step by step|steps)/.test(t)) {
      parts.push("Provide step-by-step instructions.");
    }

    if (/(explain like (i'?m|i am) 5|eli5|like i'm 5|like i am 5)/.test(t)) {
      parts.push("Explain like I'm 5 years old.");
    }

    if (/(include code|code snippet|snippet|provide code)/.test(t)) {
      parts.push("Include code snippets when relevant.");
    }

    if (/(short answer|keep it short|brief|concisely|very short)/.test(t)) {
      parts.push("Keep the answer short and concise.");
    }

    if (/(long explanation|in detail|detailed|elaborate|in depth)/.test(t)) {
      parts.push("Provide a detailed explanation.");
    }

    if (/(examples?|for example|e\.g\.)/.test(t)) {
      parts.push("Add one or two examples.");
    }

    return parts.length ? parts.join(" ") : "";
  };

  const extractRenameTitle = (text) => {
    const clean = text.trim().replace(/\s+/g, " ");
    const patterns = [
      /rename\s+(this|current|active)?\s*(chat|conversation)?\s*(to|as)?\s*:?["']?(.+?)["']?\s*$/i,
      /change\s+title\s*(to|as)?\s*:?["']?(.+?)["']?\s*$/i,
      /set\s+title\s*(to|as)?\s*:?["']?(.+?)["']?\s*$/i,
      /retitle\s*(to|as)?\s*:?["']?(.+?)["']?\s*$/i,
    ];

    for (const re of patterns) {
      const m = clean.match(re);
      if (m) {
        // last capture group is the proposed title
        const maybeTitle = m[m.length - 1];
        if (maybeTitle && typeof maybeTitle === "string") {
          const title = maybeTitle.trim().replace(/^["']|["']$/g, "");
            const titleLower = title.toLowerCase();
            // If the user didn't provide a title, the regex may capture generic words like "chat".
            if (!title) return "";
            if (titleLower === "chat" || titleLower === "conversation") return "";
            return title.slice(0, 80);
        }
      }
    }

    return "";
  };

  const [toastText, setToastText] = useState(null);
  const [toastKind, setToastKind] = useState("agent"); // "agent" | "ai"
  const toastTimeoutRef = useRef(null);

  const showToast = (text, ms = 1800, kind = "agent") => {
    setToastKind(kind);
    setToastText(text);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastText(null), ms);
  };

  // Pending multi-step agent actions (e.g., "delete chat named as X" -> ask -> next user "delete" confirms)
  const [pendingAgentAction, setPendingAgentAction] = useState(null);

  const isConfirmMessage = (text) => {
    const t = text.toLowerCase().trim();
    return /^(delete|confirm|yes|yep|ok|okay|sure|proceed|go ahead|do it)\b/.test(t);
  };

  const isCancelMessage = (text) => {
    const t = text.toLowerCase().trim();
    return /^(cancel|cancle|no|stop|abort)\b/.test(t);
  };

  const sendMessage = async (customMessage) => {

    const textToSend = customMessage || message;

    if (!textToSend.trim()) return;

    setMessage("");

    // Multi-step agent action confirmation:
    // e.g. `delete chat named as "X"` -> bot asks -> user replies `delete`
    if (pendingAgentAction) {
      if (isCancelMessage(textToSend)) {
        setPendingAgentAction(null);
        showToast("Action cancelled", 1400, "agent");
        return;
      }

      if (isConfirmMessage(textToSend)) {
        const { conversationId } = pendingAgentAction;
        try {
          showToast("Running action…", 1600, "agent");
          await axios.delete(`/api/conversation/${conversationId}`);
          await fetchConversations();

          if (conversationId === pendingAgentAction.conversationId) {
            setConversationId(null);
            setChat([]);
          }
          showToast("✅ Chat deleted", 1600, "agent");
        } catch (error) {
          console.error("Pending delete error:", error);
          showToast("Failed to delete chat", 2000, "agent");
        }

        setPendingAgentAction(null);
        return;
      }

      showToast("Waiting for confirmation…", 1800, "agent");
      appendBot('Reply "delete" to confirm, or "cancel" to abort.');
      return;
    }
    const intent = detectIntent(textToSend);

    if (intent.type === "OPEN_SETTINGS") {
      showToast("Opening settings…", 1200, "agent");
      navigate("/settings");
      return;
    }

    if (intent.type === "OPEN_NEW_CHAT") {
      showToast("Opening new chat…", 1200, "agent");
      startNewConversation();
      showToast("✅ New chat ready", 1800, "agent");
      return;
    }

    // Regenerate intent should NOT add the "regenerate" command as a user message.
    // We want to regenerate the previous answer using the last actual user question.
    if (intent.type === "REGENERATE_LAST_RESPONSE") {
      showToast("Analyzing your request…", 1200, "agent");
      showToast("Running action…", 1600, "agent");
      try {
        await regenerateResponse();
      } catch (error) {
        console.error("Regenerate error:", error);
        appendBot("Something went wrong while regenerating. Please try again.");
      }
      return;
    }

    if (intent.type === "EXPORT_PDF") {
      showToast("Analyzing your request…", 1200, "agent");
      showToast("Running action…", 1600, "agent");
      if (!chat.length) {
        showToast("No chat to export.", 1600, "agent");
        return;
      }
      try {
        exportAsPDF();
        showToast("✅ Exported as PDF", 1800, "agent");
      } catch (error) {
        console.error("Export PDF error:", error);
        showToast("Failed to export PDF", 2000, "agent");
      }
      return;
    }

    if (intent.type === "EXPORT_TEXT") {
      showToast("Analyzing your request…", 1200, "agent");
      showToast("Running action…", 1600, "agent");
      if (!chat.length) {
        showToast("No chat to export.", 1600, "agent");
        return;
      }
      try {
        exportAsText();
        showToast("✅ Exported as Text", 1800, "agent");
      } catch (error) {
        console.error("Export Text error:", error);
        showToast("Failed to export text", 2000, "agent");
      }
      return;
    }

    if (intent.type === "DELETE_CHAT_BY_TITLE_NAMED") {
      const targetTitle = intent.targetTitle || "";
      const targetLower = targetTitle.toLowerCase().trim();

      if (!targetLower) {
        appendBot('Tell me the chat title you want to delete (example: delete chat named as "My chat").');
        return;
      }

      try {
        const res = await axios.get("/api/conversations");
        const convs = res.data || [];

        const targetWords = targetLower.split(/\s+/).filter((w) => w.length > 2);
        const scoreConv = (title) => {
          const tl = (title || "").toLowerCase();
          let score = 0;
          if (!tl) return 0;
          if (tl.includes(targetLower)) score += 5;
          for (const w of targetWords) {
            if (tl.includes(w)) score += 1;
          }
          return score;
        };

        const ranked = convs
          .map((c) => ({ c, score: scoreConv(c?.title) }))
          .sort((a, b) => b.score - a.score);

        const matched = ranked[0]?.score ? ranked[0].c : null;

        if (!matched) {
          appendBot(`Couldn't find a chat matching "${targetTitle}".`);
          showToast("Chat not found", 1800, "agent");
          return;
        }

        // Ask for confirmation in a multi-step way:
        // Next user message "delete" will finalize.
        setPendingAgentAction({
          conversationId: matched._id,
          title: matched.title,
        });

        appendBot(
          `Found chat "${matched.title}". Do you want to delete it? Reply "delete" to confirm, or "cancel" to abort.`
        );
        showToast("Confirmation required…", 1800, "agent");
      } catch (error) {
        console.error("Delete by title named error:", error);
        appendBot("Something went wrong while preparing the delete.");
        showToast("Failed to prepare delete", 2000, "agent");
      }

      return;
    }

    if (intent.type === "DELETE_CHAT_BY_TITLE") {
      const targetTitle = intent.targetTitle || "";
      const targetLower = targetTitle.toLowerCase().trim();

      if (!targetLower) {
        appendBot("Tell me the chat title you want to delete (example: delete \"My chat\" chat).");
        return;
      }

      try {
        const res = await axios.get("/api/conversations");
        const convs = res.data || [];

        const targetWords = targetLower.split(/\s+/).filter((w) => w.length > 2);

        const scoreConv = (title) => {
          const tl = (title || "").toLowerCase();
          let score = 0;
          if (!tl) return 0;
          if (tl.includes(targetLower)) score += 5;
          for (const w of targetWords) {
            if (tl.includes(w)) score += 1;
          }
          return score;
        };

        const ranked = convs
          .map((c) => ({ c, score: scoreConv(c?.title) }))
          .sort((a, b) => b.score - a.score);

        const matched = ranked[0]?.score ? ranked[0].c : null;

        if (!matched) {
          appendBot(`Couldn't find a chat matching "${targetTitle}".`);
          showToast("Chat not found", 1800, "agent");
          return;
        }

        const ok = window.confirm(`Delete the chat "${matched.title}"?`);
        if (!ok) {
          showToast("Action cancelled", 1400, "agent");
          return;
        }

        await axios.delete(`/api/conversation/${matched._id}`);
        await fetchConversations();

        if (conversationId === matched._id) {
          setConversationId(null);
          setChat([]);
        }

        showToast("✅ Chat deleted", 1600, "agent");
      } catch (error) {
        console.error("Delete by title error:", error);
        appendBot("Something went wrong while deleting that chat.");
        showToast("Failed to delete chat", 2000, "agent");
      }

      return;
    }

    setChat((prev) => [...prev, { sender: "user", text: textToSend }]);
    setLoading(true);

    // Agent action mode
    const isAgentAction = intent.type !== "AI_CHAT";
    showToast(
      isAgentAction ? "Analyzing intent…" : "Thinking…",
      1200,
      isAgentAction ? "agent" : "ai"
    );
    showToast(
      isAgentAction ? "Running action…" : "Generating response…",
      1600,
      isAgentAction ? "agent" : "ai"
    );

    try {
      if (intent.type === "LIST_CHATS") {
        const res = await axios.get("/api/conversations");
        const convs = res.data || [];

        if (!convs.length) {
          appendBot("No chats yet.");
        } else {
          const lines = convs.map((c) => `- ${c.title || "Untitled chat"}`);
          appendBot(`Here are your previous chats (most recent first):\n${lines.join("\n")}`);
        }
      } else if (intent.type === "CLEAR_ALL_CHATS") {
        const ok = window.confirm("Are you sure you want to clear ALL chats?");
        if (!ok) {
          showToast("Action cancelled", 1400, "agent");
        } else {
          await axios.delete("/api/conversations/clear-all");
          setConversations([]);
          setConversationId(null);
          setChat([]);
          showToast("✅ All chats cleared", 1600, "agent");
        }
      } else if (intent.type === "DELETE_LAST_CHAT") {
        const res = await axios.get("/api/conversations");
        const convs = res.data || [];

        if (!convs.length) {
          appendBot("No chats to delete.");
        } else {
          const last = convs[0];
          const ok = window.confirm(
            "Are you sure you want to delete the last (most recent) chat?"
          );
          if (!ok) {
            showToast("Action cancelled", 1400, "agent");
          } else {
            await axios.delete(`/api/conversation/${last._id}`);
            await fetchConversations();

            if (conversationId === last._id) {
              setConversationId(null);
              setChat([]);
            } else {
              appendBot("✅ Deleted the last chat.");
            }
            showToast("✅ Chat deleted", 1600, "agent");
          }
        }
      } else if (intent.type === "DELETE_CURRENT_CHAT") {
        if (!conversationId) {
          // If user says "this chat" but none is active, fall back to deleting most recent.
          const res = await axios.get("/api/conversations");
          const convs = res.data || [];
          if (!convs.length) {
            appendBot("No chats to delete.");
          } else {
            const last = convs[0];
            const ok = window.confirm(
              "No active chat found. Delete the last (most recent) chat instead?"
            );
            if (!ok) {
              showToast("Action cancelled", 1400, "agent");
            } else {
              await axios.delete(`/api/conversation/${last._id}`);
              await fetchConversations();
              setConversationId(null);
              setChat([]);
              showToast("✅ Chat deleted", 1600, "agent");
            }
          }
        } else {
          const ok = window.confirm("Are you sure you want to delete this chat?");
          if (!ok) {
            showToast("Action cancelled", 1400, "agent");
          } else {
            await axios.delete(`/api/conversation/${conversationId}`);
            await fetchConversations();
            setConversationId(null);
            setChat([]);
            showToast("✅ Chat deleted", 1600, "agent");
          }
        }
      } else if (intent.type === "DELETE_CHAT") {
        // Generic delete without "last" / "this" - delete current if selected, else delete most recent
        if (conversationId) {
          const ok = window.confirm("Are you sure you want to delete this chat?");
          if (!ok) {
            showToast("Action cancelled", 1400, "agent");
          } else {
            await axios.delete(`/api/conversation/${conversationId}`);
            await fetchConversations();
            setConversationId(null);
            setChat([]);
            showToast("✅ Chat deleted", 1600, "agent");
          }
        } else {
          // No active chat: delete most recent
          const res = await axios.get("/api/conversations");
          const convs = res.data || [];
          if (!convs.length) {
            appendBot("No chats to delete.");
          } else {
            const last = convs[0];
            const ok = window.confirm(
              "Are you sure you want to delete the last (most recent) chat?"
            );
            if (!ok) {
              showToast("Action cancelled", 1400, "agent");
            } else {
              await axios.delete(`/api/conversation/${last._id}`);
              await fetchConversations();
              setConversationId(null);
              setChat([]);
              showToast("✅ Chat deleted", 1600, "agent");
            }
          }
        }
      } else if (
        intent.type === "RENAME_CURRENT_CHAT" ||
        intent.type === "RENAME_LAST_CHAT"
      ) {
        const proposedTitle = extractRenameTitle(textToSend);

        let targetId = conversationId;
        if (!targetId || intent.type === "RENAME_LAST_CHAT") {
          const res = await axios.get("/api/conversations");
          const convs = res.data || [];
          if (!convs.length) {
            appendBot("No chats available to rename.");
            setLoading(false);
            return;
          }
          targetId = convs[0]._id; // most recent
        }

        const proposedLower = proposedTitle ? proposedTitle.toLowerCase().trim() : "";
        const shouldPrompt =
          !proposedTitle ||
          proposedLower === "chat" ||
          proposedLower === "conversation";

        const newTitle = shouldPrompt
          ? window.prompt("Enter a new chat title:", "Untitled chat")?.trim()
          : proposedTitle;

        if (!newTitle) {
          showToast("Rename cancelled", 1400, "agent");
        } else {
          await axios.put(`/api/conversation/${targetId}/title`, {
            title: newTitle,
          });

          setConversations((prev) =>
            prev.map((c) => (c._id === targetId ? { ...c, title: newTitle } : c))
          );

          appendBot(`✅ Renamed chat to "${newTitle}"`);
          showToast("✅ Chat renamed", 1800, "agent");
        }
      } else {
        // Normal AI chat
        const formatInstruction = getFormatInstruction(textToSend);
        const messageForAI = formatInstruction
          ? `${textToSend}\n\nResponse format: ${formatInstruction}`
          : textToSend;

        const res = await axios.post("/api/chat", {
          message: messageForAI,
          conversationId,
        });

        const botReply = res.data.reply;

        if (!conversationId) {
          const newConversationId = res.data.conversationId;
          setConversationId(newConversationId);
          setConversations((prev) => [
            { _id: newConversationId, title: textToSend.slice(0, 40) },
            ...prev,
          ]);
        }

        appendBot(botReply);
      }
    } catch (error) {
      console.error("API Error:", error);
      appendBot("Something went wrong. Please try again.");
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

  const handleConversationAttachment = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAttachment(true);

    try {
      const targetConversationId = await ensureConversationForAttachment(file.name);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("scope", "conversation");
      formData.append("conversationId", targetConversationId);

      const res = await axios.post("/api/documents/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      setConversationDocuments((prev) => [res.data.document, ...prev]);
      showToast("File attached to this chat", 1800, "agent");
      if (chatInputRef.current) chatInputRef.current.focus();
    } catch (error) {
      console.error("Chat attachment upload error:", error);
      showToast(
        error.response?.data?.error || "Failed to attach file",
        2200,
        "agent"
      );
    } finally {
      setUploadingAttachment(false);
      event.target.value = "";
    }
  };

  const handleConversationDocumentDelete = async (documentId) => {
    try {
      await axios.delete(`/api/documents/${documentId}`);
      setConversationDocuments((prev) =>
        prev.filter((document) => document._id !== documentId)
      );
      showToast("Attachment removed", 1600, "agent");
    } catch (error) {
      console.error("Failed to delete conversation document", error);
      showToast(
        error.response?.data?.error || "Failed to remove attachment",
        2000,
        "agent"
      );
    }
  };

  const handleKeyDown = (e) => {
    // Enter submits; Shift+Enter allows newline (if needed).
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
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
        const sender = msg.sender === 'user' ? 'You' : 'Actio AI';
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
        const sender = msg.sender === 'user' ? 'You:' : 'Actio AI:';
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
      const formatInstruction = getFormatInstruction(lastUserMessage.text);
      const messageForAI = formatInstruction
        ? `${lastUserMessage.text}\n\nResponse format: ${formatInstruction}`
        : lastUserMessage.text;

      const res = await axios.post("/api/chat", {
        message: messageForAI,
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
          onStartNewChat={() => {
            startNewConversation();
            setSidebarOpen(false);
          }}
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
          {toastText && (
            <div className={`agent-toast ${toastKind}`} role="status" aria-live="polite">
              {toastText}
            </div>
          )}
        <div className="top-bar">
          <div className="top-bar-spacer"></div>
          <h2 className="title">
            <span className="brand-name">Actio AI</span>
            <span className="brand-tagline">Act. Think. Execute.</span>
          </h2>
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

        <div
          ref={chatBoxRef}
          className={`chat-box ${chat.length === 0 ? "welcome-mode" : ""}`}
        >
          {chat.length === 0 && (
            <div className="welcome-layout">
              <div className="welcome-left">
                <div className="welcome-copy">
                  <h3>Start a conversation</h3>
                  <p>Try a quick prompt or use an action command.</p>
                </div>

                  <div className="agentic-welcome-tip">
                    <div className="agentic-welcome-title">🧠 Tip: Agentic commands</div>
                    <div className="agentic-welcome-text">
                      Besides AI answers, you can run actions like delete, rename, export, and settings.
                      Click <b>Help</b> for examples.
                    </div>
                    <div className="agentic-welcome-actions">
                      <button
                        type="button"
                        onClick={() => tryHelpCommand("delete this chat")}
                      >
                        🗑️ delete this chat
                      </button>
                      <button
                        type="button"
                        onClick={() => tryHelpCommand('rename this chat to "AI basics"')}
                      >
                        ✏️ rename this chat
                      </button>
                      <button
                        type="button"
                        onClick={() => tryHelpCommand("export this chat as pdf")}
                      >
                        📄 export as PDF
                      </button>
                    </div>
                  </div>

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
                <div className="welcome-hero welcome-hero-subtle">
                  <div className="welcome-hero-badge">🧠 Agentic AI</div>
                  <div className="welcome-hero-title">
                    Fast answers + smart actions
                  </div>
                  <div className="welcome-hero-sub">
                    Ask a question, manage chats, and export your work from the same screen.
                  </div>
                  <div className="welcome-hero-points">
                    <span>Context aware</span>
                    <span>Saved chats</span>
                    <span>One-click export</span>
                  </div>
                </div>

                <div className="feature">
                  ⚡ Instant Answers
                  <p>Technical explanations that are quick and easy to follow.</p>
                </div>

                <div className="feature">
                  📚 Learning Assistant
                  <p>Concept clarity for AI, ML, and programming basics.</p>
                </div>

                <div className="feature">
                  💬 Smart Conversations
                  <p>Context-aware replies so your chat stays coherent.</p>
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
            <div className="message bot typing-message" aria-live="polite">
              <div className="typing-indicator" aria-label="Bot is typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          <div ref={chatEndRef}></div>
        </div>

        <div className="composer-area">
          {(conversationDocuments.length > 0 || uploadingAttachment) && (
            <div className="conversation-documents">
              {conversationDocuments.map((document) => (
                <div key={document._id} className="conversation-document-chip">
                  <div className="conversation-document-meta">
                    <span className="conversation-document-name">{document.title}</span>
                    <span className="conversation-document-label">This chat only</span>
                  </div>
                  <button
                    type="button"
                    className="conversation-document-remove"
                    onClick={() => handleConversationDocumentDelete(document._id)}
                    title="Remove attachment"
                  >
                    ×
                  </button>
                </div>
              ))}
              {uploadingAttachment && (
                <div className="conversation-document-chip pending">
                  <div className="conversation-document-meta">
                    <span className="conversation-document-name">Uploading attachment...</span>
                    <span className="conversation-document-label">This chat only</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="input-area">
            <input
              ref={attachmentInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleConversationAttachment}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="attach-btn"
              onClick={() => attachmentInputRef.current?.click()}
              disabled={loading || uploadingAttachment}
              title="Attach file to this chat"
            >
              {uploadingAttachment ? "..." : "+"}
            </button>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask a question or attach a file for this chat"
              className="chat-input"
              rows={1}
              onKeyDown={handleKeyDown}
              ref={chatInputRef}
            />
            <button
              onClick={() => sendMessage()}
              className="send-btn"
              disabled={loading || uploadingAttachment}
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
        </>
        )}
      </div>

      <button
        className="help-fab"
        onClick={openHelp}
        title="Help & Agent Commands"
        type="button"
      >
        🧠 Help
      </button>

      {helpRendered && (
        <div
          className="help-overlay"
          onClick={closeHelp}
          role="presentation"
        >
          <div
            className={`help-modal ${helpOpen ? "open" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Help & Agent Commands"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="help-header">
              <div className="help-title">
                🧠 Help & Agent Guide
              </div>
              <button
                className="help-close"
                onClick={closeHelp}
                type="button"
                aria-label="Close help"
              >
                ✕
              </button>
            </div>

            <div className="help-body">
              <div className="help-intro">
                <div className="help-intro-title">Actio AI (Agentic Mode)</div>
                <div className="help-intro-text">
                  Type normal questions, or type agentic commands (like delete/rename/export/settings) and the app will run actions for you.
                </div>
                <div className="help-intro-text">
                  For best results, use the examples below and review what you typed before pressing <b>Send</b>.
                </div>
              </div>

              <div className="help-card">
                <h3>🚀 Quick Start</h3>
                <div className="help-command-grid">
                  <div className="help-command-item">
                    <button
                      className="help-chip"
                      type="button"
                      onClick={() => tryHelpCommand('delete this chat')}
                    >
                      🗑️ delete this chat
                    </button>
                    <div className="help-command-desc">Deletes your active chat</div>
                  </div>

                  <div className="help-command-item">
                    <button
                      className="help-chip"
                      type="button"
                      onClick={() =>
                        tryHelpCommand('rename this chat to "AI basics"')
                      }
                    >
                      ✏️ rename this chat
                    </button>
                    <div className="help-command-desc">Renames the current conversation</div>
                  </div>

                  <div className="help-command-item">
                    <button
                      className="help-chip"
                      type="button"
                      onClick={() => tryHelpCommand("export this chat as pdf")}
                    >
                      📄 export this chat
                    </button>
                    <div className="help-command-desc">Exports your chat as PDF</div>
                  </div>

                  <div className="help-command-item">
                    <button
                      className="help-chip"
                      type="button"
                      onClick={() => tryHelpCommand("open settings")}
                    >
                      ⚙️ open settings
                    </button>
                    <div className="help-command-desc">Takes you to Settings</div>
                  </div>
                </div>
              </div>

              <div className="help-card">
                <h3>🗑️ Chat Actions</h3>
                <div className="help-command-grid">
                  <div className="help-command-item">
                    <button
                      className="help-chip"
                      type="button"
                      onClick={() => tryHelpCommand("clear all chats")}
                    >
                      🧹 clear all chats
                    </button>
                    <div className="help-command-desc">Deletes all conversations</div>
                  </div>

                  <div className="help-command-item">
                    <button
                      className="help-chip"
                      type="button"
                      onClick={() =>
                        tryHelpCommand('delete "chatName" chat')
                      }
                    >
                      🗑️ delete by title
                    </button>
                    <div className="help-command-desc">Deletes the chat matching the title</div>
                  </div>

                  <div className="help-command-item">
                    <button
                      className="help-chip"
                      type="button"
                      onClick={() =>
                        tryHelpCommand('delete chat named as "chatName" then delete')
                      }
                    >
                      🧾 delete named as
                    </button>
                    <div className="help-command-desc">Finds chat, then waits for confirmation</div>
                  </div>

                  <div className="help-command-item">
                    <button
                      className="help-chip"
                      type="button"
                      onClick={() =>
                        tryHelpCommand('rename this chat to "New Title"')
                      }
                    >
                      ✏️ rename this chat
                    </button>
                    <div className="help-command-desc">Updates the sidebar title</div>
                  </div>
                </div>
              </div>

              <div className="help-card">
                <h3>⚙️ Navigation</h3>
                <div className="help-command-grid">
                  <div className="help-command-item">
                    <button
                      className="help-chip"
                      type="button"
                      onClick={() => tryHelpCommand("open settings")}
                    >
                      ⚙️ open settings
                    </button>
                    <div className="help-command-desc">Go to profile/security/data</div>
                  </div>

                  <div className="help-command-item">
                    <button
                      className="help-chip"
                      type="button"
                      onClick={() => tryHelpCommand("new chat")}
                    >
                      ➕ new chat
                    </button>
                    <div className="help-command-desc">Starts a fresh conversation</div>
                  </div>
                </div>
              </div>

              <div className="help-card">
                <h3>🔁 AI Actions</h3>
                <div className="help-command-grid">
                  <div className="help-command-item">
                    <button
                      className="help-chip"
                      type="button"
                      onClick={() => tryHelpCommand("try again")}
                    >
                      🔁 try again
                    </button>
                    <div className="help-command-desc">Regenerates the last response</div>
                  </div>

                  <div className="help-command-item">
                    <button
                      className="help-chip"
                      type="button"
                      onClick={() => tryHelpCommand("regenerate")}
                    >
                      🧠 regenerate
                    </button>
                    <div className="help-command-desc">Same as “try again”</div>
                  </div>

                  <div className="help-command-item">
                    <button
                      className="help-chip"
                      type="button"
                      onClick={() => tryHelpCommand("export this chat as txt")}
                    >
                      📄 export as text
                    </button>
                    <div className="help-command-desc">Downloads chat as a TXT file</div>
                  </div>
                </div>
              </div>

              <div className="help-card">
                <h3>🧠 How it works</h3>
                <div className="help-bullets">
                  <div>1) Detects intent</div>
                  <div>2) Runs the matching action</div>
                  <div>3) Or calls the AI normally</div>
                </div>
              </div>

              <div className="help-card help-card-danger">
                <h3>🗑️ Safety for destructive actions</h3>
                <div className="help-bullets">
                  <div>Clear/Delete actions ask for confirmation</div>
                  <div>For title-based deletes, it may ask you to confirm in the next message</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
