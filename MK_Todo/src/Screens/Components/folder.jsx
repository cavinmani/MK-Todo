import React, { useState, useEffect } from 'react';
import { fetchFolders, fetchNotes, createNoteApi, updateNoteApi, deleteNoteApi } from '../../services/api';
import Footer from './Footer';

// Three dots options icon
const ThreeDotsIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

// Folded document icon matching the app's visual style
const DocumentFoldedIcon = ({ color = '#8a89f6', flapColor = '#7271e8', size = 48 }) => (
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
        : (isActive ? '0 0 0 2px #ffffff, 0 0 0 4px #2563eb' : '0 1px 3px rgba(0,0,0,0.15)'),
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

export default function Folder({ folder, onBack }) {
  const currentFolder = folder || {
    id: 'default',
    title: 'Folder',
    date: new Date().toLocaleDateString('en-GB'),
    bgColor: '#e9f2fe',
    iconColor: '#8c8bf6',
    flapColor: '#7674ea',
    category: 'Recent',
  };

  // Notes state fetched purely from DB
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewNoteModalOpen, setIsNewNoteModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newColor, setNewColor] = useState('#e9f2fe');

  const [activeNote, setActiveNote] = useState(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editNoteTitle, setEditNoteTitle] = useState('');
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editNoteTime, setEditNoteTime] = useState('');
  const [editNoteColor, setEditNoteColor] = useState('#e9f2fe');
  const [editNoteTag, setEditNoteTag] = useState('');

  // Note options menu (3 dots) and move modal
  const [activeNoteMenu, setActiveNoteMenu] = useState(null);
  const [noteToMove, setNoteToMove] = useState(null);
  const [selectedTargetFolderId, setSelectedTargetFolderId] = useState('');
  const [availableFolders, setAvailableFolders] = useState([]);

  useEffect(() => {
    fetchFolders().then((data) => {
      if (Array.isArray(data)) {
        setAvailableFolders(data.map((f) => ({ ...f, id: f._id || f.id })));
      }
    });
  }, []);

  // Load folder notes from backend
  useEffect(() => {
    const folderIdentifier = currentFolder.id || currentFolder._id;
    if (!folderIdentifier) return;

    fetchNotes({ folderId: folderIdentifier }).then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setNotes(data.map((n) => ({ ...n, id: n._id || n.id })));
      } else {
        // Fallback: If folderIdentifier was a temporary id (e.g. f_...), match by folder title
        fetchFolders().then((fList) => {
          if (Array.isArray(fList)) {
            const matched = fList.find(
              (f) => f.title?.toLowerCase().trim() === currentFolder.title?.toLowerCase().trim()
            );
            if (matched && (matched._id || matched.id) !== folderIdentifier) {
              const realId = matched._id || matched.id;
              fetchNotes({ folderId: realId }).then((notesData) => {
                if (Array.isArray(notesData)) {
                  setNotes(notesData.map((n) => ({ ...n, id: n._id || n.id })));
                } else {
                  setNotes([]);
                }
              });
            } else {
              setNotes([]);
            }
          } else {
            setNotes([]);
          }
        }).catch(() => setNotes([]));
      }
    }).catch((err) => {
      console.warn('Error fetching folder notes:', err);
      setNotes([]);
    });
  }, [currentFolder.id, currentFolder._id, currentFolder.title]);

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const tempId = `fn_${Date.now()}`;
    const folderIdentifier = currentFolder.id || currentFolder._id;
    // Auto-generate today's date and current time
    const now = new Date();
    const todayDate = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dayStr = now.toLocaleDateString('en-US', { weekday: 'long' });
    const newNoteItem = {
      id: tempId,
      title: newTitle.trim(),
      date: todayDate,
      time: `${timeStr}, ${dayStr}`,
      content: newContent.trim() || 'New note entry created inside this folder.',
      bgColor: newColor,
      tag: newTag.trim() || 'Note',
      folderId: folderIdentifier,
    };

    setNotes([newNoteItem, ...notes]);
    setNewTitle('');
    setNewContent('');
    setNewTag('');
    setIsNewNoteModalOpen(false);

    createNoteApi(newNoteItem).then((saved) => {
      if (saved && (saved._id || saved.id)) {
        setNotes((prev) =>
          prev.map((n) => (n.id === tempId ? { ...saved, id: saved._id || saved.id } : n))
        );
      }
    });
  };

  const startEditingNote = (note) => {
    setActiveNote(note);
    setIsEditingNote(true);
    setEditNoteTitle(note.title || '');
    setEditNoteContent(note.content || '');
    setEditNoteTime(note.time || '');
    setEditNoteColor(note.bgColor || '#e9f2fe');
    setEditNoteTag(note.tag || '');
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
      tag: editNoteTag.trim(),
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
    const currentFolderId = currentFolder.id || currentFolder._id;

    if (targetFolderId !== currentFolderId) {
      setNotes((prevNotes) => prevNotes.filter((n) => n.id !== noteId && n._id !== noteId));
    }

    setNoteToMove(null);

    try {
      if (typeof noteId === 'string' && (noteId.startsWith('fn_') || noteId.startsWith('n_'))) {
        await createNoteApi({ ...noteToMove, folderId: targetFolderId, category: 'All' });
      } else {
        await updateNoteApi(noteId, { folderId: targetFolderId });
      }
    } catch (err) {
      console.warn('Could not move note in backend:', err);
    }
  };

  const filteredNotes = notes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      (n.tag && n.tag.toLowerCase().includes(q))
    );
  });

  return (
    <div
      className="folder-screen-root"
      onClick={() => setActiveNoteMenu(null)}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

        .folder-screen-root {
          min-height: 100vh;
          width: 100%;
          background-color: #ffffff;
          font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #111827;
          box-sizing: border-box;
          padding: 36px 48px 110px 48px;
          -webkit-font-smoothing: antialiased;
        }

        /* Top navigation / breadcrumbs */
        .folder-top-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 24px;
          margin-bottom: 28px;
          border-bottom: 1px solid #f1f5f9;
        }

        .folder-nav-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .back-home-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #1e293b;
          font-size: 14px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .back-home-btn:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          transform: translateX(-2px);
        }

        .folder-breadcrumbs {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #64748b;
          font-weight: 500;
        }

        .breadcrumb-active {
          color: #0f172a;
          font-weight: 700;
        }

        /* Hero banner for the folder */
        .folder-hero-card {
          background: ${currentFolder.bgColor};
          border-radius: 24px;
          padding: 32px 36px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 40px;
          box-shadow: 0 4px 20px -4px rgba(0, 0, 0, 0.05);
          transition: transform 0.2s ease;
        }

        .folder-hero-left {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .folder-hero-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .folder-hero-title {
          font-size: 32px;
          font-weight: 800;
          color: #111827;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .folder-hero-meta {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 13px;
          font-weight: 500;
          color: #4b5563;
        }

        .folder-meta-pill {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(8px);
          padding: 3px 10px;
          border-radius: 6px;
          font-weight: 600;
          color: #1e293b;
        }

        .folder-hero-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .primary-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #111827;
          color: #ffffff;
          border: none;
          padding: 10px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(17, 24, 39, 0.15);
        }

        .primary-add-btn:hover {
          background: #1f2937;
          transform: translateY(-1px);
        }

        /* Search & Filter Bar */
        .notes-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .notes-section-title {
          font-size: 22px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }

        .notes-search-input {
          padding: 9px 16px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          font-size: 14px;
          font-family: inherit;
          width: 260px;
          outline: none;
          transition: border-color 0.15s;
        }

        .notes-search-input:focus {
          border-color: #2563eb;
        }

        /* Cards Grid */
        .folder-notes-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          width: 100%;
        }

        /* ── Responsive Breakpoints ── */

        /* Tablet */
        @media (max-width: 1080px) {
          .folder-notes-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        /* Large Mobile (481–768px) */
        @media (max-width: 768px) {
          .folder-screen-root {
            padding: 24px 24px 48px 24px;
          }
          .folder-hero-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 20px;
            padding: 24px 24px;
          }
          .folder-hero-title {
            font-size: 26px;
          }
          .notes-search-input {
            width: 200px;
          }
        }

        /* Small Mobile (≤480px) */
        @media (max-width: 480px) {
          .folder-screen-root {
            padding: 16px 14px 40px 14px;
          }

          /* Header: stack vertically */
          .folder-top-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .folder-nav-left {
            flex-wrap: wrap;
            gap: 10px;
          }
          .back-home-btn {
            font-size: 13px;
            padding: 7px 13px;
          }
          .folder-breadcrumbs {
            font-size: 13px;
          }

          /* Hero: full-width stack */
          .folder-hero-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
            padding: 20px 18px;
            margin-bottom: 24px;
          }
          .folder-hero-left {
            gap: 14px;
          }
          .folder-hero-title {
            font-size: 22px;
          }
          .folder-hero-actions {
            width: 100%;
            justify-content: flex-start;
          }
          .primary-add-btn {
            width: 100%;
            justify-content: center;
            padding: 10px 16px;
          }

          /* Section header: stack vertically */
          .notes-section-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 18px;
          }
          .notes-search-input {
            width: 100%;
          }

          /* Notes grid: 1 column */
          .folder-notes-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          /* Cards: compact */
          .folder-note-card {
            min-height: 155px;
            padding: 14px 16px;
          }
          .dashed-new-note {
            min-height: 155px;
          }
          .card-title {
            font-size: 15px;
          }

          /* Modals: bottom sheet style */
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

        /* Note Card inside folder */
        .folder-note-card {
          border-radius: 18px;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 165px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          box-sizing: border-box;
          cursor: pointer;
        }

        .folder-note-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 24px -6px rgba(0, 0, 0, 0.08);
        }

        .card-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .card-date {
          font-size: 11.5px;
          font-weight: 600;
          color: #4b5563;
        }

        .card-tag {
          font-size: 11px;
          font-weight: 700;
          background: rgba(0, 0, 0, 0.06);
          padding: 2px 8px;
          border-radius: 6px;
          color: #374151;
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

        .card-title {
          font-size: 15px;
          font-weight: 700;
          color: #111827;
          margin: 8px 0 6px 0;
          line-height: 1.3;
        }

        .card-snippet {
          font-size: 12.5px;
          line-height: 1.45;
          color: #374151;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .card-bottom-row {
          display: flex;
          align-items: center;
          font-size: 11.5px;
          font-weight: 500;
          color: #4b5563;
          margin-top: 10px;
        }

        /* Dashed New Note Card */
        .dashed-new-note {
          border: 2px dashed #cbd5e1;
          border-radius: 18px;
          background: transparent;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 165px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .dashed-new-note:hover {
          border-color: #94a3b8;
          background-color: #f8fafc;
          transform: translateY(-2px);
        }

        .dashed-label {
          font-size: 13px;
          font-weight: 600;
          color: #111827;
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
          gap: 18px;
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
          box-sizing: border-box;
        }

        .modal-input:focus, .modal-textarea:focus {
          border-color: #2563eb;
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

        .modal-btn-submit {
          padding: 10px 20px;
          border-radius: 10px;
          border: none;
          background: #111827;
          color: #ffffff;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }
      `}</style>

      {/* Top Header Navigation */}
      <header className="folder-top-header">
        <div className="folder-nav-left">
          <button className="back-home-btn" onClick={onBack} title="Return to Home Screen">
            <span>←</span>
            <span>Back to Home</span>
          </button>
          <div className="folder-breadcrumbs">
            <span>Workspace</span>
            <span>/</span>
            <span>Folders</span>
            <span>/</span>
            <span className="breadcrumb-active">{currentFolder.title}</span>
          </div>
        </div>
      </header>

      {/* Hero Header Banner */}
      <div className="folder-hero-card">
        <div className="folder-hero-left">
          <DocumentFoldedIcon
            color={currentFolder.iconColor || '#8c8bf6'}
            flapColor={currentFolder.flapColor || '#7674ea'}
            size={56}
          />
          <div className="folder-hero-info">
            <h1 className="folder-hero-title">{currentFolder.title}</h1>
            <div className="folder-hero-meta">
              <span className="folder-meta-pill">📅 {currentFolder.date}</span>
              <span className="folder-meta-pill">📝 {notes.length} Notes</span>
              <span className="folder-meta-pill">📁 {currentFolder.category || 'Recent'}</span>
            </div>
          </div>
        </div>

        <div className="folder-hero-actions">
          <button
            className="primary-add-btn"
            onClick={() => setIsNewNoteModalOpen(true)}
            title="Add a new note to this folder"
          >
            <span>+</span>
            <span>New Note in Folder</span>
          </button>
        </div>
      </div>

      {/* Notes Subheader with Search */}
      <div className="notes-section-header">
        <h2 className="notes-section-title">Folder Notes ({filteredNotes.length})</h2>
        <input
          type="text"
          className="notes-search-input"
          placeholder="Search notes in folder..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Notes Grid inside folder */}
      <div className="folder-notes-grid">
        {filteredNotes.map((note) => (
          <div
            key={note.id}
            className="folder-note-card"
            style={{ backgroundColor: note.bgColor }}
            onClick={() => {
              setActiveNote(note);
              setIsEditingNote(false);
              setActiveNoteMenu(null);
            }}
            title="Click to view full note details"
          >
            <div>
              <div className="card-top-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="card-date">{note.date}</span>
                  {note.tag && <span className="card-tag">{note.tag}</span>}
                </div>
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

              <h3 className="card-title">{note.title}</h3>
              <p className="card-snippet">{note.content}</p>
            </div>

            <div className="card-bottom-row">
              <ClockIcon />
              <span>{note.time}</span>
            </div>
          </div>
        ))}

        {/* Dashed Add Note Card */}
        <div
          className="dashed-new-note"
          onClick={() => setIsNewNoteModalOpen(true)}
          title="Create a new note in this folder"
        >
          <PencilBadge size={24} />
          <span className="dashed-label">New Note</span>
        </div>
      </div>

      {/* ================= MODAL: CREATE NOTE IN FOLDER ================= */}
      {isNewNoteModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNewNoteModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add Note to {currentFolder.title}</h3>
            <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="modal-field">
                <label className="modal-label">Note Title</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="e.g. Critical Review"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="modal-field">
                <label className="modal-label">Tag / Label (Optional)</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="e.g. Priority, Review, Draft"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label className="modal-label">Content</label>
                <textarea
                  className="modal-textarea"
                  placeholder="Type your notes here..."
                  rows={4}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label className="modal-label">Card Background</label>
                <div className="color-palette-options">
                  {[
                    { bg: '#e9f2fe', label: 'Soft Blue' },
                    { bg: '#fce5e3', label: 'Peach' },
                    { bg: '#fefce8', label: 'Cream' },
                    { bg: '#ece57a', label: 'Lemon' },
                    { bg: '#5eafe8', label: 'Sky' },
                  ].map((c) => (
                    <div
                      key={c.bg}
                      className={`color-dot ${newColor === c.bg ? 'selected' : ''}`}
                      style={{ backgroundColor: c.bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)' }}
                      onClick={() => setNewColor(c.bg)}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn-cancel"
                  onClick={() => setIsNewNoteModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-btn-submit">
                  Add Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: VIEW / EDIT NOTE ================= */}
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
            <div className="card-top-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="card-date">{activeNote.date}</span>
                {activeNote.tag && !isEditingNote && <span className="card-tag">{activeNote.tag}</span>}
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
                    Tag
                  </label>
                  <input
                    type="text"
                    className="modal-input"
                    style={{
                      background: 'rgba(255, 255, 255, 0.85)',
                      borderColor: 'rgba(0, 0, 0, 0.15)',
                      color: '#111827',
                    }}
                    value={editNoteTag}
                    onChange={(e) => setEditNoteTag(e.target.value)}
                    placeholder="e.g. Design, Work, Personal"
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
                      { bg: '#e9f2fe', label: 'Soft Blue' },
                      { bg: '#fce5e3', label: 'Peach' },
                      { bg: '#fefce8', label: 'Cream' },
                      { bg: '#ece57a', label: 'Lemon' },
                      { bg: '#5eafe8', label: 'Sky' },
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
                  <h2 className="card-title" style={{ fontSize: '22px' }}>{activeNote.title}</h2>
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

                <div className="card-bottom-row" style={{ marginTop: '10px' }}>
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
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Move out of folder to main workspace</div>
                </div>
                {selectedTargetFolderId === '' && (
                  <span style={{ color: '#2563eb', fontWeight: 700, fontSize: '16px' }}>✓</span>
                )}
              </div>

              {availableFolders.map((f) => {
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
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {fId === (currentFolder.id || currentFolder._id) ? 'Current Folder' : 'Folder'}
                      </div>
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

      {/* ==================== FOOTER ==================== */}
      <Footer />
    </div>
  );
}
