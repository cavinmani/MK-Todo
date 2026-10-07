import mongoose from 'mongoose';

const photoFolderSchema = new mongoose.Schema(
  {
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// One folder name per user
photoFolderSchema.index({ userEmail: 1, name: 1 }, { unique: true });

export default mongoose.model('PhotoFolder', photoFolderSchema);
