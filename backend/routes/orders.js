const express  = require('express');
const router   = express.Router();
const db       = require('../db');
const authMW   = require('../middleware/authMiddleware');
const adminMW  = require('../middleware/adminMiddleware');

function genConfirmation() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `MMS-${ts}-${rand}`;
}

// ── POST /api/orders  (place order — auth user) ─────────────
router.post('/', authMW, async (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ message: 'Admins cannot place orders' });
  }

  const { items, payment_method, shipping_address, phone_number } = req.body;
  if (!items || !items.length)
    return res.status(400).json({ message: 'No items in order' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let totalAmount = 0;
    const enriched = [];

    for (const item of items) {
      const [rows] = await conn.query(
        'SELECT * FROM products WHERE id = ? FOR UPDATE',
        [item.product_id]
      );
      if (!rows.length) throw new Error(`Product ID ${item.product_id} not found`);

      const p   = rows[0];
      const qty = parseInt(item.quantity, 10);

      if (qty < p.min_bulk_qty)
        throw new Error(
          `Minimum bulk order for "${p.name}" is ${p.min_bulk_qty} ${p.unit}`
        );
      if (qty > p.stock_quantity)
        throw new Error(
          `Insufficient stock for "${p.name}". Available: ${p.stock_quantity} ${p.unit}`
        );

      totalAmount += p.price * qty;
      enriched.push({ product_id: p.id, name: p.name, unit: p.unit,
                       quantity: qty, unit_price: p.price });
    }

    const confirmationNumber = genConfirmation();
    const [orderRes] = await conn.query(
      'INSERT INTO orders (user_id, total_amount, status, confirmation_number, payment_method, shipping_address, phone_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, totalAmount, 'confirmed', confirmationNumber, payment_method || 'cod', shipping_address || '', phone_number || '']
    );
    const orderId = orderRes.insertId;

    for (const item of enriched) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.unit_price]
      );
      await conn.query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    await conn.commit();
    
    // Trigger Notifications
    try {
      await db.query(
        `INSERT INTO admin_notifications (type, title, message) VALUES (?, ?, ?)`,
        ['order', 'New Order Received', `Order ${confirmationNumber} placed for ₹${parseFloat(totalAmount).toLocaleString('en-IN')}.`]
      );
      await db.query(
        `INSERT INTO user_notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)`,
        [req.user.id, 'order', 'Order Placed Successfully', `Your order ${confirmationNumber} has been confirmed.`]
      );
    } catch (e) {
      console.error('Notification error on order placement:', e);
    }

    res.status(201).json({
      message: 'Order placed successfully',
      orderId,
      confirmationNumber,
      totalAmount,
      items: enriched
    });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ message: err.message });
  } finally {
    conn.release();
  }
});

// ── GET /api/orders/my  (user's own orders) ─────────────────
router.get('/my', authMW, async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.*,
              GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') AS product_names,
              COUNT(oi.id) AS item_count
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products  p  ON p.id = oi.product_id
       WHERE o.user_id = ?
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(orders);
  } catch (err) {
    console.error('[GET /orders/my]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/orders/my/:id  (single order detail — own) ─────
router.get('/my/:id', authMW, async (req, res) => {
  try {
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!orders.length)
      return res.status(404).json({ message: 'Order not found' });

    const [items] = await db.query(
      `SELECT oi.*, p.name, p.unit, p.image_url
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`,
      [req.params.id]
    );
    res.json({ ...orders[0], items });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/orders  (all orders — admin) ───────────────────
router.get('/', authMW, adminMW, async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.*, u.name AS user_name, u.email,
              (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o
       JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC`
    );
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/orders/:id  (admin — any order detail) ─────────
router.get('/:id', authMW, adminMW, async (req, res) => {
  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!orders.length) return res.status(404).json({ message: 'Order not found' });

    const [items] = await db.query(
      `SELECT oi.*, p.name, p.unit, p.image_url
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`,
      [req.params.id]
    );
    res.json({ ...orders[0], items });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PATCH /api/orders/my/:id/cancel  (user cancels own order) ─
router.patch('/my/:id/cancel', authMW, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [orders] = await conn.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, req.user.id]
    );
    if (!orders.length)
      return res.status(404).json({ message: 'Order not found' });

    const order = orders[0];
    if (order.status === 'cancelled')
      return res.status(400).json({ message: 'Order is already cancelled' });
    if (order.status === 'delivered')
      return res.status(400).json({ message: 'Delivered orders cannot be cancelled' });

    // Restore stock for each item
    const [items] = await conn.query(
      'SELECT * FROM order_items WHERE order_id = ?', [order.id]
    );
    for (const item of items) {
      await conn.query(
        'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    await conn.query(
      "UPDATE orders SET status = 'cancelled' WHERE id = ?",
      [order.id]
    );

    await conn.commit();
    res.json({ message: 'Order cancelled successfully. Stock has been restored.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

// ── PATCH /api/orders/:id/status  (admin updates any order status) ─
router.patch('/:id/status', authMW, adminMW, async (req, res) => {
  const { status } = req.body;
  const allowed = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status))
    return res.status(400).json({ message: `Invalid status. Allowed: ${allowed.join(', ')}` });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [orders] = await conn.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id]
    );
    if (!orders.length)
      return res.status(404).json({ message: 'Order not found' });

    const order = orders[0];

    // If changing TO cancelled from a non-cancelled status → restore stock
    if (status === 'cancelled' && order.status !== 'cancelled') {
      const [items] = await conn.query(
        'SELECT * FROM order_items WHERE order_id = ?', [order.id]
      );
      for (const item of items) {
        await conn.query(
          'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    // If re-confirming a previously cancelled order → deduct stock again
    if (order.status === 'cancelled' && status !== 'cancelled') {
      const [items] = await conn.query(
        'SELECT * FROM order_items WHERE order_id = ?', [order.id]
      );
      for (const item of items) {
        const [prows] = await conn.query(
          'SELECT stock_quantity FROM products WHERE id = ?', [item.product_id]
        );
        if (!prows.length || prows[0].stock_quantity < item.quantity) {
          await conn.rollback();
          return res.status(400).json({ message: 'Insufficient stock to restore order' });
        }
        await conn.query(
          'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    await conn.query('UPDATE orders SET status = ? WHERE id = ?', [status, order.id]);
    await conn.commit();
    
    // Trigger User Notification
    try {
      let msg = `Your order ${order.confirmation_number} is now ${status}.`;
      if (status === 'shipped') msg = `Good news! Your order ${order.confirmation_number} has been shipped.`;
      if (status === 'delivered') msg = `Your order ${order.confirmation_number} has been successfully delivered.`;
      if (status === 'cancelled') msg = `Your order ${order.confirmation_number} has been cancelled.`;

      await db.query(
        `INSERT INTO user_notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)`,
        [order.user_id, 'order', 'Order Status Update', msg]
      );
    } catch (e) {
      console.error('Notification error on status update:', e);
    }

    res.json({ message: `Order status updated to "${status}"` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
