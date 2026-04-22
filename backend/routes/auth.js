const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../db');
const authMW   = require('../middleware/authMiddleware');

// ── POST /api/auth/register ─────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  const assignedRole = role === 'admin' ? 'admin' : 'user';

  if (!name || !email || !password)
    return res.status(400).json({ message: 'Name, email and password are required' });

  if (password.length < 6)
    return res.status(400).json({ message: 'Password must be at least 6 characters' });

  try {
    // Duplicate email check
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ message: 'Email already registered' });

    // Admin cap check
    if (assignedRole === 'admin') {
      const [[{ count }]] = await db.query(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin'"
      );
      if (count >= 2)
        return res.status(403).json({
          message: 'Admin limit reached. Maximum 2 admins are allowed.'
        });
    }

    const hashed = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), hashed, assignedRole]
    );

    res.status(201).json({
      message: 'Registration successful',
      userId: result.insertId,
      role: assignedRole
    });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/auth/login ────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (rows.length === 0)
      return res.status(401).json({ message: 'Invalid email or password' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Trigger Login Notification (only for users, admins have their own flow or can just receive it here)
    try {
      await db.query(
        `INSERT INTO user_notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)`,
        [user.id, 'security', 'New Login Detected', `Your account was accessed on ${new Date().toLocaleString('en-IN')}.`]
      );
    } catch (e) {
      console.error('Login notification error:', e);
    }

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/auth/me ────────────────────────────────────────
router.get('/me', authMW, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PATCH /api/auth/profile ─────────────────────────────────
router.patch('/profile', authMW, async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;
  if (!currentPassword) {
    return res.status(400).json({ message: 'Current password is required to make changes' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    const user = rows[0];

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ message: 'Incorrect current password' });

    let updates = [];
    let params = [];

    if (name && name.trim() !== user.name) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (email && email.trim().toLowerCase() !== user.email) {
      const targetEmail = email.trim().toLowerCase();
      const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [targetEmail, user.id]);
      if (existing.length > 0) return res.status(409).json({ message: 'Email already in use' });
      updates.push('email = ?');
      params.push(targetEmail);
    }
    if (newPassword && newPassword.length >= 6) {
      const hashed = await bcrypt.hash(newPassword, 12);
      updates.push('password = ?');
      params.push(hashed);
    } else if (newPassword && newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    if (updates.length === 0) {
      return res.json({ message: 'No changes provided' });
    }

    params.push(user.id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    // Fetch updated user to generate new token
    const [updatedRows] = await db.query('SELECT * FROM users WHERE id = ?', [user.id]);
    const updatedUser = updatedRows[0];

    const token = jwt.sign(
      { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Trigger Profile Update Notification
    try {
      await db.query(
        `INSERT INTO user_notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)`,
        [user.id, 'security', 'Profile Updated', 'Your profile information or password was successfully updated.']
      );
    } catch (e) {
      console.error('Profile update notification error:', e);
    }

    res.json({
      message: 'Profile updated successfully',
      token,
      user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role }
    });
  } catch (err) {
    console.error('[profile update]', err);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
