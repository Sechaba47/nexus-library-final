const http = require('http');
const bcrypt = require('bcryptjs');

// Test suite isolation: isolated port, test-only secret, and isolated test credentials
const TEST_PORT = '5055';
const TEST_JWT_SECRET = 'nexus-isolated-test-secret-never-use-in-production-2026';
const TEST_ADMIN_MEMBERSHIP_ID = 'TEST_ADMIN_SUITE';
const TEST_ADMIN_PASSWORD = 'TestAdminPassword!987';

process.env.PORT = TEST_PORT;
process.env.JWT_SECRET = TEST_JWT_SECRET;

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/books', require('./routes/books'));
app.use('/transactions', require('./routes/transactions'));
app.use('/users', require('./routes/users'));

app.get('/', (req, res) => res.json({ message: 'NEXUS Library API running' }));

app.use((err, req, res, next) => {
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'A record with that unique value already exists' });
  }
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const pool = require('./db');
const { getJwtSecret } = require('./auth');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:${TEST_PORT}${path}`);
    const headers = options.headers || {};
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }
    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  const server = app.listen(Number(TEST_PORT));
  console.log(`Test server started on port ${TEST_PORT}`);

  const results = [];
  function assert(condition, message) {
    if (condition) {
      console.log(' [PASS]', message);
      results.push({ pass: true, message });
    } else {
      console.error(' [FAIL]', message);
      results.push({ pass: false, message });
    }
  }

  try {
    // 1. Security Check: verify getJwtSecret fails safely when JWT_SECRET is missing
    const savedSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    let failedSafely = false;
    try {
      getJwtSecret();
    } catch (err) {
      failedSafely = err.message.includes('JWT_SECRET');
    }
    process.env.JWT_SECRET = savedSecret;
    assert(failedSafely, 'auth.getJwtSecret() fails safely when JWT_SECRET is missing');

    // 2. Check API root
    const root = await request('/');
    assert(root.status === 200 && root.body.message.includes('NEXUS'), 'API root responds with 200 OK');

    // 3. Initialize isolated test administrator account in DB for the test run
    const testAdminHash = await bcrypt.hash(TEST_ADMIN_PASSWORD, 10);
    await pool.query(
      `INSERT INTO users (name, membership_id, email, password_hash, role)
       VALUES ('Test Suite Admin', ?, 'testadmin.suite@nexus.local', ?, 'admin')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'admin'`,
      [TEST_ADMIN_MEMBERSHIP_ID, testAdminHash]
    );

    // 4. Test admin login using isolated test credentials
    const adminLogin = await request('/users/login', {
      method: 'POST',
      body: { membership_id: TEST_ADMIN_MEMBERSHIP_ID, password: TEST_ADMIN_PASSWORD }
    });
    assert(adminLogin.status === 200, 'Admin login succeeded (isolated test credentials)');
    assert(adminLogin.body.role === 'admin', 'Admin user role is "admin"');
    assert(!!adminLogin.body.token, 'Admin receives signed JWT auth token');
    const adminToken = adminLogin.body.token;

    // 5. User Registration validation tests
    // 5a. Missing name
    const regNoName = await request('/users/register', {
      method: 'POST',
      body: { name: '', email: 'test@nexus.local', password: 'password123' }
    });
    assert(regNoName.status === 400, 'Registration rejects empty name (400)');

    // 5b. Invalid email
    const regBadEmail = await request('/users/register', {
      method: 'POST',
      body: { name: 'John Doe', email: 'invalid-email', password: 'password123' }
    });
    assert(regBadEmail.status === 400, 'Registration rejects invalid email format (400)');

    // 5c. Short password
    const regShortPass = await request('/users/register', {
      method: 'POST',
      body: { name: 'John Doe', email: 'john@nexus.local', password: '123' }
    });
    assert(regShortPass.status === 400, 'Registration rejects passwords < 6 chars (400)');

    // 5d. Password confirmation mismatch
    const regMismatch = await request('/users/register', {
      method: 'POST',
      body: { name: 'John Doe', email: 'john@nexus.local', password: 'password123', confirm_password: 'mismatch' }
    });
    assert(regMismatch.status === 400, 'Registration rejects mismatched confirmation (400)');

    // 5e. Attempting privilege escalation: passing role = 'admin'
    const testEmail1 = `community_${Date.now()}@nexus.local`;
    const regPrivEscalation = await request('/users/register', {
      method: 'POST',
      body: {
        name: 'Sneaky User',
        email: testEmail1,
        password: 'password123',
        confirm_password: 'password123',
        role: 'admin' // Attempting to escalate to admin
      }
    });
    assert(regPrivEscalation.status === 201, 'Registration created member account (201)');
    assert(regPrivEscalation.body.user.role === 'member', 'Privilege escalation blocked: role is forced to "member"');
    assert(regPrivEscalation.body.user.membership_id.startsWith('MEM-'), 'Auto-generated Membership ID format is MEM-XXXX');
    const member1 = regPrivEscalation.body.user;
    const member1Token = regPrivEscalation.body.token;

    // 5f. Duplicate email
    const regDupEmail = await request('/users/register', {
      method: 'POST',
      body: {
        name: 'Another User',
        email: testEmail1,
        password: 'password123'
      }
    });
    assert(regDupEmail.status === 409, 'Registration rejects duplicate email (409)');

    // 5g. Custom Membership ID
    const customMemId = `CUSTOM-${Date.now().toString().slice(-4)}`;
    const testEmail2 = `custom_${Date.now()}@nexus.local`;
    const regCustomId = await request('/users/register', {
      method: 'POST',
      body: {
        name: 'Custom Member',
        membership_id: customMemId,
        email: testEmail2,
        password: 'password123',
        confirm_password: 'password123'
      }
    });
    assert(regCustomId.status === 201, 'Registration with custom Membership ID succeeded (201)');
    assert(regCustomId.body.user.membership_id === customMemId, 'Assigned custom Membership ID matches');

    // 6. Member Login with Membership ID and password
    const memberLogin = await request('/users/login', {
      method: 'POST',
      body: { membership_id: member1.membership_id, password: 'password123' }
    });
    assert(memberLogin.status === 200, 'Member logged in successfully using Membership ID');
    assert(memberLogin.body.membership_id === member1.membership_id, 'Member login returned correct profile');
    assert(memberLogin.body.role === 'member', 'Member login returned role "member"');

    // 7. Role Protection tests
    // 7a. Member attempting to view all users
    const memberViewUsers = await request('/users', {
      headers: { Authorization: `Bearer ${member1Token}` }
    });
    assert(memberViewUsers.status === 403, 'Member blocked from viewing users list (403 Forbidden)');

    // 7b. Admin viewing all users
    const adminViewUsers = await request('/users', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminViewUsers.status === 200, 'Admin can view users list (200 OK)');
    assert(Array.isArray(adminViewUsers.body), 'Users list is an array');

    // 7c. Member attempting to add a book
    const memberAddBook = await request('/books', {
      method: 'POST',
      headers: { Authorization: `Bearer ${member1Token}` },
      body: { title: 'Hacker Book', author: 'Nobody', genre: 'Sci-Fi', isbn: `HACK-${Date.now()}`, quantity: 5 }
    });
    assert(memberAddBook.status === 403, 'Member blocked from adding books (403 Forbidden)');

    // 8. Books Management (Admin)
    const testIsbn = `978-0-${Date.now().toString().slice(-6)}`;
    const adminAddBook = await request('/books', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        title: 'Clean Architecture',
        author: 'Robert C. Martin',
        genre: 'Software Engineering',
        isbn: testIsbn,
        quantity: 3
      }
    });
    assert(adminAddBook.status === 201, 'Admin added new book (201 Created)');
    const bookId = adminAddBook.body.id;

    // 9. View Books (Accessible to all members)
    const viewBooks = await request('/books');
    assert(viewBooks.status === 200, 'Public/Members can view books catalog (200 OK)');
    const foundBook = viewBooks.body.find((b) => b.id === bookId);
    assert(!!foundBook && foundBook.quantity === 3, 'Created book found in catalog with quantity 3');

    // 10. Transactions (Stock Management & Borrowing/Returning)
    // 10a. Admin adds stock (+2 copies)
    const addStock = await request('/transactions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { book_id: bookId, type: 'add', quantity: 2 }
    });
    assert(addStock.status === 201, 'Admin added stock (+2 copies)');
    assert(addStock.body.new_stock === 5, 'Book quantity updated to 5');

    // 10b. Member blocked from adding stock
    const memberAddStock = await request('/transactions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${member1Token}` },
      body: { book_id: bookId, type: 'add', quantity: 1 }
    });
    assert(memberAddStock.status === 403, 'Member blocked from adding inventory stock (403 Forbidden)');

    // 10c. Member borrows a copy
    const memberBorrow = await request('/transactions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${member1Token}` },
      body: { book_id: bookId, type: 'borrow', quantity: 1 }
    });
    assert(memberBorrow.status === 201, 'Member borrowed 1 copy successfully');
    assert(memberBorrow.body.new_stock === 4, 'Book stock decremented to 4');

    // 10d. Member attempting to borrow more than available stock
    const memberOverBorrow = await request('/transactions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${member1Token}` },
      body: { book_id: bookId, type: 'borrow', quantity: 999 }
    });
    assert(memberOverBorrow.status === 400, 'Borrowing more than available stock rejected (400)');

    // 10e. Member returns the borrowed copy
    const memberReturn = await request('/transactions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${member1Token}` },
      body: { book_id: bookId, type: 'return', quantity: 1 }
    });
    assert(memberReturn.status === 201, 'Member returned book successfully');
    assert(memberReturn.body.new_stock === 5, 'Book stock restored to 5');

    // 10f. Admin deducts stock (-4 copies, leaving 1)
    const deductStock = await request('/transactions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { book_id: bookId, type: 'deduct', quantity: 4 }
    });
    assert(deductStock.status === 201, 'Admin deducted stock (-4 copies)');
    assert(deductStock.body.new_stock === 1, 'Book stock is now 1 (Low stock threshold < 2)');

    // 10g. Member transaction history (only their own)
    const memberHistory = await request('/transactions', {
      headers: { Authorization: `Bearer ${member1Token}` }
    });
    assert(memberHistory.status === 200, 'Member can fetch their transaction history');
    assert(memberHistory.body.every((t) => t.user_id === member1.id), 'Member history contains only their own transactions');

    // 10h. Admin transaction history (sees all)
    const adminHistory = await request('/transactions', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminHistory.status === 200, 'Admin can fetch full transaction history');
    assert(adminHistory.body.length >= 4, 'Admin history contains all library transactions');

    // 11. Admin self-deletion protection
    const [testAdminRow] = await pool.query('SELECT id FROM users WHERE membership_id = ?', [TEST_ADMIN_MEMBERSHIP_ID]);
    if (testAdminRow.length > 0) {
      const deleteSelf = await request(`/users/${testAdminRow[0].id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(deleteSelf.status === 400, 'Admin account protected from self-deletion (400)');
    }

    // Clean up isolated test admin account from DB
    await pool.query('DELETE FROM users WHERE membership_id = ?', [TEST_ADMIN_MEMBERSHIP_ID]);
    console.log(' [PASS] Isolated test administrator account cleaned up');

    console.log('\n===========================================');
    const passed = results.filter((r) => r.pass).length;
    const total = results.length;
    console.log(`TEST SUMMARY: ${passed}/${total} assertions passed.`);
    console.log('===========================================\n');
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    server.close(() => {
      console.log('Test server closed.');
      process.exit(0);
    });
  }
}

runTests();
