import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  searchUsersApi,
  sendFriendRequestApi,
  respondFriendRequestApi,
  getFriendRequestsApi,
  getFriendsApi,
  getChatMessagesApi,
  sendChatMessageApi,
} from '../../services/api';

// Generate consistent gradient avatar colors from a string/username
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #a855f7)',
  'linear-gradient(135deg, #3b82f6, #06b6d4)',
  'linear-gradient(135deg, #ec4899, #f43f5e)',
  'linear-gradient(135deg, #10b981, #14b8a6)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #8b5cf6, #3b82f6)',
  'linear-gradient(135deg, #0ea5e9, #6366f1)',
];

function getAvatarGradient(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
}

function getInitials(name = '', username = '') {
  const target = (name || username || '?').trim();
  const parts = target.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return target.slice(0, 2).toUpperCase();
}

function formatMsgTime(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ChatPanel({ currentUser }) {
  // Current user info
  const myUsername = (currentUser?.username || currentUser?.email?.split('@')[0] || 'mk').toLowerCase();
  const myName = currentUser?.name || 'You';

  // Navigation state
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'friends' | 'search'
  const [activeFriend, setActiveFriend] = useState(null); // When non-null, active 1-on-1 chat view

  // Data states
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [messages, setMessages] = useState([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');

  // Chat input state
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // References
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    if (activeFriend) {
      scrollToBottom(false);
    }
  }, [activeFriend]);

  useEffect(() => {
    if (activeFriend && messages.length > 0) {
      scrollToBottom(true);
    }
  }, [messages.length, activeFriend]);

  // ─── Fetch Friends & Requests ─────────────────────────────────────────────
  const loadFriendsAndRequests = useCallback(async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        getFriendsApi(myUsername),
        getFriendRequestsApi(myUsername),
      ]);

      if (friendsRes && friendsRes.success) {
        setFriends(friendsRes.friends || []);
      }
      if (requestsRes && requestsRes.success) {
        setIncomingRequests(requestsRes.incoming || []);
        setOutgoingRequests(requestsRes.outgoing || []);
      }
    } catch (err) {
      console.warn('[Chat] Error loading friends/requests:', err);
    }
  }, [myUsername]);

  // Initial load + periodic polling for lists
  useEffect(() => {
    loadFriendsAndRequests();
    const interval = setInterval(() => {
      loadFriendsAndRequests();
    }, 4000);
    return () => clearInterval(interval);
  }, [loadFriendsAndRequests]);

  // ─── Fetch Messages for Active Friend ─────────────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!activeFriend) return;
    try {
      const res = await getChatMessagesApi(myUsername, activeFriend.username);
      if (res && res.success) {
        setMessages(res.messages || []);
      } else if (res?.notFriends) {
        // Friend status might have changed
        setActiveFriend(null);
      }
    } catch (err) {
      console.warn('[Chat] Error fetching messages:', err);
    }
  }, [myUsername, activeFriend]);

  useEffect(() => {
    if (!activeFriend) {
      setMessages([]);
      return;
    }
    loadMessages();
    const interval = setInterval(() => {
      loadMessages();
    }, 2500); // Poll every 2.5s for fast real-time chat feel
    return () => clearInterval(interval);
  }, [activeFriend, loadMessages]);

  // ─── User Search Handler ──────────────────────────────────────────────────
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!val.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchMessage('');
      return;
    }

    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await searchUsersApi(val.trim(), myUsername);
        setSearchLoading(false);
        if (res && res.success) {
          setSearchResults(res.users || []);
          if ((res.users || []).length === 0) {
            setSearchMessage(`No users found matching "${val.trim()}"`);
          } else {
            setSearchMessage('');
          }
        } else {
          setSearchResults([]);
          setSearchMessage(res?.message || 'Search failed');
        }
      } catch (err) {
        setSearchLoading(false);
        setSearchMessage('Could not connect to server');
      }
    }, 350);
  };

  // ─── Send Friend Request ──────────────────────────────────────────────────
  const handleSendRequest = async (targetUsername) => {
    setActionLoadingId(targetUsername);
    try {
      const res = await sendFriendRequestApi(myUsername, targetUsername);
      if (res && res.success) {
        // Update local search result status optimistically
        setSearchResults((prev) =>
          prev.map((u) =>
            u.username === targetUsername
              ? { ...u, relationship: res.status === 'accepted' ? 'friends' : 'outgoing_pending' }
              : u
          )
        );
        loadFriendsAndRequests();
      } else {
        alert(res?.message || 'Could not send friend request.');
      }
    } catch {
      alert('Error sending friend request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ─── Respond to Friend Request (Accept / Reject) ──────────────────────────
  const handleRespondRequest = async (requestId, action, senderUsername) => {
    setActionLoadingId(requestId || senderUsername);
    try {
      const res = await respondFriendRequestApi(requestId, action, senderUsername, myUsername);
      if (res && res.success) {
        // Remove from incoming requests optimistically
        setIncomingRequests((prev) => prev.filter((r) => r.requestId !== requestId && r.username !== senderUsername));
        // Update search list if open
        setSearchResults((prev) =>
          prev.map((u) =>
            u.username === senderUsername
              ? { ...u, relationship: action === 'accept' ? 'friends' : 'none' }
              : u
          )
        );
        await loadFriendsAndRequests();
      } else {
        alert(res?.message || 'Failed to update request');
      }
    } catch {
      alert('Error updating request');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ─── Send Chat Message ────────────────────────────────────────────────────
  const handleSendMessage = async (customText = null) => {
    const textToSend = (customText !== null ? customText : chatInput).trim();
    if (!textToSend || !activeFriend || sendingMsg) return;

    setSendingMsg(true);
    if (customText === null) {
      setChatInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }

    // Optimistic message append
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      sender: myUsername,
      receiver: activeFriend.username,
      text: textToSend,
      createdAt: new Date().toISOString(),
      optimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await sendChatMessageApi(myUsername, activeFriend.username, textToSend);
      if (res && res.success && res.message) {
        // Replace optimistic msg with confirmed backend record
        setMessages((prev) => prev.map((m) => (m._id === tempId ? res.message : m)));
        // Refresh friends list to update last message preview
        loadFriendsAndRequests();
      } else {
        // Rollback on failure
        setMessages((prev) => prev.filter((m) => m._id !== tempId));
        alert(res?.message || 'Could not send message.');
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      alert('Failed to send message.');
    } finally {
      setSendingMsg(false);
    }
  };

  // Open 1-on-1 Chat with a friend
  const startChatWithFriend = (friendObj) => {
    setActiveFriend(friendObj);
  };

  // Total incoming requests count for tab badge
  const pendingIncomingCount = incomingRequests.length;
  // Total unread messages count
  const totalUnreadCount = friends.reduce((acc, f) => acc + (f.unreadCount || 0), 0);

  return (
    <aside className="chat-panel-container">
      <style>{`
        .chat-panel-container {
          position: sticky;
          top: 24px;
          height: calc(100vh - 80px);
          min-height: 560px;
          background: #ffffff;
          border-radius: 24px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 10px 32px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04);
          border: 1px solid #e2e8f0;
          font-family: inherit;
          box-sizing: border-box;
          transition: all 0.3s ease;
        }

        /* Top Header */
        .cp-header {
          padding: 14px 18px;
          background: #ffffff;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          gap: 12px;
        }

        .cp-title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cp-app-badge {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
          flex-shrink: 0;
        }

        .cp-title-text h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.2;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .cp-online-pulse {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          display: inline-block;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
          animation: pulse-dot 2s infinite;
        }

        @keyframes pulse-dot {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        .cp-title-text span {
          font-size: 11.5px;
          color: #64748b;
          font-weight: 500;
        }

        .cp-user-tag {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 8px;
          background: #f1f5f9;
          color: #475569;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        /* Active Chat Header */
        .cp-active-chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .cp-back-btn {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #334155;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .cp-back-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
          transform: translateX(-2px);
        }

        .cp-chat-partner-info {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          margin-left: 10px;
          overflow: hidden;
        }

        .cp-chat-partner-name {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }

        .cp-chat-partner-sub {
          font-size: 11px;
          color: #10b981;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Segmented Nav Tabs */
        .cp-nav-tabs {
          display: flex;
          padding: 8px 12px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          gap: 6px;
          flex-shrink: 0;
        }

        .cp-tab-btn {
          flex: 1;
          padding: 8px 6px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        .cp-tab-btn:hover {
          color: #1e293b;
          background: rgba(226, 232, 240, 0.6);
        }

        .cp-tab-btn.active {
          background: #ffffff;
          color: #4f46e5;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          font-weight: 700;
        }

        .cp-badge-pill {
          padding: 1px 6px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 700;
          background: #ef4444;
          color: #ffffff;
          line-height: 1.3;
          animation: badge-pop 0.3s ease;
        }

        .cp-badge-pill.indigo {
          background: #6366f1;
        }

        @keyframes badge-pop {
          from { transform: scale(0.6); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        /* Panel Main Body */
        .cp-body {
          flex: 1;
          overflow-y: auto;
          background: #fafbfc;
          display: flex;
          flex-direction: column;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }

        .cp-body::-webkit-scrollbar {
          width: 5px;
        }
        .cp-body::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 6px;
        }

        /* ─── CHATS & FRIENDS LIST ─── */
        .cp-list {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .cp-item-card {
          padding: 10px 12px;
          border-radius: 14px;
          background: #ffffff;
          border: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          position: relative;
        }

        .cp-item-card:hover {
          transform: translateY(-1px) translateX(2px);
          border-color: #cbd5e1;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
        }

        .cp-avatar {
          width: 40px;
          height: 40px;
          border-radius: 13px;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.5px;
          flex-shrink: 0;
          position: relative;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
        }

        .cp-avatar-status {
          position: absolute;
          bottom: -1px;
          right: -1px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #10b981;
          border: 2px solid #ffffff;
        }

        .cp-item-info {
          flex: 1;
          min-width: 0;
        }

        .cp-item-top {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 2px;
        }

        .cp-item-name {
          font-size: 13.5px;
          font-weight: 700;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cp-item-time {
          font-size: 10.5px;
          color: #94a3b8;
          font-weight: 500;
          flex-shrink: 0;
        }

        .cp-item-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .cp-item-preview {
          font-size: 12px;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 180px;
        }

        .cp-item-unread-badge {
          background: #4f46e5;
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
          min-width: 18px;
          height: 18px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 5px;
          box-shadow: 0 2px 5px rgba(79, 70, 229, 0.4);
        }

        /* ─── ADD & SEARCH TAB ─── */
        .cp-search-area {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .cp-search-input-box {
          position: relative;
          display: flex;
          align-items: center;
        }

        .cp-search-input {
          width: 100%;
          padding: 10px 36px 10px 36px;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          font-size: 13px;
          color: #0f172a;
          outline: none;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .cp-search-input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }

        .cp-search-icon {
          position: absolute;
          left: 12px;
          color: #94a3b8;
          pointer-events: none;
        }

        .cp-search-clear {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          border: none !important;
          background: transparent !important;
          background-color: transparent !important;
          color: #64748b !important;
          cursor: pointer;
          font-size: 13px;
          line-height: 1;
          padding: 0;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.15s ease;
          box-shadow: none !important;
          outline: none;
        }

        .cp-search-clear:hover {
          color: #0f172a !important;
          background: rgba(0, 0, 0, 0.06) !important;
          background-color: rgba(0, 0, 0, 0.06) !important;
        }

        .cp-section-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #64748b;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* Request Cards */
        .cp-request-card {
          padding: 12px;
          border-radius: 14px;
          background: #ffffff;
          border: 1px solid #e0e7ff;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.05);
          display: flex;
          align-items: center;
          gap: 10px;
          animation: fade-slide 0.25s ease;
          margin-bottom: 8px;
        }

        @keyframes fade-slide {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .cp-action-btn-row {
          display: flex;
          gap: 6px;
          margin-left: auto;
        }

        .cp-btn-accept {
          background: #000000 !important;
          background-color: #000000 !important;
          color: #ffffff !important;
          border: none !important;
          padding: 5px 11px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: all 0.15s ease;
          box-shadow: none !important;
          height: 28px;
          line-height: 1;
        }

        .cp-btn-accept:hover {
          background: #27272a !important;
          background-color: #27272a !important;
          transform: translateY(-1px);
        }

        .cp-btn-decline {
          background: #f1f5f9;
          color: #64748b;
          border: 1px solid #e2e8f0;
          padding: 5px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 28px;
        }

        .cp-btn-decline:hover {
          background: #fee2e2;
          color: #ef4444;
          border-color: #fca5a5;
        }

        .cp-btn-add {
          background: #000000 !important;
          background-color: #000000 !important;
          color: #ffffff !important;
          border: none !important;
          padding: 3px 8px;
          border-radius: 5px;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          transition: all 0.15s ease;
          box-shadow: none !important;
          white-space: nowrap;
          flex-shrink: 0;
          height: 24px;
          line-height: 1;
          letter-spacing: 0.2px;
        }

        .cp-btn-add:hover {
          background: #27272a !important;
          background-color: #27272a !important;
          transform: translateY(-1px);
        }

        .cp-btn-add:disabled {
          background: #71717a !important;
          background-color: #71717a !important;
          cursor: not-allowed;
          transform: none;
        }

        .cp-btn-chat {
          background: #000000 !important;
          background-color: #000000 !important;
          color: #ffffff !important;
          border: none;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          box-shadow: none !important;
          white-space: nowrap;
          flex-shrink: 0;
          height: 26px;
        }

        .cp-btn-chat:hover {
          background: #27272a !important;
          background-color: #27272a !important;
          transform: translateY(-1px);
        }

        .cp-pill-pending {
          background: #fef3c7;
          color: #d97706;
          border: 1px solid #fde68a;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .cp-pill-friends {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          cursor: pointer;
        }

        /* ─── ACTIVE CHAT CONVERSATION VIEW ─── */
        .cp-messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 16px 14px 10px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #f8fafc;
        }

        .cp-msg-row {
          display: flex;
          gap: 8px;
          animation: msg-bubble-pop 0.22s ease-out both;
        }

        @keyframes msg-bubble-pop {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .cp-msg-row.me {
          flex-direction: row-reverse;
        }

        .cp-msg-bubble {
          max-width: 80%;
          padding: 10px 14px;
          border-radius: 18px;
          font-size: 13.5px;
          line-height: 1.5;
          word-break: break-word;
          position: relative;
        }

        .cp-msg-row.me .cp-msg-bubble {
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
          color: #ffffff;
          border-bottom-right-radius: 4px;
          box-shadow: 0 2px 8px rgba(79, 70, 229, 0.2);
        }

        .cp-msg-row.other .cp-msg-bubble {
          background: #ffffff;
          color: #1e293b;
          border: 1px solid #e2e8f0;
          border-bottom-left-radius: 4px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .cp-msg-time {
          font-size: 10px;
          margin-top: 3px;
          display: block;
          opacity: 0.75;
          text-align: right;
        }

        .cp-msg-row.other .cp-msg-time {
          color: #94a3b8;
          text-align: left;
        }

        /* Empty States */
        .cp-empty-state {
          padding: 36px 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #64748b;
          margin: auto;
        }

        .cp-empty-icon {
          width: 56px;
          height: 56px;
          border-radius: 18px;
          background: #eef2ff;
          color: #6366f1;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
        }

        .cp-empty-state h4 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #1e293b;
        }

        .cp-empty-state p {
          margin: 0;
          font-size: 12.5px;
          line-height: 1.45;
          max-width: 240px;
        }

        .cp-empty-btn {
          margin-top: 8px;
          background: #000000 !important;
          background-color: #000000 !important;
          color: #ffffff !important;
          border: none !important;
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 10.5px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          transition: all 0.15s ease;
          box-shadow: none !important;
          text-decoration: none;
          white-space: nowrap !important;
          height: 26px;
          line-height: 1;
          letter-spacing: 0.2px;
        }

        .cp-empty-btn:hover {
          background: #27272a !important;
          background-color: #27272a !important;
          transform: translateY(-1px);
        }

        /* Icebreakers */
        .cp-icebreakers {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: center;
          margin-top: 8px;
        }

        .cp-icebreaker-pill {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #475569;
          font-size: 11.5px;
          font-weight: 600;
          padding: 6px 10px;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.18s ease;
        }

        .cp-icebreaker-pill:hover {
          background: #e0e7ff;
          color: #4338ca;
          border-color: #a5b4fc;
          transform: translateY(-1px);
        }

        /* ─── CHAT INPUT AREA ─── */
        .cp-input-area {
          padding: 12px 14px 14px;
          border-top: 1px solid #f1f5f9;
          background: #ffffff;
          flex-shrink: 0;
        }

        .cp-input-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          background: #f8fafc;
          border-radius: 14px;
          padding: 8px 10px 8px 14px;
          border: 1px solid #e2e8f0;
          transition: all 0.2s ease;
        }

        .cp-input-row:focus-within {
          border-color: #6366f1;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
        }

        .cp-textarea {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 13.5px;
          font-family: inherit;
          color: #0f172a;
          resize: none;
          outline: none;
          max-height: 100px;
          line-height: 1.45;
          box-sizing: border-box;
          padding: 3px 0;
        }

        .cp-send-btn {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, #4f46e5, #6366f1);
          border: none;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s ease;
          box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3);
        }

        .cp-send-btn:hover:not(:disabled) {
          transform: scale(1.08);
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.45);
        }

        .cp-send-btn:disabled {
          background: #cbd5e1;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .cp-input-hint {
          margin: 6px 0 0;
          font-size: 10.5px;
          color: #94a3b8;
          text-align: center;
        }
      `}</style>

      {/* ─── HEADER ─── */}
      <div className="cp-header">
        {activeFriend ? (
          <div className="cp-active-chat-header">
            <button
              type="button"
              className="cp-back-btn"
              onClick={() => setActiveFriend(null)}
              title="Back to friends"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>

            <div className="cp-chat-partner-info">
              <div
                className="cp-avatar"
                style={{ width: 34, height: 34, fontSize: 12, background: getAvatarGradient(activeFriend.username) }}
              >
                {getInitials(activeFriend.name, activeFriend.username)}
                <span className="cp-avatar-status" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="cp-chat-partner-name">{activeFriend.name || activeFriend.username}</div>
                <div className="cp-chat-partner-sub">
                  <span className="cp-online-pulse" /> @{activeFriend.username}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="cp-back-btn"
              onClick={loadMessages}
              title="Refresh messages"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <div className="cp-title-wrap">
              <div className="cp-app-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="cp-title-text">
                <h3>
                  MK Chat <span className="cp-online-pulse" />
                </h3>
                <span>Connect & collaborate</span>
              </div>
            </div>
            <div className="cp-user-tag" title={`Logged in as @${myUsername}`}>
              @{myUsername}
            </div>
          </>
        )}
      </div>

      {/* ─── NAVIGATION TABS (When not in active chat) ─── */}
      {!activeFriend && (
        <div className="cp-nav-tabs">
          <button
            type="button"
            className={`cp-tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveTab('chats')}
          >
            <span>Chats</span>
            {totalUnreadCount > 0 && <span className="cp-badge-pill">{totalUnreadCount}</span>}
          </button>
          <button
            type="button"
            className={`cp-tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            <span>Friends</span>
            {friends.length > 0 && (
              <span className="cp-badge-pill indigo">{friends.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`cp-tab-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <span>Add</span>
            {pendingIncomingCount > 0 && (
              <span className="cp-badge-pill">{pendingIncomingCount}</span>
            )}
          </button>
        </div>
      )}

      {/* ─── BODY CONTENT ─── */}
      <div className="cp-body">
        {activeFriend ? (
          /* ================= ACTIVE 1-ON-1 CHAT ================= */
          <>
            <div className="cp-messages-container">
              {messages.length === 0 ? (
                <div className="cp-empty-state">
                  <div
                    className="cp-empty-icon"
                    style={{ background: getAvatarGradient(activeFriend.username), color: '#ffffff' }}
                  >
                    {getInitials(activeFriend.name, activeFriend.username)}
                  </div>
                  <h4>Say Hello to {activeFriend.name || activeFriend.username}!</h4>
                  <p>You and @{activeFriend.username} are connected. Start your conversation below!</p>
                  <div className="cp-icebreakers">
                    <button
                      type="button"
                      className="cp-icebreaker-pill"
                      onClick={() => handleSendMessage('Hey there! 👋')}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                      </svg>
                      Say Hello
                    </button>
                    <button
                      type="button"
                      className="cp-icebreaker-pill"
                      onClick={() => handleSendMessage('Check out my latest todo notes 📝')}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      Check out notes
                    </button>
                    <button
                      type="button"
                      className="cp-icebreaker-pill"
                      onClick={() => handleSendMessage('Let’s collaborate on tasks today! 🚀')}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      Collaborate
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = (m.sender || '').toLowerCase() === myUsername;
                  return (
                    <div key={m._id} className={`cp-msg-row ${isMe ? 'me' : 'other'}`}>
                      {!isMe && (
                        <div
                          className="cp-avatar"
                          style={{
                            width: 28,
                            height: 28,
                            fontSize: 10,
                            background: getAvatarGradient(m.sender),
                          }}
                        >
                          {getInitials(activeFriend.name, activeFriend.username)}
                        </div>
                      )}
                      <div className="cp-msg-bubble">
                        <div>{m.text}</div>
                        <span className="cp-msg-time">
                          {formatMsgTime(m.createdAt)} {isMe && '✓✓'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Row */}
            <div className="cp-input-area">
              <div className="cp-input-row">
                <textarea
                  ref={textareaRef}
                  className="cp-textarea"
                  placeholder={`Message @${activeFriend.username}...`}
                  rows={1}
                  value={chatInput}
                  onChange={(e) => {
                    setChatInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  type="button"
                  className="cp-send-btn"
                  onClick={() => handleSendMessage()}
                  disabled={sendingMsg || !chatInput.trim()}
                  title="Send message"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <p className="cp-input-hint">Press Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        ) : activeTab === 'chats' ? (
          /* ================= CHATS TAB ================= */
          <div className="cp-list">
            {friends.length === 0 ? (
              <div className="cp-empty-state">
                <div className="cp-empty-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h4>No Conversations Yet</h4>
                <p>Search for friends by their username and send a request to start chatting!</p>
                <button
                  type="button"
                  className="cp-empty-btn"
                  style={{
                    background: '#000000',
                    backgroundColor: '#000000',
                    color: '#ffffff',
                    fontSize: '10.5px',
                    whiteSpace: 'nowrap',
                    height: '26px',
                    padding: '4px 12px',
                  }}
                  onClick={() => setActiveTab('search')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>Find Friends</span>
                </button>
              </div>
            ) : (
              friends.map((f) => (
                <div
                  key={f.username}
                  className="cp-item-card"
                  onClick={() => startChatWithFriend(f)}
                >
                  <div
                    className="cp-avatar"
                    style={{ background: getAvatarGradient(f.username) }}
                  >
                    {getInitials(f.name, f.username)}
                    <span className="cp-avatar-status" />
                  </div>
                  <div className="cp-item-info">
                    <div className="cp-item-top">
                      <span className="cp-item-name">{f.name || f.username}</span>
                      <span className="cp-item-time">
                        {formatMsgTime(f.lastMessage?.createdAt || f.friendsSince)}
                      </span>
                    </div>
                    <div className="cp-item-bottom">
                      <span className="cp-item-preview">
                        {f.lastMessage?.text || `@${f.username} · Tap to chat`}
                      </span>
                      {f.unreadCount > 0 && (
                        <span className="cp-item-unread-badge">{f.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'friends' ? (
          /* ================= FRIENDS TAB ================= */
          <div className="cp-list">
            {friends.length === 0 ? (
              <div className="cp-empty-state">
                <div className="cp-empty-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <h4>No Friends Added Yet</h4>
                <p>Add your friends by username to collaborate and send real-time messages!</p>
                <button
                  type="button"
                  className="cp-empty-btn"
                  style={{
                    background: '#000000',
                    backgroundColor: '#000000',
                    color: '#ffffff',
                    fontSize: '10.5px',
                    whiteSpace: 'nowrap',
                    height: '26px',
                    padding: '4px 12px',
                  }}
                  onClick={() => setActiveTab('search')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>Search Friends</span>
                </button>
              </div>
            ) : (
              friends.map((f) => (
                <div
                  key={f.username}
                  className="cp-item-card"
                  onClick={() => startChatWithFriend(f)}
                >
                  <div
                    className="cp-avatar"
                    style={{ background: getAvatarGradient(f.username) }}
                  >
                    {getInitials(f.name, f.username)}
                    <span className="cp-avatar-status" />
                  </div>
                  <div className="cp-item-info">
                    <div className="cp-item-name">{f.name || f.username}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>@{f.username}</div>
                  </div>
                  <button
                    type="button"
                    className="cp-btn-chat"
                    style={{ background: '#000000', backgroundColor: '#000000', color: '#ffffff' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      startChatWithFriend(f);
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>Chat</span>
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          /* ================= SEARCH & ADD TAB ================= */
          <div className="cp-search-area">
            {/* Search Input */}
            <div className="cp-search-input-box">
              <svg className="cp-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="cp-search-input"
                placeholder="Search username (e.g. alex, mk)..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="cp-search-clear"
                  style={{
                    background: 'transparent',
                    backgroundColor: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                  }}
                  onClick={() => handleSearchChange('')}
                  title="Clear search"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Incoming Requests Section (Highlighted) */}
            {incomingRequests.length > 0 && (
              <div>
                <div className="cp-section-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    Friend Requests ({incomingRequests.length})
                  </span>
                </div>
                {incomingRequests.map((req) => (
                  <div key={req.requestId} className="cp-request-card">
                    <div
                      className="cp-avatar"
                      style={{ width: 36, height: 36, fontSize: 12, background: getAvatarGradient(req.username) }}
                    >
                      {getInitials(req.name, req.username)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cp-item-name" style={{ fontSize: 13 }}>{req.name || req.username}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>@{req.username}</div>
                    </div>
                    <div className="cp-action-btn-row">
                      <button
                        type="button"
                        className="cp-btn-accept"
                        style={{ background: '#000000', backgroundColor: '#000000', color: '#ffffff' }}
                        disabled={actionLoadingId === req.requestId}
                        onClick={() => handleRespondRequest(req.requestId, 'accept', req.username)}
                        title="Accept friend request"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Accept</span>
                      </button>
                      <button
                        type="button"
                        className="cp-btn-decline"
                        disabled={actionLoadingId === req.requestId}
                        onClick={() => handleRespondRequest(req.requestId, 'reject', req.username)}
                        title="Decline friend request"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Outgoing Requests Section */}
            {outgoingRequests.length > 0 && (
              <div>
                <div className="cp-section-title">
                  <span>⏳ Sent Requests ({outgoingRequests.length})</span>
                </div>
                {outgoingRequests.map((req) => (
                  <div key={req.requestId} className="cp-request-card">
                    <div
                      className="cp-avatar"
                      style={{ width: 34, height: 34, fontSize: 11, background: getAvatarGradient(req.username) }}
                    >
                      {getInitials(req.name, req.username)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cp-item-name" style={{ fontSize: 12.5 }}>{req.name || req.username}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>@{req.username}</div>
                    </div>
                    <span className="cp-pill-pending">Awaiting...</span>
                  </div>
                ))}
              </div>
            )}

            {/* Search Results */}
            <div>
              <div className="cp-section-title">
                <span>{searchQuery.trim() ? `Search Results` : `Quick Suggestion`}</span>
                {searchLoading && <span style={{ fontSize: 11, color: '#6366f1' }}>Searching...</span>}
              </div>

              {searchMessage && (
                <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>
                  {searchMessage}
                </div>
              )}

              {searchResults.length === 0 && !searchLoading && !searchMessage && (
                <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 10px', lineHeight: 1.5 }}>
                  💡 Type any username above to find other users on MK Todo and send a friend request!
                </div>
              )}

              {searchResults.map((u) => {
                const isLoading = actionLoadingId === u.username;
                return (
                  <div key={u.username} className="cp-request-card">
                    <div
                      className="cp-avatar"
                      style={{ width: 36, height: 36, fontSize: 12, background: getAvatarGradient(u.username) }}
                    >
                      {getInitials(u.name, u.username)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cp-item-name" style={{ fontSize: 13 }}>{u.name || u.username}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>@{u.username}</div>
                    </div>

                    <div>
                      {u.relationship === 'friends' ? (
                        <button
                          type="button"
                          className="cp-pill-friends"
                          onClick={() => {
                            startChatWithFriend(u);
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          <span>Friends</span>
                        </button>
                      ) : u.relationship === 'outgoing_pending' ? (
                        <span className="cp-pill-pending">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span>Sent</span>
                        </span>
                      ) : u.relationship === 'incoming_pending' ? (
                        <button
                          type="button"
                          className="cp-btn-accept"
                          style={{ background: '#000000', backgroundColor: '#000000', color: '#ffffff' }}
                          onClick={() => handleRespondRequest(u.requestId, 'accept', u.username)}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Accept</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="cp-btn-add"
                          style={{
                            background: '#000000',
                            backgroundColor: '#000000',
                            color: '#ffffff',
                            fontSize: '10px',
                            height: '24px',
                            padding: '3px 8px',
                          }}
                          disabled={isLoading}
                          onClick={() => handleSendRequest(u.username)}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          <span>{isLoading ? 'Sending...' : 'Add Friend'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
