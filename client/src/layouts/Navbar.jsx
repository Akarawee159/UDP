// src/layouts/Navbar.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { message } from "antd";
import { useNavigate, useLocation, matchPath } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";
import { dispatchLock, LOCK_KEY, BEFORE_LOCK_KEY } from "../hooks/useIdleLock";
import api from "../api.js";
import ModalExpired from "./Modal/ModalExpired.jsx";
import ModalSetting from "./Modal/ModalSetting.jsx";
import { disconnect } from '../socketClient';

/* =========================
 * Icons (@ant-design/icons)
 * ========================= */
import {
  BellOutlined,
  UserOutlined,
  DownOutlined,
  SearchOutlined,
  LogoutOutlined,
  MenuOutlined,
  HomeOutlined,
  IdcardOutlined,
  LockOutlined,
  SafetyCertificateFilled,
  ClockCircleOutlined
} from "@ant-design/icons";

/* ดึงรายการเมนูจาก Sidebar เพื่อใช้ระบุเมนู/ไอคอนที่ active */
import { menuItems } from "./Sidebar";

/* =========================
 * Pure utility functions
 * ========================= */
const formatTime = (date) =>
  date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const formatDate = (date) =>
  date.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

/* ================
 * Navbar Component
 * ================ */
export default function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const [pwExpiredOpen, setPwExpiredOpen] = useState(false);
  const [resetToken, setResetToken] = useState(null);
  const isHandlingExpiry = useRef(false);
  const isFetchingPing = useRef(false);
  const [openSetting, setOpenSetting] = useState(false);
  const [settingTabKey, setSettingTabKey] = useState("profile");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const [expiresAt, setExpiresAt] = useState(null);
  const [warnDays, setWarnDays] = useState(null);

  const [resetRequests, setResetRequests] = useState([]);   // is_status = 4
  const [loadingResets, setLoadingResets] = useState(false); // สำหรับโหลดรายการ

  const [roleName, setRoleName] = useState(user?.permission_role || "พนักงาน");

  const BE_BASE = useMemo(() => {
    const base = api.defaults?.baseURL || "";
    if (/^https?:\/\//i.test(base)) return base.replace(/\/api\/?$/, "");
    if (base.startsWith("/")) return (window.location.origin + base).replace(/\/api\/?$/, "");
    return window.location.origin;
  }, []);

  const makeAvatarUrl = useCallback(
    (file) => (file ? `${BE_BASE}/img/profile/${file}?v=${Date.now()}` : null),
    [BE_BASE]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/permission/my-menus");
        const name = data?.data?.groupName || user?.permission_role || "พนักงาน";
        if (alive) setRoleName(name);
      } catch {
        if (alive) setRoleName(user?.permission_role || "พนักงาน");
      }
    })();
    return () => { alive = false; };
  }, [user?.permission_role]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/management/me");
        const file = data?.data?.profileImg;
        if (alive) setAvatarUrl(makeAvatarUrl(file));
      } catch { /* เงียบได้ */ }
    })();
    return () => { alive = false; };
  }, [user?.employee_id, BE_BASE]);

  /* เวลา real-time */
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!expiresAt) { setWarnDays(null); return; }
    const calc = () => {
      const end = new Date(expiresAt).getTime();
      const now = Date.now();
      const diff = end - now;
      if (!Number.isFinite(end)) { setWarnDays(null); return; }
      if (diff <= 0) { setWarnDays(null); return; }
      const ceilDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
      setWarnDays(ceilDays > 0 && ceilDays <= 3 ? ceilDays : null);
    };
    calc();
    const t = setInterval(calc, 60 * 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const fetchPwStatus = useCallback(async () => {
    if (isHandlingExpiry.current || pwExpiredOpen) return;
    try {
      const { data } = await api.get('/auth/status');
      setExpiresAt(data?.password_expires_at || null);
    } catch { /* เงียบ */ }
  }, [pwExpiredOpen]);

  // ✅ ดึงคำขอรีเซ็ตรหัสผ่านที่สถานะ = 4 สำหรับ Navbar
  const fetchResetRequests = useCallback(async () => {
    try {
      setLoadingResets(true);
      const { data } = await api.get('/forgotpassword/admin/pending');
      if (data?.success && Array.isArray(data.data)) {
        setResetRequests(data.data);
      } else {
        setResetRequests([]);
      }
    } catch (err) {
      // ถ้าไม่ได้สิทธิ์ (401/403) → ไม่แสดงอะไร
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setResetRequests([]);
      }
    } finally {
      setLoadingResets(false);
    }
  }, []);

  useEffect(() => {
    fetchPwStatus();
  }, [fetchPwStatus]);

  useEffect(() => {
    fetchResetRequests();
  }, [fetchResetRequests]);

  useEffect(() => {
    const onChanged = () => fetchPwStatus();
    window.addEventListener('hrms:password-changed', onChanged);
    return () => window.removeEventListener('hrms:password-changed', onChanged);
  }, [fetchPwStatus]);

  useEffect(() => {
    const onExpired = async (e) => {
      if (isHandlingExpiry.current) return;
      isHandlingExpiry.current = true;
      setPwExpiredOpen(true);

      const rt = e.detail?.resetToken;
      if (rt) {
        setResetToken(rt);
        return;
      }
      if (isFetchingPing.current) return;
      isFetchingPing.current = true;
      try {
        await api.get('/auth/ping');
      } catch (err) {
        const rt2 = err?.response?.data?.resetToken;
        if (rt2) setResetToken(rt2);
      } finally {
        isFetchingPing.current = false;
      }
    };

    const onChanged = () => {
      isHandlingExpiry.current = false;
      setPwExpiredOpen(false);
      setResetToken(null);
      fetchPwStatus();
    };

    window.addEventListener('hrms:password-expired', onExpired);
    window.addEventListener('hrms:password-changed', onChanged);
    return () => {
      window.removeEventListener('hrms:password-expired', onExpired);
      window.removeEventListener('hrms:password-changed', onChanged);
    };
  }, [fetchPwStatus]);

  useEffect(() => {
    const h = (e) => {
      const row = e.detail || {};
      if (!row?.employee_id) return;
      if (String(row.employee_id) === String(user?.employee_id)) {
        setAvatarUrl(makeAvatarUrl(row.profileImg));
      }
    };
    window.addEventListener('hrms:user-upsert', h);
    return () => window.removeEventListener('hrms:user-upsert', h);
  }, [user?.employee_id, makeAvatarUrl]);

  // ✅ Realtime: มีคำขอใหม่ / สถานะเปลี่ยน → อัปเดต list
  useEffect(() => {
    const h = (e) => {
      const payload = e.detail || {};
      const code = payload.employee_code;
      const status = String(payload.is_status || '');
      if (!code) return;

      if (status === '4') {
        // มีคำขอใหม่ → ดึงรายการล่าสุด (เอา username + created_at มาด้วย)
        fetchResetRequests();
      } else {
        // สถานะเปลี่ยนจาก 4 เป็น 5 หรือ 6 → เอาออกจาก list
        setResetRequests(prev =>
          prev.filter(r => String(r.employee_code) !== String(code))
        );
      }
    };
    window.addEventListener('hrms:forgot-password-update', h);
    return () => window.removeEventListener('hrms:forgot-password-update', h);
  }, [fetchResetRequests]);


  const activeMenu = useMemo(() => {
    const isActivePath = (path) => {
      if (!path || path === "#") return false;
      return !!matchPath({ path, end: false }, location.pathname);
    };

    for (const item of menuItems) {
      if (item.type === "single" && isActivePath(item.path)) {
        return { title: item.label, icon: item.icon || <HomeOutlined /> };
      }
    }
    for (const item of menuItems) {
      if (item.type === "dropdown" && Array.isArray(item.children)) {
        for (const child of item.children) {
          if (isActivePath(child.path)) {
            return { title: child.label, icon: item.icon || <HomeOutlined /> };
          }
        }
      }
    }
    return { title: "HOME", icon: <HomeOutlined /> };
  }, [location.pathname]);

  // ✅ ปุ่ม "รับทราบ" ในแจ้งเตือน reset password
  const handleAckResetRequest = useCallback(async (employee_code, e) => {
    if (e) e.stopPropagation(); // ป้องกันไม่ให้คลิกทะลุไปโดน div แม่ (ถ้ามี)

    try {
      await api.post('/forgotpassword/admin/ack', { employee_code });
      message.success('รับทราบคำขอรีเซ็ตรหัสผ่านแล้ว');

      // เอา item นี้ออกจาก list
      setResetRequests(prev =>
        prev.filter(r => String(r.employee_code) !== String(employee_code))
      );

      // 👉 พาไปหน้า UserManagement และปิด Dropdown
      navigate('/management');
      setShowNotifications(false);

    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        message.error('คุณไม่มีสิทธิ์จัดการคำขอนี้');
      } else {
        message.error('ไม่สามารถอัปเดตสถานะคำขอได้');
      }
    }
  }, [navigate]); // อย่าลืมเพิ่ม dependency navigate

  const handleLogout = useCallback(async () => {
    try { window.__LOGGING_OUT__ = true; } catch { }
    isHandlingExpiry.current = false;
    try {
      const useLocal = !!localStorage.getItem('refreshToken');
      const store = useLocal ? localStorage : sessionStorage;
      const r = store.getItem('refreshToken');
      if (r) await api.post('/auth/logout', { refreshToken: r });
    } catch { }
    disconnect();
    logout();
    navigate("/");
  }, [logout, navigate]);

  const toggleUserMenu = useCallback(() => setShowUserMenu((v) => !v), []);
  const toggleNotifications = useCallback(() => setShowNotifications((v) => !v), []);
  const closeDropdowns = useCallback(() => {
    setShowUserMenu(false);
    setShowNotifications(false);
  }, []);

  const handleLockScreen = useCallback(() => {
    try {
      sessionStorage.setItem(BEFORE_LOCK_KEY, window.location.pathname);
      localStorage.setItem(LOCK_KEY, "1");
    } catch { }
    dispatchLock();
    setShowUserMenu(false);
    navigate("/lock", { replace: true });
  }, [navigate]);

  const hasResetRequests = resetRequests.length > 0;
  const hasNotifications = warnDays !== null || hasResetRequests;
  const totalNew = (warnDays !== null ? 1 : 0) + resetRequests.length;

  return (
    <header className="bg-white sticky top-0 z-40 border-b border-gray-100 shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* --- Left Section: Toggle & Page Title --- */}
          <div className="flex items-center space-x-4">
            <button
              onClick={onToggleSidebar}
              // เปลี่ยน Hover เป็นธีมสีน้ำเงิน
              className="p-2 rounded-xl text-gray-500 hover:bg-slate-50 hover:text-slate-600 transition-all duration-200"
              title="เปิด/ปิด เมนู"
            >
              <MenuOutlined className="text-xl" />
            </button>

            {/* Page Title */}
            <div className="hidden lg:flex items-center space-x-3">
              {/* เปลี่ยนธีมไอคอน Page Title เป็นสีน้ำเงิน */}
              <div className="w-9 h-9 rounded-lg bg-gray-50 text-gray-600 flex items-center justify-center shadow-sm border border-gray-100">
                <span className="text-lg">{activeMenu.icon}</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800 leading-none">{activeMenu.title}</h1>
                <span className="text-xs text-gray-400 font-medium">ระบบติดตามบรรจุภัณฑ์</span>
              </div>
            </div>

            {/* Mobile Title */}
            <div className="lg:hidden">
              <h1 className="text-lg font-bold text-gray-800 truncate">{activeMenu.title}</h1>
            </div>
          </div>

          {/* --- Right Section: Widgets & User --- */}
          <div className="flex items-center gap-2 sm:gap-4">

            {/* Time Widget (Desktop) */}
            <div className="hidden md:flex flex-col items-end mr-2">
              <div className="text-sm font-bold text-gray-700 font-mono tracking-wide leading-none mb-0.5">
                {formatTime(currentTime)}
              </div>
              <div className="text-[12px] text-gray-400 font-medium flex items-center gap-1">
                <ClockCircleOutlined className="text-[12px]" /> {formatDate(currentTime)}
              </div>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={toggleNotifications}
                // เปลี่ยนธีม Active ของกระดิ่งเป็นสีน้ำเงิน
                className={`relative p-2.5 rounded-full transition-all duration-200 ${showNotifications ? 'bg-red-50 text-red-600' : 'text-gray-400 hover:text-red-600 hover:bg-gray-50'
                  }`}
              >
                {/* ✅ เพิ่มเงื่อนไข animate-bell-alert เมื่อมีแจ้งเตือน */}
                <BellOutlined className={`text-xl ${hasNotifications ? 'animate-bell-alert' : ''}`} />

                {hasNotifications && (
                  <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-30" onClick={closeDropdowns} />
                  <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-40 overflow-hidden animate-fade-in-up">
                    <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                      <h3 className="text-sm font-bold text-gray-700">การแจ้งเตือน</h3>
                      {hasNotifications && (
                        <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">
                          {totalNew} ใหม่
                        </span>
                      )}
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {/* 🔔 รหัสผ่านใกล้หมดอายุ (อันเดิม) */}
                      {warnDays !== null && (
                        <div
                          onClick={() => {
                            setSettingTabKey("security");
                            setOpenSetting(true);
                            setShowNotifications(false);
                          }}
                          className="p-4 border-l-4 border-orange-400 bg-orange-50 hover:bg-orange-100 cursor-pointer transition-colors"
                        >
                          <div className="flex gap-3">
                            <div className="mt-1 text-orange-500">
                              <SafetyCertificateFilled className="text-lg" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-800">รหัสผ่านใกล้หมดอายุ</p>
                              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                เหลือเวลาอีก <b className="text-orange-600">{warnDays} วัน</b> กรุณาเปลี่ยนรหัสผ่านเพื่อความปลอดภัย
                              </p>
                              <p className="text-[10px] text-gray-400 mt-2">
                                หมดอายุ: {new Date(expiresAt).toLocaleString("th-TH")}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 🔔 คำขอรีเซ็ตรหัสผ่านจากผู้ใช้งาน (is_status = 4) */}
                      {hasResetRequests &&
                        resetRequests.map((req) => (
                          <div
                            key={req.employee_code}
                            className="border-t border-gray-50"
                          >
                            <div
                              // 👉 1. เพิ่ม onClick ให้ทั้งก้อน เพื่อคลิกพื้นที่ว่างแล้วไปหน้าจัดการ
                              onClick={() => {
                                navigate('/management');
                                setShowNotifications(false);
                              }}
                              // เปลี่ยนธีมสี Notification เป็นสีน้ำเงิน
                              className="p-4 border-l-4 border-blue-500 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                            >
                              <div className="flex gap-3 justify-between">
                                <div className="flex gap-3">
                                  <div className="mt-1 text-blue-500">
                                    <LockOutlined className="text-lg" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-800">
                                      คำขอรีเซ็ตรหัสผ่านใหม่
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                      ผู้ใช้งาน <b>{req.username || '-'}</b> และรหัสพนักงาน{" "}
                                      <b>{req.employee_code}</b> ขอรีเซ็ตรหัสผ่าน
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start">
                                  <button
                                    // 👉 2. ส่ง event (e) เข้าไปในฟังก์ชัน
                                    onClick={(e) => handleAckResetRequest(req.employee_code, e)}
                                    // ปุ่มรับทราบเปลี่ยนเป็นสีน้ำเงิน
                                    className="px-3 py-1.5 text-[11px] font-semibold rounded-full bg-blue-600 text-white hover:bg-blue-500 shadow-sm hover:scale-105 transition-all"
                                  >
                                    รับทราบ
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                      {/* กำลังโหลด */}
                      {loadingResets && !hasNotifications && (
                        <div className="py-8 text-center">
                          <div className="inline-block p-3 rounded-full bg-gray-50 text-gray-300 mb-2">
                            <ClockCircleOutlined className="text-2xl" />
                          </div>
                          <p className="text-xs text-gray-400">กำลังโหลดการแจ้งเตือน...</p>
                        </div>
                      )}

                      {/* ไม่มีแจ้งเตือนอะไรเลย */}
                      {!loadingResets && !hasNotifications && (
                        <div className="py-8 text-center">
                          <div className="inline-block p-3 rounded-full bg-gray-50 text-gray-300 mb-2">
                            <BellOutlined className="text-2xl" />
                          </div>
                          <p className="text-xs text-gray-400">ไม่มีการแจ้งเตือนใหม่</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={toggleUserMenu}
                className="flex items-center gap-3 p-1.5 pr-3 rounded-full hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all duration-200 group"
              >
                {/* เปลี่ยน Border Hover เป็นสีน้ำเงิน */}
                <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-100 group-hover:border-blue-200 shadow-sm">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    // เปลี่ยน Gradient เป็นโทนน้ำเงิน
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white">
                      <UserOutlined />
                    </div>
                  )}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-md font-bold text-gray-700 leading-none mb-0.5">{user?.username || "User"}</p>
                  <p className="text-[12px] text-red-500 font-bold">ระบบ ( SPT )</p>
                </div>
                {/* เปลี่ยน Hover Text เป็นสีน้ำเงิน */}
                <DownOutlined className="hidden lg:block text-[10px] text-gray-400 group-hover:text-blue-500 transition-colors" />
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={closeDropdowns} />
                  <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-40 overflow-hidden animate-fade-in-up">
                    {/* Dropdown Header - เปลี่ยน Gradient เป็นโทนน้ำเงิน */}
                    <div className="p-5 bg-gradient-to-br from-gray-500 to-slate-600 text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
                      <div className="relative z-10 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full border-2 border-white/30 overflow-hidden shadow-md">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="User" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-white/20 flex items-center justify-center">
                              <UserOutlined className="text-xl" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-lg truncate">{user?.username}</p>
                          {/* เปลี่ยน Text เป็นสีน้ำเงินอ่อน */}
                          <p className="text-[16px] text-blue-100 opacity-90">{roleName}</p>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setSettingTabKey("profile");
                          setOpenSetting(true);
                          setShowUserMenu(false);
                        }}
                        // เปลี่ยน Hover เป็นธีมสีน้ำเงิน
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors"
                      >
                        <IdcardOutlined className="text-lg" />
                        ตั้งค่าส่วนตัว
                      </button>
                      <button
                        onClick={handleLockScreen}
                        // เปลี่ยน Hover เป็นธีมสีน้ำเงิน
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors"
                      >
                        <LockOutlined className="text-lg" />
                        ล็อคหน้าจอ
                      </button>
                    </div>

                    <div className="p-2 border-t border-gray-100">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors font-medium"
                      >
                        <LogoutOutlined className="text-lg" />
                        ออกจากระบบ
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Search (Optional) */}
      <div className="md:hidden border-t border-gray-100 px-4 py-3 bg-gray-50/50">
        <div className="relative">
          <SearchOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาเมนู..."
            // เปลี่ยน focus ring/border เป็นสีน้ำเงิน
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Modals */}
      <ModalSetting
        open={openSetting}
        tabKey={settingTabKey}
        onClose={() => setOpenSetting(false)}
        onChanged={(patch) => {
          if (Object.prototype.hasOwnProperty.call(patch, 'profileImg')) {
            setAvatarUrl(makeAvatarUrl(patch.profileImg));
          }
        }}
      />

      <ModalExpired
        open={pwExpiredOpen}
        resetToken={resetToken}
        onClose={() => { setPwExpiredOpen(false); setResetToken(null); }}
        onForceLogout={handleLogout}
      />

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1); }

        /* CSS Animation for Bell Blinking */
        @keyframes bellAlert {
          0%, 100% { color: #ef4444; } /* สีแดง (Red-500) */
          50% { color: #9ca3af; }      /* สีเทา (Gray-400) หรือสีปกติ */
        }
        .animate-bell-alert { animation: bellAlert 1s infinite ease-in-out; }
      `}</style>
    </header>
  );
}