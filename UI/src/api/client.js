const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api';

function getToken() {
  return localStorage.getItem('lms_token');
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${url}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_user');
    window.location.href = '/login';
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  if (res.status === 204) return null;
  return res.json();
}

const api = {
  get: (url) => request(url),
  post: (url, data) => request(url, { method: 'POST', body: JSON.stringify(data) }),
  put: (url, data) => request(url, { method: 'PUT', body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined) }),
  patch: (url, data) => request(url, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: (url) => request(url, { method: 'DELETE' }),
  del: (url) => request(url, { method: 'DELETE' }),
  upload: (url, formData) => request(url, { method: 'POST', body: formData }),
};

export default api;
