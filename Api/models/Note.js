import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, default: '' },
    date: { type: String, default: () => new Date().toLocaleDateString('en-GB') },
    time: { type: String, default: '' },
    bgColor: { type: String, default: '#ece57a' },
    category: {
      type: String,
      default: 'All',
    },
    folderId: { type: String, default: null },
    tag: { type: String, default: '' },
    month: { type: Number, default: () => new Date().getMonth() },
    year: { type: Number, default: () => new Date().getFullYear() },
    userEmail: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);

noteSchema.index({ userEmail: 1, createdAt: -1 });

export default mongoose.model('Note', noteSchema);
