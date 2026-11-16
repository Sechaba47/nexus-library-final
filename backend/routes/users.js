const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { generateToken, authenticate, requireAuth, requireAdmin } = require('../auth');

const FIELDS = 'id, name, membership_id, email, role, created_at';

// Helper to generate a unique membership ID: e.g. MEM-4821
async function generateUniqueMembershipId() {
  let unique = false;
  let candidate = '';
  let attempts = 0;
  while (!unique && attempts < 10) {
    attempts++;
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit number
    candidate = `MEM-${randomNum}`;
    const [existing] = await pool.query('SELECT id FROM users WHERE membership_id = ?', [candidate]);
    if (existing.length === 0) {
      unique = true;
    }
  }
  if (!unique) {
    candidate = `MEM-${Date.now().toString().slice(-6)}`;
  }
  return candidate;
}

// POST /users/login - Authenticate with Membership ID (or email) and Password
router.post('/login', async (req, res, next) => {
  const { membership_id, password } = req.body;
  if (!membership_id || !password) {
    return res.status(400).json({ error: 'Membership ID and password are required' });
  }
  try {
    const trimmedId = membership_id.trim();
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE membership_id = ? OR email = ?',
      [trimmedId, trimmedId]
    );
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Invalid membership ID or password' });
    }
    const { password_hash, ...user } = rows[0];
    const token = generateToken(user);
    res.json({ ...user, token });
  } catch (e) { next(e); }
});

// POST /users/register - Public community member self-registration
router.post('/register', async (req, res, next) => {
  const { name, email, password, confirm_password, membership_id } = req.body;

  // Validate Name
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Full name is required (minimum 2 characters)' });
  }

  // Validate Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }

  // Validate Password
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Validate Password Confirmation
  if (confirm_password !== undefined && password !== confirm_password) {
    return res.status(400).json({ error: 'Password and confirmation do not match' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();

    // Check if email already registered
    const [existingEmail] = await pool.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existingEmail.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists' });
    }

    // Determine Membership ID
    let finalMembershipId = membership_id ? membership_id.trim() : '';
    if (finalMembershipId) {
      if (!/^[A-Za-z0-9_-]{3,30}$/.test(finalMembershipId)) {
        return res.status(400).json({
          error: 'Membership ID must be 3-30 characters long and contain only letters, numbers, hyphens, or underscores'
        });
      }
      const [existingId] = await pool.query('SELECT id FROM users WHERE membership_id = ?', [finalMembershipId]);
      if (existingId.length > 0) {
        return res.status(409).json({ error: 'That Membership ID is already taken. Please choose another or auto-generate one.' });
      }
    } else {
      finalMembershipId = await generateUniqueMembershipId();
    }

    // Hash Password
    const hash = await bcrypt.hash(password, 10);

    // CRITICAL: Force role to 'member' - public registration can NEVER create an admin
    const role = 'member';

    const [r] = await pool.query(
      'INSERT INTO users (name, membership_id, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), finalMembershipId, cleanEmail, hash, role]
    );

    const newUser = {
      id: r.insertId,
      name: name.trim(),
      membership_id: finalMembershipId,
      email: cleanEmail,
      role
    };

    const token = generateToken(newUser);

    res.status(201).json({
      message: 'Account registered successfully',
      user: newUser,
      token
    });
  } catch (e) {
    next(e);
  }
});

// GET /users - Admin only: List all users
router.get('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT ${FIELDS} FROM users ORDER BY name`);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /users - Admin only: Create a user
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  const { name, membership_id, email, password, role } = req.body;
  if (!name || !membership_id || !password) {
    return res.status(400).json({ error: 'Name, membership ID and password are required' });
  }
  if (role && !['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or member' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const [r] = await pool.query(
      'INSERT INTO users (name, membership_id, email, password_hash, role) VALUES (?,?,?,?,?)',
      [name.trim(), membership_id.trim(), cleanEmail, hash, role || 'member']
    );
    res.status(201).json({
      id: r.insertId,
      name: name.trim(),
      membership_id: membership_id.trim(),
      email: cleanEmail,
      role: role || 'member'
    });
  } catch (e) { next(e); }
});

// PUT /users/:id - Admin or Self update
router.put('/:id', authenticate, requireAuth, async (req, res, next) => {
  const targetId = Number(req.params.id);
  const isSelf = req.user && req.user.id === targetId;
  const isAdmin = req.user && req.user.role === 'admin';

  if (!isAdmin && !isSelf) {
    return res.status(403).json({ error: 'You are not authorized to update this profile' });
  }

  const { name, membership_id, email, password, role } = req.body;
  if (!name || !membership_id) {
    return res.status(400).json({ error: 'Name and membership ID are required' });
  }

  // Only admin can change role; ordinary member keeps current role
  const finalRole = isAdmin && role && ['admin', 'member'].includes(role) ? role : (req.user.role || 'member');

  try {
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    let r;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      [r] = await pool.query(
        'UPDATE users SET name=?, membership_id=?, email=?, role=?, password_hash=? WHERE id=?',
        [name.trim(), membership_id.trim(), cleanEmail, finalRole, hash, targetId]
      );
    } else {
      [r] = await pool.query(
        'UPDATE users SET name=?, membership_id=?, email=?, role=? WHERE id=?',
        [name.trim(), membership_id.trim(), cleanEmail, finalRole, targetId]
      );
    }
    if (!r.affectedRows) return res.status(404).json({ error: 'User not found' });
    res.json({ id: targetId, name: name.trim(), membership_id: membership_id.trim(), email: cleanEmail, role: finalRole });
  } catch (e) { next(e); }
});

// DELETE /users/:id - Admin only: Delete user
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  const targetId = Number(req.params.id);
  if (req.user && req.user.id === targetId) {
    return res.status(400).json({ error: 'Cannot delete your own administrator account' });
  }
  try {
    const [r] = await pool.query('DELETE FROM users WHERE id = ?', [targetId]);
    if (!r.affectedRows) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (e) { next(e); }
});

module.exports = router;
