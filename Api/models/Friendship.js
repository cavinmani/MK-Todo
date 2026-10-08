import mongoose from 'mongoose';

const friendshipSchema = new mongoose.Schema(
  {
    requester: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    recipient: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// Indexes for fast lookup
friendshipSchema.index({ requester: 1, recipient: 1 });
friendshipSchema.index({ recipient: 1, status: 1 });
friendshipSchema.index({ requester: 1, status: 1 });

export default mongoose.model('Friendship', friendshipSchema);
