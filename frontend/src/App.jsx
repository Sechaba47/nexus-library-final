import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Books from './pages/Books.jsx';
import Transactions from './pages/Transactions.jsx';
import Users from './pages/Users.jsx';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('nexus_user'));
    } catch {
      return null;
    }
  });

  const login = (u) => {
    sessionStorage.setItem('nexus_user', JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    sessionStorage.removeItem('nexus_user');
    setUser(null);
  };

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={login} />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <Navbar user={user} onLogout={logout} />
      <main className="container">
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/books" element={<Books user={user} />} />
          <Route path="/transactions" element={<Transactions user={user} />} />
          <Route
            path="/users"
            element={user.role === 'admin' ? <Users currentUser={user} /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
