import { useEffect, useState } from 'react';
import { api } from '../api.js';

const EMPTY = { name: '', membership_id: '', email: '', password: '', role: 'member' };

export default function Users({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    api('/users')
      .then(setUsers)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
    setError('');
  };

  const generateId = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setForm((prev) => ({ ...prev, membership_id: `MEM-${randomNum}` }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim() || !form.membership_id.trim()) {
      return setError('Name and Membership ID are required');
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return setError('Please enter a valid email address');
    }

    if (!editingId && (!form.password || form.password.length < 6)) {
      return setError('Password must be at least 6 characters for new users');
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        membership_id: form.membership_id.trim(),
        email: form.email.trim() || null,
        password: form.password || undefined,
        role: form.role,
      };

      if (editingId) {
        await api('/users/' + editingId, { method: 'PUT', body: payload });
        setSuccess(`User "${form.name}" updated successfully!`);
      } else {
        await api('/users', { method: 'POST', body: payload });
        setSuccess(`User "${form.name}" created successfully!`);
      }

      reset();
      load();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const edit = (u) => {
    setEditingId(u.id);
    setForm({
      name: u.name,
      membership_id: u.membership_id,
      email: u.email || '',
      password: '',
      role: u.role,
    });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (u) => {
    if (u.id === currentUser.id) {
      return setError('You cannot delete your own logged-in administrator account.');
    }
    if (!window.confirm(`Delete user "${u.name}" (${u.membership_id})?`)) return;

    setError('');
    try {
      await api('/users/' + u.id, { method: 'DELETE' });
      setSuccess(`User "${u.name}" deleted.`);
      setTimeout(() => setSuccess(''), 4000);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <h2>User Management</h2>

      {error && <p className="error">{error}</p>}
      {success && <p className="success-banner" style={{ color: 'var(--gold)', borderColor: 'var(--gold)' }}>{success}</p>}

      <div className="card">
        <h3>{editingId ? `Update User #${editingId}` : 'Add New User'}</h3>
        <form className="form-grid" onSubmit={submit}>
          <input
            name="name"
            placeholder="Full Name"
            value={form.name}
            onChange={change}
          />

          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              name="membership_id"
              placeholder="Membership ID"
              value={form.membership_id}
              onChange={change}
            />
            {!editingId && (
              <button
                type="button"
                className="btn small"
                onClick={generateId}
                title="Auto-generate Membership ID"
                style={{ whiteSpace: 'nowrap' }}
              >
                Auto
              </button>
            )}
          </div>

          <input
            name="email"
            type="email"
            placeholder="Email Address"
            value={form.email}
            onChange={change}
          />

          <input
            name="password"
            type="password"
            placeholder={editingId ? 'New Password (leave empty to keep)' : 'Password (min. 6 chars)'}
            value={form.password}
            onChange={change}
          />

          <select name="role" value={form.role} onChange={change}>
            <option value="member">Member</option>
            <option value="admin">Administrator</option>
          </select>

          <div className="actions full">
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Saving…' : editingId ? 'Save Changes' : 'Create User'}
            </button>
            {editingId && (
              <button className="btn" type="button" onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card table-wrap">
        <h3>Registered Users ({users.length})</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Membership ID</th>
              <th>Email</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong></td>
                <td><code>{u.membership_id}</code></td>
                <td>{u.email || '—'}</td>
                <td>
                  <span className={`badge ${u.role === 'admin' ? 'role-admin' : ''}`}>
                    {u.role.toUpperCase()}
                  </span>
                </td>
                <td className="actions">
                  <button className="btn small" onClick={() => edit(u)}>Update</button>
                  <button
                    className="btn small danger"
                    disabled={u.id === currentUser.id}
                    title={u.id === currentUser.id ? 'Cannot delete your own account' : 'Delete user'}
                    onClick={() => remove(u)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!users.length && (
              <tr>
                <td colSpan="5" className="muted" style={{ textAlign: 'center' }}>No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
