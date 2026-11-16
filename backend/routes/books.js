const router = require('express').Router();
const pool = require('../db');
const { authenticate, requireAdmin } = require('../auth');

const validate = (b) => {
  const { title, author, genre, isbn, quantity } = b;
  if (!title || !author || !genre || !isbn) return 'Title, author, genre and ISBN are required';
  if (!Number.isInteger(Number(quantity)) || Number(quantity) < 0) return 'Quantity must be 0 or more';
  return null;
};

// GET /books - View all books (accessible to all members and admins)
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM books ORDER BY title');
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /books/:id - View single book
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Book not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// POST /books - Admin only: Add a new book
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });
  const { title, author, genre, isbn, quantity } = req.body;
  try {
    const [r] = await pool.query(
      'INSERT INTO books (title, author, genre, isbn, quantity) VALUES (?,?,?,?,?)',
      [title.trim(), author.trim(), genre.trim(), isbn.trim(), Number(quantity)]
    );
    res.status(201).json({ id: r.insertId, title: title.trim(), author: author.trim(), genre: genre.trim(), isbn: isbn.trim(), quantity: Number(quantity) });
  } catch (e) { next(e); }
});

// PUT /books/:id - Admin only: Update book
router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });
  const { title, author, genre, isbn, quantity } = req.body;
  try {
    const [r] = await pool.query(
      'UPDATE books SET title=?, author=?, genre=?, isbn=?, quantity=? WHERE id=?',
      [title.trim(), author.trim(), genre.trim(), isbn.trim(), Number(quantity), req.params.id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Book not found' });
    res.json({ id: Number(req.params.id), title: title.trim(), author: author.trim(), genre: genre.trim(), isbn: isbn.trim(), quantity: Number(quantity) });
  } catch (e) { next(e); }
});

// DELETE /books/:id - Admin only: Delete book
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const [r] = await pool.query('DELETE FROM books WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Book not found' });
    res.json({ message: 'Book deleted' });
  } catch (e) { next(e); }
});

module.exports = router;
