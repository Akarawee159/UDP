// src/App.jsx
import React from "react";
import { useEffect } from "react";
import { connectWithStoredToken } from "./socketClient";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import useIdleLock, { BEFORE_LOCK_KEY } from "./hooks/useIdleLock";

import Login from "./pages/Login";
import Home from "./pages/Home";
import LockScreen from "./pages/LockScreen";
import ProtectedRoute from "./layouts/ProtectedRoute";
import AdminLayout from "./layouts/AdminLayout";

import Dashboard from "./pages/DashBoard/Dashboard";

// การจัดการผู้ใช้งาน
import PermissionRole from "./pages/Management/PermissionRole/PermissionRole";
import UserManagement from "./pages/Management/UserManagement/UserManagement";

// ข้อมูลหลัก
import Employees from "./pages/Masterdata/Employees/Employees";
import Material from "./pages/Masterdata/Material/Material";

// ระบบขึ้นทะเบียนทรัพย์สิน
import RegisterAsset from "./pages/Registration/RegisterAsset/RegisterAsset";
import AssetList from "./pages/Registration/RegisterAsset/Page/AssetList";
import AssetDetail from "./pages/Registration/RegisterAsset/Page/AssetDetail";
import AssetLog from "./pages/Registration/RegisterAsset/Page/AssetLog";

// ตั้งค่าเริ่มต้น
import Branch from "./pages/Settings/Branch/Branch";
import Company from "./pages/Settings/Company/Company";
import Department from "./pages/Settings/Department/Department";
import Position from "./pages/Settings/Position/Position";
import Zone from "./pages/Settings/Zone/Zone";
import Location from "./pages/Settings/Location/Location";
import CountingUnit from "./pages/Settings/CountingUnit/CountingUnit";
import PackagingSize from "./pages/Settings/PackagingSize/PackagingSize";

// SMART PACKAGE TRACKING
import SystemOut from "./pages/SmartPackage/SystemOut/SystemOut";
import SystemOutList from "./pages/SmartPackage/SystemOut/Page/SystemOutList";
import SystemIn from "./pages/SmartPackage/SystemIn/SystemIn";
import SystemRepair from "./pages/SmartPackage/SystemRepair/SystemRepair";

// รายงาน
import EmployeeReport from "./pages/Reports/EmployeeReport/EmployeeReport";
import TrainingReport from "./pages/Reports/TrainingReport/TrainingReport";

/** 404 สำหรับ route ที่ไม่มีจริง (คนพิมพ์ผิด/ไม่มีเส้นทาง) */
function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md text-center">
        <div className="text-7xl font-extrabold text-slate-900">404</div>
        <div className="mt-2 text-xl font-semibold text-slate-700">NOT FOUND</div>
        <div className="mt-2 text-slate-500">ไม่พบหน้าที่คุณต้องการ</div>

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

function WithIdleLock({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const disabled =
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname === "/lock";

  useIdleLock({
    timeout: 8 * 60 * 60 * 1000,
    disabled,

    onLock: () => {
      if (location.pathname === "/lock") return;

      try {
        const here = window.location.pathname + window.location.search + window.location.hash;
        sessionStorage.setItem(BEFORE_LOCK_KEY, here);
      } catch { }

      navigate("/lock", { replace: true });
    },

    onUnlock: () => {
      if (location.pathname !== "/lock") return;

      let back = "/home";
      try {
        back = sessionStorage.getItem(BEFORE_LOCK_KEY) || "/home";
      } catch { }
      try {
        sessionStorage.removeItem(BEFORE_LOCK_KEY);
      } catch { }

      navigate(back, { replace: true });
    },
  });

  return children;
}

export default function App() {
  useEffect(() => {
    connectWithStoredToken();
  }, []);

  return (
    <BrowserRouter>
      <WithIdleLock>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/lock" element={<LockScreen />} />

          {/* /home ไม่อยู่ในเมนู → ให้เข้าได้ทุกคนที่ login */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <Home />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* Dashboard (เมนูหลัก id=10) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute mainId="10">
                <AdminLayout>
                  <Dashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* การจัดการผู้ใช้งาน main=20 */}
          <Route
            path="/permission"
            element={
              <ProtectedRoute mainId="20" subId="202">
                <AdminLayout>
                  <PermissionRole />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/management"
            element={
              <ProtectedRoute mainId="20" subId="201">
                <AdminLayout>
                  <UserManagement />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* ตั้งค่าเริ่มต้น main=30 */}
          <Route path="/settings/company" element={<ProtectedRoute mainId="30" subId="300"><AdminLayout><Company /></AdminLayout></ProtectedRoute>} />
          <Route path="/settings/branch" element={<ProtectedRoute mainId="30" subId="301"><AdminLayout><Branch /></AdminLayout></ProtectedRoute>} />
          <Route path="/settings/department" element={<ProtectedRoute mainId="30" subId="302"><AdminLayout><Department /></AdminLayout></ProtectedRoute>} />
          <Route path="/settings/position" element={<ProtectedRoute mainId="30" subId="303"><AdminLayout><Position /></AdminLayout></ProtectedRoute>} />
          <Route path="/settings/zone" element={<ProtectedRoute mainId="30" subId="304"><AdminLayout><Zone /></AdminLayout></ProtectedRoute>} />
          <Route path="/settings/location" element={<ProtectedRoute mainId="30" subId="305"><AdminLayout><Location /></AdminLayout></ProtectedRoute>} />
          <Route path="/settings/counting-unit" element={<ProtectedRoute mainId="30" subId="306"><AdminLayout><CountingUnit /></AdminLayout></ProtectedRoute>} />
          <Route path="/settings/packaging-size" element={<ProtectedRoute mainId="30" subId="307"><AdminLayout><PackagingSize /></AdminLayout></ProtectedRoute>} />

          {/* ข้อมูลหลัก main=40 */}
          <Route
            path="/employees"
            element={
              <ProtectedRoute mainId="40" subId="401">
                <AdminLayout>
                  <Employees />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/material"
            element={
              <ProtectedRoute mainId="40" subId="402">
                <AdminLayout>
                  <Material />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* รายงาน main=50 */}
          <Route
            path="/registration/register-asset"
            element={
              <ProtectedRoute mainId="50" subId="501">
                <AdminLayout>
                  <RegisterAsset />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/registration/register-asset/create"
            element={
              <ProtectedRoute mainId="50" subId="501">
                <AdminLayout>
                  <AssetList />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/registration/register-asset/detail"
            element={
              <ProtectedRoute mainId="50" subId="501">
                <AdminLayout>
                  <AssetDetail />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/registration/register-asset/log"
            element={
              <ProtectedRoute mainId="50" subId="501">
                <AdminLayout>
                  <AssetLog />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* SMART PACKAGE TRACKING main=60 */}
          <Route
            path="/smart-package/system-out"
            element={
              <ProtectedRoute mainId="60" subId="601">
                <AdminLayout>
                  <SystemOut />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/smart-package/system-out/list"
            element={
              <ProtectedRoute mainId="60" subId="601">
                <AdminLayout>
                  <SystemOutList />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/smart-package/system-in"
            element={
              <ProtectedRoute mainId="60" subId="602">
                <AdminLayout>
                  <SystemIn />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/smart-package/system-repair"
            element={
              <ProtectedRoute mainId="60" subId="603">
                <AdminLayout>
                  <SystemRepair />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* รายงาน main=70 */}
          <Route
            path="/registration/register-asset"
            element={
              <ProtectedRoute mainId="70" subId="701">
                <AdminLayout>
                  <EmployeeReport />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports/training-report"
            element={
              <ProtectedRoute mainId="70" subId="702">
                <AdminLayout>
                  <TrainingReport />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* ✅ route ไม่ตรงกับอะไรเลย → 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </WithIdleLock>
    </BrowserRouter>
  );
}
