import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';

const router = express.Router();

// Seed initial default user if none exists
export const seedDefaultUser = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      const count = await User.countDocuments();
      if (count === 0) {
        await User.create({
          name: 'MK',
          username: 'mk',
          email: 'mk@gmail.com',
          password: 'anil',
        });
        console.log('[Auth] Default user seeded: mk@gmail.com / username: mk');
      }
    }
  } catch (err) {
    console.warn('[Auth] Could not seed user:', err.message);
  }
};

// POST /api/auth/login
// Accepts: { identifier, password }  — identifier can be email OR username
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Username/email and password are required.' });
    }

    const cleanIdentifier = identifier.toLowerCase().trim();

    if (mongoose.connection.readyState === 1) {
      try {
        // Try matching by email OR username
        const user = await User.findOne({
          $or: [{ email: cleanIdentifier }, { username: cleanIdentifier }],
        });

        if (user) {
          if (user.password === password) {
            return res.json({
              success: true,
              user: { email: user.email, name: user.name, username: user.username },
              message: 'Login successful',
            });
          } else {
            return res.status(401).json({ success: false, message: 'Invalid password. Please try again.' });
          }
        } else {
          return res.status(404).json({ success: false, message: 'No account found with that username or email.' });
        }
      } catch (dbErr) {
        console.warn('[Auth] DB query error:', dbErr.message);
      }
    }

    // Fallback: default credentials mk/anil
    if ((cleanIdentifier === 'mk' || cleanIdentifier === 'mk@gmail.com') && password === 'anil') {
      return res.json({
        success: true,
        user: { email: 'mk@gmail.com', name: 'MK', username: 'mk' },
        message: 'Login successful (offline mode)',
      });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials. Please try again.' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// POST /api/auth/register
// Body: { name, username, email, password }
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    console.log('[Register] Incoming:', { name, username, email, password: password ? '***' : 'MISSING' });
    console.log('[Register] DB state:', mongoose.connection.readyState); // 1 = connected

    if (!name || !username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, username, email and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username.toLowerCase().trim();

    if (mongoose.connection.readyState !== 1) {
      console.warn('[Register] DB not connected — state:', mongoose.connection.readyState);
      return res.status(503).json({
        success: false,
        message: 'Database not connected. Please try again in a moment.',
      });
    }

    // Check email duplicate
    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'Email is already registered.' });
    }

    // Check username duplicate
    const existingUsername = await User.findOne({ username: cleanUsername });
    if (existingUsername) {
      return res.status(409).json({ success: false, message: 'Username is already taken.' });
    }

    console.log('[Register] Creating user:', cleanUsername, cleanEmail);
    const newUser = await User.create({
      name: name.trim(),
      username: cleanUsername,
      email: cleanEmail,
      password,
    });
    console.log('[Register] User created successfully:', newUser._id);

    return res.status(201).json({
      success: true,
      user: { email: newUser.email, name: newUser.name, username: newUser.username },
      message: 'Account created successfully!',
    });
  } catch (error) {
    console.error('[Register] Error:', error.message, error.code || '');
    // Handle duplicate key errors from MongoDB (code 11000)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(409).json({
        success: false,
        message: `That ${field} is already taken. Please choose another.`,
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/check-username
// Returns { available: true } if username is free, { available: false } if taken
router.post('/check-username', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || typeof username !== 'string') {
      return res.json({ available: false, reason: 'invalid_input' });
    }

    const cleanUsername = username.toLowerCase().trim();

    if (cleanUsername.length < 3) {
      return res.json({ available: false, reason: 'too_short' });
    }

    if (mongoose.connection.readyState !== 1) {
      // DB not connected — can't verify, tell frontend it's unknown (available: null is not valid JSON boolean)
      // Return available: true so we don't block user — register route will catch real conflicts
      return res.json({ available: true, reason: 'db_offline' });
    }

    const existing = await User.findOne({ username: cleanUsername }).lean();
    return res.json({ available: existing === null, reason: existing ? 'taken' : 'free' });
  } catch (err) {
    console.error('[check-username] Error:', err.message);
    // On any server error, don't block the user — register will catch real conflicts
    return res.json({ available: true, reason: 'server_error' });
  }
});

export default router;
