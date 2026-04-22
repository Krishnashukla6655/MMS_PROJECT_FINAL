const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// Get all notifications for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [notifications] = await db.query(
      `SELECT * FROM user_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ notifications });
  } catch (err) {
    console.error('Error fetching user notifications:', err);
    res.status(500).json({ message: 'Server error fetching notifications' });
  }
});

// Mark all notifications as read for the logged-in user
router.patch('/read', authMiddleware, async (req, res) => {
  try {
    await db.query(
      `UPDATE user_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      [req.user.id]
    );
    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    console.error('Error marking notifications as read:', err);
    res.status(500).json({ message: 'Server error updating notifications' });
  }
});

module.exports = router;
