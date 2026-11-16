const pool = require('./db');

async function migrate() {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM users LIKE 'email'");
    if (cols.length === 0) {
      console.log('Adding email column to users table...');
      await pool.query("ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL UNIQUE AFTER membership_id");
      await pool.query("UPDATE users SET email = 'admin@nexus.local' WHERE membership_id = 'ADMIN001' AND email IS NULL");
      console.log('Email column added and admin updated.');
    } else {
      console.log('Email column already exists.');
    }

    console.log('Modifying transactions type ENUM...');
    await pool.query("ALTER TABLE transactions MODIFY COLUMN type ENUM('add', 'deduct', 'borrow', 'return') NOT NULL");
    console.log('Transactions type ENUM updated to add, deduct, borrow, return.');

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
