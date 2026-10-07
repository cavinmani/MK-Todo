import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchPhotos,
  fetchPhotoFolders,
  uploadPhoto,
  deletePhotoApi,
  createPhotoFolderApi,
  deletePhotoFolderApi,
  movePhotoApi,
} from '../../services/api.js';

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

export default function Photos() {
  const [allPhotos, setAllPhotos] = useState([]);
  const [folders, setFolders] = useState([]); // distinct folder names from DB
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'gallery' | 'folders'
  const [selectedFolder, setSelectedFolder] = useState(null); // string | null (when inside a folder in 'folders' tab)
  const [loading, setLoading] = useState(true);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  // Upload modal state (supports up to 5 images)
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]); // array of { id, file, previewUrl, name, size }
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadingState, setUploadingState] = useState('idle'); // idle | uploading | success | error
  const [uploadError, setUploadError] = useState('');
  const [uploadWarning, setUploadWarning] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [pendingFolder, setPendingFolder] = useState('gallery');

  // Create folder mini-modal
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFolderName, setCreateFolderName] = useState('');

  // 3-dots context menu
  const [menuOpenId, setMenuOpenId] = useState(null);

  // Move modal
  const [movePhoto, setMovePhoto] = useState(null);
  const [moveToFolder, setMoveToFolder] = useState('');
  const [moveLoading, setMoveLoading] = useState(false);

  const fileInputRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [pList, fList] = await Promise.all([
      fetchPhotos({ folder: 'all' }),
      fetchPhotoFolders(),
    ]);
    setAllPhotos(pList || []);
    setFolders(fList || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // User-created folders (excluding 'gallery')
  const userFolders = folders.filter((f) => f && f !== 'gallery');

  // Derived photos list depending on tab and folder selection
  const displayedPhotos = (() => {
    if (activeTab === 'all') return allPhotos;
    if (activeTab === 'gallery') return allPhotos.filter((p) => !p.folder || p.folder === 'gallery');
    if (activeTab === 'folders') {
      if (selectedFolder) return allPhotos.filter((p) => p.folder === selectedFolder);
      return [];
    }
    return allPhotos;
  })();

  // ── Lightbox ──────────────────────────────────────────────
  const openLightbox = (photo, idx) => {
    setLightboxPhoto(photo);
    setLightboxIdx(idx);
  };
  const closeLightbox = () => setLightboxPhoto(null);
  const lightboxPrev = (e) => {
    e.stopPropagation();
    const newIdx = (lightboxIdx - 1 + displayedPhotos.length) % displayedPhotos.length;
    setLightboxIdx(newIdx);
    setLightboxPhoto(displayedPhotos[newIdx]);
  };
  const lightboxNext = (e) => {
    e.stopPropagation();
    const newIdx = (lightboxIdx + 1) % displayedPhotos.length;
    setLightboxIdx(newIdx);
    setLightboxPhoto(displayedPhotos[newIdx]);
  };

  useEffect(() => {
    if (!lightboxPhoto) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') lightboxPrev(e);
      if (e.key === 'ArrowRight') lightboxNext(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxPhoto, lightboxIdx, displayedPhotos]);

  // ── Multi-image Upload Handlers (Max 5 images) ───────────────
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const addFiles = (incomingFileList) => {
    setUploadError('');
    setUploadWarning('');
    const rawFiles = Array.from(incomingFileList || []).filter((f) =>
      f.type.startsWith('image/')
    );

    if (rawFiles.length === 0) {
      setUploadError('Please select valid image files (JPG, PNG, WebP, GIF, HEIC).');
      return;
    }

    const availableSlots = 5 - selectedFiles.length;
    if (availableSlots <= 0) {
      setUploadWarning('Maximum 5 images allowed at a time. Remove an image to add another.');
      return;
    }

    let filesToAdd = rawFiles;
    if (rawFiles.length > availableSlots) {
      setUploadWarning(
        `Maximum 5 images allowed at a time. Added ${availableSlots} of ${rawFiles.length} selected images.`
      );
      filesToAdd = rawFiles.slice(0, availableSlots);
    }

    const newItems = filesToAdd.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      size: formatFileSize(file.size),
    }));

    setSelectedFiles((prev) => {
      const updated = [...prev, ...newItems];
      if (updated.length === 1) {
        setUploadTitle(updated[0].name.replace(/\.[^.]+$/, ''));
      }
      return updated;
    });
  };

  const removeFile = (idToRemove) => {
    setSelectedFiles((prev) => {
      const target = prev.find((item) => item.id === idToRemove);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const updated = prev.filter((item) => item.id !== idToRemove);
      if (updated.length === 1) {
        setUploadTitle(updated[0].name.replace(/\.[^.]+$/, ''));
      }
      return updated;
    });
    setUploadWarning('');
  };

  const clearSelectedFiles = () => {
    selectedFiles.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setSelectedFiles([]);
    setUploadTitle('');
    setUploadError('');
    setUploadWarning('');
    setIsDragOver(false);
  };

  const onFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    e.target.value = '';
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const openUploadModal = (folder) => {
    const targetFolder =
      folder ||
      (activeTab === 'folders' && selectedFolder
        ? selectedFolder
        : 'gallery');
    setPendingFolder(targetFolder);
    clearSelectedFiles();
    setUploadingState('idle');
    setUploadOpen(true);
  };

  const closeUploadModal = () => {
    clearSelectedFiles();
    setUploadingState('idle');
    setUploadOpen(false);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadError('Please select at least 1 image to upload.');
      return;
    }
    if (selectedFiles.length > 5) {
      setUploadError('Maximum 5 images allowed at a time.');
      return;
    }
    setUploadingState('uploading');
    setUploadError('');
    setUploadWarning('');

    const filesToUpload = selectedFiles.map((item) => item.file);
    const result = await uploadPhoto(filesToUpload, {
      title: selectedFiles.length === 1 ? (uploadTitle || selectedFiles[0].name.replace(/\.[^.]+$/, '')) : undefined,
      folder: pendingFolder || 'gallery',
    });

    if (result?.success) {
      setUploadingState('success');
      setTimeout(() => {
        closeUploadModal();
        loadData();
      }, 900);
    } else {
      setUploadingState('error');
      setUploadError(result?.message || 'Upload failed. Check your Cloudinary API secret in .env');
    }
  };

  const handleCreateFolder = async () => {
    const name = createFolderName.trim();
    if (!name) return;
    await createPhotoFolderApi(name);
    setCreateFolderOpen(false);
    setCreateFolderName('');
    await loadData();
    setActiveTab('folders');
    setSelectedFolder(name);
  };

  const handleDeleteFolder = async (fName, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete folder "${fName}"? Photos inside will not be deleted.`)) return;
    await deletePhotoFolderApi(fName);
    if (selectedFolder === fName) setSelectedFolder(null);
    await loadData();
  };

  const handleDelete = async (photo, e) => {
    e.stopPropagation();
    setMenuOpenId(null);
    if (!window.confirm(`Delete "${photo.title}"?`)) return;
    setDeleteLoading(photo._id);
    await deletePhotoApi(photo._id);
    setDeleteLoading(null);
    loadData();
  };

  const handleMove = async () => {
    if (!movePhoto || !moveToFolder) return;
    setMoveLoading(true);
    await movePhotoApi(movePhoto._id, moveToFolder);
    setMoveLoading(false);
    setMovePhoto(null);
    setMoveToFolder('');
    loadData();
  };

  // Close 3-dots menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const close = () => setMenuOpenId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpenId]);

  return (
    <div className="photos-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

        .photos-root {
          min-height: 100vh;
          width: 100%;
          background-color: #ffffff;
          font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #111827;
          box-sizing: border-box;
          padding: 36px 48px 110px 48px;
          -webkit-font-smoothing: antialiased;
        }

        /* ── Header ── */
        .photos-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 24px;
          margin-bottom: 24px;
          border-bottom: 1px solid #f1f5f9;
          flex-wrap: wrap;
          gap: 12px;
        }

        .photos-brand {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .photos-badge {
          background: #6366f1;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 6px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .photos-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .photos-count-chip {
          background: #f1f5f9;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 20px;
        }

        .photos-upload-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          background: #111827;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 9px 18px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.18s, transform 0.15s;
          outline: none;
        }
        .photos-upload-btn:hover {
          background: #1e293b;
          transform: translateY(-1px);
        }

        /* ── Section title ── */
        .photos-section-title {
          font-size: 26px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 6px 0;
          letter-spacing: -0.02em;
        }

        .photos-section-sub {
          font-size: 14px;
          color: #9ca3af;
          font-weight: 500;
          margin: 0 0 24px 0;
        }

        /* ── Folder tabs ── */
        .photos-folders {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }

        .photos-tab {
          padding: 7px 18px;
          border-radius: 999px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.18s ease;
          font-family: inherit;
          outline: none;
        }

        .photos-tab:hover {
          border-color: #a5b4fc;
          color: #4f46e5;
          background: #eef2ff;
        }

        .photos-tab.active, .photos-tab.folder-active {
          background: #6366f1;
          border-color: #6366f1;
          color: #fff;
        }

        /* ── Folders Hub & Grid ── */
        .photos-folders-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 20px;
          margin-top: 16px;
          margin-bottom: 32px;
        }

        .photos-folder-card {
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 18px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          box-shadow: 0 2px 6px rgba(0,0,0,0.03);
          display: flex;
          flex-direction: column;
        }

        .photos-folder-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 14px 30px -4px rgba(99,102,241,0.15), 0 4px 12px rgba(0,0,0,0.06);
          border-color: #c7d2fe;
        }

        .photos-folder-card-thumb {
          width: 100%;
          height: 135px;
          object-fit: cover;
          display: block;
          background: #f1f5f9;
        }

        .photos-folder-card-placeholder {
          width: 100%;
          height: 135px;
          background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 44px;
        }

        .photos-folder-card-body {
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fff;
          gap: 8px;
        }

        .photos-folder-card-info {
          min-width: 0;
          flex: 1;
        }

        .photos-folder-card-name {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 2px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .photos-folder-card-count {
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
          margin: 0;
        }

        .photos-folder-card-del-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 6px;
          border-radius: 8px;
          font-size: 14px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .photos-folder-card-del-btn:hover {
          color: #ef4444;
          background: #fee2e2;
        }

        /* + Create Folder card */
        .photos-folder-card-create {
          border: 2px dashed #cbd5e1;
          border-radius: 18px;
          min-height: 185px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          background: #fafafa;
          color: #6366f1;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        .photos-folder-card-create:hover {
          border-color: #6366f1;
          background: #eef2ff;
          transform: translateY(-3px);
        }
        .photos-folder-card-create-icon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 2px 8px rgba(99,102,241,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 700;
        }
        .photos-folder-card-create span {
          font-size: 13px;
          font-weight: 700;
        }

        /* ── Inside folder banner ── */
        .photos-folder-view-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          margin-bottom: 24px;
          background: #f8fafc;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          flex-wrap: wrap;
          gap: 12px;
        }
        .photos-folder-view-left {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }
        .photos-folder-back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: #fff;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }
        .photos-folder-back-btn:hover {
          border-color: #6366f1;
          color: #6366f1;
          background: #eef2ff;
        }
        .photos-folder-view-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .photos-folder-view-badge {
          background: #e0e7ff;
          color: #4338ca;
          font-size: 12px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 20px;
        }
        .photos-folder-view-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .photos-folder-upload-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #6366f1;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s;
        }
        .photos-folder-upload-btn:hover {
          background: #4f46e5;
        }
        .photos-folder-del-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #fff;
          color: #ef4444;
          border: 1.5px solid #fecaca;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
        }
        .photos-folder-del-btn:hover {
          background: #fee2e2;
          border-color: #ef4444;
        }

        /* ── All Tab: Created Folders Section ── */
        .photos-all-folders-section {
          margin-top: 50px;
          padding-top: 32px;
          border-top: 1.5px solid #f1f5f9;
        }
        .photos-all-folders-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 10px;
        }
        .photos-all-folders-title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .photos-all-folders-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.02em;
        }
        .photos-all-folders-badge {
          background: #f1f5f9;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 20px;
        }
        .photos-all-folders-new-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border: 1.5px dashed #cbd5e1;
          border-radius: 999px;
          background: #fff;
          font-size: 13px;
          font-weight: 600;
          color: #6366f1;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
        }
        .photos-all-folders-new-btn:hover {
          border-color: #6366f1;
          background: #eef2ff;
        }


        /* Create Folder mini-modal */
        .photos-cf-backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(4px);
          z-index: 9500;
          display: flex; align-items: center; justify-content: center;
          animation: lb-fade 0.15s ease;
        }
        .photos-cf-modal {
          background: #fff; border-radius: 20px; padding: 28px;
          width: 360px; max-width: calc(100vw - 32px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.18);
          animation: lb-scale 0.2s cubic-bezier(0.34,1.56,0.64,1);
        }
        .photos-cf-modal h4 {
          font-size: 17px; font-weight: 800; color: #0f172a;
          margin: 0 0 6px 0; letter-spacing: -0.02em;
        }
        .photos-cf-modal p {
          font-size: 13px; color: #94a3b8; font-weight: 500; margin: 0 0 18px 0;
        }
        .photos-cf-actions { display: flex; gap: 8px; margin-top: 18px; }
        .photos-cf-cancel {
          flex: 1; padding: 10px; border: 1.5px solid #e5e7eb; border-radius: 10px;
          background: #fff; font-size: 14px; font-weight: 600; color: #6b7280;
          cursor: pointer; font-family: inherit;
        }
        .photos-cf-next {
          flex: 1; padding: 10px; border: none; border-radius: 10px;
          background: #6366f1; color: #fff; font-size: 14px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: background 0.15s;
        }
        .photos-cf-next:hover { background: #4f46e5; }
        .photos-cf-next:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Masonry-style grid (CSS columns) ── */
        .photos-masonry {
          columns: 4;
          column-gap: 16px;
        }

        .photos-item {
          break-inside: avoid;
          margin-bottom: 16px;
          border-radius: 18px;
          overflow: hidden;
          cursor: pointer;
          position: relative;
          display: block;
          background: #f1f5f9;
          transition: transform 0.22s ease, box-shadow 0.22s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }

        .photos-item:hover {
          transform: translateY(-4px) scale(1.015);
          box-shadow: 0 16px 36px -8px rgba(0,0,0,0.14);
          z-index: 2;
        }

        .photos-item img {
          width: 100%;
          height: auto;
          display: block;
          object-fit: cover;
          border-radius: 18px;
          transition: filter 0.22s ease;
        }

        .photos-item:hover img { filter: brightness(0.85); }

        /* Hover overlay with title */
        .photos-item-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 32px 14px 14px;
          background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%);
          border-radius: 0 0 18px 18px;
          opacity: 0;
          transition: opacity 0.22s ease;
          pointer-events: none;
        }

        .photos-item:hover .photos-item-overlay { opacity: 1; }

        .photos-item-title {
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 2px 0;
          line-height: 1.3;
        }

        .photos-item-date {
          font-size: 11px;
          color: rgba(255,255,255,0.75);
          margin: 0;
          font-weight: 500;
        }


        /* 3-dots menu button on photo */
        .photos-item-menu-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(255,255,255,0.92);
          border: none;
          color: #374151;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.18s, background 0.15s;
          pointer-events: all;
          z-index: 4;
          letter-spacing: 1px;
          line-height: 1;
          font-weight: 900;
        }
        .photos-item:hover .photos-item-menu-btn,
        .photos-item-menu-btn.open { opacity: 1; }
        .photos-item-menu-btn:hover { background: #fff; }

        /* Dropdown */
        .photos-item-dropdown {
          position: absolute;
          top: 44px;
          right: 10px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18);
          z-index: 10;
          min-width: 140px;
          overflow: hidden;
          animation: lb-scale 0.15s cubic-bezier(0.34,1.56,0.64,1);
        }
        .photos-dropdown-item {
          display: flex; align-items: center; gap: 8px;
          padding: 11px 16px;
          font-size: 13px; font-weight: 600; color: #374151;
          cursor: pointer; border: none; background: none;
          width: 100%; text-align: left; font-family: inherit;
          transition: background 0.12s;
        }
        .photos-dropdown-item:hover { background: #f8fafc; }
        .photos-dropdown-item.danger { color: #ef4444; }
        .photos-dropdown-item.danger:hover { background: #fef2f2; }

        /* Folder badge on photo */
        .photos-item-folder-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(99,102,241,0.88);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;
          opacity: 0;
          transition: opacity 0.18s;
          pointer-events: none;
          letter-spacing: 0.03em;
        }
        .photos-item:hover .photos-item-folder-badge { opacity: 1; }

        /* ── Lightbox ── */
        .photos-lightbox-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.88);
          backdrop-filter: blur(10px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: lb-fade 0.2s ease;
        }

        @keyframes lb-fade { from { opacity: 0; } to { opacity: 1; } }

        .photos-lightbox-inner {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 90vw;
          max-height: 90vh;
          animation: lb-scale 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }

        @keyframes lb-scale {
          from { transform: scale(0.88); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }

        .photos-lightbox-img {
          max-width: 80vw;
          max-height: 76vh;
          border-radius: 18px;
          object-fit: contain;
          box-shadow: 0 32px 80px rgba(0,0,0,0.5);
          display: block;
        }

        .photos-lightbox-info { margin-top: 16px; text-align: center; }
        .photos-lightbox-title { font-size: 17px; font-weight: 700; color: #fff; margin: 0 0 4px 0; }
        .photos-lightbox-date { font-size: 13px; color: rgba(255,255,255,0.55); margin: 0; }

        .photos-lightbox-close {
          position: fixed; top: 20px; right: 20px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          color: #fff; font-size: 22px; width: 40px; height: 40px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.15s; z-index: 10001; line-height: 1;
        }
        .photos-lightbox-close:hover { background: rgba(255,255,255,0.22); }

        .photos-lb-nav {
          position: fixed; top: 50%; transform: translateY(-50%);
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.18);
          color: #fff; width: 44px; height: 44px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.15s; z-index: 10001;
          font-size: 20px; user-select: none;
        }
        .photos-lb-nav:hover { background: rgba(255,255,255,0.22); }
        .photos-lb-prev { left: 20px; }
        .photos-lb-next { right: 20px; }

        .photos-lb-counter {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          color: rgba(255,255,255,0.6); font-size: 13px; font-weight: 600; letter-spacing: 0.05em;
        }

        /* ── Empty state ── */
        .photos-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 64px 24px; color: #9ca3af;
          gap: 16px; text-align: center;
        }
        .photos-empty svg { opacity: 0.35; }
        .photos-empty p { font-size: 15px; font-weight: 500; margin: 0; }
        .photos-empty-upload-btn {
          margin-top: 8px;
          background: #6366f1; color: #fff; border: none; border-radius: 10px;
          padding: 10px 22px; font-size: 14px; font-weight: 700; cursor: pointer;
          font-family: inherit; transition: background 0.18s;
        }
        .photos-empty-upload-btn:hover { background: #4f46e5; }

        /* ── Skeleton loader ── */
        .photos-skeleton-grid { columns: 4; column-gap: 16px; }
        .photos-skeleton-item {
          break-inside: avoid; margin-bottom: 16px; border-radius: 18px;
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── Upload Modal ── */
        .photos-modal-backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(6px);
          z-index: 9000;
          display: flex; align-items: flex-start; justify-content: center;
          /* Push modal above the floating nav bar (~80px) */
          padding: 24px 16px 90px 16px;
          overflow-y: auto;
          animation: lb-fade 0.2s ease;
        }

        .photos-modal {
          background: #fff;
          border-radius: 24px;
          width: 560px;
          max-width: calc(100vw - 32px);
          /* No overflow-y on the modal itself; backdrop scrolls */
          box-shadow: 0 40px 80px rgba(0,0,0,0.2);
          animation: lb-scale 0.25s cubic-bezier(0.34,1.56,0.64,1);
          display: flex;
          flex-direction: column;
          margin: auto;
        }

        .photos-modal-scrollarea {
          padding: 32px 32px 0 32px;
          flex: 1;
        }

        .photos-modal h3 {
          font-size: 20px; font-weight: 800; color: #0f172a;
          margin: 0 0 20px 0; letter-spacing: -0.02em;
        }

        .photos-modal-close {
          float: right; background: none; border: none;
          font-size: 20px; color: #94a3b8; cursor: pointer; margin-top: -4px;
          font-family: inherit; padding: 0; line-height: 1;
        }
        .photos-modal-close:hover { color: #ef4444; }

        /* Drop zone */
        .photos-dropzone {
          border: 2px dashed #cbd5e1;
          border-radius: 16px;
          padding: 32px 20px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.18s, background 0.18s;
          margin-bottom: 20px;
          background: #f8fafc;
          position: relative;
        }
        .photos-dropzone:hover, .photos-dropzone.drag-over {
          border-color: #6366f1; background: #eef2ff;
        }
        .photos-dropzone-preview {
          width: 100%; max-height: 200px; object-fit: cover;
          border-radius: 12px; display: block;
        }
        .photos-dropzone-hint {
          font-size: 14px; color: #64748b; font-weight: 500; margin: 8px 0 0 0;
          line-height: 1.5;
        }
        .photos-dropzone svg { color: #94a3b8; margin-bottom: 8px; }

        /* Multi-image Selection Bar & Previews Grid */
        .photos-selection-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #f1f5f9;
        }
        .photos-selection-count {
          font-size: 13px;
          font-weight: 700;
          color: #334155;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .photos-count-tag {
          background: #6366f1;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
        }
        .photos-max-limit-tag {
          background: #f59e0b;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
        }
        .photos-clear-all-btn {
          background: none;
          border: none;
          color: #ef4444;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: background 0.15s;
        }
        .photos-clear-all-btn:hover {
          background: #fef2f2;
        }

        .photos-previews-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }
        @media (max-width: 480px) {
          .photos-previews-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .photos-preview-card {
          position: relative;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
        }
        .photos-preview-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 10px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }
        .photos-preview-thumb-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          background: #0f172a;
          overflow: hidden;
        }
        .photos-preview-thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .photos-preview-order-badge {
          position: absolute;
          top: 5px;
          left: 5px;
          background: rgba(15, 23, 42, 0.75);
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 6px;
          backdrop-filter: blur(4px);
        }
        .photos-preview-remove-btn {
          position: absolute;
          top: 5px;
          right: 5px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.92);
          color: #fff;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
          padding: 0;
          transition: transform 0.15s, background 0.15s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.25);
        }
        .photos-preview-remove-btn:hover {
          background: #dc2626;
          transform: scale(1.15);
        }
        .photos-preview-info {
          padding: 6px 8px;
          background: #fff;
        }
        .photos-preview-name {
          font-size: 11px;
          font-weight: 600;
          color: #1e293b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
        }
        .photos-preview-size {
          font-size: 10px;
          color: #64748b;
          margin: 2px 0 0 0;
        }
        .photos-add-more-slot {
          border: 2px dashed #cbd5e1;
          border-radius: 12px;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          aspect-ratio: 1;
          gap: 3px;
          color: #64748b;
          transition: all 0.18s;
          padding: 8px;
          text-align: center;
        }
        .photos-add-more-slot:hover {
          border-color: #6366f1;
          background: #eef2ff;
          color: #4f46e5;
          transform: translateY(-2px);
        }
        .photos-add-more-icon {
          font-size: 20px;
          font-weight: 400;
          line-height: 1;
        }
        .photos-add-more-label {
          font-size: 11px;
          font-weight: 700;
        }
        .photos-add-more-sub {
          font-size: 9px;
          color: #94a3b8;
        }

        .photos-upload-meta-hint {
          font-size: 12px;
          color: #475569;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 12px;
          margin-top: 10px;
          line-height: 1.4;
        }

        .photos-upload-warning {
          background: #fffbeb;
          color: #92400e;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 600;
          margin-top: 12px;
          border: 1px solid #fde68a;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Form fields */
        .photos-form-group { margin-bottom: 16px; margin-top: 10px; }
        .photos-form-label {
          display: block; font-size: 12px; font-weight: 700; color: #374151;
          margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .photos-form-input, .photos-form-select {
          width: 100%; padding: 10px 14px; border: 1.5px solid #e5e7eb;
          border-radius: 10px; font-size: 14px; font-family: inherit;
          color: #111827; outline: none; box-sizing: border-box;
          transition: border-color 0.18s;
        }
        .photos-form-input:focus, .photos-form-select:focus { border-color: #6366f1; }

        .photos-folder-row { display: flex; gap: 10px; align-items: flex-start; }
        .photos-folder-row .photos-form-select { flex: 1; }
        .photos-folder-divider {
          font-size: 12px; color: #94a3b8; font-weight: 600;
          padding-top: 10px; white-space: nowrap;
        }
        .photos-folder-row .photos-form-input { flex: 1; }

        .photos-modal-footer {
          display: flex; gap: 10px; justify-content: flex-end;
          padding: 16px 32px 24px 32px;
          border-top: 1px solid #f1f5f9;
          background: #fff;
          border-radius: 0 0 24px 24px;
          flex-shrink: 0;
        }
        .photos-modal-cancel {
          padding: 10px 20px; border: 1.5px solid #e5e7eb; border-radius: 10px;
          background: #fff; font-size: 14px; font-weight: 600; color: #6b7280;
          cursor: pointer; font-family: inherit; transition: border-color 0.18s;
        }
        .photos-modal-cancel:hover { border-color: #94a3b8; }
        .photos-modal-submit {
          padding: 10px 24px; border: none; border-radius: 10px;
          background: #111827; color: #fff; font-size: 14px; font-weight: 700;
          cursor: pointer; font-family: inherit; transition: background 0.18s, transform 0.15s;
          display: flex; align-items: center; gap: 8px; min-width: 140px; justify-content: center;
        }
        .photos-modal-submit:hover:not(:disabled) { background: #1e293b; transform: translateY(-1px); }
        .photos-modal-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .photos-upload-error {
          background: #fef2f2; color: #b91c1c; border-radius: 10px;
          padding: 10px 14px; font-size: 13px; font-weight: 600;
          margin-top: 12px; border: 1px solid #fecaca;
        }

        .photos-upload-success {
          background: #f0fdf4; color: #15803d; border-radius: 10px;
          padding: 10px 14px; font-size: 13px; font-weight: 600;
          margin-top: 12px; border: 1px solid #bbf7d0;
          text-align: center;
        }

        /* Spinner */
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        /* ── Responsive ── */
        @media (max-width: 1080px) {
          .photos-masonry, .photos-skeleton-grid { columns: 3; }
        }
        @media (max-width: 768px) {
          .photos-root { padding: 24px 20px 110px 20px; }
          .photos-masonry, .photos-skeleton-grid { columns: 2; }
          .photos-section-title { font-size: 22px; }
        }
        @media (max-width: 480px) {
          .photos-root { padding: 16px 14px 110px 14px; }
          .photos-masonry, .photos-skeleton-grid { columns: 2; column-gap: 10px; }
          .photos-item { margin-bottom: 10px; border-radius: 14px; }
          .photos-item img { border-radius: 14px; }
          .photos-lightbox-img { max-width: 96vw; max-height: 70vh; border-radius: 12px; }
          .photos-lb-prev { left: 8px; }
          .photos-lb-next { right: 8px; }
          .photos-lightbox-close { top: 12px; right: 12px; }
          .photos-header { flex-wrap: wrap; gap: 10px; }
          .photos-modal-scrollarea { padding: 20px 20px 0 20px; }
          .photos-modal-footer { padding: 14px 20px 20px 20px; }
        }
      `}</style>

      {/* ── Top bar ── */}
      <header className="photos-header">
        <div className="photos-brand">
          <span>{getSessionUserName()} Photos</span>
          <span className="photos-badge">Gallery</span>
        </div>
        <div className="photos-header-right">
          <span className="photos-count-chip">{allPhotos.length} photos</span>
          <button className="photos-upload-btn" onClick={() => openUploadModal()} id="photos-upload-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload Photos
          </button>
        </div>
      </header>

      <h2 className="photos-section-title">
        {activeTab === 'all'
          ? 'All Photos'
          : activeTab === 'gallery'
          ? 'Gallery'
          : selectedFolder
          ? selectedFolder
          : 'Folders'}
      </h2>
      <p className="photos-section-sub">
        {activeTab === 'all'
          ? 'Explore your complete photo collection and albums.'
          : activeTab === 'gallery'
          ? 'Your default gallery photos.'
          : selectedFolder
          ? `Photos inside the "${selectedFolder}" folder.`
          : 'Organise your photos into custom folders.'}
      </p>

      {/* ── 3-tab folder bar: All | Gallery | Folders ── */}
      <div className="photos-folders">
        <button
          className={`photos-tab${activeTab === 'all' ? ' folder-active' : ''}`}
          onClick={() => { setActiveTab('all'); setSelectedFolder(null); }}
          id="tab-all"
        >
          All
        </button>

        <button
          className={`photos-tab${activeTab === 'gallery' ? ' folder-active' : ''}`}
          onClick={() => { setActiveTab('gallery'); setSelectedFolder(null); }}
          id="tab-gallery"
        >
          Gallery
        </button>

        <button
          className={`photos-tab${activeTab === 'folders' ? ' folder-active' : ''}`}
          onClick={() => { setActiveTab('folders'); }}
          id="tab-folders"
        >
          📁 Folders {userFolders.length > 0 ? `(${userFolders.length})` : ''}
        </button>
      </div>

      {/* ── Main Content Area ── */}
      {loading ? (
        <div className="photos-skeleton-grid">
          {[180, 240, 160, 200, 220, 180, 260, 190].map((h, i) => (
            <div key={i} className="photos-skeleton-item" style={{ height: h }} />
          ))}
        </div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════
              CASE 1: Folders tab (Hub view - no folder selected)
             ══════════════════════════════════════════════════════ */}
          {activeTab === 'folders' && !selectedFolder && (
            <div className="photos-folders-view">
              <div className="photos-all-folders-header">
                <div className="photos-all-folders-title-wrap">
                  <h3 className="photos-all-folders-title">My Folders</h3>
                  <span className="photos-all-folders-badge">{userFolders.length} folders</span>
                </div>
                <button
                  className="photos-all-folders-new-btn"
                  onClick={() => { setCreateFolderOpen(true); setCreateFolderName(''); }}
                  id="folders-create-btn"
                >
                  + Create Folder
                </button>
              </div>

              <div className="photos-folders-grid">
                {userFolders.map((fName) => {
                  const fPhotos = allPhotos.filter((p) => p.folder === fName);
                  const cover = fPhotos[0]?.thumb;
                  return (
                    <div
                      key={fName}
                      className="photos-folder-card"
                      onClick={() => setSelectedFolder(fName)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedFolder(fName)}
                      title={`Open "${fName}" folder`}
                    >
                      {cover ? (
                        <img src={cover} className="photos-folder-card-thumb" alt={fName} loading="lazy" />
                      ) : (
                        <div className="photos-folder-card-placeholder">📁</div>
                      )}
                      <div className="photos-folder-card-body">
                        <div className="photos-folder-card-info">
                          <p className="photos-folder-card-name">📁 {fName}</p>
                          <p className="photos-folder-card-count">
                            {fPhotos.length} {fPhotos.length === 1 ? 'photo' : 'photos'}
                          </p>
                        </div>
                        <button
                          className="photos-folder-card-del-btn"
                          onClick={(e) => handleDeleteFolder(fName, e)}
                          title={`Delete "${fName}" folder`}
                          aria-label={`Delete "${fName}" folder`}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* + Create Folder card */}
                <div
                  className="photos-folder-card-create"
                  onClick={() => { setCreateFolderOpen(true); setCreateFolderName(''); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && (setCreateFolderOpen(true), setCreateFolderName(''))}
                  title="Create a new folder"
                >
                  <div className="photos-folder-card-create-icon">+</div>
                  <span>Create Folder</span>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              CASE 2: Folders tab (Inside a specific folder)
             ══════════════════════════════════════════════════════ */}
          {activeTab === 'folders' && selectedFolder && (
            <div className="photos-inside-folder-view">
              <div className="photos-folder-view-header">
                <div className="photos-folder-view-left">
                  <button
                    className="photos-folder-back-btn"
                    onClick={() => setSelectedFolder(null)}
                    id="folder-back-btn"
                  >
                    ← Back to Folders
                  </button>
                  <h3 className="photos-folder-view-title">
                    📁 {selectedFolder}
                  </h3>
                  <span className="photos-folder-view-badge">
                    {displayedPhotos.length} {displayedPhotos.length === 1 ? 'photo' : 'photos'}
                  </span>
                </div>
                <div className="photos-folder-view-actions">
                  <button
                    className="photos-folder-upload-btn"
                    onClick={() => openUploadModal(selectedFolder)}
                  >
                    + Upload to {selectedFolder}
                  </button>
                  <button
                    className="photos-folder-del-btn"
                    onClick={(e) => handleDeleteFolder(selectedFolder, e)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                    Delete Folder
                  </button>
                </div>
              </div>

              {displayedPhotos.length === 0 ? (
                <div className="photos-empty">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <p>This folder is empty. Upload your first photo to "{selectedFolder}"!</p>
                  <button
                    className="photos-empty-upload-btn"
                    onClick={() => openUploadModal(selectedFolder)}
                  >
                    + Upload Photo
                  </button>
                </div>
              ) : (
                <div className="photos-masonry">
                  {displayedPhotos.map((photo, idx) => (
                    <div
                      key={photo._id}
                      className="photos-item"
                      onClick={() => openLightbox(photo, idx)}
                      title={photo.title}
                      role="button"
                      aria-label={`View ${photo.title}`}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && openLightbox(photo, idx)}
                      style={{ position: 'relative' }}
                    >
                      <img src={photo.thumb} alt={photo.title} loading="lazy" />
                      {/* 3-dots menu button */}
                      <button
                        className={`photos-item-menu-btn${menuOpenId === photo._id ? ' open' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === photo._id ? null : photo._id); }}
                        title="Options"
                        aria-label="Photo options"
                      >
                        ···
                      </button>
                      {menuOpenId === photo._id && (
                        <div className="photos-item-dropdown" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="photos-dropdown-item"
                            onClick={() => { setMenuOpenId(null); setMovePhoto(photo); setMoveToFolder(''); }}
                          >
                            📂 Move to Folder
                          </button>
                          <button
                            className="photos-dropdown-item danger"
                            onClick={(e) => handleDelete(photo, e)}
                            disabled={deleteLoading === photo._id}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            {deleteLoading === photo._id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      )}
                      <div className="photos-item-overlay">
                        <p className="photos-item-title">{photo.title}</p>
                        <p className="photos-item-date">{photo.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              CASE 3: Gallery tab (default folder only)
             ══════════════════════════════════════════════════════ */}
          {activeTab === 'gallery' && (
            displayedPhotos.length === 0 ? (
              <div className="photos-empty">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p>No photos in Gallery yet.</p>
                <button className="photos-empty-upload-btn" onClick={() => openUploadModal('gallery')}>
                  + Upload Image
                </button>
              </div>
            ) : (
              <div className="photos-masonry">
                {displayedPhotos.map((photo, idx) => (
                  <div
                    key={photo._id}
                    className="photos-item"
                    onClick={() => openLightbox(photo, idx)}
                    title={photo.title}
                    role="button"
                    aria-label={`View ${photo.title}`}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && openLightbox(photo, idx)}
                    style={{ position: 'relative' }}
                  >
                    <img src={photo.thumb} alt={photo.title} loading="lazy" />
                    {/* 3-dots menu button */}
                    <button
                      className={`photos-item-menu-btn${menuOpenId === photo._id ? ' open' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === photo._id ? null : photo._id); }}
                      title="Options"
                      aria-label="Photo options"
                    >
                      ···
                    </button>
                    {menuOpenId === photo._id && (
                      <div className="photos-item-dropdown" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="photos-dropdown-item"
                          onClick={() => { setMenuOpenId(null); setMovePhoto(photo); setMoveToFolder(''); }}
                        >
                          📂 Move to Folder
                        </button>
                        <button
                          className="photos-dropdown-item danger"
                          onClick={(e) => handleDelete(photo, e)}
                          disabled={deleteLoading === photo._id}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          {deleteLoading === photo._id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    )}
                    <div className="photos-item-overlay">
                      <p className="photos-item-title">{photo.title}</p>
                      <p className="photos-item-date">{photo.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* ══════════════════════════════════════════════════════
              CASE 4: All tab (All photos + Created Folders section below)
             ══════════════════════════════════════════════════════ */}
          {activeTab === 'all' && (
            <>
              {allPhotos.length === 0 ? (
                <div className="photos-empty">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <p>No photos yet. Create a folder or upload your first photo!</p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      className="photos-empty-upload-btn"
                      style={{ background: '#6366f1' }}
                      onClick={() => { setCreateFolderOpen(true); setCreateFolderName(''); }}
                    >
                      📁 Create Folder
                    </button>
                    <button
                      className="photos-empty-upload-btn"
                      onClick={() => openUploadModal('gallery')}
                    >
                      + Upload Image
                    </button>
                  </div>
                </div>
              ) : (
                <div className="photos-masonry">
                  {allPhotos.map((photo, idx) => (
                    <div
                      key={photo._id}
                      className="photos-item"
                      onClick={() => openLightbox(photo, idx)}
                      title={photo.title}
                      role="button"
                      aria-label={`View ${photo.title}`}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && openLightbox(photo, idx)}
                      style={{ position: 'relative' }}
                    >
                      <img src={photo.thumb} alt={photo.title} loading="lazy" />
                      {photo.folder && photo.folder !== 'gallery' && (
                        <span className="photos-item-folder-badge">📁 {photo.folder}</span>
                      )}
                      {/* 3-dots menu button */}
                      <button
                        className={`photos-item-menu-btn${menuOpenId === photo._id ? ' open' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === photo._id ? null : photo._id); }}
                        title="Options"
                        aria-label="Photo options"
                      >
                        ···
                      </button>
                      {menuOpenId === photo._id && (
                        <div className="photos-item-dropdown" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="photos-dropdown-item"
                            onClick={() => { setMenuOpenId(null); setMovePhoto(photo); setMoveToFolder(''); }}
                          >
                            📂 Move to Folder
                          </button>
                          <button
                            className="photos-dropdown-item danger"
                            onClick={(e) => handleDelete(photo, e)}
                            disabled={deleteLoading === photo._id}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            {deleteLoading === photo._id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      )}
                      <div className="photos-item-overlay">
                        <p className="photos-item-title">{photo.title}</p>
                        <p className="photos-item-date">{photo.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── After that image: Created Folders Section ── */}
              <div className="photos-all-folders-section">
                <div className="photos-all-folders-header">
                  <div className="photos-all-folders-title-wrap">
                    <h3 className="photos-all-folders-title">📁 Created Folders</h3>
                    <span className="photos-all-folders-badge">{userFolders.length} folders</span>
                  </div>
                  <button
                    className="photos-all-folders-new-btn"
                    onClick={() => { setCreateFolderOpen(true); setCreateFolderName(''); }}
                    id="all-create-folder-btn"
                  >
                    + New Folder
                  </button>
                </div>

                <div className="photos-folders-grid">
                  {userFolders.map((fName) => {
                    const fPhotos = allPhotos.filter((p) => p.folder === fName);
                    const cover = fPhotos[0]?.thumb;
                    return (
                      <div
                        key={fName}
                        className="photos-folder-card"
                        onClick={() => { setActiveTab('folders'); setSelectedFolder(fName); }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && (setActiveTab('folders'), setSelectedFolder(fName))}
                        title={`Open "${fName}" folder`}
                      >
                        {cover ? (
                          <img src={cover} className="photos-folder-card-thumb" alt={fName} loading="lazy" />
                        ) : (
                          <div className="photos-folder-card-placeholder">📁</div>
                        )}
                        <div className="photos-folder-card-body">
                          <div className="photos-folder-card-info">
                            <p className="photos-folder-card-name">📁 {fName}</p>
                            <p className="photos-folder-card-count">
                              {fPhotos.length} {fPhotos.length === 1 ? 'photo' : 'photos'}
                            </p>
                          </div>
                          <button
                            className="photos-folder-card-del-btn"
                            onClick={(e) => handleDeleteFolder(fName, e)}
                            title={`Delete "${fName}" folder`}
                            aria-label={`Delete "${fName}" folder`}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <div
                    className="photos-folder-card-create"
                    onClick={() => { setCreateFolderOpen(true); setCreateFolderName(''); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && (setCreateFolderOpen(true), setCreateFolderName(''))}
                    title="Create a new folder"
                  >
                    <div className="photos-folder-card-create-icon">+</div>
                    <span>Create Folder</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Lightbox ── */}
      {lightboxPhoto && (
        <div
          className="photos-lightbox-overlay"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label={`Viewing: ${lightboxPhoto.title}`}
        >
          <button className="photos-lightbox-close" onClick={closeLightbox} title="Close (Esc)" aria-label="Close lightbox">✕</button>

          {displayedPhotos.length > 1 && (
            <>
              <button className="photos-lb-nav photos-lb-prev" onClick={lightboxPrev} title="Previous (←)" aria-label="Previous photo">‹</button>
              <button className="photos-lb-nav photos-lb-next" onClick={lightboxNext} title="Next (→)" aria-label="Next photo">›</button>
            </>
          )}

          <div className="photos-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <img className="photos-lightbox-img" src={lightboxPhoto.url} alt={lightboxPhoto.title} />
            <div className="photos-lightbox-info">
              <h3 className="photos-lightbox-title">{lightboxPhoto.title}</h3>
              <p className="photos-lightbox-date">{lightboxPhoto.date}</p>
            </div>
          </div>

          {displayedPhotos.length > 1 && (
            <div className="photos-lb-counter" aria-live="polite">
              {lightboxIdx + 1} / {displayedPhotos.length}
            </div>
          )}
        </div>
      )}

      {/* ── Upload Modal (Up to 5 images) ── */}
      {uploadOpen && (
        <div className="photos-modal-backdrop" onClick={closeUploadModal}>
          <div className="photos-modal" onClick={(e) => e.stopPropagation()}>

            {/* -- Scrollable form area -- */}
            <div className="photos-modal-scrollarea">
              <h3>
                Upload Images
                {pendingFolder && pendingFolder !== 'gallery' && (
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#6366f1', marginLeft: '8px', verticalAlign: 'middle' }}>
                    📁 {pendingFolder}
                  </span>
                )}
                <button className="photos-modal-close" onClick={closeUploadModal} aria-label="Close upload modal">✕</button>
              </h3>

              {/* Hidden file input supporting multiple images */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                onChange={onFileChange}
                id="photos-file-input"
              />

              {/* If no files selected yet, show full dropzone */}
              {selectedFiles.length === 0 ? (
                <div
                  className={`photos-dropzone${isDragOver ? ' drag-over' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  id="photos-dropzone"
                >
                  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <p className="photos-dropzone-hint">
                    <strong style={{ color: '#1e293b' }}>Click or drag & drop images here</strong><br/>
                    <span style={{ color: '#4f46e5', fontWeight: '600', fontSize: '13px' }}>Select up to 5 images at a time</span><br/>
                    <small style={{ color: '#94a3b8' }}>JPG, PNG, WebP, GIF, HEIC · Max 20 MB each</small>
                  </p>
                </div>
              ) : (
                /* Selected files grid & management */
                <div>
                  <div className="photos-selection-bar">
                    <div className="photos-selection-count">
                      <span>Selected Photos</span>
                      <span className={selectedFiles.length >= 5 ? 'photos-max-limit-tag' : 'photos-count-tag'}>
                        {selectedFiles.length} / 5 {selectedFiles.length >= 5 ? '(Max)' : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="photos-clear-all-btn"
                      onClick={clearSelectedFiles}
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="photos-previews-grid">
                    {selectedFiles.map((item, idx) => (
                      <div key={item.id} className="photos-preview-card">
                        <div className="photos-preview-thumb-wrap">
                          <img src={item.previewUrl} alt={item.name} className="photos-preview-thumb" />
                          <span className="photos-preview-order-badge">#{idx + 1}</span>
                          <button
                            type="button"
                            className="photos-preview-remove-btn"
                            onClick={() => removeFile(item.id)}
                            title="Remove image"
                            aria-label={`Remove image ${item.name}`}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="photos-preview-info">
                          <p className="photos-preview-name" title={item.name}>{item.name}</p>
                          <p className="photos-preview-size">{item.size}</p>
                        </div>
                      </div>
                    ))}

                    {/* Add More slot if less than 5 */}
                    {selectedFiles.length < 5 && (
                      <div
                        className="photos-add-more-slot"
                        onClick={() => fileInputRef.current?.click()}
                        title="Add more images"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                      >
                        <span className="photos-add-more-icon">+</span>
                        <span className="photos-add-more-label">Add More</span>
                        <span className="photos-add-more-sub">{5 - selectedFiles.length} slot{5 - selectedFiles.length > 1 ? 's' : ''} left</span>
                      </div>
                    )}
                  </div>

                  {/* Optional title for single image */}
                  {selectedFiles.length === 1 && (
                    <div className="photos-form-group">
                      <label className="photos-form-label" htmlFor="photos-single-title">Photo Title (Optional)</label>
                      <input
                        id="photos-single-title"
                        className="photos-form-input"
                        type="text"
                        placeholder="e.g. Sunset in Paris"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Note for multiple images */}
                  {selectedFiles.length > 1 && (
                    <div className="photos-upload-meta-hint">
                      📁 Destination: <strong>{pendingFolder}</strong>. All {selectedFiles.length} images will be saved using their original filenames.
                    </div>
                  )}
                </div>
              )}

              {/* Status & warning messages */}
              {uploadWarning && (
                <div className="photos-upload-warning">
                  <span>ℹ️</span>
                  <span>{uploadWarning}</span>
                </div>
              )}
              {uploadingState === 'error' && (
                <div className="photos-upload-error">⚠️ {uploadError}</div>
              )}
              {uploadingState === 'success' && (
                <div className="photos-upload-success">
                  ✅ {selectedFiles.length === 1 ? 'Image' : `${selectedFiles.length} images`} uploaded successfully!
                </div>
              )}

            </div>
            {/* ── end scrollarea ── */}

            {/* ── Sticky footer – always visible ── */}
            <div className="photos-modal-footer">
              <button className="photos-modal-cancel" onClick={closeUploadModal}>Cancel</button>
              <button
                className="photos-modal-submit"
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || uploadingState === 'uploading' || uploadingState === 'success'}
                id="photos-submit-upload"
              >
                {uploadingState === 'uploading' ? (
                  <><div className="spinner" /> Uploading {selectedFiles.length} {selectedFiles.length === 1 ? 'image' : 'images'}…</>
                ) : uploadingState === 'success' ? (
                  `✓ Uploaded!`
                ) : (
                  selectedFiles.length === 0
                    ? 'Upload Images'
                    : `Upload ${selectedFiles.length} Image${selectedFiles.length > 1 ? 's' : ''}`
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* -- Create Folder mini-modal -- */}
      {createFolderOpen && (
        <div className="photos-cf-backdrop" onClick={() => setCreateFolderOpen(false)}>
          <div className="photos-cf-modal" onClick={(e) => e.stopPropagation()}>
            <h4>📁 Create Folder</h4>
            <p>Give your folder a name. You can upload photos into it after.</p>
            <input
              className="photos-form-input"
              type="text"
              placeholder="e.g. Travel, Family, Work…"
              value={createFolderName}
              onChange={(e) => setCreateFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              autoFocus
              id="cf-folder-name-input"
            />
            <div className="photos-cf-actions">
              <button className="photos-cf-cancel" onClick={() => setCreateFolderOpen(false)}>Cancel</button>
              <button
                className="photos-cf-next"
                onClick={handleCreateFolder}
                disabled={!createFolderName.trim()}
                id="cf-next-btn"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Folder modal */}
      {movePhoto && (
        <div className="photos-cf-backdrop" onClick={() => setMovePhoto(null)}>
          <div className="photos-cf-modal" onClick={(e) => e.stopPropagation()}>
            <h4>📂 Move to Folder</h4>
            <p>Select destination for <strong style={{color:'#111827'}}>"{movePhoto.title}"</strong></p>
            <select
              className="photos-form-input"
              value={moveToFolder}
              onChange={(e) => setMoveToFolder(e.target.value)}
              style={{marginTop:'4px'}}
            >
              <option value="">Select folder…</option>
              {['gallery', ...userFolders]
                .filter((f) => f !== (movePhoto.folder || 'gallery'))
                .map((f) => (
                  <option key={f} value={f}>
                    {f === 'gallery' ? 'Gallery (default)' : `📁 ${f}`}
                  </option>
                ))}
            </select>
            <div className="photos-cf-actions">
              <button className="photos-cf-cancel" onClick={() => setMovePhoto(null)}>Cancel</button>
              <button
                className="photos-cf-next"
                onClick={handleMove}
                disabled={!moveToFolder || moveLoading}
              >
                {moveLoading ? 'Moving…' : 'Move →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
