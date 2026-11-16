import { useState } from 'react';

const EMPTY = { title: '', author: '', genre: '', isbn: '', quantity: 0 };

export default function BookForm({ initial = EMPTY, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.author.trim() || !form.genre.trim() || !form.isbn.trim()) {
      return setError('Title, author, genre and ISBN are required');
    }
    if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 0) {
      return setError('Quantity must be a whole number, 0 or more');
    }
    try {
      await onSubmit({ ...form, quantity: Number(form.quantity) });
      if (!onCancel) setForm(EMPTY);
      setError('');
    } catch (err) { setError(err.message); }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <input name="title" placeholder="Title" value={form.title} onChange={change} />
      <input name="author" placeholder="Author" value={form.author} onChange={change} />
      <input name="genre" placeholder="Genre" value={form.genre} onChange={change} />
      <input name="isbn" placeholder="ISBN" value={form.isbn} onChange={change} />
      <input name="quantity" type="number" min="0" placeholder="Quantity" value={form.quantity} onChange={change} />
      <div className="actions">
        <button className="btn primary" type="submit">{submitLabel}</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>Cancel</button>}
      </div>
      {error && <p className="error full">{error}</p>}
    </form>
  );
}
