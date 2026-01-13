// src/hooks/useAuth.js
import { useEffect, useState } from 'react';
import api from '../api';

const read = (k) => localStorage.getItem(k) || sessionStorage.getItem(k);

export default function useAuth() {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(read('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = read('token');
    const u = read('user');
    if (t && u) {
      try { setUser(JSON.parse(u)); setToken(t); }
      catch { localStorage.removeItem('user'); sessionStorage.removeItem('user'); }
    }
    setLoading(false);
  }, []);

  const login = (accessToken, userData, { remember = true, refreshToken } = {}) => {
    const storage = remember ? localStorage : sessionStorage;
    const other   = remember ? sessionStorage : localStorage;
    ['token','user','refreshToken'].forEach(k => other.removeItem(k));

    storage.setItem('token', accessToken);
    storage.setItem('user', JSON.stringify(userData));
    if (refreshToken) storage.setItem('refreshToken', refreshToken);

    setToken(accessToken);
    setUser(userData);
  };

  const logout = async () => {
    try {
      const rt = read('refreshToken');
      if (rt) {
        // ✅ เลิกอ้าง config.apiPath และเรียกผ่าน axios instance เดียว
        await api.post('/auth/logout', { refreshToken: rt });
      }
    } catch (_) {
      // เงียบไว้ ไม่บล็อกการออกจากระบบ
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      setToken(null);
      setUser(null);
      if (window.location.pathname !== '/') window.location.replace('/'); // กลับหน้าแรกเสมอ
    }
  };

  return { user, token, loading, login, logout };
}
