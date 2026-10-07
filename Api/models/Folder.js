import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    date: { type: String, default: () => new Date().toLocaleDateString('en-GB') },
    bgColor: { type: String, default: '#e9f2fe' },
    iconColor: { type: String, default: '#8c8bf6' },
    flapColor: { type: String, default: '#7674ea' },
    category: {
      type: String,
      default: 'All',
    },
    userEmail: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);

folderSchema.index({ userEmail: 1, createdAt: 1 });

export default mongoose.model('Folder', folderSchema);
