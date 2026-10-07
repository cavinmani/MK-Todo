import express from 'express';
import Todo from '../models/Todo.js';

const router = express.Router();

// GET /api/todos?userEmail=xxx&folderId=xxx
router.get('/', async (req, res) => {
  try {
    const { userEmail, folderId } = req.query;
    if (!userEmail) return res.status(400).json({ success: false, message: 'userEmail is required.' });

    const query = { userEmail: userEmail.toLowerCase().trim() };
    if (folderId !== undefined) {
      query.folderId = folderId === 'null' || folderId === '' ? null : folderId;
    }

    const todos = await Todo.find(query).sort({ createdAt: -1 });
    return res.json({ success: true, count: todos.length, data: todos });
  } catch (error) {
    console.error('[Todos GET]', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/todos
router.post('/', async (req, res) => {
  try {
    const { text, completed, priority, dueDate, folderId, userEmail } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Todo text is required.' });
    if (!userEmail) return res.status(400).json({ success: false, message: 'userEmail is required.' });

    const newTodo = await Todo.create({
      text,
      completed: completed || false,
      priority: priority || 'medium',
      dueDate: dueDate || new Date().toLocaleDateString('en-GB'),
      folderId: folderId || null,
      userEmail: userEmail.toLowerCase().trim(),
    });
    return res.status(201).json({ success: true, data: newTodo });
  } catch (error) {
    console.error('[Todos POST]', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/todos/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await Todo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Todo not found.' });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/todos/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Todo.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Todo not found.' });
    return res.json({ success: true, message: 'Todo deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export const seedDefaultTodos = async () => {}; // no-op: seed removed
export default router;
