import { NavLink } from 'react-router-dom';

export default function Navbar({ user, onLogout }) {
  const isAdmin = user.role === 'admin';

  return (
    <header className="navbar">
      <span className="brand">NEXUS</span>
      <nav>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/books">Books</NavLink>
        <NavLink to="/transactions">{isAdmin ? 'Transactions' : 'My Borrowings'}</NavLink>
        {isAdmin && <NavLink to="/users">Users</NavLink>}
      </nav>
      <div className="nav-user">
        <span className="user-info">
          <strong>{user.name}</strong>
          <span className={`role-badge ${user.role}`}>
            {isAdmin ? 'ADMIN' : 'MEMBER'}
          </span>
          {user.membership_id && (
            <span className="membership-tag">#{user.membership_id}</span>
          )}
        </span>
        <button className="btn small" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}
