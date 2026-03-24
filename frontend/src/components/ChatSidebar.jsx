import axios from "axios";
import { FaTrash } from "react-icons/fa";

function ChatSidebar({
  conversations,
  loadConversation,
  setConversations,
  conversationId,
  setConversationId,
  setChat,
  user,
  onStartNewChat,
  onOpenSettings,
  onLogout
}) {

  const deleteConversation = async (e, id) => {

  e.stopPropagation();

  const confirmDelete = window.confirm(
    "Are you sure you want to delete this conversation?"
  );

  if (!confirmDelete) return;

  try {

    await axios.delete(`/api/conversation/${id}`);

    setConversations(prev =>
      prev.filter(conv => conv._id !== id)
    );

    // 👇 IMPORTANT FIX
    if (conversationId === id) {
      setConversationId(null);
      setChat([]);
    }

  } catch (error) {

    console.error("Failed to delete conversation", error);

  }

};

  return (
    <div className="sidebar">
    
    <div className="sidebar-top">
      <div className="user-profile">

            <div className="avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>

            <div className="user-info">
              <div className="user-name">
                {user?.name || "Loading..."}
              </div>

              <div className="user-email">
                {user?.email || ""}
              </div>
            </div>

            <button
              className="settings-btn"
              onClick={onOpenSettings}
              title="Settings"
              type="button"
            >
              ⚙️
            </button>

      </div>

      <button
        type="button"
        className="sidebar-new-chat-btn"
        onClick={onStartNewChat}
      >
        + New Chat
      </button>

      <h3>Previous Chats</h3>

      {conversations.length === 0 && (
        <p>No chats yet</p>
      )}

      {conversations.map(conv => (

        <div
          key={conv._id}
          className="chat-item"
          onClick={() => loadConversation(conv._id)}
        >

          <span className="chat-title">
            {conv.title}
          </span>

          <button
            className="delete-btn"
            onClick={(e) => deleteConversation(e, conv._id)}
          >
            <FaTrash />
          </button>

        </div>

      ))}

    </div>

    <div className="sidebar-bottom">
      <button
        className="logout-btn"
        onClick={onLogout}
      >
        Logout
      </button>
    </div>
    </div>

  );

}

export default ChatSidebar;
