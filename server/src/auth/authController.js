'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const UAParser = require('ua-parser-js');
const auditModel = require('./auditModel');
require('dotenv').config();
const dayjs = require('dayjs');
const authModel = require('./authModel');

/* ---------- helpers: UA/IP ---------- */
function parseClient(req) {
  const ua = String(req.headers['user-agent'] || '');
  const parser = new UAParser(ua);
  const osInfo = parser.getOS();        // { name, version }
  const brInfo = parser.getBrowser();   // { name, version }
  const devInfo = parser.getDevice();   // { vendor, model, type }

  const os = [osInfo.name, osInfo.version].filter(Boolean).join(' ').trim() || null;
  const browser = [brInfo.name, brInfo.version].filter(Boolean).join(' ').trim() || null;

  // device: desktop/mobile/tablet/console/smarttv/wearable/embedded + รุ่น (ถ้ามี)
  const deviceType = devInfo.type || 'desktop';
  const deviceModel = [devInfo.vendor, devInfo.model].filter(Boolean).join(' ');
  const device = [deviceType, deviceModel].filter(Boolean).join(' ').trim() || deviceType;

  // IP: รองรับหลัง reverse proxy (ตั้ง trust proxy ใน server.js)
  const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = fwd || req.socket?.remoteAddress || req.ip || null;

  return { os, browser, device, ip, user_agent: ua };
}

/* --------------------------- Helpers --------------------------- */
function buildAccessClaims(user) {
  return {
    employee_id: user.employee_id,
    username: user.username,
    permission_role: user.permission_role,
    role: user.role || user.permission_role,
    titlename_th: user.titlename_th,
    firstname_th: user.firstname_th,
    lastname_th: user.lastname_th,
    company: user.company,
    dep_code: user.dep_code,
    branch: user.branch,
    department: user.department,
    position: user.position,
    tv: Number(user.token_version || 0),
  };
}

function signAccessToken(user) {
  const claims = buildAccessClaims(user);
  const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
  return jwt.sign(claims, process.env.JWT_SECRET, { expiresIn });
}
function signRefreshToken(user) {
  const payload = { employee_id: user.employee_id, username: user.username };
  const expiresIn = process.env.REFRESH_EXPIRES_IN || '7d';
  return jwt.sign(payload, process.env.REFRESH_SECRET, { expiresIn });
}
function verifyJwtAsync(token, secret) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, payload) => (err ? reject(err) : resolve(payload)));
  });
}

// Helper: ดึงจำนวนวันจาก DB
async function getPolicyDays() {
  return await authModel.getGlobalPasswordPolicy();
}

/* ---------------------------- Login --------------------------- */
exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const users = await authModel.findUserByUsername(username);
    if (users.length === 0) {
      return res.status(401).json({ code: 'BAD_CREDENTIALS', message: 'Invalid username or password' });
    }
    const user = users[0];

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ code: 'BAD_CREDENTIALS', message: 'Invalid username or password' });
    }

    // 1. Bypass แบบเดิม (Hardcode Admin ID 1)
    const isAdminBypass =
      Number(user.employee_id) === 1 &&
      String(user.username || '').trim().toLowerCase() === 'admin';

    // 2. ✅ Bypass แบบใหม่ (จาก Permission Group)
    const isPrivilegeBypass = user.privilege_access === 'Allow';

    // ✅ ถ้าเข้าเงื่อนไขใดเงื่อนไขหนึ่ง ให้ข้ามการตรวจ Status
    if (!isAdminBypass && !isPrivilegeBypass) {
      const s = Number(user.is_status ?? user.status);
      const allowedStatuses = [1, 6];
      if (s === 2) return res.status(403).json({ code: 'USER_BUSY', message: 'ผู้ใช้นี้กำลังใช้งานอยู่' });
      if (s === 3) return res.status(403).json({ code: 'USER_FORBIDDEN', message: 'ผู้ใช้นี้ ไม่อนุญาตให้ใช้งาน' });
      if (s === 4) return res.status(403).json({ code: 'USER_FORGOT', message: 'ผู้ใช้นี้ แจ้งลืมรหัสผ่าน' });
      if (s === 5) return res.status(403).json({ code: 'ADMIN_DOING', message: 'ผู้ดูแลระบบกำลังทำการรีเซ็ทรหัสผ่านให้คุณ' });
      if (!allowedStatuses.includes(s)) {
        return res.status(403).json({ code: 'ACCOUNT_INACTIVE', message: 'บัญชีผู้ใช้งานถูกปิดใช้งาน' });
      }
    }

    // 👉 เพิ่มเช็กรหัสผ่านหมดอายุ/ถูกบังคับเปลี่ยน
    const expired = user.password_expires_at ? new Date(user.password_expires_at) <= new Date() : false;
    const mustChange = Number(user.must_change_password || 0) === 1;

    if (expired || mustChange) {
      // ✅ ดึงค่าวันหมดอายุจาก DB
      const currentPolicyDays = await getPolicyDays();

      const resetToken = signResetToken(user, 'password_expired');
      return res.status(419).json({
        code: 'PASSWORD_EXPIRED',
        message: 'รหัสผ่านหมดอายุ/ต้องเปลี่ยนก่อนเข้าใช้งาน',
        resetToken,
        default_expiry_days: currentPolicyDays // ส่งค่าจริงจาก DB ไปให้ Frontend แสดง
      });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await authModel.saveRefreshToken(user.employee_id, refreshToken);

    try { await authModel.updateEmployeeStatusById(user.employee_id, 2); } catch { }

    try {
      const c = parseClient(req);
      await auditModel.insertAuthLog({
        employee_id: user.employee_id,
        username: user.username,
        event: 'login',
        ...c
      });
    } catch (e) {
      console.warn('audit login log failed:', e?.message || e);
    }

    const io = req.app.get('io');
    io?.emit('user:status', { employee_id: user.employee_id, is_status: 2 });

    return res.json({
      accessToken,
      refreshToken,
      user: {
        employee_id: user.employee_id,
        username: user.username,
        permission_role: user.permission_role,
        role: user.role || user.permission_role,
        firstname_th: user.firstname_th,
        lastname_th: user.lastname_th,
        company: user.company,
        dep_code: user.dep_code,
        branch: user.branch,
        department: user.department,
        position: user.position
      }
    });
  } catch (error) {
    console.error('Login failed unexpectedly:', error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An internal server error occurred.' });
  }
};


/* ------------------------ Refresh Token ------------------------ */
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: 'Missing refresh token' });

  try {
    const tokens = await authModel.isRefreshTokenValid(refreshToken);
    if (tokens.length === 0) return res.status(403).json({ message: 'Refresh token is not valid or expired' });

    let payload;
    try {
      payload = await verifyJwtAsync(refreshToken, process.env.REFRESH_SECRET);
    } catch {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const users = await authModel.findUserByUsername(payload.username);
    if (users.length === 0) return res.status(401).json({ message: 'User not found' });
    const user = users[0];

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);

    await authModel.saveRefreshToken(user.employee_id, newRefreshToken);
    await authModel.deleteRefreshToken(refreshToken);

    return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    return res.status(500).json({ message: 'Refresh failed', error: error.message });
  }
};

/* ---------------------------- Logout --------------------------- */
exports.logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'Missing refresh token' });

  try {
    let employeeId = null;
    let username = null;
    await new Promise((resolve) => {
      jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, payload) => {
        if (!err && payload) {
          employeeId = payload.employee_id || null;
          username = payload.username || null;
        }
        resolve();
      });
    });

    await authModel.deleteRefreshToken(refreshToken);

    if (employeeId) {
      try { await authModel.updateEmployeeStatusById(employeeId, 1); } catch { }
    }

    try {
      const c = parseClient(req);
      await auditModel.insertAuthLog({
        employee_id: employeeId || 'unknown',
        username: username || 'unknown',
        event: 'logout',
        ...c
      });
    } catch (e) {
      console.warn('audit logout log failed:', e?.message || e);
    }

    const io = req.app.get('io');
    io?.emit('user:status', { employee_id: employeeId, is_status: 1 });

    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    return res.status(500).json({ message: 'Logout failed', error: error.message });
  }
};

/* --------------------- เตะผู้ใช้เป้าหมาย -------------------- */
exports.revokeSessionsForEmployee = async (req, res) => {
  const requester = req.user;
  const { employee_id, keep_status } = req.body || {};
  if (!employee_id) return res.status(400).json({ message: 'Missing employee_id' });

  const group = String(requester?.permission_role || requester?.role || '').toLowerCase();
  const isAdmin = group === 'administrator';

  const isSelf = String(requester?.employee_id || '') === String(employee_id);
  if (!isAdmin && !isSelf) return res.status(403).json({ message: 'Forbidden' });

  try {
    await authModel.deleteAllRefreshTokensByEmployeeId(employee_id);
    if (!keep_status) {
      await authModel.updateEmployeeStatusById(employee_id, 1);
    }
    await authModel.bumpTokenVersion(employee_id);

    const io = req.app.get('io');
    io?.to(`emp:${employee_id}`).emit('auth:revoke', { keep_status: !!keep_status });

    if (!keep_status) {
      io?.emit('user:status', { employee_id, is_status: 1 });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Revoke failed', error: error.message });
  }
};

/* ---------------------------- Verify --------------------------- */
exports.verifyPassword = async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'Missing username or password' });

  try {
    const users = await authModel.findUserByUsername(username);
    if (users.length === 0) return res.status(401).json({ code: 'BAD_CREDENTIALS', message: 'Invalid username or password' });

    const user = users[0];
    const s = Number(user.is_status ?? user.status);
    if (s === 3) return res.status(403).json({ code: 'USER_FORBIDDEN', message: 'ผู้ใช้นี้ ไม่อนุญาตให้ใช้งาน' });
    if (s === 4) return res.status(403).json({ code: 'USER_FORGOT', message: 'ผู้ใช้นี้ แจ้งลืมรหัสผ่าน' });
    if (s === 5) return res.status(403).json({ code: 'ADMIN_DOING', message: 'ผู้ดูแลระบบกำลังทำการรีเซ็ทรหัสผ่านให้คุณ' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ code: 'BAD_CREDENTIALS', message: 'Invalid username or password' });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'Verify failed', error: error.message });
  }
};

const clampDays = (d) => {
  const n = Number(d);
  if (!Number.isFinite(n)) return 90; // Default fallback
  return Math.max(1, Math.min(3650, Math.floor(n)));
};
const strongPwd = (pw) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/.test(String(pw || ''));

function signResetToken(user, reason = 'password_expired') {
  return jwt.sign(
    { employee_id: user.employee_id, username: user.username, reason },
    process.env.REFRESH_SECRET,
    { expiresIn: '10m' }
  );
}

// 1) กดเปลี่ยนรหัส "ขณะใช้งาน" (มี access token)
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Missing current/new password' });
  }
  if (!strongPwd(newPassword)) {
    return res.status(400).json({ message: 'รหัสผ่านต้องยาว ≥8 ตัว มี ตัวเล็ก/ใหญ่/ตัวเลข/อักขระพิเศษ' });
  }

  try {
    const users = await authModel.findUserByUsername(req.user.username);
    if (users.length === 0) return res.status(404).json({ message: 'User not found' });
    const user = users[0];

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(400).json({ message: 'รหัสผ่านเดิมไม่ถูกต้อง' });

    // ✅ เพิ่ม: ตรวจสอบว่ารหัสใหม่ซ้ำกับรหัสเดิมหรือไม่
    // if (currentPassword === newPassword) {
    //   return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องไม่เหมือนเดิม' });
    // }

    const hash = await bcrypt.hash(newPassword, 10);

    // ✅ ดึงค่าวันจาก DB (tb_password_expired)
    const policyDays = await getPolicyDays();
    const days = clampDays(policyDays);

    await authModel.updatePasswordAndExpiry(user.employee_id, hash, days, { clearMustChange: true });
    await authModel.deleteAllRefreshTokensByEmployeeId(user.employee_id);
    await authModel.bumpTokenVersion(user.employee_id);

    const fresh = (await authModel.findUserByUsername(user.username))?.[0];
    const newAccessToken = signAccessToken(fresh);
    const newRefreshToken = signRefreshToken(fresh);
    await authModel.saveRefreshToken(fresh.employee_id, newRefreshToken);

    req.app.get('io')?.to(`emp:${user.employee_id}`).emit('auth:password_changed', {
      at: new Date().toISOString()
    });

    return res.json({
      ok: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expires_in_days: days
    });
  } catch (e) {
    return res.status(500).json({ message: 'Change password failed', error: e.message });
  }
};

// 2) เปลี่ยนรหัส "จาก resetToken" (กรณีหมดอายุแล้ว) ✅ แก้ไข: เพิ่มการตรวจ CurrentPassword
exports.changeExpiredPassword = async (req, res) => {
  const { resetToken, currentPassword, newPassword, continue: shouldContinue } = req.body || {};

  // Validation เบื้องต้น
  if (!resetToken || !newPassword) return res.status(400).json({ message: 'Missing resetToken/newPassword' });
  if (!currentPassword) return res.status(400).json({ message: 'กรุณาระบุรหัสผ่านเดิม' }); // 👈 บังคับใส่รหัสเดิม

  if (!strongPwd(newPassword)) {
    return res.status(400).json({ message: 'รหัสผ่านต้องยาว ≥8 ตัว มี ตัวเล็ก/ใหญ่/ตัวเลข/อักขระพิเศษ' });
  }

  try {
    // ตรวจสอบ Token
    let payload;
    try {
      payload = await verifyJwtAsync(resetToken, process.env.REFRESH_SECRET);
      if (payload?.reason !== 'password_expired') throw new Error('Invalid reset token');
    } catch {
      return res.status(403).json({ message: 'Invalid or expired resetToken' });
    }

    // หา User
    const users = await authModel.findUserByUsername(payload.username);
    if (users.length === 0) return res.status(404).json({ message: 'User not found' });
    const user = users[0];

    // ✅ เพิ่ม: ตรวจสอบรหัสผ่านเดิมจริง ๆ
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return res.status(400).json({ message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    }

    // ✅ เพิ่ม: ตรวจสอบว่ารหัสใหม่ซ้ำกับรหัสเดิมหรือไม่
    // if (currentPassword === newPassword) {
    //   return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องไม่เหมือนเดิม' });
    // }

    // --- ดำเนินการเปลี่ยนรหัสผ่าน ---
    const hash = await bcrypt.hash(newPassword, 10);

    // ดึงค่าวันจาก DB (tb_password_expired)
    const policyDays = await getPolicyDays();
    const days = clampDays(policyDays);

    await authModel.updatePasswordAndExpiry(user.employee_id, hash, days, { clearMustChange: true });
    await authModel.deleteAllRefreshTokensByEmployeeId(user.employee_id);
    await authModel.bumpTokenVersion(user.employee_id);

    req.app.get('io')?.to(`emp:${user.employee_id}`).emit('auth:password_changed', {
      at: new Date().toISOString()
    });

    if (shouldContinue) {
      const fresh = (await authModel.findUserByUsername(user.username))?.[0];
      const newAccessToken = signAccessToken(fresh);
      const newRefreshToken = signRefreshToken(fresh);
      await authModel.saveRefreshToken(fresh.employee_id, newRefreshToken);
      return res.json({ ok: true, accessToken: newAccessToken, refreshToken: newRefreshToken, expires_in_days: days });
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: 'Expired change failed', error: e.message });
  }
};

// 3) สถานะวันหมดอายุ + Config
exports.passwordStatus = async (req, res) => {
  try {
    const meta = await authModel.getPasswordMetaByEmployeeId(req.user.employee_id);
    const exAt = meta?.password_expires_at ? new Date(meta.password_expires_at) : null;
    const now = new Date();
    const daysLeft = exAt ? Math.ceil((exAt - now) / (1000 * 60 * 60 * 24)) : null;

    // ✅ ดึงค่า Policy ปัจจุบันไปด้วย เพื่อให้หน้า Frontend แสดง
    const currentPolicyDays = await getPolicyDays();

    return res.json({
      ok: true,
      password_expires_at: exAt ? exAt.toISOString() : null,
      days_left: daysLeft,
      must_change: !!meta?.must_change_password,
      policy_days: currentPolicyDays // เพิ่ม field นี้
    });
  } catch (e) {
    return res.status(500).json({ message: 'Status failed', error: e.message });
  }
};

// ✅ [เพิ่มใหม่] Public endpoint สำหรับดึง Policy (เผื่อ ModalExpired เรียกใช้โดยไม่มี Token)
exports.getPasswordPolicy = async (req, res) => {
  try {
    const days = await getPolicyDays();
    res.json({ success: true, policy_days: days });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch policy' });
  }
};