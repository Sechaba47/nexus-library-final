import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Transactions({ user }) {
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({ book_id: '', type: 'add', quantity: 1, user_id: '' });
  const [memberBorrowBookId, setMemberBorrowBookId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.role === 'admin';

  const load = () => {
    api('/books')
      .then(setBooks)
      .catch((e) => setError(e.message));

    api('/transactions')
      .then(setHistory)
      .catch((e) => setError(e.message));

    if (isAdmin) {
      api('/users')
        .then(setUsers)
        .catch(() => {});
    }
  };

  useEffect(() => {
    load();
  }, [isAdmin]);

  // Admin submit handler
  const submitAdminTransaction = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.book_id) return setError('Please select a book');
    const qty = Number(form.quantity);
    if (!Number.isInteger(qty) || qty < 1) return setError('Quantity must be a whole number of at least 1');

    if (['borrow', 'return'].includes(form.type) && !form.user_id) {
      return setError('Please select the user for borrowing or returning books');
    }

    setLoading(true);
    try {
      await api('/transactions', {
        method: 'POST',
        body: {
          book_id: Number(form.book_id),
          type: form.type,
          quantity: qty,
          user_id: form.user_id ? Number(form.user_id) : user.id,
        },
      });

      setSuccess(`Transaction recorded successfully (${form.type})`);
      setForm({ book_id: '', type: 'add', quantity: 1, user_id: '' });
      setTimeout(() => setSuccess(''), 4000);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Member submit handler (borrow)
  const submitMemberBorrow = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!memberBorrowBookId) return setError('Please select a book to borrow');
    const selected = books.find((b) => b.id === Number(memberBorrowBookId));
    if (selected && selected.quantity < 1) return setError('Selected book is out of stock');

    setLoading(true);
    try {
      await api('/transactions', {
        method: 'POST',
        body: {
          book_id: Number(memberBorrowBookId),
          type: 'borrow',
          quantity: 1,
        },
      });

      setSuccess(`Book "${selected?.title || ''}" borrowed successfully!`);
      setMemberBorrowBookId('');
      setTimeout(() => setSuccess(''), 4000);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Member return handler
  const returnBook = async (bookId, bookTitle) => {
    if (!window.confirm(`Return "${bookTitle}" to the library?`)) return;

    setError('');
    setSuccess('');
    try {
      await api('/transactions', {
        method: 'POST',
        body: {
          book_id: bookId,
          type: 'return',
          quantity: 1,
        },
      });

      setSuccess(`Successfully returned "${bookTitle}"!`);
      setTimeout(() => setSuccess(''), 4000);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  // Compute active borrowings for the member
  const memberActiveBorrows = [];
  if (!isAdmin) {
    const bookBalanceMap = {};
    history.forEach((t) => {
      if (t.user_id === user.id) {
        if (!bookBalanceMap[t.book_id]) {
          bookBalanceMap[t.book_id] = { book_id: t.book_id, book_title: t.book_title, balance: 0 };
        }
        if (t.type === 'borrow') bookBalanceMap[t.book_id].balance += t.quantity;
        if (t.type === 'return') bookBalanceMap[t.book_id].balance -= t.quantity;
      }
    });

    Object.values(bookBalanceMap).forEach((item) => {
      if (item.balance > 0) {
        memberActiveBorrows.push(item);
      }
    });
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'add': return 'Stock Added';
      case 'deduct': return 'Stock Deducted';
      case 'borrow': return 'Borrowed';
      case 'return': return 'Returned';
      default: return type;
    }
  };

  return (
    <>
      <h2>{isAdmin ? 'Stock & Transaction Management' : 'My Borrowings & Returns'}</h2>

      {error && <p className="error">{error}</p>}
      {success && <p className="success-banner" style={{ color: 'var(--gold)', borderColor: 'var(--gold)' }}>{success}</p>}

      {isAdmin ? (
        // Admin Transaction / Stock Form
        <div className="card">
          <h3>Record Transaction / Adjust Stock</h3>
          <form className="form-grid" onSubmit={submitAdminTransaction}>
            <select
              value={form.book_id}
              onChange={(e) => setForm({ ...form, book_id: e.target.value })}
            >
              <option value="">Select Book…</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} (Stock: {b.quantity})
                </option>
              ))}
            </select>

            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="add">Add Stock (New Arrivals)</option>
              <option value="deduct">Deduct Stock (Damage / Loss)</option>
              <option value="borrow">Borrow Book (Assign to Member)</option>
              <option value="return">Return Book (From Member)</option>
            </select>

            {['borrow', 'return'].includes(form.type) && (
              <select
                value={form.user_id}
                onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              >
                <option value="">Select Member…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.membership_id})
                  </option>
                ))}
              </select>
            )}

            <input
              type="number"
              min="1"
              placeholder="Quantity"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />

            <div className="actions">
              <button className="btn primary" type="submit" disabled={loading}>
                {loading ? 'Recording…' : 'Record Transaction'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        // Member View: Active Borrowings & Borrow Form
        <>
          <div className="card">
            <h3>Currently Borrowed Books</h3>
            {memberActiveBorrows.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {memberActiveBorrows.map((item) => (
                  <div key={item.book_id} className="row" style={{ alignItems: 'center' }}>
                    <div className="grow">
                      <strong>{item.book_title}</strong>
                      <div className="muted">Currently holding: {item.balance} {item.balance === 1 ? 'copy' : 'copies'}</div>
                    </div>
                    <button
                      className="btn small primary"
                      onClick={() => returnBook(item.book_id, item.book_title)}
                    >
                      Return Book
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">You currently do not have any borrowed books.</p>
            )}
          </div>

          <div className="card">
            <h3>Borrow a Book</h3>
            <form className="form-grid" onSubmit={submitMemberBorrow} style={{ maxWidth: '600px' }}>
              <select
                value={memberBorrowBookId}
                onChange={(e) => setMemberBorrowBookId(e.target.value)}
              >
                <option value="">Select an available book to borrow…</option>
                {books.filter((b) => b.quantity > 0).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} (Available: {b.quantity})
                  </option>
                ))}
              </select>

              <div className="actions">
                <button className="btn primary" type="submit" disabled={loading}>
                  {loading ? 'Processing…' : 'Borrow Book'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Transaction History Log */}
      <div className="card table-wrap">
        <h3>{isAdmin ? 'All Library Transactions' : 'My Transaction History'}</h3>
        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Book</th>
              <th>Type</th>
              <th>Qty</th>
              <th>{isAdmin ? 'Member' : 'Account'}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((t) => {
              const isPositive = t.type === 'add' || t.type === 'return';
              return (
                <tr key={t.id}>
                  <td>{new Date(t.created_at).toLocaleString()}</td>
                  <td><strong>{t.book_title}</strong></td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        borderColor: isPositive ? 'var(--gold)' : 'var(--line)',
                        color: isPositive ? 'var(--gold)' : 'var(--text)',
                      }}
                    >
                      {getTypeLabel(t.type)}
                    </span>
                  </td>
                  <td>{t.quantity}</td>
                  <td>
                    {t.user_name ? `${t.user_name} (${t.membership_id || 'ID: ' + t.user_id})` : '—'}
                  </td>
                </tr>
              );
            })}
            {!history.length && (
              <tr>
                <td colSpan="5" className="muted" style={{ textAlign: 'center', padding: '16px' }}>
                  No transaction records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
