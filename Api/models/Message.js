import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    receiver: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, receiver: 1, createdAt: 1 });
messageSchema.index({ receiver: 1, read: 1 });

export default mongoose.model('Message', messageSchema);
