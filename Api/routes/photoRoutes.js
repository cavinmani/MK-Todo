import express from 'express';
import Photo from '../models/Photo.js';
import { createCloudinaryUpload, cloudinary } from '../config/cloudinary.js';

const router = express.Router();

// Multer middleware – folder comes from req.body.folder at upload time
const upload = createCloudinaryUpload('gallery');

/* ──────────────────────────────────────────────────────────
   GET  /api/photos?userEmail=...&folder=...&category=...
   List all photos for a user, optionally filtered
────────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const { userEmail, folder, category } = req.query;
    if (!userEmail) return res.status(400).json({ success: false, message: 'userEmail required' });

    const filter = { userEmail: userEmail.toLowerCase() };
    if (folder && folder !== 'all') filter.folder = folder;
    if (category && category !== 'all') filter.category = category;

    const photos = await Photo.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: photos });
  } catch (err) {
    console.error('[Photos] GET error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ──────────────────────────────────────────────────────────
   GET  /api/photos/folders?userEmail=...
   List all distinct folder names the user has
────────────────────────────────────────────────────────── */
router.get('/folders', async (req, res) => {
  try {
    const { userEmail } = req.query;
    if (!userEmail) return res.status(400).json({ success: false, message: 'userEmail required' });

    const folders = await Photo.distinct('folder', { userEmail: userEmail.toLowerCase() });
    res.json({ success: true, data: folders });
  } catch (err) {
    console.error('[Photos] GET /folders error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ──────────────────────────────────────────────────────────
   POST /api/photos/upload
   Upload up to 5 images to Cloudinary and save metadata to MongoDB
   Body (multipart/form-data):
     - images     : file(s) (max 5)
     - image      : file (legacy fallback)
     - userEmail  : string
     - title      : string (optional, applied if 1 image)
     - category   : string (optional)
     - folder     : string (cloudinary sub-folder, e.g. "nature")
────────────────────────────────────────────────────────── */
router.post('/upload', (req, res) => {
  // Use upload.any() to accept all image files (under 'images', 'image', etc.)
  upload.any()(req, res, async (err) => {
    if (err) {
      console.error('[Photos] Multer error:', err);
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ success: false, message: 'Maximum 5 images allowed at a time.' });
      }
      return res.status(400).json({ success: false, message: err.message });
    }

    const files = req.files || [];

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    if (files.length > 5) {
      return res.status(400).json({ success: false, message: 'Maximum 5 images allowed at a time.' });
    }

    try {
      const { userEmail, title, category, folder } = req.body;
      if (!userEmail) return res.status(400).json({ success: false, message: 'userEmail required' });

      // Format date as "25 Sep 2026"
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      const createdPhotos = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Cloudinary gives us the full URL in file.path
        const cloudUrl = file.path;
        const publicId = file.filename;

        // Build a thumbnail URL at 300px width using Cloudinary transformations
        const thumbUrl = cloudinary.url(publicId, {
          width: 300,
          crop: 'fill',
          quality: 'auto',
          fetch_format: 'auto',
        });

        // Use custom title for single image if provided, otherwise clean file name without extension
        const itemTitle = (files.length === 1 && title && title.trim())
          ? title.trim()
          : (file.originalname ? file.originalname.replace(/\.[^.]+$/, '') : 'Untitled');

        const photo = await Photo.create({
          userEmail: userEmail.toLowerCase(),
          title: itemTitle || 'Untitled',
          category: category || 'all',
          folder: folder || 'gallery',
          publicId,
          url: cloudUrl,
          thumb: thumbUrl,
          date: dateStr,
        });

        createdPhotos.push(photo);
      }

      res.status(201).json({
        success: true,
        data: createdPhotos,
        photo: createdPhotos[0],
        count: createdPhotos.length,
        message: `${createdPhotos.length} image${createdPhotos.length > 1 ? 's' : ''} uploaded successfully`,
      });
    } catch (dbErr) {
      console.error('[Photos] DB error after upload:', dbErr);
      res.status(500).json({ success: false, message: dbErr.message });
    }
  });
});

/* ──────────────────────────────────────────────────────────
   PUT /api/photos/:id/move
   Move a photo to a different folder (metadata only)
   Body: { folder }
────────────────────────────────────────────────────────── */
router.put('/:id/move', async (req, res) => {
  try {
    const { folder } = req.body;
    if (!folder) return res.status(400).json({ success: false, message: 'folder required' });

    const photo = await Photo.findByIdAndUpdate(
      req.params.id,
      { folder: folder.trim() },
      { new: true }
    );
    if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });

    res.json({ success: true, data: photo });
  } catch (err) {
    console.error('[Photos] MOVE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ──────────────────────────────────────────────────────────
   DELETE /api/photos/:id
   Delete photo from both MongoDB and Cloudinary
────────────────────────────────────────────────────────── */
router.delete('/:id', async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(photo.publicId);

    // Delete from DB
    await photo.deleteOne();

    res.json({ success: true, message: 'Photo deleted' });
  } catch (err) {
    console.error('[Photos] DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
