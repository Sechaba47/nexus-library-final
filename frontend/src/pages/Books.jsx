import { useEffect, useState } from 'react';
import { api } from '../api.js';
import BookForm from '../components/BookForm.jsx';

const LOW_STOCK = 2;

export default function Books({ user }) {
  const [books, setBooks] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  const isAdmin = user?.role === 'admin';

  const load = () => {
    api('/books')
      .then(setBooks)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (data) => {
    try {
      await api('/books', { method: 'POST', body: data });
      setSuccess(`Book "${data.title}" added successfully!`);
      setTimeout(() => setSuccess(''), 4000);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const update = async (id, data) => {
    try {
      await api('/books/' + id, { method: 'PUT', body: data });
      setEditingId(null);
      setSuccess(`Book "${data.title}" updated successfully!`);
      setTimeout(() => setSuccess(''), 4000);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (b) => {
    if (!window.confirm(`Delete "${b.title}"? All transaction records for this book will also be removed.`)) return;
    try {
      await api('/books/' + b.id, { method: 'DELETE' });
      setSuccess(`Book "${b.title}" deleted.`);
      setTimeout(() => setSuccess(''), 4000);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  // Member action: Borrow a book directly from the books page
  const borrowBook = async (b) => {
    if (b.quantity <= 0) {
      return setError(`"${b.title}" is currently out of stock.`);
    }
    if (!window.confirm(`Borrow a copy of "${b.title}"?`)) return;

    setError('');
    try {
      await api('/transactions', {
        method: 'POST',
        body: {
          book_id: b.id,
          type: 'borrow',
          quantity: 1,
        },
      });
      setSuccess(`Successfully borrowed 1 copy of "${b.title}"!`);
      setTimeout(() => setSuccess(''), 4000);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <h2>{isAdmin ? 'Book Management' : 'Library Book Catalog'}</h2>
        <input
          placeholder="Search by title, author, genre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '280px' }}
        />
      </div>

      {error && <p className="error">{error}</p>}
      {success && <p className="success-banner" style={{ color: 'var(--gold)', borderColor: 'var(--gold)' }}>{success}</p>}

      {/* Admin Only: Add new book form */}
      {isAdmin && (
        <div className="card">
          <h3>Add new book</h3>
          <BookForm submitLabel="Add book" onSubmit={add} />
        </div>
      )}

      {/* Book List / Cards */}
      <div className="card">
        <h3>Books ({filteredBooks.length})</h3>
        {filteredBooks.map((b) => {
          const isLow = b.quantity < LOW_STOCK;
          const isOutOfStock = b.quantity === 0;

          return (
            <div className={`row ${isLow ? 'low-stock-row' : ''}`} key={b.id}>
              {editingId === b.id && isAdmin ? (
                <BookForm
                  initial={b}
                  submitLabel="Save Changes"
                  onSubmit={(d) => update(b.id, d)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <div className="grow">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.05rem' }}>{b.title}</strong>
                      {isOutOfStock ? (
                        <span className="badge" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>Out of stock</span>
                      ) : isLow ? (
                        <span className="badge">Low stock</span>
                      ) : (
                        <span className="badge in-stock">In stock</span>
                      )}
                    </div>
                    <div className="muted" style={{ marginTop: '4px' }}>
                      By {b.author} · Genre: {b.genre} · ISBN: {b.isbn} · Available: <strong>{b.quantity}</strong>
                    </div>
                  </div>

                  <div className="actions">
                    {isAdmin ? (
                      <>
                        <button className="btn small" onClick={() => setEditingId(b.id)}>Update</button>
                        <button className="btn small danger" onClick={() => remove(b)}>Delete</button>
                      </>
                    ) : (
                      <button
                        className="btn small primary"
                        disabled={isOutOfStock}
                        onClick={() => borrowBook(b)}
                        title={isOutOfStock ? 'Currently out of stock' : 'Borrow this book'}
                      >
                        {isOutOfStock ? 'Unavailable' : 'Borrow Book'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {!filteredBooks.length && (
          <p className="muted">
            {books.length === 0 ? 'No books cataloged in the library yet.' : 'No books matching your search query.'}
          </p>
        )}
      </div>
    </>
  );
}
