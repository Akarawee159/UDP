// src/api.js
import axios from 'axios';
import { setAuthToken } from './socketClient';

const API_PATH = import.meta.env.VITE_API_PATH;

if (!API_PATH) {
  console.error('❌ VITE_API_PATH is not defined in .env');
}

const api = axios.create({ baseURL: API_PATH });

// ใช้ flag บน window บอกว่ากำลังออกจากระบบอยู่
const isLoggingOut = () =>
  typeof window !== 'undefined' && !!window.__LOGGING_OUT__;

// ใส่ Authorization เฉพาะถ้าไม่ได้กำลังออกจากระบบ
api.interceptors.request.use((req) => {
  if (!isLoggingOut()) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

// ไม่ต้อง refresh สำหรับ endpoint เหล่านี้
const SKIP_REFRESH_PATHS = [
  '/auth/login',
  '/auth/refresh-token',
  '/auth/logout',
  '/auth/revoke-sessions',
  '/auth/password/expired-change',
];
const shouldSkipRefresh = (cfg) => {
  const url = (cfg?.url || '').toString();
  return SKIP_REFRESH_PATHS.some(p => url.startsWith(p));
};

let isRefreshing = false;
let queue = [];
const enqueue = () => new Promise((resolve, reject) => queue.push({ resolve, reject }));
const flush = (err, token) => { queue.forEach(p => (err ? p.reject(err) : p.resolve(token))); queue = []; };

api.interceptors.response.use(
  (res) => res,
  async (error) => {

    // ✅ กรณีรหัสผ่านหมดอายุ/ถูกบังคับเปลี่ยน → แจ้ง UI แบบ global
    if (error?.response?.status === 419 && error?.response?.data?.code === 'PASSWORD_EXPIRED') {
      const payload = error.response.data || {};
      try {
        window.dispatchEvent(new CustomEvent('hrms:password-expired', {
          detail: {
            resetToken: payload.resetToken || null,
            default_expiry_days: payload.default_expiry_days || 90,
          }
        }));
      } catch { }
      return Promise.reject(error);
    }

    const status = error?.response?.status;
    const original = error.config;

    // ถ้ากำลัง logout หรืออยู่ในลิสต์ skip → ไม่ต้อง refresh
    if (isLoggingOut() || shouldSkipRefresh(original)) {
      return Promise.reject(error);
    }

    if (status === 401 && !original?._retry) {
      if (isRefreshing) {
        const newToken = await enqueue();
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const rt = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
        if (!rt) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_PATH}/auth/refresh-token`, { refreshToken: rt });
        const { accessToken, refreshToken: newRT } = data;

        const useLocal = !!localStorage.getItem('refreshToken');
        const write = useLocal ? localStorage : sessionStorage;

        write.setItem('token', accessToken);
        if (newRT) write.setItem('refreshToken', newRT);

        setAuthToken(accessToken); // ← sync token ให้ socket

        flush(null, accessToken);

        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (err) {
        flush(err, null);
        try { localStorage.clear(); sessionStorage.clear(); } catch { }
        if (typeof window !== 'undefined') {
          window.location.replace('/'); // ← ไปหน้า login เท่านั้น
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
