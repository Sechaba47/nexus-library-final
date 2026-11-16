// Secure database seeding script: initializes or updates admin and starter library catalog
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

(async () => {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || typeof adminPassword !== 'string' || !adminPassword.trim()) {
      console.error('CRITICAL ERROR: ADMIN_PASSWORD environment variable is missing.');
      console.error('Please configure ADMIN_PASSWORD in your backend/.env file before running seed.');
      console.error('Example: ADMIN_PASSWORD=your_secure_password_here');
      process.exit(1);
    }

    const adminMembershipId = (process.env.ADMIN_MEMBERSHIP_ID || 'ADMIN001').trim();
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@nexus.local').trim().toLowerCase();

    // Hash admin password using bcrypt
    const adminHash = await bcrypt.hash(adminPassword.trim(), 10);

    // Initialize or securely update the admin account in MySQL
    const [existingAdmin] = await pool.query(
      'SELECT id FROM users WHERE membership_id = ?',
      [adminMembershipId]
    );

    if (existingAdmin.length === 0) {
      await pool.query(
        `INSERT INTO users (name, membership_id, email, password_hash, role)
         VALUES ('Administrator', ?, ?, ?, 'admin')`,
        [adminMembershipId, adminEmail, adminHash]
      );
      console.log(`[SEED] Admin account initialized: ${adminMembershipId}`);
    } else {
      await pool.query(
        `UPDATE users SET password_hash = ?, email = ?, role = 'admin' WHERE membership_id = ?`,
        [adminHash, adminEmail, adminMembershipId]
      );
      console.log(`[SEED] Admin account password updated: ${adminMembershipId}`);
    }

    // Starter library books catalog (inserted safely without overwriting)
    const starterBooks = [
      ['The Pragmatic Programmer', 'David Thomas & Andrew Hunt', 'Software Engineering', '978-0135957059', 4],
      ['Clean Code', 'Robert C. Martin', 'Software Engineering', '978-0132350884', 1],
      ['JavaScript: The Definitive Guide', 'David Flanagan', 'Web Development', '978-1491952023', 3],
      ['Design Patterns: Elements of Reusable Object-Oriented Software', 'Erich Gamma et al.', 'Computer Science', '978-0201633610', 2],
      ['Introduction to Algorithms', 'Thomas H. Cormen et al.', 'Computer Science', '978-0262033848', 0]
    ];

    for (const [title, author, genre, isbn, qty] of starterBooks) {
      await pool.query(
        `INSERT IGNORE INTO books (title, author, genre, isbn, quantity)
         VALUES (?, ?, ?, ?, ?)`,
        [title, author, genre, isbn, qty]
      );
    }

    console.log(`[SEED] Starter books catalog verified (${starterBooks.length} titles).`);
    console.log('[SEED] Database seeding completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[SEED] Execution failed:', err.message);
    process.exit(1);
  }
})();
