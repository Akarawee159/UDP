// src/layouts/AdminLayout.jsx
import React from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

/* =========================
 * Config & Helper functions
 * ========================= */
const LOCAL_STORAGE_KEY = "sidebarOpen";

/** อ่านค่าเริ่มต้นของสถานะ Sidebar จาก localStorage (รองรับ SSR) */
function getInitialSidebarOpen() {
  if (typeof window === "undefined") return false; // กัน error ตอน SSR/ไม่มี window
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  // ถ้ายังไม่เคยบันทึก ให้ปิดไว้ก่อนเป็นค่าเริ่มต้น (false)
  return saved === "1";
}

/* ================
 * Layout Component
 * ================ */
export default function AdminLayout({ children }) {
  /* -------------
   * State
   * ------------- */
  // ใช้ lazy initializer เพื่อคำนวณค่าเริ่มต้นแค่ครั้งแรก
  const [sidebarOpen, setSidebarOpen] = React.useState(getInitialSidebarOpen);

  /* -------------
   * Effects
   * ------------- */
  // เมื่อ sidebarOpen เปลี่ยน ให้บันทึกลง localStorage
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LOCAL_STORAGE_KEY, sidebarOpen ? "1" : "0");
  }, [sidebarOpen]);

  /* -------------
   * Handlers
   * ------------- */
  const handleToggleSidebar = () => setSidebarOpen(v => !v);
  const handleAnyLinkClick = () => setSidebarOpen(false);

  /* -------------
   * Render
   * ------------- */
  return (
    <div className="flex h-screen bg-gray-100">
      {/* แสดง Sidebar เฉพาะเมื่อเปิดอยู่ */}
      {sidebarOpen && <Sidebar onAnyLinkClick={handleAnyLinkClick} />}

      {/* พื้นที่เนื้อหาเมน */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Navbar จะมีปุ่ม toggle เรียก handleToggleSidebar */}
        <Navbar onToggleSidebar={handleToggleSidebar} />

        {/* ส่วนหลักของหน้า ใส่ children จากหน้าต่างๆ */}
        <main className="flex-1 overflow-y-auto p-4">{children}</main>
      </div>
    </div>
  );
}
