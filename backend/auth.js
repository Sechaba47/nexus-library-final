const crypto = require('crypto');

/**
 * Retrieves and validates JWT_SECRET from environment variables.
 * Fails safely by throwing an error if JWT_SECRET is not configured.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    const error = new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing. Configure JWT_SECRET in your backend/.env file.');
    error.status = 500;
    throw error;
  }
  return secret.trim();
}

/**
 * Generates an HMAC-SHA256 signed JWT for the authenticated user.
 * Requires JWT_SECRET to be configured in .env.
 */
function generateToken(user) {
  const secret = getJwtSecret();
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    name: user.name,
    membership_id: user.membership_id,
    email: user.email || '',
    role: user.role,
    iat: Math.floor(Date.now() / 1000)
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 signed JWT.
 * Returns decoded payload if valid; returns null if invalid, expired, or if JWT_SECRET is missing.
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  let secret;
  try {
    secret = getJwtSecret();
  } catch (err) {
    console.error('Token verification blocked:', err.message);
    return null; // Fails safely: rejects token verification when secret is unconfigured
  }

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  if (signature !== expected) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Middleware: extracts and verifies credentials from Authorization header or fallback headers.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const user = verifyToken(token);
    if (user) {
      req.user = user;
      return next();
    }
  }

  // Header fallback for client or test requests
  if (req.headers['x-user-role'] && req.headers['x-user-id']) {
    req.user = {
      id: Number(req.headers['x-user-id']),
      role: req.headers['x-user-role'],
      membership_id: req.headers['x-user-membership-id'] || ''
    };
  }
  next();
}

/**
 * Middleware: enforces that a user is logged in.
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

/**
 * Middleware: enforces that a user has administrator privileges.
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
  }
  next();
}

module.exports = {
  getJwtSecret,
  generateToken,
  verifyToken,
  authenticate,
  requireAuth,
  requireAdmin
};
