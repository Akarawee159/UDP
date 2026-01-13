// auth/auditModel.js
'use strict';
const db = require('../config/database');

async function insertAuthLog({
  employee_id,
  username,
  event,        // 'login' | 'logout' | 'auto_logout'
  os,
  device,
  browser,
  ip,
  user_agent
}) {
  const sql = `
    INSERT INTO auth_audit_logs
      (employee_id, username, event, os, device, browser, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  await db.query(sql, [
    String(employee_id || ''),
    String(username || ''),
    String(event || ''),
    os || null,
    device || null,
    browser || null,
    ip || null,
    user_agent || null
  ]);
}

module.exports = { insertAuthLog };
