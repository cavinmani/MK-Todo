import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Create a multer upload middleware bound to a Cloudinary folder.
 * The final Cloudinary path will be:  mktodo-gallery/<userFolder>/<timestamp>
 */
export function createCloudinaryUpload(folderName = 'gallery') {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: (req, file) => {
      // Allow per-request folder override from req.body or fall back to folderName
      const folder = req.body?.folder
        ? `mktodo-gallery/${req.body.folder}`
        : `mktodo-gallery/${folderName}`;
      // Generate a unique suffix per file so multiple simultaneous uploads don't collide
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      return {
        folder,
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'],
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        public_id: uniqueSuffix,
      };
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: 20 * 1024 * 1024, // 20 MB limit per file
      files: 5,                   // Maximum 5 files per request
    },
  });
}

export { cloudinary };
