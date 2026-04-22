const express  = require('express');
const path     = require('path');
const cors     = require('cors');
require('dotenv').config();

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static: uploaded product images ────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Static: frontend ────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/chat',       require('./routes/chatbot'));
app.use('/api/notifications', require('./routes/notifications'));

// Admin — list all users
app.get(
  '/api/users',
  require('./middleware/authMiddleware'),
  require('./middleware/adminMiddleware'),
  async (req, res) => {
    const db = require('./db');
    try {
      const [rows] = await db.query(
        'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Contact Log API
app.post('/api/contact/click', async (req, res) => {
  const db = require('./db');
  const action_type = req.body.action || 'viewed_contact_modal';
  try {
    await db.query('INSERT INTO contact_logs (action_type) VALUES (?)', [action_type]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin — get contact stats
app.get(
  '/api/admin/contact-stats',
  require('./middleware/authMiddleware'),
  require('./middleware/adminMiddleware'),
  async (req, res) => {
    const db = require('./db');
    try {
      const [rows] = await db.query('SELECT COUNT(*) as total FROM contact_logs');
      res.json({ total: rows[0].total });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Root → portal selection page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/portal.html'));
});

// ── Catch-all → serve frontend ──────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀  MMS Server running → http://localhost:${PORT}`);
  console.log(`📦  Admin Dashboard  → http://localhost:${PORT}/admin/dashboard.html`);
  console.log(`🛒  Product Store    → http://localhost:${PORT}/index.html\n`);
});
