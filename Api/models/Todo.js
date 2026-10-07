import mongoose from 'mongoose';

const todoSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    dueDate: { type: String, default: () => new Date().toLocaleDateString('en-GB') },
    folderId: { type: String, default: null },
    userEmail: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);

todoSchema.index({ userEmail: 1, createdAt: -1 });

export default mongoose.model('Todo', todoSchema);
