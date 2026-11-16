import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const LOW_STOCK = 2;

export default function Dashboard({ user }) {
  const [books, setBooks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    api('/books')
      .then(setBooks)
      .catch((e) => setError(e.message));

    api('/transactions')
      .then(setTransactions)
      .catch(() => {});

    if (isAdmin) {
      api('/users')
        .then((u) => setUsersCount(u.length))
        .catch(() => {});
    }
  }, [isAdmin]);

  const low = books.filter((b) => b.quantity < LOW_STOCK);
  const totalStock = books.reduce((sum, b) => sum + b.quantity, 0);

  // Calculate member active borrowings
  const memberBorrows = transactions.filter(
    (t) => t.user_id === user?.id && t.type === 'borrow'
  ).reduce((acc, t) => acc + t.quantity, 0);
  const memberReturns = transactions.filter(
    (t) => t.user_id === user?.id && t.type === 'return'
  ).reduce((acc, t) => acc + t.quantity, 0);
  const activeBorrows = Math.max(0, memberBorrows - memberReturns);

  const filteredBooks = books.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.genre.toLowerCase().includes(q) ||
      b.isbn.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="dashboard-header" style={{ marginBottom: '16px' }}>
        <h2>{isAdmin ? 'Admin Dashboard' : 'Member Dashboard'}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {isAdmin
            ? 'Overview of library inventory, transactions and members'
            : `Welcome back, ${user?.name}! Browse library titles and track your borrowings.`}
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      {isAdmin ? (
        // Admin Dashboard Stats
        <>
          <div className="stats">
            <div className="card">
              <span className="muted">Book Titles</span>
              <strong>{books.length}</strong>
            </div>
            <div className="card">
              <span className="muted">Copies in Stock</span>
              <strong>{totalStock}</strong>
            </div>
            <div className="card" style={low.length > 0 ? { borderColor: 'var(--red)' } : {}}>
              <span className="muted">Low Stock Titles</span>
              <strong style={low.length > 0 ? { color: 'var(--red)' } : {}}>{low.length}</strong>
            </div>
            <div className="card">
              <span className="muted">Registered Users</span>
              <strong>{usersCount}</strong>
            </div>
            <div className="card">
              <span className="muted">Total Transactions</span>
              <strong>{transactions.length}</strong>
            </div>
          </div>

          {low.length > 0 && (
            <div className="card alert-box" style={{ borderColor: 'var(--red)', background: 'rgba(192,80,77,0.1)' }}>
              <strong style={{ color: 'var(--red)' }}>⚠️ Low Stock Alert:</strong>
              <span style={{ marginLeft: '8px' }}>
                {low.length} {low.length === 1 ? 'title has' : 'titles have'} less than {LOW_STOCK} copies available ({low.map((b) => b.title).join(', ')}).
              </span>
            </div>
          )}

          <div className="card quick-actions-card">
            <h3>Quick Admin Actions</h3>
            <div className="actions">
              <Link to="/books" className="btn primary">Manage Books</Link>
              <Link to="/transactions" className="btn">Record Stock / Transaction</Link>
              <Link to="/users" className="btn">Manage Users</Link>
            </div>
          </div>
        </>
      ) : (
        // Member Dashboard Stats
        <div className="stats">
          <div className="card">
            <span className="muted">Available Titles</span>
            <strong>{books.length}</strong>
          </div>
          <div className="card">
            <span className="muted">Total Copies in Library</span>
            <strong>{totalStock}</strong>
          </div>
          <div className="card">
            <span className="muted">My Active Borrowings</span>
            <strong style={{ color: activeBorrows > 0 ? 'var(--gold)' : 'inherit' }}>
              {activeBorrows}
            </strong>
          </div>
        </div>
      )}

      <div className="card table-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0 }}>Available Library Catalog</h3>
          <input
            placeholder="Search by title, author, genre or ISBN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '300px' }}
          />
        </div>

        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>Genre</th>
              <th>ISBN</th>
              <th>Available Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredBooks.map((b) => {
              const isLow = b.quantity < LOW_STOCK;
              const isOutOfStock = b.quantity === 0;
              return (
                <tr key={b.id} className={isLow ? 'low' : ''}>
                  <td><strong>{b.title}</strong></td>
                  <td>{b.author}</td>
                  <td>{b.genre}</td>
                  <td>{b.isbn}</td>
                  <td>{b.quantity}</td>
                  <td>
                    {isOutOfStock ? (
                      <span className="badge" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>Out of stock</span>
                    ) : isLow ? (
                      <span className="badge">Low stock (&lt; {LOW_STOCK})</span>
                    ) : (
                      <span className="badge in-stock">In stock</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!filteredBooks.length && (
              <tr>
                <td colSpan="6" className="muted" style={{ textAlign: 'center', padding: '16px' }}>
                  {books.length === 0 ? 'No books cataloged yet.' : 'No books matching your search query.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
