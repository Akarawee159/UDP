// src/layouts/Sidebar.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Link, useLocation, matchPath } from "react-router-dom";
import { Tooltip, Avatar } from 'antd';
import logo from "../assets/logo_login.png";
import useAuth from "../hooks/useAuth.js";
import api from "../api.js";
import { disconnect } from '../socketClient';

/* Icons (@ant-design/icons) */
import {
  MenuOutlined,
  CloseOutlined,
  LogoutOutlined,
  DownOutlined,
  DashboardOutlined,
  SettingOutlined,
  DatabaseOutlined,
  TeamOutlined,
  FileTextOutlined,
  DropboxOutlined,
  UserOutlined,
} from "@ant-design/icons";

/* Menu Config (โครงสร้างเดิม) */
export const menuItems = [
  {
    id: "10", label: "แดชบอร์ด",
    icon: <DashboardOutlined />,
    path: "/dashboard",
    type: "single"
  },
  {
    id: "20", label: "การจัดการผู้ใช้งาน",
    icon: <TeamOutlined />,
    type: "dropdown",
    children: [
      { id: "201", label: "กำหนดสิทธิผู้ใช้งาน", path: "/management" },
      { id: "202", label: "กำหนดสิทธิการใช้งาน", path: "/permission" },
    ]
  },
  {
    id: "30",
    label: "ข้อมูลตั้งค่า",
    icon: <SettingOutlined />,
    type: "dropdown",
    path: "/settings",
    children: [
      { id: "300", label: "บริษัท", path: "/settings/company" },
      { id: "301", label: "สาขา", path: "/settings/branch" },
      { id: "302", label: "แผนก", path: "/settings/department" },
      { id: "303", label: "ตำแหน่งงาน", path: "/settings/position" },
      { id: "304", label: "โซน", path: "/settings/zone" },
      { id: "305", label: "โลเคชั่น", path: "/settings/location" },
      { id: "306", label: "หน่วยนับ", path: "/settings/counting-unit" },
      { id: "307", label: "ขนาดบรรจุภัณฑ์", path: "/settings/packaging-size" },
    ]
  },
  {
    id: "40",
    label: "ข้อมูลหลัก",
    icon: <DatabaseOutlined />,
    type: "dropdown",
    children: [
      { id: "401", label: "สร้างข้อมูลพนักงาน", path: "/employees" },
      { id: "402", label: "สร้างข้อมูลกล่อง", path: "/material" },
    ]
  },
  {
    id: "50",
    label: "ระบบขึ้นทะเบียนกล่อง",
    icon: <DropboxOutlined />,
    type: "dropdown",
    children: [
      { id: "501", label: "ขึ้นทะเบียนกล่อง", path: "/registration/register-box" },
    ]
  },
  {
    id: "60",
    label: "รายงาน",
    icon: <FileTextOutlined />,
    type: "dropdown",
    children: [
      { id: "601", label: "รายงานพิเศษ (Non-Move)", path: "/reports/employee-report" },
      { id: "602", label: "รายงานตามสถานะกล่อง", path: "/reports/training-report" },
    ]
  },
];

export default function Sidebar({ onAnyLinkClick = () => { }, open = true }) {
  /* ====================================================== */
  /* == ส่วน Logic ทั้งหมดถูกคงไว้เหมือนเดิม ไม่มีการแก้ไข == */
  /* ====================================================== */

  /* Auth & Router */
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /* Active helpers */
  const isActivePath = (path) => path && path !== "#" ? !!matchPath({ path, end: false }, location.pathname) : false;
  const hasActiveChild = (item) => item?.children?.some((c) => isActivePath(c.path));

  /* State */
  const [collapsed, setCollapsed] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* User Info Logic */
  const [roleName, setRoleName] = useState(user?.permission_role || "พนักงาน");
  const [avatarUrl, setAvatarUrl] = useState(null);

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
  }, [user?.employee_id, makeAvatarUrl]);

  // ===== Permission cache keys =====
  const PERM_CACHE_KEY = 'perm:my-menus:v1';
  const readPermCache = () => {
    try {
      const raw = localStorage.getItem(PERM_CACHE_KEY) || sessionStorage.getItem(PERM_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  /* Permission Loading */
  const [perm, setPerm] = useState(() => {
    const cached = readPermCache();
    return cached
      ? { loaded: true, mainIds: cached.mainIds || [], subIds: cached.subIds || [] }
      : { loaded: false, mainIds: [], subIds: [] };
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get('/permission/my-menus');
        const payload = { mainIds: data?.data?.mainIds || [], subIds: data?.data?.subIds || [] };
        if (alive) setPerm({ loaded: true, ...payload });
        try {
          const store = localStorage.getItem('token') ? localStorage : sessionStorage;
          store.setItem(PERM_CACHE_KEY, JSON.stringify(payload));
        } catch { }
      } catch {
        if (alive) setPerm({ loaded: true, mainIds: [], subIds: [] });
      }
    })();
    return () => { alive = false; };
  }, [user?.permission_role]);

  /* Menu Filtering */
  const visibleMenuItems = useMemo(() => {
    if (!perm.loaded) return [];
    const allowMain = new Set((perm.mainIds || []).map(String));
    const allowSub = new Set((perm.subIds || []).map(String));
    return menuItems
      .filter((it) => allowMain.has(String(it.id)))
      .map((it) => {
        if (it.type === "dropdown") {
          const children = (it.children || []).filter((c) => allowSub.has(String(c.id)));
          return children.length ? { ...it, children } : null;
        }
        return it;
      })
      .filter(Boolean);
  }, [perm]);

  /* Hooks for side effects */
  useEffect(() => {
    const initial = {};
    visibleMenuItems.forEach((it, idx) => {
      if (it.type === "dropdown" && hasActiveChild(it)) initial[idx] = true;
    });
    setOpenDropdowns((prev) => ({ ...initial, ...prev }));
  }, [location.pathname, visibleMenuItems]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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


  /* Handlers */
  const toggleDropdown = (index) => setOpenDropdowns((prev) => ({ ...prev, [index]: !prev[index] }));
  const toggleMobileMenu = () => setMobileMenuOpen((v) => !v);
  const handleMenuClick = () => {
    if (isMobile) setMobileMenuOpen(false);
    onAnyLinkClick();
  };
  const handleLogout = useCallback(() => {
    try { window.__LOGGING_OUT__ = true; } catch { }
    disconnect();
    logout();
    navigate("/");
  }, [logout, navigate]);


  /* ========================================================= */
  /* == ส่วน Render (JSX) - ธีม Slate / Gray                 == */
  /* ========================================================= */
  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={toggleMobileMenu}
          className="fixed top-4 left-4 z-[60] p-2 bg-slate-800/80 backdrop-blur-sm text-white rounded-lg shadow-lg border border-slate-700/80 hover:bg-slate-700 transition-colors md:hidden"
          aria-label={mobileMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
        >
          {mobileMenuOpen ? <CloseOutlined /> : <MenuOutlined />}
        </button>
      )}

      {/* Overlay (mobile only) */}
      {isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <div
        className={`
          fixed md:relative flex flex-col
          ${isMobile
            ? (mobileMenuOpen ? "translate-x-0" : "-translate-x-full")
            : (open ? "translate-x-0" : "-translate-x-full")}
          ${collapsed && !isMobile ? "w-20" : "w-64"}
          h-screen bg-slate-900 text-slate-300 transition-all duration-300 ease-in-out z-[55]
          border-r border-slate-800/80 shadow-2xl
        `}
      >
        {/* Header - Logo */}
        <div className="flex-shrink-0 flex items-center gap-3 p-4 h-20 border-b border-slate-800/80">
          <img src={logo} alt="Logo" className="w-10 h-10 object-cover rounded-full flex-shrink-0" />
          {(!collapsed || isMobile) && (
            <div className="animate-fade-in overflow-hidden">
              <h1 className="text-lg font-bold text-white whitespace-nowrap">UDP</h1>
              <p className="text-xs text-white whitespace-nowrap">( SPT )</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar min-h-0">
          {visibleMenuItems.map((item, index) => (
            <div key={index} className="group">
              {item.type === "single" ? (
                (() => {
                  const active = isActivePath(item.path);
                  return (
                    <Link
                      to={item.path}
                      onClick={handleMenuClick}
                      className={`relative flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200
                        {/* ธีม Slate Gray: พื้นหลังเทาเข้มเมื่อ Active */}
                        ${active ? "bg-slate-700/50 text-white" : "hover:bg-slate-800/60"}`}
                    >
                      {/* ไอคอนสีขาวเทาเมื่อ Active */}
                      <span className={`transition-colors ${active ? "text-slate-50" : "text-slate-400 group-hover:text-slate-200"}`}>
                        {item.icon}
                      </span>
                      {(!collapsed || isMobile) && <span className="font-medium text-sm">{item.label}</span>}
                    </Link>
                  );
                })()
              ) : (
                (() => {
                  const parentActive = hasActiveChild(item);
                  return (
                    <div>
                      <div
                        className={`flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer transition-all duration-200
                          {/* ธีม Slate Gray: พื้นหลังเทาเข้มเมื่อ Active */}
                          ${parentActive ? "bg-slate-700/50 text-white" : "hover:bg-slate-800/60"}`}
                        onClick={() => toggleDropdown(index)}
                      >
                        <div className="flex items-center gap-4">
                          <span className={`transition-colors ${parentActive ? "text-slate-50" : "text-slate-400 group-hover:text-slate-200"}`}>
                            {item.icon}
                          </span>
                          {(!collapsed || isMobile) && <span className="font-medium text-sm">{item.label}</span>}
                        </div>
                        {(!collapsed || isMobile) && (
                          <DownOutlined className={`text-xs text-slate-500 transition-transform duration-300 ${openDropdowns[index] ? "rotate-180" : ""}`} />
                        )}
                      </div>

                      {openDropdowns[index] && (!collapsed || isMobile) && (
                        <div className="pl-6 mt-2 space-y-1 animate-slide-down">
                          {item.children.map((child, childIndex) => {
                            const childActive = isActivePath(child.path);
                            return (
                              <Link
                                to={child.path}
                                key={childIndex}
                                onClick={handleMenuClick}
                                className={`relative flex items-center gap-3 pl-6 pr-3 py-2.5 rounded-md transition-all duration-200
                                  ${childActive ? "text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/50"}`}
                              >
                                {/* ธีม Slate Gray: จุดสีเทาสว่าง และ Shadow สีเทา */}
                                <span className={`absolute left-2 w-1.5 h-1.5 rounded-full transition-all duration-300 ${childActive ? "bg-slate-200 shadow-[0_0_8px_rgba(226,232,240,0.6)] scale-125" : "bg-slate-600 group-hover:bg-slate-500"}`} />
                                <span className="text-sm">{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          ))}
        </nav>

        {/* User Profile & Logout */}
        <div className="flex-shrink-0 p-3 border-t border-slate-800/80">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/60 transition-colors">
            <Avatar src={avatarUrl} icon={<UserOutlined />} className="flex-shrink-0 bg-slate-700" />
            {(!collapsed || isMobile) && (
              <div className="animate-fade-in flex-1 overflow-hidden">
                <p className="font-semibold text-sm text-white truncate">{user?.username || 'Administrator'}</p>
                <p className="text-xs text-slate-500 truncate">{roleName}</p>
              </div>
            )}
            <Tooltip title="ออกจากระบบ">
              <LogoutOutlined
                className="text-slate-500 hover:text-red-500 cursor-pointer transition-colors p-2"
                onClick={handleLogout}
              />
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Custom Styles */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-down { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
        .animate-slide-down { animation: slide-down 0.3s ease-out forwards; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #334155 transparent; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </>
  );
}