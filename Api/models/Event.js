import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    time: { type: String, default: '10:00 AM' },
    content: { type: String, default: '' },
    location: { type: String, default: '' },
    image: { type: String, default: '' },
    badge: { type: String, default: '(1+)' },
    attendees: { type: [String], default: [] },
    userEmail: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);

eventSchema.index({ userEmail: 1, createdAt: -1 });

export default mongoose.model('Event', eventSchema);
