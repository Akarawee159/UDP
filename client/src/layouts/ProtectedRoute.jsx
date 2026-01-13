// src/layouts/ProtectedRoute.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { getIsLocked } from "../hooks/useIdleLock";
import api from "../api.js";

/** หน้า 404 แบบกวนๆ (เมื่อ "ไม่มีสิทธิ์" ให้ดูเหมือน Not Found) */
function NotFound404() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md text-center">
        {/* ไอคอนกวนๆ */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-white shadow flex items-center justify-center">
          <span className="text-5xl select-none" aria-hidden="true">
            😏
          </span>
        </div>

        <div className="mt-5 text-6xl font-extrabold text-slate-900">403</div>
        <div className="mt-2 text-2xl font-extrabold text-slate-800">
          ฮั่นแน่ 😆
        </div>

        <div className="mt-2 text-slate-600">
          คุณไม่มีสิทธิ์เข้าถึงหน้านี้
        </div>

        <div className="mt-3 text-sm text-slate-500">
          พิมพ์ URL เองเก่งนะ… แต่สิทธิ์เข้าไม่ถึง 😜
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <a
            href="/home"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            กลับหน้าแรก
          </a>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
          >
            ไปหน้า Login
          </a>
        </div>
      </div>
    </div>
  );
}


/**
 * ProtectedRoute
 * - ถ้ายังไม่ login -> ไป "/"
 * - ถ้า lock -> ไป "/lock"
 * - ถ้า "ไม่มีสิทธิ์" -> แสดง 404 (ไม่ redirect)
 *
 * ใช้งานได้ 2 แบบ:
 * 1) roles: ['admin','manager']
 * 2) mainId/subId: '40'/'403' (อิงจาก JSON เมนู)
 */
export default function ProtectedRoute({
  children,
  roles,
  mainId,
  subId,
}) {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  const userRaw = localStorage.getItem("user") || sessionStorage.getItem("user");
  const user = userRaw ? JSON.parse(userRaw) : null;

  // ล็อกหน้าจอ → เด้งไป /lock
  if (getIsLocked()) return <Navigate to="/lock" replace />;

  // ยังไม่ล็อกอิน → เด้งไปหน้า login
  if (!token || !user) return <Navigate to="/" replace />;

  // ---------------------- Role-based guard (ถ้าใช้ roles) ----------------------
  const allowByRoles = useMemo(() => {
    if (!Array.isArray(roles) || roles.length === 0) return true;
    const group = String(user?.permission_role || "").toLowerCase();
    const allow = roles.map((v) => String(v).toLowerCase());
    return allow.includes(group);
  }, [roles, user?.permission_role]);

  // ---------------------- Menu permission guard (mainId/subId) ----------------------
  const needMenuCheck = !!(mainId || subId);

  // ใช้ cache key เดียวกับ Sidebar (เพื่อให้เข้าหน้าได้ไว)
  const PERM_CACHE_KEY = "perm:my-menus:v1";

  const readPermCache = () => {
    try {
      const raw =
        localStorage.getItem(PERM_CACHE_KEY) ||
        sessionStorage.getItem(PERM_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const [perm, setPerm] = useState(() => {
    const cached = readPermCache();
    return cached
      ? { loaded: true, mainIds: cached.mainIds || [], subIds: cached.subIds || [] }
      : { loaded: false, mainIds: [], subIds: [] };
  });

  // โหลดสิทธิจาก BE (กันการแก้ localStorage หลอก)
  useEffect(() => {
    if (!needMenuCheck) return;

    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/permission/my-menus");
        const payload = {
          mainIds: data?.data?.mainIds || [],
          subIds: data?.data?.subIds || [],
        };

        if (alive) setPerm({ loaded: true, ...payload });

        // cache (local ถ้า token อยู่ localStorage ไม่งั้น session)
        try {
          const store = localStorage.getItem("token") ? localStorage : sessionStorage;
          store.setItem(PERM_CACHE_KEY, JSON.stringify(payload));
        } catch { }
      } catch {
        // ถ้าดึงไม่ได้ → ถือว่าไม่มีสิทธิ (จะไป 404)
        if (alive) setPerm({ loaded: true, mainIds: [], subIds: [] });
      }
    })();

    return () => {
      alive = false;
    };
  }, [needMenuCheck]);

  const allowByMenu = useMemo(() => {
    if (!needMenuCheck) return true;
    if (!perm.loaded) return null; // กำลังโหลด

    const allowMain = new Set((perm.mainIds || []).map(String));
    const allowSub = new Set((perm.subIds || []).map(String));

    if (mainId && !allowMain.has(String(mainId))) return false;
    if (subId && !allowSub.has(String(subId))) return false;

    return true;
  }, [needMenuCheck, perm, mainId, subId]);

  // ระหว่างโหลดสิทธิ (กรณีใช้ mainId/subId) → โชว์ loading สั้นๆ
  if (allowByMenu === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600 text-sm">Loading...</div>
      </div>
    );
  }

  // ✅ ถ้าไม่ผ่าน role หรือ ไม่ผ่านเมนู → แสดง 404
  if (!allowByRoles) return <NotFound404 />;
  if (allowByMenu === false) return <NotFound404 />;

  return children;
}
