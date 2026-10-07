import mongoose from 'mongoose';

const photoSchema = new mongoose.Schema(
  {
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      default: 'Untitled',
      trim: true,
    },
    category: {
      type: String,
      default: 'all',
      trim: true,
    },
    // The folder name the user chose (e.g. "nature", "travel", "My Trip 2026")
    folder: {
      type: String,
      default: 'gallery',
      trim: true,
    },
    // Cloudinary public_id – needed to delete from cloud
    publicId: {
      type: String,
      required: true,
    },
    // Full-size URL returned by Cloudinary
    url: {
      type: String,
      required: true,
    },
    // Thumbnail URL (auto-generated at 300px)
    thumb: {
      type: String,
      required: true,
    },
    // Format: "25 Sep 2026"
    date: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Photo', photoSchema);
