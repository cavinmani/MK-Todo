import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Friendship from '../models/Friendship.js';
import Message from '../models/Message.js';

const router = express.Router();

// Helper to seed demo users if DB is connected so searching for friends is immediately possible
export const seedDemoUsers = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      const demoUsers = [
        { name: 'Alex Carter', username: 'alex', email: 'alex@gmail.com', password: '123' },
        { name: 'Priya Sharma', username: 'priya', email: 'priya@gmail.com', password: '123' },
        { name: 'David Miller', username: 'david', email: 'david@gmail.com', password: '123' },
      ];

      for (const du of demoUsers) {
        const exists = await User.findOne({ username: du.username });
        if (!exists) {
          await User.create(du);
          console.log(`[Chat] Demo user seeded: @${du.username}`);
        }
      }
    }
  } catch (err) {
    console.warn('[Chat] Demo user seed notice:', err.message);
  }
};

// ─── 1. Search Users ──────────────────────────────────────────────────────────
// GET /api/chat/search?query=...&currentUsername=...
router.get('/search', async (req, res) => {
  try {
    const { query = '', currentUsername = '' } = req.query;
    const cleanQuery = query.toString().trim().toLowerCase();
    const cleanCurrent = currentUsername.toString().trim().toLowerCase();

    if (!cleanQuery) {
      return res.json({ success: true, users: [] });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Database disconnected' });
    }

    // Find users by username or name, excluding current user
    const users = await User.find({
      username: { $ne: cleanCurrent },
      $or: [
        { username: { $regex: cleanQuery, $options: 'i' } },
        { name: { $regex: cleanQuery, $options: 'i' } },
      ],
    })
      .select('name username email createdAt')
      .limit(20)
      .lean();

    // Check relationship status for each user
    const usersWithStatus = await Promise.all(
      users.map(async (u) => {
        const friendship = await Friendship.findOne({
          $or: [
            { requester: cleanCurrent, recipient: u.username },
            { requester: u.username, recipient: cleanCurrent },
          ],
        }).lean();

        let relationship = 'none';
        let requestId = null;

        if (friendship) {
          if (friendship.status === 'accepted') {
            relationship = 'friends';
          } else if (friendship.status === 'pending') {
            requestId = friendship._id;
            if (friendship.requester === cleanCurrent) {
              relationship = 'outgoing_pending';
            } else {
              relationship = 'incoming_pending';
            }
          }
        }

        return {
          id: u._id,
          name: u.name,
          username: u.username,
          email: u.email,
          relationship,
          requestId,
        };
      })
    );

    return res.json({ success: true, users: usersWithStatus });
  } catch (err) {
    console.error('[Chat Search Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 2. Send Friend Request ──────────────────────────────────────────────────
// POST /api/chat/friend-request
// Body: { fromUsername, toUsername }
router.post('/friend-request', async (req, res) => {
  try {
    const { fromUsername, toUsername } = req.body;
    if (!fromUsername || !toUsername) {
      return res.status(400).json({ success: false, message: 'fromUsername and toUsername required' });
    }

    const cleanFrom = fromUsername.toLowerCase().trim();
    const cleanTo = toUsername.toLowerCase().trim();

    if (cleanFrom === cleanTo) {
      return res.status(400).json({ success: false, message: 'Cannot send friend request to yourself' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Database disconnected' });
    }

    // Verify recipient exists
    const recipientUser = await User.findOne({ username: cleanTo });
    if (!recipientUser) {
      return res.status(404).json({ success: false, message: `User @${cleanTo} not found` });
    }

    // Check existing friendship
    const existing = await Friendship.findOne({
      $or: [
        { requester: cleanFrom, recipient: cleanTo },
        { requester: cleanTo, recipient: cleanFrom },
      ],
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ success: false, message: 'You are already friends!' });
      }
      if (existing.status === 'pending') {
        if (existing.requester === cleanFrom) {
          return res.status(400).json({ success: false, message: 'Friend request already sent and pending.' });
        } else {
          // If other user already sent request to us, auto-accept!
          existing.status = 'accepted';
          await existing.save();
          return res.json({ success: true, message: 'Request accepted! You are now friends.', status: 'accepted' });
        }
      }
      // If was rejected, reopen as pending
      existing.status = 'pending';
      existing.requester = cleanFrom;
      existing.recipient = cleanTo;
      await existing.save();
      return res.json({ success: true, message: 'Friend request sent!', friendship: existing });
    }

    const newFriendship = await Friendship.create({
      requester: cleanFrom,
      recipient: cleanTo,
      status: 'pending',
    });

    return res.json({ success: true, message: 'Friend request sent!', friendship: newFriendship });
  } catch (err) {
    console.error('[Friend Request Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 3. Respond to Friend Request ────────────────────────────────────────────
// POST /api/chat/respond-request
// Body: { requestId, action: 'accept' | 'reject' } OR { fromUsername, toUsername, action }
router.post('/respond-request', async (req, res) => {
  try {
    const { requestId, action, fromUsername, toUsername } = req.body;

    if (!action || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be "accept" or "reject"' });
    }

    let friendship = null;
    if (requestId) {
      friendship = await Friendship.findById(requestId);
    } else if (fromUsername && toUsername) {
      friendship = await Friendship.findOne({
        $or: [
          { requester: fromUsername.toLowerCase(), recipient: toUsername.toLowerCase() },
          { requester: toUsername.toLowerCase(), recipient: fromUsername.toLowerCase() },
        ],
      });
    }

    if (!friendship) {
      return res.status(404).json({ success: false, message: 'Friend request not found' });
    }

    if (action === 'accept') {
      friendship.status = 'accepted';
      await friendship.save();
      return res.json({ success: true, message: 'Friend request accepted! You can now chat.', status: 'accepted' });
    } else {
      friendship.status = 'rejected';
      await friendship.save();
      return res.json({ success: true, message: 'Friend request declined.', status: 'rejected' });
    }
  } catch (err) {
    console.error('[Respond Request Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 4. Get Pending Requests ─────────────────────────────────────────────────
// GET /api/chat/requests?username=...
router.get('/requests', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username parameter required' });
    }

    const cleanUsername = username.toLowerCase().trim();

    // Incoming pending requests
    const incomingFriendships = await Friendship.find({
      recipient: cleanUsername,
      status: 'pending',
    }).sort({ createdAt: -1 }).lean();

    const incoming = await Promise.all(
      incomingFriendships.map(async (f) => {
        const u = await User.findOne({ username: f.requester }).select('name username email').lean();
        return {
          requestId: f._id,
          username: f.requester,
          name: u?.name || f.requester,
          email: u?.email || '',
          createdAt: f.createdAt,
        };
      })
    );

    // Outgoing pending requests
    const outgoingFriendships = await Friendship.find({
      requester: cleanUsername,
      status: 'pending',
    }).sort({ createdAt: -1 }).lean();

    const outgoing = await Promise.all(
      outgoingFriendships.map(async (f) => {
        const u = await User.findOne({ username: f.recipient }).select('name username email').lean();
        return {
          requestId: f._id,
          username: f.recipient,
          name: u?.name || f.recipient,
          email: u?.email || '',
          createdAt: f.createdAt,
        };
      })
    );

    return res.json({ success: true, incoming, outgoing });
  } catch (err) {
    console.error('[Get Requests Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 5. Get Friends List ─────────────────────────────────────────────────────
// GET /api/chat/friends?username=...
router.get('/friends', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username parameter required' });
    }

    const cleanUsername = username.toLowerCase().trim();

    const friendships = await Friendship.find({
      $or: [{ requester: cleanUsername }, { recipient: cleanUsername }],
      status: 'accepted',
    }).lean();

    const friends = await Promise.all(
      friendships.map(async (f) => {
        const friendUsername = f.requester === cleanUsername ? f.recipient : f.requester;
        const u = await User.findOne({ username: friendUsername }).select('name username email createdAt').lean();

        // Latest message between the two
        const lastMsg = await Message.findOne({
          $or: [
            { sender: cleanUsername, receiver: friendUsername },
            { sender: friendUsername, receiver: cleanUsername },
          ],
        }).sort({ createdAt: -1 }).lean();

        // Unread count sent by friend to current user
        const unreadCount = await Message.countDocuments({
          sender: friendUsername,
          receiver: cleanUsername,
          read: false,
        });

        return {
          id: u?._id || friendUsername,
          username: friendUsername,
          name: u?.name || friendUsername,
          email: u?.email || '',
          friendshipId: f._id,
          friendsSince: f.updatedAt || f.createdAt,
          lastMessage: lastMsg
            ? {
                text: lastMsg.text,
                sender: lastMsg.sender,
                createdAt: lastMsg.createdAt,
              }
            : null,
          unreadCount,
        };
      })
    );

    // Sort by most recent message, or friendsSince
    friends.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.friendsSince).getTime();
      const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.friendsSince).getTime();
      return timeB - timeA;
    });

    return res.json({ success: true, friends });
  } catch (err) {
    console.error('[Get Friends Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 6. Get Chat Messages ────────────────────────────────────────────────────
// GET /api/chat/messages?user1=...&user2=...
router.get('/messages', async (req, res) => {
  try {
    const { user1, user2 } = req.query;
    if (!user1 || !user2) {
      return res.status(400).json({ success: false, message: 'Both user1 and user2 are required' });
    }

    const cleanUser1 = user1.toLowerCase().trim();
    const cleanUser2 = user2.toLowerCase().trim();

    // Verify friendship is accepted
    const friendship = await Friendship.findOne({
      $or: [
        { requester: cleanUser1, recipient: cleanUser2 },
        { requester: cleanUser2, recipient: cleanUser1 },
      ],
      status: 'accepted',
    });

    if (!friendship) {
      return res.status(403).json({
        success: false,
        notFriends: true,
        message: 'You must be accepted friends to view or send messages.',
        messages: [],
      });
    }

    // Mark messages sent by user2 to user1 as read
    await Message.updateMany(
      { sender: cleanUser2, receiver: cleanUser1, read: false },
      { $set: { read: true } }
    );

    // Fetch messages sorted chronologically
    const messages = await Message.find({
      $or: [
        { sender: cleanUser1, receiver: cleanUser2 },
        { sender: cleanUser2, receiver: cleanUser1 },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ success: true, messages });
  } catch (err) {
    console.error('[Get Messages Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 7. Send Message ─────────────────────────────────────────────────────────
// POST /api/chat/messages
// Body: { sender, receiver, text }
router.post('/messages', async (req, res) => {
  try {
    const { sender, receiver, text } = req.body;
    if (!sender || !receiver || !text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Sender, receiver, and non-empty text required' });
    }

    const cleanSender = sender.toLowerCase().trim();
    const cleanReceiver = receiver.toLowerCase().trim();

    // Verify friendship is accepted
    const friendship = await Friendship.findOne({
      $or: [
        { requester: cleanSender, recipient: cleanReceiver },
        { requester: cleanReceiver, recipient: cleanSender },
      ],
      status: 'accepted',
    });

    if (!friendship) {
      return res.status(403).json({
        success: false,
        message: 'Cannot send messages to non-friends. Send a friend request first.',
      });
    }

    const newMsg = await Message.create({
      sender: cleanSender,
      receiver: cleanReceiver,
      text: text.trim(),
      read: false,
    });

    return res.status(201).json({ success: true, message: newMsg });
  } catch (err) {
    console.error('[Send Message Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
