const express  = require('express');
const router   = express.Router();
const db       = require('../db');
const authMW   = require('../middleware/authMiddleware');
const adminMW  = require('../middleware/adminMiddleware');

const today = () => new Date().toISOString().slice(0, 10);

// ── GET /api/attendance/employees ───────────────────────────
// List all employees with today's attendance status
router.get('/employees', authMW, adminMW, async (req, res) => {
  try {
    const { search, department, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const dateStr = today();

    let sql = `
      SELECT e.*,
             ROUND(e.base_salary + e.daily_bonus, 2) AS effective_salary,
             a.status   AS today_status,
             a.marked_at AS today_marked_at
      FROM employees e
      LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = ?
      WHERE 1=1
    `;
    const params = [dateStr];

    if (search) {
      sql += ` AND (e.name LIKE ? OR e.emp_code LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (department && department !== 'all') {
      sql += ` AND e.department = ?`;
      params.push(department);
    }

    // Count total
    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) t`;
    const [countRes] = await db.query(countSql, params);
    const total = countRes[0].total;

    sql += ` ORDER BY e.department, e.name LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [rows] = await db.query(sql, params);
    res.json({ employees: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/attendance/departments ─────────────────────────
router.get('/departments', authMW, adminMW, async (req, res) => {
  try {
    const [depts] = await db.query('SELECT DISTINCT department FROM employees ORDER BY department');
    res.json(depts.map(d => d.department));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/attendance/stats ────────────────────────────────
router.get('/stats', authMW, adminMW, async (req, res) => {
  try {
    const dateStr = req.query.date || today();
    const [[{ total }]]   = await db.query('SELECT COUNT(*) AS total FROM employees');
    const [[{ present }]] = await db.query(
      "SELECT COUNT(*) AS present FROM attendance WHERE date = ? AND status = 'present'", [dateStr]);
    const [[{ absent }]]  = await db.query(
      "SELECT COUNT(*) AS absent  FROM attendance WHERE date = ? AND status = 'absent'",  [dateStr]);
    res.json({ total, present, absent, unmarked: total - present - absent, date: dateStr });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/attendance/mark ────────────────────────────────
// Mark single employee attendance
router.post('/mark', authMW, adminMW, async (req, res) => {
  const { employee_id, status, date } = req.body;
  const dateStr = date || today();

  if (!['present', 'absent'].includes(status))
    return res.status(400).json({ message: 'Status must be present or absent' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [emps] = await conn.query('SELECT * FROM employees WHERE id = ? FOR UPDATE', [employee_id]);
    if (!emps.length) return res.status(404).json({ message: 'Employee not found' });
    const emp = emps[0];

    // Check if already marked today
    const [existing] = await conn.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, dateStr]);

    const prevStatus = existing.length ? existing[0].status : null;

    if (existing.length) {
      await conn.query(
        'UPDATE attendance SET status = ? WHERE employee_id = ? AND date = ?',
        [status, employee_id, dateStr]);
    } else {
      await conn.query(
        'INSERT INTO attendance (employee_id, date, status) VALUES (?, ?, ?)',
        [employee_id, dateStr, status]);
    }

    // Salary logic: only update if status actually changed or is newly set
    if (status === 'present') {
      if (prevStatus !== 'present') {
        // Was absent or unmarked → now present: add +1 bonus
        await conn.query(
          'UPDATE employees SET daily_bonus = daily_bonus + 1, consecutive_present = consecutive_present + 1 WHERE id = ?',
          [employee_id]);
      }
    } else {
      // Marking absent: reset bonus to 0
      await conn.query(
        'UPDATE employees SET daily_bonus = 0, consecutive_present = 0 WHERE id = ?',
        [employee_id]);
    }

    // Create notification
    const notifTitle   = `${emp.name} marked ${status.toUpperCase()}`;
    const notifMessage = `Employee ${emp.emp_code} — ${emp.name} (${emp.department}) was marked ${status} on ${dateStr}.` +
      (status === 'present'
        ? ` Daily bonus: ₹${(emp.daily_bonus + 1).toFixed(2)}`
        : ` Daily bonus reset to ₹0.00`);
    await conn.query(
      'INSERT INTO admin_notifications (type, title, message) VALUES (?, ?, ?)',
      ['attendance', notifTitle, notifMessage]);

    await conn.commit();

    res.json({
      message: `${emp.name} marked ${status}`,
      employee: emp.name,
      status,
      date: dateStr
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

// ── POST /api/attendance/mark-bulk ──────────────────────────
// Mark multiple employees at once
router.post('/mark-bulk', authMW, adminMW, async (req, res) => {
  const { records, date } = req.body;
  const dateStr = date || today();

  if (!records || !records.length)
    return res.status(400).json({ message: 'No records provided' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    let presentCount = 0, absentCount = 0;

    for (const { employee_id, status } of records) {
      if (!['present', 'absent'].includes(status)) continue;

      const [existing] = await conn.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, dateStr]);
      const prevStatus = existing.length ? existing[0].status : null;

      if (existing.length) {
        await conn.query(
          'UPDATE attendance SET status = ? WHERE employee_id = ? AND date = ?',
          [status, employee_id, dateStr]);
      } else {
        await conn.query(
          'INSERT INTO attendance (employee_id, date, status) VALUES (?, ?, ?)',
          [employee_id, dateStr, status]);
      }

      if (status === 'present') {
        if (prevStatus !== 'present') {
          await conn.query(
            'UPDATE employees SET daily_bonus = daily_bonus + 1, consecutive_present = consecutive_present + 1 WHERE id = ?',
            [employee_id]);
        }
        presentCount++;
      } else {
        if (prevStatus !== 'absent') {
          await conn.query(
            'UPDATE employees SET daily_bonus = 0, consecutive_present = 0 WHERE id = ?',
            [employee_id]);
        }
        absentCount++;
      }
    }

    // Create a single bulk notification
    const notifMessage =
      `Bulk attendance marked for ${dateStr}: ` +
      `${presentCount} Present ✅, ${absentCount} Absent ❌ ` +
      `out of ${records.length} employees.`;
    await conn.query(
      'INSERT INTO admin_notifications (type, title, message) VALUES (?, ?, ?)',
      ['attendance', `Bulk Attendance — ${dateStr}`, notifMessage]);

    await conn.commit();
    res.json({ message: 'Bulk attendance marked', present: presentCount, absent: absentCount, total: records.length });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

// ── GET /api/attendance/notifications ───────────────────────
router.get('/notifications', authMW, adminMW, async (req, res) => {
  try {
    const [notifs] = await db.query(
      'SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 50');
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) AS count FROM admin_notifications WHERE is_read = 0');
    res.json({ notifications: notifs, unread_count: count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/attendance/notifications/read ─────────────────
router.patch('/notifications/read', authMW, adminMW, async (req, res) => {
  try {
    await db.query('UPDATE admin_notifications SET is_read = 1');
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
