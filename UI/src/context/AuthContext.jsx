import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState(localStorage.getItem('lms_avatar') || null);

  useEffect(() => {
    const token = localStorage.getItem('lms_token');
    const cached = localStorage.getItem('lms_user');
    if (token && cached) {
      setUser(JSON.parse(cached));
      api.get('/auth/me').then((u) => {
        setUser(u);
        localStorage.setItem('lms_user', JSON.stringify(u));
        api.get('/profile/avatar').then(r => {
          const url = r.avatar_path ? `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${r.avatar_path}` : null;
          setAvatarUrl(url);
          if (url) localStorage.setItem('lms_avatar', url);
        }).catch(() => {});
      }).catch(() => {
        localStorage.removeItem('lms_token');
        localStorage.removeItem('lms_user');
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password, role = null) => {
    const body = role ? { email, password, role } : { email, password };
    const res = await api.post('/auth/login', body);
    localStorage.setItem('lms_token', res.token);
    localStorage.setItem('lms_user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_user');
    localStorage.removeItem('lms_avatar');
    setUser(null);
    setAvatarUrl(null);
  };

  const roleRoute = (role) => {
    const routes = {
      admin: '/admin',
      manager: '/manager',
      new_joiner: '/training',
      employee: '/upskilling',
    };
    return routes[role] || '/';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, roleRoute, avatarUrl, setAvatarUrl }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
