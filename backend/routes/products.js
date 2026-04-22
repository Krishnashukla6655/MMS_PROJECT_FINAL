const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const db       = require('../db');
const authMW   = require('../middleware/authMiddleware');
const adminMW  = require('../middleware/adminMiddleware');

// ── Multer (image uploads) ──────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|png|webp|gif)/.test(file.mimetype);
    cb(ok ? null : new Error('Only image files allowed'), ok);
  }
});

// ── GET /api/products  (public) ─────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let sql  = 'SELECT * FROM products';
    const params = [];
    const conditions = [];

    if (category && category !== 'all') {
      conditions.push('category = ?');
      params.push(category);
    }
    if (search) {
      conditions.push('(name LIKE ? OR description LIKE ? OR category LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY category, name';

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[GET /products]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/products/categories  (public) ──────────────────
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category'
    );
    res.json(rows.map(r => r.category));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/products/:id  (public) ─────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length)
      return res.status(404).json({ message: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/products  (admin) ─────────────────────────────
router.post('/', authMW, adminMW, upload.single('image'), async (req, res) => {
  const { name, description, price, min_bulk_qty, stock_quantity, category, unit } = req.body;
  if (!name || !price)
    return res.status(400).json({ message: 'Name and price are required' });

  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const [result] = await db.query(
      `INSERT INTO products
         (name, description, image_url, price, min_bulk_qty, stock_quantity, category, unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description || '', image_url, price,
       min_bulk_qty || 10, stock_quantity || 0, category || '', unit || 'units']
    );
    res.status(201).json({ message: 'Product added', productId: result.insertId });
  } catch (err) {
    console.error('[POST /products]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PUT /api/products/:id  (admin) ──────────────────────────
router.put('/:id', authMW, adminMW, upload.single('image'), async (req, res) => {
  const { name, description, price, min_bulk_qty, stock_quantity, category, unit } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Product not found' });

    const p = rows[0];
    const image_url = req.file ? `/uploads/${req.file.filename}` : p.image_url;

    await db.query(
      `UPDATE products SET
         name=?, description=?, image_url=?, price=?,
         min_bulk_qty=?, stock_quantity=?, category=?, unit=?
       WHERE id=?`,
      [
        name            || p.name,
        description     ?? p.description,
        image_url,
        price           || p.price,
        min_bulk_qty    || p.min_bulk_qty,
        stock_quantity  !== undefined ? stock_quantity : p.stock_quantity,
        category        || p.category,
        unit            || p.unit,
        req.params.id
      ]
    );
    res.json({ message: 'Product updated' });
  } catch (err) {
    console.error('[PUT /products]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PATCH /api/products/:id/add-stock  (admin) ──────────────
router.patch('/:id/add-stock', authMW, adminMW, async (req, res) => {
  const qty = parseInt(req.body.quantity, 10);
  if (!qty || qty <= 0)
    return res.status(400).json({ message: 'Provide a positive quantity' });

  try {
    await db.query(
      'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
      [qty, req.params.id]
    );
    const [[p]] = await db.query('SELECT stock_quantity FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Stock updated', newStock: p.stock_quantity });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE /api/products/:id  (admin) ───────────────────────
router.delete('/:id', authMW, adminMW, async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
