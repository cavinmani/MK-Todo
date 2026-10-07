const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://mk-todo-a6x0.onrender.com/api';
const API_BASE_URL = rawBaseUrl.endsWith('/api') ? rawBaseUrl.replace(/\/+$/, '') : `${rawBaseUrl.replace(/\/+$/, '')}/api`;

// Get the logged-in user's email from localStorage session
function getSessionEmail() {
  try {
    const raw = localStorage.getItem('mk_session_user');
    if (raw) {
      const u = JSON.parse(raw);
      return u?.email || null;
    }
  } catch (_) {}
  return null;
}

// Generic fetch helper with timeout (30s to accommodate Render free-tier cold starts)
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    config.signal = controller.signal;
    const response = await fetch(url, config);
    clearTimeout(timeoutId);
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn(`[API] Network error calling ${endpoint}:`, error.message);
    return null;
  }
}

// ─── Health ───────────────────────────────────────────────
export async function getHealthStatus() {
  return await apiRequest('/health');
}

// ─── Authentication ────────────────────────────────────────
export async function loginUser(identifier, password) {
  return await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

export async function registerUser({ name, username, email, password }) {
  return await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, username, email, password }),
  });
}

// Returns: true = available, false = taken, null = API error / unknown
export async function checkUsernameAvailable(username) {
  const res = await apiRequest('/auth/check-username', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
  if (res === null || res === undefined) return null;
  if (typeof res.available === 'boolean') return res.available;
  return null;
}

// ─── Folders ───────────────────────────────────────────────
export async function fetchFolders(category) {
  const email = getSessionEmail();
  if (!email) return [];
  const query = `?userEmail=${encodeURIComponent(email)}${category ? `&category=${encodeURIComponent(category)}` : ''}`;
  const res = await apiRequest(`/folders${query}`);
  return res?.data ?? [];
}

export async function createFolderApi(folderData) {
  const email = getSessionEmail();
  if (!email) return null;
  const res = await apiRequest('/folders', {
    method: 'POST',
    body: JSON.stringify({ ...folderData, userEmail: email }),
  });
  return res?.data ?? null;
}

export async function deleteFolderApi(folderId) {
  const res = await apiRequest(`/folders/${folderId}`, { method: 'DELETE' });
  return res?.success ?? false;
}

// ─── Notes ─────────────────────────────────────────────────
export async function fetchNotes(params = {}) {
  const email = getSessionEmail();
  if (!email) return [];
  const queryParts = [`userEmail=${encodeURIComponent(email)}`];
  if (params.folderId !== undefined) queryParts.push(`folderId=${encodeURIComponent(params.folderId || '')}`);
  if (params.category) queryParts.push(`category=${encodeURIComponent(params.category)}`);
  if (params.month !== undefined) queryParts.push(`month=${encodeURIComponent(params.month)}`);
  if (params.year !== undefined) queryParts.push(`year=${encodeURIComponent(params.year)}`);

  const res = await apiRequest(`/notes?${queryParts.join('&')}`);
  return res?.data ?? [];
}

export async function createNoteApi(noteData) {
  const email = getSessionEmail();
  if (!email) return null;
  const res = await apiRequest('/notes', {
    method: 'POST',
    body: JSON.stringify({ ...noteData, userEmail: email }),
  });
  return res?.data ?? null;
}

export async function updateNoteApi(noteId, updateData) {
  const res = await apiRequest(`/notes/${noteId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
  return res?.data ?? null;
}

export async function deleteNoteApi(noteId) {
  const res = await apiRequest(`/notes/${noteId}`, { method: 'DELETE' });
  return res?.success ?? false;
}


// ─── Events ────────────────────────────────────────────────
export async function fetchEvents() {
  const email = getSessionEmail();
  if (!email) return [];
  const res = await apiRequest(`/events?userEmail=${encodeURIComponent(email)}`);
  return res?.data ?? [];
}

export async function createEventApi(eventData) {
  const email = getSessionEmail();
  if (!email) return null;
  const res = await apiRequest('/events', {
    method: 'POST',
    body: JSON.stringify({ ...eventData, userEmail: email }),
  });
  return res?.data ?? null;
}

export async function deleteEventApi(eventId) {
  const res = await apiRequest(`/events/${eventId}`, { method: 'DELETE' });
  return res?.success ?? false;
}

// ─── Photos (Cloudinary Gallery) ───────────────────────────
export async function fetchPhotos({ folder, category } = {}) {
  const email = getSessionEmail();
  if (!email) return [];
  const params = new URLSearchParams({ userEmail: email });
  if (folder && folder !== 'all') params.append('folder', folder);
  if (category && category !== 'all') params.append('category', category);
  const res = await apiRequest(`/photos?${params.toString()}`);
  return res?.data ?? [];
}

export async function fetchPhotoFolders() {
  const email = getSessionEmail();
  if (!email) return [];
  const res = await apiRequest(`/photo-folders?userEmail=${encodeURIComponent(email)}`);
  return res?.data ?? [];
}

export async function createPhotoFolderApi(name) {
  const email = getSessionEmail();
  if (!email) return null;
  const res = await apiRequest('/photo-folders', {
    method: 'POST',
    body: JSON.stringify({ userEmail: email, name }),
  });
  return res?.success ?? false;
}

export async function deletePhotoFolderApi(name) {
  const email = getSessionEmail();
  if (!email) return false;
  const res = await apiRequest(`/photo-folders/${encodeURIComponent(name)}?userEmail=${encodeURIComponent(email)}`, {
    method: 'DELETE',
  });
  return res?.success ?? false;
}

export async function movePhotoApi(photoId, folder) {
  const res = await apiRequest(`/photos/${photoId}/move`, {
    method: 'PUT',
    body: JSON.stringify({ folder }),
  });
  return res?.success ?? false;
}

/**
 * Upload photos to Cloudinary via the backend (max 5 images at a time).
 * @param {File|File[]|FileList} fileOrFiles
 * @param {object} meta  - { title, category, folder }
 */
export async function uploadPhoto(fileOrFiles, meta = {}) {
  const email = getSessionEmail();
  if (!email) return null;
  const form = new FormData();

  const files = Array.isArray(fileOrFiles)
    ? fileOrFiles
    : (fileOrFiles instanceof FileList ? Array.from(fileOrFiles) : [fileOrFiles]).filter(Boolean);

  if (files.length === 0) return null;
  if (files.length > 5) {
    return { success: false, message: 'Maximum 5 images allowed at a time.' };
  }

  files.forEach((f) => {
    form.append('images', f);
  });

  form.append('userEmail', email);
  if (meta.title && files.length === 1) form.append('title', meta.title);
  if (meta.category) form.append('category', meta.category);
  if (meta.folder)   form.append('folder', meta.folder);

  const url = `${API_BASE_URL}/photos/upload`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for multiple large files
    const response = await fetch(url, {
      method: 'POST',
      body: form, // No Content-Type header – browser sets it with boundary
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return await response.json();
  } catch (error) {
    console.warn('[API] Upload error:', error.message);
    return { success: false, message: error.message || 'Upload failed' };
  }
}

export const uploadPhotos = uploadPhoto;

export async function deletePhotoApi(photoId) {
  const res = await apiRequest(`/photos/${photoId}`, { method: 'DELETE' });
  return res?.success ?? false;
}

