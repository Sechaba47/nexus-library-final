import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const location = useLocation();
  const prefilledId = location.state?.prefilledId || '';

  const [form, setForm] = useState({ membership_id: prefilledId, password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.membership_id.trim() || !form.password) {
      return setError('Enter your membership ID and password');
    }
    setLoading(true);
    setError('');
    try {
      const data = await api('/users/login', { method: 'POST', body: form });
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={submit}>
        <h1 className="brand">NEXUS</h1>
        <p className="muted">Community Library Management</p>

        {prefilledId && (
          <div className="info-banner" style={{ fontSize: '0.85rem', color: 'var(--gold)', marginBottom: '8px' }}>
            Account created! Enter your password to log in.
          </div>
        )}

        <input
          placeholder="Membership ID"
          value={form.membership_id}
          onChange={(e) => setForm({ ...form, membership_id: e.target.value })}
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          autoComplete="current-password"
        />
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>

        {error && <p className="error">{error}</p>}

        <div className="auth-footer" style={{ marginTop: '12px' }}>
          <span className="muted">New community member? </span>
          <Link to="/register" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>
            Create an account
          </Link>
        </div>
      </form>
    </div>
  );
}
