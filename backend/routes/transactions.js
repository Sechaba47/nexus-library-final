const router = require('express').Router();
const pool = require('../db');
const { authenticate, requireAuth } = require('../auth');

// GET /transactions - Transaction history log, newest first
// Admins see all transactions; members see their own transactions
router.get('/', authenticate, async (req, res, next) => {
  try {
    let query = `SELECT t.id, t.type, t.quantity, t.created_at,
                        b.id AS book_id, b.title AS book_title,
                        u.id AS user_id, u.name AS user_name, u.membership_id
                 FROM transactions t
                 JOIN books b ON b.id = t.book_id
                 LEFT JOIN users u ON u.id = t.user_id`;
    const params = [];

    if (req.user && req.user.role === 'member') {
      query += ' WHERE t.user_id = ?';
      params.push(req.user.id);
    } else if (req.query.user_id) {
      query += ' WHERE t.user_id = ?';
      params.push(req.query.user_id);
    }

    query += ' ORDER BY t.created_at DESC, t.id DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /transactions - Record transaction
// type: 'add' (stock added) | 'deduct' (stock deducted) | 'borrow' (member borrows book) | 'return' (member returns book)
router.post('/', authenticate, requireAuth, async (req, res, next) => {
  const { book_id, type } = req.body;
  let targetUserId = req.body.user_id;
  const quantity = Number(req.body.quantity) || 1;

  const validTypes = ['add', 'deduct', 'borrow', 'return'];
  if (!book_id || !validTypes.includes(type)) {
    return res.status(400).json({ error: 'Valid book_id and type (add, deduct, borrow, return) are required' });
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be a whole number of at least 1' });
  }

  // Stock management ('add' and 'deduct') requires administrator role
  if (['add', 'deduct'].includes(type) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can add or deduct book stock' });
  }

  // If a regular member is borrowing or returning, enforce their own user ID
  if (req.user.role === 'member') {
    targetUserId = req.user.id;
  } else if (!targetUserId && ['borrow', 'return'].includes(type)) {
    // If admin didn't specify a target user, associate with the admin user
    targetUserId = req.user.id;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT quantity, title FROM books WHERE id = ? FOR UPDATE', [book_id]);
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Book not found' });
    }

    const currentQty = rows[0].quantity;

    // Validate stock availability for borrow or deduct
    if ((type === 'borrow' || type === 'deduct') && currentQty < quantity) {
      await conn.rollback();
      return res.status(400).json({ error: `Not enough stock available (Current stock: ${currentQty})` });
    }

    // Determine quantity delta
    let delta = 0;
    if (type === 'add' || type === 'return') {
      delta = quantity;
    } else if (type === 'borrow' || type === 'deduct') {
      delta = -quantity;
    }

    await conn.query('UPDATE books SET quantity = quantity + ? WHERE id = ?', [delta, book_id]);
    const [r] = await conn.query(
      'INSERT INTO transactions (book_id, user_id, type, quantity) VALUES (?,?,?,?)',
      [book_id, targetUserId || null, type, quantity]
    );

    await conn.commit();
    res.status(201).json({
      id: r.insertId,
      book_id,
      book_title: rows[0].title,
      user_id: targetUserId || null,
      type,
      quantity,
      new_stock: currentQty + delta
    });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

module.exports = router;
