"use strict";

require("dotenv").config();
const express = require("express");
const cors = require("cors");

/* -------------------------- Socket.IO ----------------------- */
const http = require("http");
const { Server } = require("socket.io");

const auth = require("./src/auth/middleware/authMiddleware"); // function middleware
const { verifyJwtAndTV } = auth;
/* -------------------------- Socket.IO ----------------------- */

const { useSecurityHeaders } = require("./src/auth/middleware/security");
const permit = require("./src/auth/middleware/permit");

const authRoutes = require("./src/auth/authRoutes");
const forgotpasswordRoutes = require("./src/modules/management/forgotPassword/forgotpasswordRoutes");
const permissionRoutes = require("./src/modules/management/permissionRole/permissionRoutes");
const managementRoutes = require("./src/modules/management/userManagement/managementRoutes");

const employeeRoutes = require("./src/modules/masterdata/employee/employeeRoutes");
const workhistoryRoutes = require("./src/modules/masterdata/workhistory/workhistoryRoutes");
const relativesRoutes = require("./src/modules/masterdata/relatives/relativesRoutes");
const locationRoutes = require("./src/modules/masterdata/location/locationRoutes");
const materialRoutes = require("./src/modules/masterdata/material/materialRoutes");

const branchRoutes = require("./src/modules/settings/branch/branchRoutes");
const companyRoutes = require("./src/modules/settings/company/companyRoutes");
const countingunitRoutes = require("./src/modules/settings/countingunit/countingunitRoutes");
const departmentRoutes = require("./src/modules/settings/department/departmentRoutes");
const areaRoutes = require("./src/modules/settings/area/areaRoutes");
const packagingRoutes = require("./src/modules/settings/packaging/packagingRoutes");
const positionRoutes = require("./src/modules/settings/position/positionRoutes");
const zoneRoutes = require("./src/modules/settings/zone/zoneRoutes");

const reportEmployeeRoutes = require("./src/modules/reports/reportEmployee/reportEmployeeRoutes");
const reportTrainingRoutes = require("./src/modules/reports/reportTraining/reportTrainingRoutes");
const db = require("./src/config/database");
const path = require("path");
const app = express();
app.use(express.json());

// ✅ ตั้ง trust proxy ให้เหมาะสม “ก่อน” ติดตั้ง rate limiter/helmet ใดๆ
app.disable("trust proxy"); // ไม่มี proxy ก็ปิดไปเลย (ค่า default)

/* ---------------- Security & Core Middlewares ---------------- */
useSecurityHeaders(app);

// CORS
const allowOrigin = process.env.FRONTEND_ORIGIN || "*";
app.use(
  cors({
    origin: allowOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* -------------------------- Routes -------------------------- */

// ✅ Auth routes (public endpoints ภายในนั้นดูแลเอง)
app.use("/api/auth", authRoutes);

// Forgot password (แล้วแต่ flow ของคุณ จะให้ auth หรือไม่ ให้ route ข้างในเป็นตัวตัดสิน)
app.use("/api/forgotpassword", forgotpasswordRoutes);

// Permission routes (ด้านในครอบ permit แล้ว ยกเว้น /my-menus)
app.use("/api/permission", permissionRoutes);

// Management routes: ❗ไม่ครอบ permit ที่นี่ เพราะมี /management/me ที่ทุกคนต้องเรียกได้ (ตาม Sidebar คุณเรียกอยู่)
app.use("/api/management", managementRoutes);

/**
 * =========================
 * Settings (main=30)
 * =========================
 */
app.use("/api/settings/branch", auth, permit({ mainId: "30", subId: "301" }), branchRoutes);
app.use("/api/settings/company", auth, permit({ mainId: "30", subId: "302" }), companyRoutes);
app.use("/api/settings/department", auth, permit({ mainId: "30", subId: "302" }), departmentRoutes);
app.use("/api/settings/position", auth, permit({ mainId: "30", subId: "303" }), positionRoutes);
app.use("/api/settings/zone", auth, permit({ mainId: "30", subId: "304" }), zoneRoutes);
app.use("/api/settings/area", auth, permit({ mainId: "30", subId: "305" }), areaRoutes);
app.use("/api/settings/countingunit", auth, permit({ mainId: "30", subId: "306" }), countingunitRoutes);
app.use("/api/settings/packaging", auth, permit({ mainId: "30", subId: "307" }), packagingRoutes);

/**
 * =========================
 * Masterdata (main=40)
 * =========================
 */
app.use("/api/employee", auth, permit({ mainId: "40", subId: "401" }), employeeRoutes);
app.use("/api/workhistory", auth, permit({ mainId: "40", subId: "401" }), workhistoryRoutes);
app.use("/api/relatives", auth, permit({ mainId: "40", subId: "401" }), relativesRoutes);
app.use("/api/location", auth, permit({ mainId: "40", subId: "401" }), locationRoutes);
app.use("/api/masterdata/material", auth, permit({ mainId: "40", subId: "402" }), materialRoutes);

/**
 * =========================
 * Registration (main=50)
 * =========================
 */


/**
 * =========================
 * Reports (main=60)
 * =========================
 */
app.use("/api/report/employee", auth, permit({ mainId: "60", subId: "601" }), reportEmployeeRoutes);
app.use("/api/report/training", auth, permit({ mainId: "60", subId: "602" }), reportTrainingRoutes);

/* --------------------- Static File Serving ------------------- */
app.use("/img/profile", express.static(path.join(__dirname, "src/img/profile")));
app.use("/img/signature", express.static(path.join(__dirname, "src/img/signature")));
app.use("/img/employee", express.static(path.join(__dirname, "src/img/employee")));
app.use("/img/material", express.static(path.join(__dirname, "img/material")));

// Health & root
app.get("/", (_req, res) => res.send("UDP API is running"));
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/db", async (_req, res) => {
  try {
    // ใช้คำสั่ง SQL ง่ายๆ เพื่อทดสอบ (SELECT 1)
    // หมายเหตุ: ถ้าใช้ mysql2 ให้ใช้ db.execute หรือ db.query
    await db.execute("SELECT 1");

    res.status(200).json({
      status: "ok",
      message: "Database connection is healthy",
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Database Connection Error:", error);
    res.status(500).json({
      status: "error",
      message: "Cannot connect to database",
      error: error.message
    });
  }
});

/* -------------------- 404 & Error Handler ------------------- */
app.use((req, res, _next) => {
  res.status(404).json({
    success: false,
    message: "Not Found",
    path: req.originalUrl,
  });
});

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

/* -------------------------- Socket.IO ----------------------- */
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowOrigin, credentials: true },
});

io.use(async (socket, next) => {
  try {
    const fromAuth = socket.handshake.auth && socket.handshake.auth.token;
    const fromHeader = socket.handshake.headers?.authorization;
    const token = fromAuth || (fromHeader?.startsWith("Bearer ") ? fromHeader.slice(7) : null);
    const user = await verifyJwtAndTV(token);
    socket.user = user;
    socket.join(`emp:${user.employee_id}`);
    next();
  } catch (e) {
    next(new Error("unauthorized"));
  }
});

app.set("io", io);

/* -------------------------- Boot ---------------------------- */
const PORT = process.env.PORT;
httpServer.listen(PORT, () => console.log(`Server on port ${PORT}`));
