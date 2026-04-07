import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('lms_token');
    const cached = localStorage.getItem('lms_user');
    if (token && cached) {
      setUser(JSON.parse(cached));
      api.get('/auth/me').then((u) => {
        setUser(u);
        localStorage.setItem('lms_user', JSON.stringify(u));
      }).catch(() => {
        localStorage.removeItem('lms_token');
        localStorage.removeItem('lms_user');
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('lms_token', res.token);
    localStorage.setItem('lms_user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_user');
    setUser(null);
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
    <AuthContext.Provider value={{ user, loading, login, logout, roleRoute }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
