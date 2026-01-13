// src/pages/LockScreen.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LockOutlined,
  UserOutlined,
  ArrowRightOutlined,
  LogoutOutlined,
  SafetyCertificateFilled
} from '@ant-design/icons';
import { message, Avatar } from 'antd';
import api from '../api';
import useAuth from '../hooks/useAuth';
import { BEFORE_LOCK_KEY, LOCK_KEY, dispatchUnlock } from '../hooks/useIdleLock';
import { disconnect } from '../socketClient';

export default function LockScreen() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const userJson = localStorage.getItem('user') || sessionStorage.getItem('user');
  const user = userJson ? JSON.parse(userJson) : null;
  const username = user?.username || '';
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // State และ Logic คำนวณ Base URL (ลอกมาจาก Navbar)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const BE_BASE = useMemo(() => {
    const base = api.defaults?.baseURL || "";
    if (/^https?:\/\//i.test(base)) return base.replace(/\/api\/?$/, "");
    if (base.startsWith("/")) return (window.location.origin + base).replace(/\/api\/?$/, "");
    return window.location.origin;
  }, []);

  // useEffect เพื่อดึงรูปโปรไฟล์ล่าสุดจาก Server
  useEffect(() => {
    if (!username) return; // ถ้าไม่มี user ไม่ต้องโหลด
    const fetchProfile = async () => {
      try {
        const { data } = await api.get("/management/me");
        const filename = data?.data?.profileImg;
        if (filename) {
          // ใส่ timestamp ?v=... เพื่อป้องกัน Browser จำรูปเก่า (Caching)
          setAvatarUrl(`${BE_BASE}/img/profile/${filename}?v=${Date.now()}`);
        }
      } catch (err) {
        console.error("Failed to load profile image", err);
      }
    };
    fetchProfile();
  }, [username, BE_BASE]);

  // ✅ Ping auth เพื่อตรวจ token-version ทุก ๆ 10 วิ (Logic เดิม)
  useEffect(() => {
    let timer;
    const ping = async () => {
      try {
        await api.get('/auth/ping'); // ถ้า token ถูก revoke → 401 ที่นี่
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) {
          try { localStorage.clear(); sessionStorage.clear(); } catch { }
          navigate('/', { replace: true }); // เด้งออกอัตโนมัติ
          return; // หยุด loop
        }
      } finally {
        timer = setTimeout(ping, 10000);
      }
    };
    ping();
    return () => clearTimeout(timer);
  }, [navigate]);

  const unlock = async () => {
    if (!username || !password) {
      message.warning('กรอกรหัสผ่านเพื่อปลดล็อก');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/verify', { username, password });
      localStorage.removeItem(LOCK_KEY);
      dispatchUnlock();
      const back = sessionStorage.getItem(BEFORE_LOCK_KEY) || '/home';
      sessionStorage.removeItem(BEFORE_LOCK_KEY);
      message.success('ปลดล็อกสำเร็จ');
      navigate(back, { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      if (code === 'USER_FORBIDDEN') {
        message.error('ผู้ใช้นี้ ไม่อนุญาตให้ใช้งาน');
        // ⬇️ ถูกแบนอยู่ → เคลียร์แล้วกลับหน้าแรกทันที
        try { localStorage.clear(); sessionStorage.clear(); } catch { }
        navigate('/', { replace: true });
      } else if (status === 401) {
        message.error('รหัสผ่านไม่ถูกต้อง');
      } else {
        message.error('ปลดล็อกไม่สำเร็จ');
      }
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  // ปุ่ม “ไม่ใช่คุณใช่ไหม?” = logout เต็มรูปแบบ
  const goLogin = async () => {
    try {
      await logout();
    } catch {
      // เงียบได้
    } finally {
      // ✅ เรียก disconnect จาก socketClient (ถ้ามี import)
      try { if (typeof disconnect === 'function') disconnect(); } catch { }

      try { localStorage.clear(); sessionStorage.clear(); } catch { }
      navigate('/', { replace: true });
    }
  };

  return (
    // เปลี่ยน Gradient พื้นหลังเป็นโทนน้ำเงิน-คราม
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-100 via-indigo-50 to-white overflow-hidden">

      {/* --- Decorative Background Elements --- */}
      <div className="absolute inset-0 pointer-events-none">
        {/* เปลี่ยนรัศมี Gradient เป็นสีน้ำเงิน */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_120%,rgba(37,99,235,0.1),transparent)]" />
        {/* เปลี่ยน Blob เป็นสีน้ำเงินและคราม */}
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-indigo-300/20 rounded-full blur-3xl" />
      </div>

      {/* --- Main Card --- */}
      <div className="relative w-full max-w-md bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border border-white/60 p-8 text-center">

        {/* Header Icon - เปลี่ยนธีมเป็นสีน้ำเงิน */}
        <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-b from-blue-100 to-white border border-blue-100 flex items-center justify-center mb-6 shadow-inner">
          <LockOutlined className="text-3xl text-blue-600 drop-shadow-sm" />
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-1">หน้าจอถูกล็อก</h1>
        <p className="text-gray-500 text-sm mb-8">ระบบล็อกหน้าจออัตโนมัติเพื่อความปลอดภัย</p>

        {username ? (
          <div className="space-y-6">
            {/* User Profile Card */}
            <div className="flex flex-col items-center gap-3 pb-4 border-b border-gray-100">
              {/* ✅ แก้ไข: ถ้ามี avatarUrl ให้แสดงรูป ถ้าไม่มีให้แสดง Icon */}
              {/* เปลี่ยนกรอบและสีไอคอนเป็นสีน้ำเงิน */}
              <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-white shadow-sm flex items-center justify-center text-blue-600 text-2xl overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserOutlined />
                )}
              </div>
              <div>
                <div className="text-sm text-gray-400 uppercase tracking-wider font-semibold text-[10px] mb-1">Logged in as</div>
                {/* เปลี่ยนสีชื่อผู้ใช้เป็นน้ำเงินเข้ม */}
                <div className="font-bold text-lg text-blue-800 leading-none">{username}</div>
              </div>
            </div>

            {/* Password Input */}
            <div className="text-left">
              <label className="block text-xs font-semibold text-gray-500 mb-2 ml-1">รหัสผ่านของคุณ</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <SafetyCertificateFilled className="text-gray-400" />
                </div>
                <input
                  type="password"
                  autoFocus
                  // เปลี่ยน Focus Ring เป็นสีน้ำเงิน
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50/80 border border-gray-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all text-gray-700 placeholder-gray-400"
                  placeholder="ระบุรหัสผ่านเพื่อปลดล็อก"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && unlock()}
                />
              </div>
            </div>

            {/* Unlock Button - เปลี่ยน Gradient เป็นน้ำเงิน-คราม */}
            <button
              onClick={unlock}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-blue-200 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>กำลังตรวจสอบ...</span>
              ) : (
                <>
                  <span>ปลดล็อกเข้าใช้งาน</span>
                  <ArrowRightOutlined />
                </>
              )}
            </button>

            {/* Switch Account - เปลี่ยน Hover Text เป็นสีน้ำเงิน */}
            <div className="pt-2">
              <button
                onClick={goLogin}
                className="text-sm text-gray-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2 w-full py-2"
              >
                <LogoutOutlined />
                <span>ไม่ใช่คุณ? ออกจากระบบ</span>
              </button>
            </div>
          </div>
        ) : (
          /* Case: No User Found (Fallback) */
          <div className="py-8">
            <p className="text-gray-500 mb-6">ไม่พบข้อมูลผู้ใช้งานในขณะนี้</p>
            <button
              onClick={goLogin}
              className="w-full py-3 rounded-2xl bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold transition-all"
            >
              กลับสู่หน้าเข้าสู่ระบบ
            </button>
          </div>
        )}
      </div>

      {/* Footer Copyright/Version - เปลี่ยน Text เป็นสีน้ำเงินจางๆ */}
      <div className="absolute bottom-4 text-center w-full">
        <p className="text-xs text-blue-800/40 font-medium">Secured by HRMS System</p>
      </div>
    </div>
  );
}