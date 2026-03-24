import { useState, useEffect } from "react";
import axios from "axios";

function Settings({ onBack, onLogout, onUserUpdated, onChatsCleared }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [documents, setDocuments] = useState([]);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);

  useEffect(() => {
    fetchUserDetails();
    fetchDocuments();
  }, []);

  const fetchUserDetails = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        onLogout?.();
        return;
      }

      const res = await axios.get("/api/auth/me");
      setUser(res.data);
      setName(res.data.name);
      setEmail(res.data.email);
    } catch (error) {
      console.error("Failed to fetch user details:", error);
      if (error.response?.status === 401) {
        onLogout?.();
      }
    }
  };

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(""), 3000);
  };

  const fetchDocuments = async () => {
    try {
      setDocumentLoading(true);
      const res = await axios.get("/api/documents", {
        params: { scope: "global" }
      });
      setDocuments(res.data || []);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    }
    setDocumentLoading(false);
  };

  const updateProfile = async () => {
    if (!name.trim()) {
      showMessage("Name cannot be empty", "error");
      return;
    }
    if (!email.trim()) {
      showMessage("Email cannot be empty", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.put("/api/auth/update-profile", {
        name: name.trim(),
        email: email.trim()
      });
      
      setUser(res.data.user);
      onUserUpdated?.(res.data.user);
      showMessage("Profile updated successfully", "success");
    } catch (error) {
      console.error("Failed to update profile:", error);
      showMessage(error.response?.data?.message || "Failed to update profile", "error");
    }
    setLoading(false);
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage("Please fill all password fields", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage("New passwords do not match", "error");
      return;
    }

    if (newPassword.length < 6) {
      showMessage("Password must be at least 6 characters", "error");
      return;
    }

    setLoading(true);
    try {
      await axios.put("/api/auth/change-password", {
        currentPassword,
        newPassword
      });
      
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showMessage("✅ Password changed successfully", "success");
    } catch (error) {
      console.error("Failed to change password:", error);
      showMessage(error.response?.data?.message || "Failed to change password", "error");
    }
    setLoading(false);
  };

  const clearAllChats = async () => {
    if (!window.confirm("⚠️ This will delete ALL your conversations and messages. Are you sure?")) {
      return;
    }

    setLoading(true);
    try {
      await axios.delete("/api/conversations/clear-all");
      onChatsCleared?.();
      showMessage("✅ All chats cleared successfully", "success");
    } catch (error) {
      console.error("Failed to clear chats:", error);
      showMessage("Failed to clear chats", "error");
    }
    setLoading(false);
  };

  const handleDocumentUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploadingDocument(true);
    try {
      await axios.post("/api/documents/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      showMessage("Document uploaded successfully", "success");
      await fetchDocuments();
    } catch (error) {
      console.error("Failed to upload document:", error);
      showMessage(
        error.response?.data?.error ||
          error.message ||
          "Failed to upload document",
        "error"
      );
    }
    setUploadingDocument(false);
    event.target.value = "";
  };

  const handleDocumentDelete = async (documentId) => {
    const confirmed = window.confirm("Delete this document from your knowledge base?");
    if (!confirmed) return;

    try {
      await axios.delete(`/api/documents/${documentId}`);
      showMessage("Document deleted successfully", "success");
      await fetchDocuments();
    } catch (error) {
      console.error("Failed to delete document:", error);
      showMessage(error.response?.data?.error || "Failed to delete document", "error");
    }
  };

  const deleteAccount = async () => {
    const firstConfirm = window.confirm(
      "⚠️ WARNING: This will permanently delete your account and all your conversations. This action cannot be undone.\n\nAre you sure?"
    );

    if (!firstConfirm) return;

    const finalConfirm = window.confirm(
      "🗑️ This is your last chance! All your data will be lost forever.\n\nAre you absolutely sure?"
    );

    if (!finalConfirm) return;

    setLoading(true);
    try {
      await axios.delete("/api/auth/delete");
      onLogout?.();
    } catch (error) {
      console.error("Failed to delete account:", error);
      showMessage("Failed to delete account", "error");
      setLoading(false);
    }
  };

  const goBack = () => onBack?.();

  if (!user) {
    return (
      <div className="settings-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <button className="back-btn" onClick={goBack}>
          ← Back
        </button>
        <h1>Settings</h1>
      </div>

      {message && (
        <div className={`message ${messageType}`}>
          {message}
        </div>
      )}

      <div className="settings-content">
        {/* Profile Section */}
        <div className="settings-section">
          <h2>👤 Profile</h2>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>
          <button 
            className="btn btn-primary"
            onClick={updateProfile}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {/* Security Section */}
        <div className="settings-section">
          <h2>🔒 Security</h2>
          <div className="form-group">
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
          <button 
            className="btn btn-secondary"
            onClick={changePassword}
            disabled={loading}
          >
            {loading ? "Updating..." : "Change Password"}
          </button>
        </div>

        <div className="settings-section">
          <h2>Knowledge Base</h2>
          <p className="section-description">
            Upload PDF, TXT, or Markdown files so the assistant can use them as extra context during chat.
          </p>

          <label className="btn btn-primary upload-btn">
            {uploadingDocument ? "Uploading..." : "Upload Document"}
            <input
              type="file"
              accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
              onChange={handleDocumentUpload}
              disabled={uploadingDocument}
              hidden
            />
          </label>

          <div className="document-list">
            {documentLoading ? (
              <div className="document-empty">Loading documents...</div>
            ) : documents.length === 0 ? (
              <div className="document-empty">No documents uploaded yet.</div>
            ) : (
              documents.map((doc) => (
                <div key={doc._id} className="document-item">
                  <div className="document-meta">
                    <div className="document-title">{doc.title}</div>
                    <div className="document-subtitle">
                      {doc.mimeType} | {doc.chunkCount || 0} chunks | {doc.status}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary document-delete-btn"
                    onClick={() => handleDocumentDelete(doc._id)}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Data Section */}
        <div className="settings-section">
          <h2>📊 Data Management</h2>
          <p className="section-description">
            Manage your chat data and conversations
          </p>
          <button 
            className="btn btn-warning"
            onClick={clearAllChats}
            disabled={loading}
          >
            {loading ? "Clearing..." : "🗑️ Clear All Chats"}
          </button>
        </div>

        {/* Danger Zone */}
        <div className="settings-section danger-zone">
          <h2>⚠️ Danger Zone</h2>
          <p className="danger-description">
            Irreversible actions that will permanently delete your data
          </p>
          <button 
            className="btn btn-danger"
            onClick={deleteAccount}
            disabled={loading}
          >
            {loading ? "Deleting..." : "🗑️ Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
