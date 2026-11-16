const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  let res;

  // Retrieve current user session if available
  let token = null;
  let userRole = null;
  let userId = null;
  try {
    const stored = JSON.parse(sessionStorage.getItem('nexus_user'));
    if (stored) {
      token = stored.token;
      userRole = stored.role;
      userId = stored.id;
    }
  } catch {
    // Ignore JSON parse errors for user session
  }

  const reqHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }
  if (userRole) {
    reqHeaders['X-User-Role'] = userRole;
  }
  if (userId) {
    reqHeaders['X-User-Id'] = String(userId);
  }

  try {
    res = await fetch(BASE + path, {
      method,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the API on ' + BASE + '. Is the backend running?');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
