import express from 'express';
import Note from '../models/Note.js';

const router = express.Router();

// GET /api/notes?userEmail=xxx&folderId=xxx&category=xxx&month=x&year=x
router.get('/', async (req, res) => {
  try {
    const { userEmail, folderId, category, month, year } = req.query;
    if (!userEmail) return res.status(400).json({ success: false, message: 'userEmail is required.' });

    const query = { userEmail: userEmail.toLowerCase().trim() };
    if (folderId !== undefined) {
      query.folderId = folderId === 'null' || folderId === '' ? null : folderId;
    }
    if (category) query.category = category;
    if (month !== undefined) query.month = Number(month);
    if (year !== undefined) query.year = Number(year);

    const notes = await Note.find(query).sort({ createdAt: -1 });
    return res.json({ success: true, count: notes.length, data: notes });
  } catch (error) {
    console.error('[Notes GET]', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/notes
router.post('/', async (req, res) => {
  try {
    const { title, content, date, time, bgColor, category, folderId, tag, month, year, userEmail } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Note title is required.' });
    if (!userEmail) return res.status(400).json({ success: false, message: 'userEmail is required.' });

    const newNote = await Note.create({
      title,
      content: content || '',
      date: date || new Date().toLocaleDateString('en-GB'),
      time: time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      bgColor: bgColor || '#ece57a',
      category: category || 'Todays',
      folderId: folderId || null,
      tag: tag || '',
      month: month !== undefined ? Number(month) : new Date().getMonth(),
      year: year !== undefined ? Number(year) : new Date().getFullYear(),
      userEmail: userEmail.toLowerCase().trim(),
    });
    return res.status(201).json({ success: true, data: newNote });
  } catch (error) {
    console.error('[Notes POST]', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/notes/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await Note.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Note not found.' });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Note.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Note not found.' });
    return res.json({ success: true, message: 'Note deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export const seedDefaultNotes = async () => {}; // no-op: seed removed
export default router;
