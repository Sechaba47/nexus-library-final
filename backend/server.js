require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getJwtSecret } = require('./auth');

// Fail safely on startup if JWT_SECRET is missing or empty
try {
  getJwtSecret();
} catch (err) {
  console.error(err.message);
  console.error('Server startup halted: JWT_SECRET must be configured in backend/.env before running.');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

app.use('/books', require('./routes/books'));
app.use('/transactions', require('./routes/transactions'));
app.use('/users', require('./routes/users'));

app.get('/', (req, res) => res.json({ message: 'NEXUS Library API running' }));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'A record with that unique value already exists' });
  }
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
