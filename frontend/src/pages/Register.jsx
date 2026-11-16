import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    membership_id: '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');
  const [registeredUser, setRegisteredUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateId = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newId = `MEM-${randomNum}`;
    setForm((prev) => ({ ...prev, membership_id: newId }));
    setError('');
  };

  const validate = () => {
    if (!form.name.trim() || form.name.trim().length < 2) {
      return 'Please enter your full name (at least 2 characters)';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email.trim() || !emailRegex.test(form.email.trim())) {
      return 'Please enter a valid email address';
    }
    if (form.membership_id.trim() && !/^[A-Za-z0-9_-]{3,30}$/.test(form.membership_id.trim())) {
      return 'Membership ID must be 3-30 characters (letters, numbers, hyphens, underscores)';
    }
    if (!form.password || form.password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    if (form.password !== form.confirm_password) {
      return 'Passwords do not match';
    }
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validate();
    if (validationError) {
      return setError(validationError);
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirm_password: form.confirm_password,
        membership_id: form.membership_id.trim() || undefined,
      };

      const res = await api('/users/register', {
        method: 'POST',
        body: payload,
      });

      setRegisteredUser(res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Success view once registered
  if (registeredUser) {
    return (
      <div className="login-wrap">
        <div className="card login register-card">
          <h1 className="brand">NEXUS</h1>
          <p className="muted">Registration Successful</p>
          <div className="success-banner">
            <h3>Welcome, {registeredUser.name}!</h3>
            <p className="success-text">Your community membership account is ready.</p>
            <div className="id-highlight-box">
              <span className="muted" style={{ display: 'block', marginBottom: '4px' }}>Your Official Membership ID:</span>
              <strong className="id-display">{registeredUser.membership_id}</strong>
            </div>
            <p className="muted small-note" style={{ margin: '12px 0 16px' }}>
              Please save this Membership ID. You will use it together with your password to log in.
            </p>
            <button
              className="btn primary"
              style={{ width: '100%' }}
              onClick={() => navigate('/login', { state: { prefilledId: registeredUser.membership_id } })}
            >
              Proceed to Log in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <form className="card login register-card" onSubmit={submit}>
        <h1 className="brand">NEXUS</h1>
        <p className="muted">Community Member Registration</p>

        <div className="form-group">
          <input
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoComplete="name"
          />
        </div>

        <div className="form-group">
          <input
            type="email"
            placeholder="Email Address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              placeholder="Membership ID (Optional)"
              value={form.membership_id}
              onChange={(e) => setForm({ ...form, membership_id: e.target.value })}
              title="Leave empty to auto-generate or click Generate"
            />
            <button
              type="button"
              className="btn small"
              style={{ whiteSpace: 'nowrap', alignSelf: 'center' }}
              onClick={generateId}
              title="Generate a random unique Membership ID"
            >
              Auto ID
            </button>
          </div>
          <span className="muted" style={{ fontSize: '0.75rem', display: 'block', textAlign: 'left', marginTop: '3px' }}>
            Leave blank to automatically assign, or click &ldquo;Auto ID&rdquo;
          </span>
        </div>

        <div className="form-group">
          <input
            type="password"
            placeholder="Password (min. 6 characters)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete="new-password"
          />
        </div>

        <div className="form-group">
          <input
            type="password"
            placeholder="Confirm Password"
            value={form.confirm_password}
            onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
            autoComplete="new-password"
          />
        </div>

        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? 'Creating Account…' : 'Register as Member'}
        </button>

        {error && <p className="error">{error}</p>}

        <div className="auth-footer" style={{ marginTop: '12px' }}>
          <span className="muted">Already registered? </span>
          <Link to="/login" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
