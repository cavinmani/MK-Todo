import express from 'express';
import PhotoFolder from '../models/PhotoFolder.js';
import Photo from '../models/Photo.js';

const router = express.Router();

/* ──────────────────────────────────────────────────────────
   GET /api/photo-folders?userEmail=...
   Returns merged list: manually-created folders + folders derived from photos
────────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const { userEmail } = req.query;
    if (!userEmail) return res.status(400).json({ success: false, message: 'userEmail required' });

    const email = userEmail.toLowerCase();

    // Folders created explicitly
    const created = await PhotoFolder.find({ userEmail: email }).sort({ createdAt: 1 });
    const createdNames = created.map(f => f.name);

    // Folders derived from existing photos
    const derived = await Photo.distinct('folder', { userEmail: email });

    // Merge & deduplicate
    const all = [...new Set([...createdNames, ...derived.filter(Boolean)])];

    res.json({ success: true, data: all });
  } catch (err) {
    console.error('[PhotoFolders] GET error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ──────────────────────────────────────────────────────────
   POST /api/photo-folders
   Create an empty folder
   Body: { userEmail, name }
────────────────────────────────────────────────────────── */
router.post('/', async (req, res) => {
  try {
    const { userEmail, name } = req.body;
    if (!userEmail || !name) return res.status(400).json({ success: false, message: 'userEmail and name required' });

    const folder = await PhotoFolder.findOneAndUpdate(
      { userEmail: userEmail.toLowerCase(), name: name.trim() },
      { userEmail: userEmail.toLowerCase(), name: name.trim() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ success: true, data: folder });
  } catch (err) {
    console.error('[PhotoFolders] POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ──────────────────────────────────────────────────────────
   DELETE /api/photo-folders/:name?userEmail=...
   Delete folder record (photos inside are NOT deleted)
────────────────────────────────────────────────────────── */
router.delete('/:name', async (req, res) => {
  try {
    const { userEmail } = req.query;
    const { name } = req.params;
    if (!userEmail) return res.status(400).json({ success: false, message: 'userEmail required' });

    await PhotoFolder.deleteOne({ userEmail: userEmail.toLowerCase(), name });
    res.json({ success: true });
  } catch (err) {
    console.error('[PhotoFolders] DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
