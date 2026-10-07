import React, { useState, useEffect } from 'react';
import {
  fetchFolders,
  createFolderApi,
  deleteFolderApi,
  fetchNotes,
  createNoteApi,
  updateNoteApi,
  deleteNoteApi,
} from '../../services/api';

// Helper to get logged-in user name from session
function getSessionUserName() {
  try {
    const raw = localStorage.getItem('mk_session_user');
    if (raw) {
      const u = JSON.parse(raw);
      return u?.name || 'My';
    }
  } catch (_) {}
  return 'My';
}

// Folded document icon matching the reference screenshot
const DocumentFoldedIcon = ({ color = '#8a89f6', flapColor = '#7271e8', size = 36 }) => (
  <svg
    width={size}
    height={Math.round(size * 1.15)}
    viewBox="0 0 34 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'block' }}
  >
    <path
      d="M6 0C2.68629 0 0 2.68629 0 6V34C0 37.3137 2.68629 40 6 40H28C31.3137 40 34 37.3137 34 34V13.5L20.5 0H6Z"
      fill={color}
    />
    <path
      d="M20.5 0V8.5C20.5 11.2614 22.7386 13.5 25.5 13.5H34L20.5 0Z"
      fill={flapColor}
    />
  </svg>
);

// Pencil squircle badge matching the reference design
const PencilBadge = ({ size = 26, isDashed = false, onClick, title, isActive = false }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '7px',
      backgroundColor: isActive ? '#2563eb' : '#18181b',
      border: 'none',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      cursor: onClick ? 'pointer' : 'default',
      boxShadow: isDashed
        ? '0 2px 5px rgba(0,0,0,0.1)'
        : (isActive ? '0 0 0 2px #ffffff, 0 0 0 4px #2563eb' : 'none'),
      transition: 'transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
    }}
    onMouseEnter={(e) => {
      if (onClick) e.currentTarget.style.transform = 'scale(1.1)';
    }}
    onMouseLeave={(e) => {
      if (onClick) e.currentTarget.style.transform = 'scale(1)';
    }}
  >
    <svg
      width={Math.round(size * 0.55)}
      height={Math.round(size * 0.55)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  </button>
);

// Outline clock icon
const ClockIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// Three dots options icon
const MoreDotsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="2.2" />
    <circle cx="12" cy="12" r="2.2" />
    <circle cx="19" cy="12" r="2.2" />
  </svg>
);

const ThreeDotsIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

export default function Home({ onNavigateToCalendar, onLogout, onOpenFolder }) {

  // Folders state fetched from DB
  const [folders, setFolders] = useState([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);

  // Notes state fetched from DB
  const [notes, setNotes] = useState([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);

  // Modal States
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#e9f2fe');

  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  // Auto-fill time with current time + day name
  const [newNoteTime, setNewNoteTime] = useState(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dayStr = now.toLocaleDateString('en-US', { weekday: 'long' });
    return `${timeStr}, ${dayStr}`;
  });
  const [newNoteColor, setNewNoteColor] = useState('#ece57a');

  // Selected note for detail view / editing
  const [activeNote, setActiveNote] = useState(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editNoteTitle, setEditNoteTitle] = useState('');
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editNoteTime, setEditNoteTime] = useState('');
  const [editNoteColor, setEditNoteColor] = useState('#ece57a');

  // Folder options menu
  const [activeFolderMenu, setActiveFolderMenu] = useState(null);

  // Note options menu (3 dots) and move modal
  const [activeNoteMenu, setActiveNoteMenu] = useState(null);
  const [noteToMove, setNoteToMove] = useState(null);
  const [selectedTargetFolderId, setSelectedTargetFolderId] = useState('');

  // Fetch folders and notes purely from database on mount
  useEffect(() => {
    setIsLoadingFolders(true);
    fetchFolders()
      .then((data) => {
        if (data && Array.isArray(data)) {
          setFolders(data.map((f) => ({ ...f, id: f._id || f.id })));
        } else {
          setFolders([]);
        }
      })
      .catch((err) => console.warn('Could not fetch folders:', err))
      .finally(() => setIsLoadingFolders(false));

    setIsLoadingNotes(true);
    fetchNotes({ folderId: '' })
      .then((data) => {
        if (data && Array.isArray(data)) {
          setNotes(data.map((n) => ({ ...n, id: n._id || n.id })));
        } else {
          setNotes([]);
        }
      })
      .catch((err) => console.warn('Could not fetch notes:', err))
      .finally(() => setIsLoadingNotes(false));
  }, []);


  // Add Folder Handler
  const handleAddFolder = (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    let iconColor = '#8c8bf6';
    let flapColor = '#7674ea';
    if (newFolderColor === '#fce5e3') {
      iconColor = '#b86745';
      flapColor = '#9e5132';
    } else if (newFolderColor === '#fefce8') {
      iconColor = '#cad54a';
      flapColor = '#b2bd3a';
    } else if (newFolderColor === '#e0f2fe') {
      iconColor = '#0284c7';
      flapColor = '#0369a1';
    } else if (newFolderColor === '#f3e8ff') {
      iconColor = '#9333ea';
      flapColor = '#7e22ce';
    }

    const tempId = `f_${Date.now()}`;
    // Auto-generate today's date in DD/MM/YYYY format
    const todayDate = new Date().toLocaleDateString('en-GB');
    const newFolder = {
      id: tempId,
      title: newFolderName.trim(),
      date: todayDate,
      bgColor: newFolderColor,
      iconColor,
      flapColor,
      category: 'All',
    };

    setFolders([...folders, newFolder]);
    setNewFolderName('');
    setIsFolderModalOpen(false);

    // Save to backend
    createFolderApi(newFolder).then((saved) => {
      if (saved && (saved._id || saved.id)) {
        setFolders((prev) =>
          prev.map((f) => (f.id === tempId ? { ...saved, id: saved._id || saved.id } : f))
        );
      }
    });
  };

  // Add Note Handler
  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;

    const tempId = `n_${Date.now()}`;
    // Auto-generate today's date and current time
    const now = new Date();
    const todayDate = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dayStr = now.toLocaleDateString('en-US', { weekday: 'long' });
    const autoTime = `${timeStr}, ${dayStr}`;
    const newNote = {
      id: tempId,
      date: todayDate,
      title: newNoteTitle.trim(),
      content:
        newNoteContent.trim() ||
        'Ultrices viverra odio congue lecos felis, libero egestas nunc sagi are masa, elit ornare eget sem veib in ulum.',
      time: newNoteTime.trim() || autoTime,
      bgColor: newNoteColor,
      category: 'All',
      month: now.getMonth(),
      year: now.getFullYear(),
      folderId: null,
    };

    setNotes([...notes, newNote]);
    setNewNoteTitle('');
    setNewNoteContent('');
    setIsNoteModalOpen(false);

    // Save to backend
    createNoteApi(newNote).then((saved) => {
      if (saved && (saved._id || saved.id)) {
        setNotes((prev) =>
          prev.map((n) => (n.id === tempId ? { ...saved, id: saved._id || saved.id } : n))
        );
      }
    });
  };

  const handleDeleteFolder = (id, e) => {
    if (e) e.stopPropagation();
    setFolders(folders.filter((f) => f.id !== id && f._id !== id));
    setActiveFolderMenu(null);
    deleteFolderApi(id);
  };

  const startEditingNote = (note) => {
    setActiveNote(note);
    setIsEditingNote(true);
    setEditNoteTitle(note.title || '');
    setEditNoteContent(note.content || '');
    setEditNoteTime(note.time || '');
    setEditNoteColor(note.bgColor || '#ece57a');
  };

  const handleSaveEditNote = (e) => {
    e.preventDefault();
    if (!editNoteTitle.trim() || !activeNote) return;

    const noteId = activeNote.id || activeNote._id;
    const updatedFields = {
      title: editNoteTitle.trim(),
      content: editNoteContent.trim(),
      time: editNoteTime.trim() || activeNote.time,
      bgColor: editNoteColor || activeNote.bgColor,
    };

    const updatedNote = { ...activeNote, ...updatedFields };

    setNotes((prevNotes) =>
      prevNotes.map((n) => (n.id === noteId || n._id === noteId ? updatedNote : n))
    );
    setActiveNote(updatedNote);
    setIsEditingNote(false);

    updateNoteApi(noteId, updatedFields).catch((err) => {
      console.warn('Could not update note in backend:', err);
    });
  };

  const handleDeleteNote = (id) => {
    setNotes(notes.filter((n) => n.id !== id && n._id !== id));
    setActiveNote(null);
    setIsEditingNote(false);
    setActiveNoteMenu(null);
    deleteNoteApi(id);
  };

  const handleOpenMoveModal = (note) => {
    setNoteToMove(note);
    setSelectedTargetFolderId(note.folderId || '');
  };

  const handleConfirmMoveNote = async () => {
    if (!noteToMove) return;
    const noteId = noteToMove.id || noteToMove._id;
    const targetFolderId = selectedTargetFolderId || null;

    if (targetFolderId) {
      setNotes((prevNotes) => prevNotes.filter((n) => n.id !== noteId && n._id !== noteId));
    } else {
      setNotes((prevNotes) =>
        prevNotes.map((n) =>
          n.id === noteId || n._id === noteId ? { ...n, folderId: null } : n
        )
      );
    }

    setNoteToMove(null);

    try {
      if (typeof noteId === 'string' && (noteId.startsWith('n_') || noteId.startsWith('fn_'))) {
        await createNoteApi({ ...noteToMove, folderId: targetFolderId, category: 'All' });
      } else {
        await updateNoteApi(noteId, { folderId: targetFolderId });
      }
    } catch (err) {
      console.warn('Could not move note:', err);
    }
  };

  // Show all folders and notes directly from DB (no tab filtering)
  const displayedFolders = folders;
  const displayedNotes = notes;

  // ── AI Chat State ──────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', text: 'Hi! I\'m your AI assistant powered by Gemini. Ask me anything — tasks, ideas, writing, code, or general questions! ✨' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = React.useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    const userMsg = { role: 'user', text };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const apiKey =
        (import.meta.env.VITE_GEMINI_API_KEY && import.meta.env.VITE_GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE')
          ? import.meta.env.VITE_GEMINI_API_KEY
          : (localStorage.getItem('gemini_api_key') || 'AIzaSyCekvikB_jCloGvqQWtAgfxZVERN_iXoPk');

      if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        throw new Error('API_KEY_MISSING');
      }

      // Format previous messages for Gemini API, filtering out system error bubbles
      const historyContents = chatMessages
        .filter((m) => !m.text.startsWith('⚠️') && !m.text.startsWith('❌'))
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.text }]
        }));

      const body = {
        contents: [
          ...historyContents,
          { role: 'user', parts: [{ text }] }
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      };

      const modelsToTry = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];
      let reply = null;
      let lastErrMsg = null;

      for (const model of modelsToTry) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (res.ok) {
            const data = await res.json();
            reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (reply) break;
          } else {
            const errData = await res.json().catch(() => ({}));
            lastErrMsg = errData?.error?.message || `HTTP ${res.status}`;
          }
        } catch (e) {
          lastErrMsg = e.message;
        }
      }

      if (!reply) {
        throw new Error(lastErrMsg || 'Could not generate a response.');
      }

      setChatMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      const errMsg = err.message === 'API_KEY_MISSING'
        ? '⚠️ Please add your Gemini API key to the .env file as VITE_GEMINI_API_KEY.'
        : `❌ Error: ${err.message}. Please check your connection.`;
      setChatMessages((prev) => [...prev, { role: 'assistant', text: errMsg }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div
      className="home-screen-root"
      onClick={() => {
        setActiveFolderMenu(null);
        setActiveNoteMenu(null);
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

        .home-screen-root {
          min-height: 100vh;
          width: 100%;
          background-color: #ffffff;
          font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #111827;
          box-sizing: border-box;
          padding: 36px 24px 110px 48px;
          -webkit-font-smoothing: antialiased;
        }

        /* Two-column split layout */
        .home-split-layout {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 32px;
          align-items: flex-start;
          max-width: 1400px;
          margin: 0 auto;
        }

        .home-left-col {
          min-width: 0;
        }

        /* AI Chat Panel */
        .ai-chat-panel {
          position: sticky;
          top: 24px;
          height: calc(100vh - 160px);
          background: #ffffff;
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
          border: 1px solid #e2e8f0;
        }

        .ai-chat-header {
          padding: 14px 18px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          background: #ffffff;
        }

        .ai-chat-logo-wrap {
          display: flex;
          align-items: center;
        }

        .ai-chat-logo-img {
          height: 34px;
          width: auto;
          max-width: 150px;
          object-fit: contain;
          display: block;
        }

        .ai-chat-clear-btn {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          color: #64748b;
          border-radius: 8px;
          width: 32px;
          height: 32px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .ai-chat-clear-btn:hover {
          background: #fee2e2;
          border-color: #fca5a5;
          color: #ef4444;
          transform: scale(1.05);
        }

        .ai-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px 16px 8px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scrollbar-width: thin;
          scrollbar-color: #e2e8f0 transparent;
          background: #f8fafc;
        }

        .ai-chat-messages::-webkit-scrollbar {
          width: 4px;
        }
        .ai-chat-messages::-webkit-scrollbar-track { background: transparent; }
        .ai-chat-messages::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }

        .ai-msg {
          display: flex;
          gap: 8px;
          animation: msg-in 0.25s ease both;
        }

        @keyframes msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .ai-msg.user {
          flex-direction: row-reverse;
        }

        .ai-msg-bubble {
          max-width: 82%;
          padding: 10px 14px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.55;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .ai-msg.assistant .ai-msg-bubble {
          background: #ffffff;
          color: #1e293b;
          border-bottom-left-radius: 4px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .ai-msg.user .ai-msg-bubble {
          background: linear-gradient(135deg, #4c84ff, #6366f1);
          color: #ffffff;
          border-bottom-right-radius: 4px;
        }

        .ai-typing {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 10px 14px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          border-bottom-left-radius: 4px;
          width: fit-content;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .ai-typing span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #94a3b8;
          display: inline-block;
          animation: typing-dot 1.2s infinite;
        }
        .ai-typing span:nth-child(2) { animation-delay: 0.2s; }
        .ai-typing span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }

        .ai-chat-input-area {
          padding: 12px 14px 14px;
          border-top: 1px solid #f1f5f9;
          flex-shrink: 0;
          background: #ffffff;
        }

        .ai-chat-input-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          background: #f8fafc;
          border-radius: 14px;
          padding: 8px 10px 8px 14px;
          border: 1px solid #e2e8f0;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .ai-chat-input-row:focus-within {
          border-color: #4c84ff;
          box-shadow: 0 0 0 3px rgba(76,132,255,0.12);
        }

        .ai-chat-textarea {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          color: #0f172a;
          font-size: 13px;
          font-family: inherit;
          resize: none;
          max-height: 100px;
          line-height: 1.5;
          padding: 2px 0;
        }

        .ai-chat-textarea::placeholder {
          color: #94a3b8;
        }

        .ai-chat-send-btn {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, #4c84ff, #6366f1);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }

        .ai-chat-send-btn:hover:not(:disabled) {
          opacity: 0.88;
          transform: scale(1.05);
        }

        .ai-chat-send-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .ai-chat-hint {
          font-size: 10.5px;
          color: #94a3b8;
          text-align: center;
          margin-top: 8px;
        }

        @media (max-width: 900px) {
          .home-split-layout {
            grid-template-columns: 1fr;
          }
          .ai-chat-panel {
            position: static;
            height: 480px;
          }
        }

        /* Top Bar Navigation */
        .home-top-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 24px;
          margin-bottom: 24px;
          border-bottom: 1px solid #f1f5f9;
        }

        .home-brand-title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .home-brand-badge {
          background: #111827;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .home-top-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .home-action-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .home-action-btn:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #0f172a;
        }

        .home-logout-btn {
          background: #fee2e2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .home-logout-btn:hover {
          background: #fecaca;
          color: #991b1b;
        }

        /* Section Containers */
        .home-content-container {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 48px;
        }

        .section-block {
          display: flex;
          flex-direction: column;
        }

        /* Section Headings */
        .section-title {
          font-size: 26px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 16px 0;
          letter-spacing: -0.02em;
        }

        /* Tabs Row */
        .tabs-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .tabs-group {
          display: flex;
          align-items: center;
          gap: 28px;
        }

        .tab-item {
          font-size: 15px;
          font-weight: 500;
          color: #9ca3af;
          cursor: pointer;
          position: relative;
          padding-bottom: 6px;
          transition: color 0.15s ease;
          background: none;
          border: none;
          outline: none;
          font-family: inherit;
        }

        .tab-item:hover {
          color: #4b5563;
        }

        .tab-item.active {
          color: #111827;
          font-weight: 700;
        }

        .tab-item.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2.5px;
          background-color: #111827;
          border-radius: 2px;
        }

        /* Month Navigator */
        .month-navigator {
          display: flex;
          align-items: center;
          gap: 12px;
          user-select: none;
        }

        .month-label {
          font-size: 14px;
          font-weight: 500;
          color: #6b7280;
          min-width: 110px;
          text-align: center;
        }

        .month-arrow-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background-color 0.15s;
        }

        .month-arrow-btn:hover {
          background-color: #f3f4f6;
        }

        /* 4-Column Cards Grid */
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          width: 100%;
        }

        /* ── Responsive Breakpoints ── */

        /* Tablet: 2 columns */
        @media (max-width: 1080px) {
          .cards-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        /* Large Mobile (481–768px): 2 columns, less padding */
        @media (max-width: 768px) {
          .home-screen-root {
            padding: 24px 24px 48px 24px;
          }
          .home-content-container {
            gap: 36px;
          }
          .section-title {
            font-size: 22px;
          }
          .home-top-nav {
            flex-wrap: wrap;
            gap: 12px;
          }
          .home-top-actions {
            gap: 8px;
          }
        }

        /* Small Mobile (≤480px): 1 column, compact layout */
        @media (max-width: 480px) {
          .home-screen-root {
            padding: 16px 14px 40px 14px;
          }
          .home-content-container {
            gap: 28px;
          }
          .section-title {
            font-size: 20px;
            margin-bottom: 12px;
          }

          /* Nav: brand left, actions right, both on same row */
          .home-top-nav {
            flex-direction: row;
            flex-wrap: wrap;
            gap: 10px;
            padding-bottom: 16px;
            margin-bottom: 16px;
          }
          .home-brand-title {
            font-size: 16px;
          }
          .home-brand-badge {
            font-size: 9px;
            padding: 2px 6px;
          }
          /* Shrink buttons on mobile — show icon + short text */
          .home-action-btn {
            padding: 7px 12px;
            font-size: 12px;
            border-radius: 8px;
            gap: 5px;
          }

          /* Cards: 1 column */
          .cards-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          /* Tabs: wrap rows */
          .tabs-header-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .tabs-group {
            gap: 18px;
          }
          .tab-item {
            font-size: 14px;
          }

          /* Month navigator: full width centered */
          .month-navigator {
            width: 100%;
            justify-content: flex-start;
          }
          .month-label {
            min-width: 90px;
            font-size: 13px;
          }

          /* Cards: slightly less tall on mobile */
          .folder-card {
            min-height: 140px;
            padding: 18px 18px;
          }
          .dashed-card.folder-height {
            min-height: 140px;
          }
          .note-card {
            min-height: 240px;
            padding: 18px 18px;
          }
          .dashed-card.note-height {
            min-height: 240px;
          }
          .note-title {
            font-size: 16px;
          }

          /* Modal: edge-to-edge on mobile */
          .modal-overlay {
            padding: 12px;
            align-items: flex-end;
          }
          .modal-card {
            border-radius: 16px 16px 0 0;
            max-width: 100%;
            padding: 22px 18px;
          }
        }

        /* Folder Card */
        .folder-card {
          border-radius: 22px;
          padding: 22px 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 165px;
          position: relative;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          box-sizing: border-box;
          cursor: pointer;
        }

        .folder-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 24px -6px rgba(0, 0, 0, 0.08);
        }

        .folder-top-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .folder-more-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #111827;
          opacity: 0.8;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s;
        }

        .folder-more-btn:hover {
          opacity: 1;
          background-color: rgba(0, 0, 0, 0.05);
        }

        .folder-menu-dropdown {
          position: absolute;
          top: 48px;
          right: 20px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          z-index: 20;
          overflow: hidden;
          min-width: 120px;
        }

        .folder-menu-item {
          padding: 9px 14px;
          font-size: 13px;
          color: #374151;
          cursor: pointer;
          transition: background 0.15s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .folder-menu-item:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .folder-menu-item.danger {
          color: #dc2626;
        }

        .folder-menu-item.danger:hover {
          background: #fee2e2;
        }

        /* Note 3-Dots Menu Styles */
        .note-more-btn {
          background: rgba(0, 0, 0, 0.05);
          border: none;
          color: #1f2937;
          cursor: pointer;
          width: 28px;
          height: 28px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s, transform 0.15s;
        }

        .note-more-btn:hover {
          background-color: rgba(0, 0, 0, 0.12);
          transform: scale(1.08);
        }

        .note-menu-dropdown {
          position: absolute;
          top: 34px;
          right: 0;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.04);
          z-index: 50;
          overflow: hidden;
          min-width: 135px;
          padding: 4px;
        }

        .note-menu-item {
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          border-radius: 8px;
          transition: background 0.15s, color 0.15s;
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .note-menu-item:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .note-menu-item.danger {
          color: #dc2626;
        }

        .note-menu-item.danger:hover {
          background: #fee2e2;
          color: #b91c1c;
        }

        .folder-bottom {
          margin-top: 28px;
        }

        .folder-title {
          font-size: 17px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 5px 0;
          line-height: 1.25;
        }

        .folder-date {
          font-size: 12px;
          font-weight: 500;
          color: #6b7280;
          margin: 0;
        }

        /* Dashed New Card */
        .dashed-card {
          border: 2px dashed #cbd5e1;
          border-radius: 22px;
          background: transparent;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-sizing: border-box;
          user-select: none;
        }

        .dashed-card:hover {
          border-color: #94a3b8;
          background-color: #f8fafc;
          transform: translateY(-2px);
        }

        .dashed-card.folder-height {
          min-height: 165px;
        }

        .dashed-card.note-height {
          min-height: 290px;
        }

        .dashed-label {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
        }

        /* Note Card */
        .note-card {
          border-radius: 22px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 290px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          box-sizing: border-box;
          cursor: pointer;
        }

        .note-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 24px -6px rgba(0, 0, 0, 0.08);
        }

        .note-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .note-date {
          font-size: 12px;
          font-weight: 500;
          color: #4b5563;
          margin: 0;
        }

        .note-main-content {
          margin: 14px 0;
          flex-grow: 1;
        }

        .note-title {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 12px 0;
          line-height: 1.25;
        }

        .note-snippet {
          font-size: 13px;
          line-height: 1.55;
          color: #374151;
          margin: 0;
          white-space: pre-line;
          display: -webkit-box;
          -webkit-line-clamp: 6;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .note-bottom-row {
          display: flex;
          align-items: center;
          font-size: 12px;
          font-weight: 500;
          color: #4b5563;
          margin-top: 16px;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-card {
          background: #ffffff;
          border-radius: 20px;
          max-width: 460px;
          width: 100%;
          padding: 28px;
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .modal-title {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }

        .modal-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .modal-label {
          font-size: 13px;
          font-weight: 600;
          color: #4b5563;
        }

        .modal-input, .modal-textarea {
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid #d1d5db;
          font-size: 14px;
          font-family: inherit;
          color: #111827;
          outline: none;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }

        .modal-input:focus, .modal-textarea:focus {
          border-color: #2563eb;
        }

        .modal-textarea {
          min-height: 100px;
          resize: vertical;
        }

        .color-palette-options {
          display: flex;
          gap: 10px;
          margin-top: 4px;
        }

        .color-dot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid transparent;
          transition: transform 0.15s;
        }

        .color-dot.selected {
          border-color: #111827;
          transform: scale(1.1);
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 8px;
        }

        .modal-btn-cancel {
          padding: 10px 18px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #4b5563;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }

        .modal-btn-cancel:hover {
          background: #f9fafb;
        }

        .modal-btn-submit {
          padding: 10px 20px;
          border-radius: 10px;
          border: none;
          background: #111827;
          color: #ffffff;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .modal-btn-submit:hover {
          background: #1f2937;
        }
      `}</style>

      {/* Top Application Bar */}
      <header className="home-top-nav">
        <div className="home-brand-title">
          <span>{getSessionUserName()}'s TODO</span>
          <span className="home-brand-badge">Workspace</span>
        </div>
      </header>


      <main className="home-split-layout">
        <div className="home-left-col">
          <div className="home-content-container">
        {/* ================= SECTION 1: RECENT FOLDERS ================= */}
        <section className="section-block">
          <h2 className="section-title">Recent Folders</h2>


          {/* Folders 4-Column Grid */}
          <div className="cards-grid">
            {displayedFolders.map((folder) => (
              <div
                key={folder.id}
                className="folder-card"
                style={{ backgroundColor: folder.bgColor }}
                onClick={() => setActiveFolderMenu(null)}
                onDoubleClick={() => onOpenFolder && onOpenFolder(folder)}
                title="Double-click to open folder"
              >
                <div className="folder-top-row">
                  <DocumentFoldedIcon
                    color={folder.iconColor}
                    flapColor={folder.flapColor}
                    size={36}
                  />
                  <div style={{ position: 'relative' }}>
                    <button
                      className="folder-more-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveFolderMenu(
                          activeFolderMenu === folder.id ? null : folder.id
                        );
                      }}
                      title="Folder Options"
                    >
                      <MoreDotsIcon />
                    </button>

                    {activeFolderMenu === folder.id && (
                      <div className="folder-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                        <div
                          className="folder-menu-item"
                          onClick={() => {
                            if (onOpenFolder) onOpenFolder(folder);
                            setActiveFolderMenu(null);
                          }}
                        >
                          📂 Open
                        </div>
                        <div
                          className="folder-menu-item danger"
                          onClick={(e) => handleDeleteFolder(folder.id, e)}
                        >
                          🗑️ Delete
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="folder-bottom">
                  <h3 className="folder-title">{folder.title}</h3>
                  <p className="folder-date">{folder.date}</p>
                </div>
              </div>
            ))}

            {/* "New folder" dashed card */}
            <div
              className="dashed-card folder-height"
              onClick={() => setIsFolderModalOpen(true)}
              title="Create new folder"
            >
              <DocumentFoldedIcon color="#1e293b" flapColor="#0f172a" size={32} />
              <span className="dashed-label">New folder</span>
            </div>
          </div>
        </section>

        {/* ================= SECTION 2: MY NOTES ================= */}
        <section className="section-block">
          <h2 className="section-title">My Notes</h2>


          {/* Notes 4-Column Grid */}
          <div className="cards-grid">
            {displayedNotes.map((note) => (
              <div
                key={note.id}
                className="note-card"
                style={{ backgroundColor: note.bgColor }}
                onClick={() => {
                  setActiveNote(note);
                  setIsEditingNote(false);
                  setActiveNoteMenu(null);
                }}
                title="Click to view note"
              >
                <div>
                  <div className="note-top-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="note-date">{note.date}</span>
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        className="note-more-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveNoteMenu(activeNoteMenu === note.id ? null : note.id);
                        }}
                        title="Note Options"
                      >
                        <ThreeDotsIcon />
                      </button>

                      {activeNoteMenu === note.id && (
                        <div
                          className="note-menu-dropdown"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            className="note-menu-item"
                            onClick={() => {
                              setActiveNoteMenu(null);
                              setActiveNote(note);
                              setIsEditingNote(false);
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span>View</span>
                          </div>

                          <div
                            className="note-menu-item"
                            onClick={() => {
                              setActiveNoteMenu(null);
                              startEditingNote(note);
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                            <span>Edit</span>
                          </div>

                          <div
                            className="note-menu-item"
                            onClick={() => {
                              setActiveNoteMenu(null);
                              handleOpenMoveModal(note);
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                              <polyline points="12 11 15 14 12 17" />
                              <line x1="9" y1="14" x2="15" y2="14" />
                            </svg>
                            <span>Move</span>
                          </div>

                          <div
                            className="note-menu-item danger"
                            onClick={() => {
                              setActiveNoteMenu(null);
                              handleDeleteNote(note.id || note._id);
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            <span>Delete</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="note-main-content">
                    <h3 className="note-title">{note.title}</h3>
                    <p className="note-snippet">{note.content}</p>
                  </div>
                </div>

                <div className="note-bottom-row">
                  <ClockIcon />
                  <span>{note.time}</span>
                </div>
              </div>
            ))}

            {/* "New Note" dashed card */}
            <div
              className="dashed-card note-height"
              onClick={() => setIsNoteModalOpen(true)}
              title="Create new note"
            >
              <PencilBadge size={28} isDashed={true} />
              <span className="dashed-label">New Note</span>
            </div>
          </div>
        </section>
        </div>{/* home-content-container */}
        </div>{/* home-left-col */}

      {/* ================= MODAL: CREATE NEW FOLDER ================= */}
      {isFolderModalOpen && (
        <div className="modal-overlay" onClick={() => setIsFolderModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Create New Folder</h3>
            <form onSubmit={handleAddFolder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="modal-field">
                <label className="modal-label">Folder Name</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="e.g. Project Specs"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="modal-field">
                <label className="modal-label">Folder Color Theme</label>
                <div className="color-palette-options">
                  {[
                    { bg: '#e9f2fe', label: 'Soft Blue' },
                    { bg: '#fce5e3', label: 'Peach' },
                    { bg: '#fefce8', label: 'Cream Yellow' },
                    { bg: '#e0f2fe', label: 'Sky' },
                    { bg: '#f3e8ff', label: 'Lilac' },
                  ].map((c) => (
                    <div
                      key={c.bg}
                      className={`color-dot ${newFolderColor === c.bg ? 'selected' : ''}`}
                      style={{ backgroundColor: c.bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)' }}
                      onClick={() => setNewFolderColor(c.bg)}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn-cancel"
                  onClick={() => setIsFolderModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-btn-submit">
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE NEW NOTE ================= */}
      {isNoteModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNoteModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Create New Note</h3>
            <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="modal-field">
                <label className="modal-label">Note Title</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="e.g. Science Review Notes"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="modal-field">
                <label className="modal-label">Content</label>
                <textarea
                  className="modal-textarea"
                  placeholder="Write your note contents..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="modal-field">
                <label className="modal-label">Reminder Time</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="10:30 PM, Monday"
                  value={newNoteTime}
                  onChange={(e) => setNewNoteTime(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label className="modal-label">Card Background</label>
                <div className="color-palette-options">
                  {[
                    { bg: '#ece57a', label: 'Lemon Yellow' },
                    { bg: '#fba599', label: 'Salmon Peach' },
                    { bg: '#5eafe8', label: 'Sky Blue' },
                    { bg: '#bbf7d0', label: 'Mint Green' },
                    { bg: '#fed7aa', label: 'Warm Apricot' },
                  ].map((c) => (
                    <div
                      key={c.bg}
                      className={`color-dot ${newNoteColor === c.bg ? 'selected' : ''}`}
                      style={{ backgroundColor: c.bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)' }}
                      onClick={() => setNewNoteColor(c.bg)}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn-cancel"
                  onClick={() => setIsNoteModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-btn-submit">
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: VIEW / EDIT NOTE DETAIL ================= */}
      {activeNote && (
        <div
          className="modal-overlay"
          onClick={() => {
            setActiveNote(null);
            setIsEditingNote(false);
          }}
        >
          <div
            className="modal-card"
            style={{
              backgroundColor: isEditingNote ? editNoteColor : activeNote.bgColor,
              transition: 'background-color 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="note-top-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="note-date">{activeNote.date}</span>
                {isEditingNote && (
                  <span
                    style={{
                      background: 'rgba(17, 24, 39, 0.12)',
                      color: '#111827',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Editing
                  </span>
                )}
              </div>
              <button
                type="button"
                title="Close"
                onClick={() => {
                  setActiveNote(null);
                  setIsEditingNote(false);
                }}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  backgroundColor: '#18181b',
                  border: 'none',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  transition: 'transform 0.15s ease, background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {isEditingNote ? (
              <form onSubmit={handleSaveEditNote} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px' }}>
                <div className="modal-field">
                  <label className="modal-label" style={{ fontWeight: 700, color: '#111827' }}>
                    Title
                  </label>
                  <input
                    type="text"
                    className="modal-input"
                    style={{
                      background: 'rgba(255, 255, 255, 0.85)',
                      borderColor: 'rgba(0, 0, 0, 0.15)',
                      fontWeight: 600,
                      color: '#111827',
                    }}
                    value={editNoteTitle}
                    onChange={(e) => setEditNoteTitle(e.target.value)}
                    placeholder="Enter note title..."
                    required
                    autoFocus
                  />
                </div>

                <div className="modal-field">
                  <label className="modal-label" style={{ fontWeight: 700, color: '#111827' }}>
                    Content
                  </label>
                  <textarea
                    className="modal-textarea"
                    style={{
                      background: 'rgba(255, 255, 255, 0.85)',
                      borderColor: 'rgba(0, 0, 0, 0.15)',
                      color: '#111827',
                      minHeight: '105px',
                    }}
                    value={editNoteContent}
                    onChange={(e) => setEditNoteContent(e.target.value)}
                    placeholder="Enter note content..."
                    rows={4}
                  />
                </div>

                <div className="modal-field">
                  <label className="modal-label" style={{ fontWeight: 700, color: '#111827' }}>
                    Reminder Time
                  </label>
                  <input
                    type="text"
                    className="modal-input"
                    style={{
                      background: 'rgba(255, 255, 255, 0.85)',
                      borderColor: 'rgba(0, 0, 0, 0.15)',
                      color: '#111827',
                    }}
                    value={editNoteTime}
                    onChange={(e) => setEditNoteTime(e.target.value)}
                    placeholder="08:13 PM, Friday"
                  />
                </div>

                <div className="modal-field">
                  <label className="modal-label" style={{ fontWeight: 700, color: '#111827' }}>
                    Card Color
                  </label>
                  <div className="color-palette-options">
                    {[
                      { bg: '#ece57a', label: 'Lemon Yellow' },
                      { bg: '#fba599', label: 'Salmon Peach' },
                      { bg: '#5eafe8', label: 'Sky Blue' },
                      { bg: '#bbf7d0', label: 'Mint Green' },
                      { bg: '#fed7aa', label: 'Warm Apricot' },
                    ].map((c) => (
                      <div
                        key={c.bg}
                        className={`color-dot ${editNoteColor === c.bg ? 'selected' : ''}`}
                        style={{
                          backgroundColor: c.bg,
                          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
                          cursor: 'pointer',
                        }}
                        onClick={() => setEditNoteColor(c.bg)}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="modal-actions" style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    className="modal-btn-cancel"
                    onClick={() => setIsEditingNote(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="modal-btn-submit"
                    style={{ background: '#111827', color: '#ffffff' }}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div style={{ margin: '8px 0' }}>
                  <h2 className="note-title" style={{ fontSize: '22px' }}>{activeNote.title}</h2>
                  <p
                    style={{
                      fontSize: '14px',
                      lineHeight: '1.6',
                      color: '#1f2937',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {activeNote.content}
                  </p>
                </div>

                <div className="note-bottom-row" style={{ marginTop: '10px' }}>
                  <ClockIcon />
                  <span>{activeNote.time}</span>
                </div>

                <div className="modal-actions" style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    className="modal-btn-cancel"
                    style={{ background: '#dc2626', color: '#ffffff', border: 'none' }}
                    onClick={() => handleDeleteNote(activeNote.id || activeNote._id)}
                  >
                    Delete Note
                  </button>
                  <button
                    type="button"
                    className="modal-btn-cancel"
                    style={{
                      background: '#ffffff',
                      color: '#111827',
                      border: '1px solid rgba(0,0,0,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    onClick={() => startEditingNote(activeNote)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Edit Note
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* ================= MODAL: MOVE NOTE TO FOLDER ================= */}
      {noteToMove && (
        <div className="modal-overlay" onClick={() => setNoteToMove(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: '440px', gap: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-title" style={{ fontSize: '18px' }}>Move Note</h3>
              <button
                type="button"
                onClick={() => setNoteToMove(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#6b7280',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
              Choose destination folder for <strong style={{ color: '#111827' }}>"{noteToMove.title}"</strong>:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
              <div
                onClick={() => setSelectedTargetFolderId('')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: selectedTargetFolderId === '' ? '2px solid #2563eb' : '1px solid #e5e7eb',
                  backgroundColor: selectedTargetFolderId === '' ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '20px' }}>🏠</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>My Notes (Home)</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Unfiled / main workspace</div>
                </div>
                {selectedTargetFolderId === '' && (
                  <span style={{ color: '#2563eb', fontWeight: 700, fontSize: '16px' }}>✓</span>
                )}
              </div>

              {folders.map((f) => {
                const fId = f.id || f._id;
                const isSelected = selectedTargetFolderId === fId;
                return (
                  <div
                    key={fId}
                    onClick={() => setSelectedTargetFolderId(fId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>📁</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>{f.title}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Folder</div>
                    </div>
                    {isSelected && (
                      <span style={{ color: '#2563eb', fontWeight: 700, fontSize: '16px' }}>✓</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="modal-actions" style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={() => setNoteToMove(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn-submit"
                onClick={handleConfirmMoveNote}
              >
                Move Note
              </button>
            </div>
          </div>
        </div>
      )}

        {/* ==================== AI CHAT PANEL ==================== */}
        <aside className="ai-chat-panel">
          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-chat-logo-wrap">
              <img src="/gemini.png" alt="Gemini" className="ai-chat-logo-img" />
            </div>
            <button
              type="button"
              className="ai-chat-clear-btn"
              onClick={() => setChatMessages([
                { role: 'assistant', text: 'Chat cleared! Ask me anything ✨' }
              ])}
              title="Clear chat"
            >🗑</button>
          </div>

          {/* Messages */}
          <div className="ai-chat-messages">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`ai-msg ${msg.role}`}>
                <div className="ai-msg-bubble">{msg.text}</div>
              </div>
            ))}
            {chatLoading && (
              <div className="ai-msg assistant">
                <div className="ai-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="ai-chat-input-area">
            <div className="ai-chat-input-row">
              <textarea
                className="ai-chat-textarea"
                placeholder="Ask me anything..."
                rows={1}
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
              />
              <button
                type="button"
                className="ai-chat-send-btn"
                onClick={sendChatMessage}
                disabled={chatLoading || !chatInput.trim()}
                title="Send message"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="ai-chat-hint">Press Enter to send · Shift+Enter for new line</p>
          </div>
        </aside>
      </main>{/* home-split-layout */}
    </div>
  );
}
