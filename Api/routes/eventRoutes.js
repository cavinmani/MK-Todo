import express from 'express';
import Event from '../models/Event.js';

const router = express.Router();

// GET /api/events?userEmail=xxx
router.get('/', async (req, res) => {
  try {
    const { userEmail } = req.query;
    if (!userEmail) return res.status(400).json({ success: false, message: 'userEmail is required.' });

    const events = await Event.find({ userEmail: userEmail.toLowerCase().trim() }).sort({ createdAt: -1 });
    return res.json({ success: true, count: events.length, data: events });
  } catch (error) {
    console.error('[Events GET]', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/events
router.post('/', async (req, res) => {
  try {
    const { title, name, date, time, content, location, image, badge, attendees, userEmail } = req.body;
    const eventTitle = title || name;
    if (!eventTitle) return res.status(400).json({ success: false, message: 'Event title is required.' });
    if (!userEmail) return res.status(400).json({ success: false, message: 'userEmail is required.' });

    const eventContent = content !== undefined ? content : (location || '');
    const newEvent = await Event.create({
      title: eventTitle,
      date: date || new Date().toISOString().split('T')[0],
      time: time || '10:00 AM',
      content: eventContent,
      location: eventContent,
      image: image || '',
      badge: badge || '(1+)',
      attendees: attendees || [],
      userEmail: userEmail.toLowerCase().trim(),
    });
    return res.status(201).json({ success: true, data: newEvent });
  } catch (error) {
    console.error('[Events POST]', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/events/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Event.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Event not found.' });
    return res.json({ success: true, message: 'Event deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export const seedDefaultEvents = async () => {}; // no-op: seed removed
export default router;
