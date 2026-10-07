import express from 'express';
import Folder from '../models/Folder.js';

const router = express.Router();

// GET /api/folders?userEmail=xxx&category=xxx
router.get('/', async (req, res) => {
  try {
    const { userEmail, category } = req.query;
    if (!userEmail) return res.status(400).json({ success: false, message: 'userEmail is required.' });

    const query = { userEmail: userEmail.toLowerCase().trim() };
    if (category) query.category = category;

    const folders = await Folder.find(query).sort({ createdAt: 1 });
    return res.json({ success: true, count: folders.length, data: folders });
  } catch (error) {
    console.error('[Folders GET]', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/folders
router.post('/', async (req, res) => {
  try {
    const { title, bgColor, iconColor, flapColor, category, date, userEmail } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Folder title is required.' });
    if (!userEmail) return res.status(400).json({ success: false, message: 'userEmail is required.' });

    const newFolder = await Folder.create({
      title,
      bgColor: bgColor || '#e9f2fe',
      iconColor: iconColor || '#8c8bf6',
      flapColor: flapColor || '#7674ea',
      category: category || 'This Week',
      date: date || new Date().toLocaleDateString('en-GB'),
      userEmail: userEmail.toLowerCase().trim(),
    });
    return res.status(201).json({ success: true, data: newFolder });
  } catch (error) {
    console.error('[Folders POST]', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/folders/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await Folder.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Folder not found.' });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/folders/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Folder.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Folder not found.' });
    return res.json({ success: true, message: 'Folder deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export const seedDefaultFolders = async () => {}; // no-op: seed removed
export default router;
