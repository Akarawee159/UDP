// src/middlewares/permit.js
"use strict";

const model = require("../../modules/management/permissionRole/permissionModel");

const toArr = (v) => {
  try {
    return Array.isArray(v) ? v : JSON.parse(v ?? "[]");
  } catch {
    return [];
  }
};

async function loadMenusOnce(req) {
  // cache บน req กัน query ซ้ำใน request เดียว
  if (req._permMenus) return req._permMenus;

  const empId = req.user?.employee_id;
  if (!empId) return null;

  const row = await model.getMenusByEmployeeId(empId);

  const payload = {
    mainIds: toArr(row?.main_menu).map(String),
    subIds: toArr(row?.sub_menu).map(String),
    actionPermissions: toArr(row?.action_permission).map(String),
    groupName: String(row?.group_name || ""),
  };

  req._permMenus = payload;
  return payload;
}

function permit({ mainId, subId } = {}) {
  return async (req, res, next) => {
    try {
      if (!req.user?.employee_id) {
        return res.status(401).json({ success: false, message: "unauthorized" });
      }

      const menus = await loadMenusOnce(req);
      const allowMain = new Set((menus?.mainIds || []).map(String));
      const allowSub = new Set((menus?.subIds || []).map(String));

      if (mainId && !allowMain.has(String(mainId))) {
        return res.status(403).json({ success: false, message: "forbidden (main)" });
      }

      if (subId && !allowSub.has(String(subId))) {
        return res.status(403).json({ success: false, message: "forbidden (sub)" });
      }

      next();
    } catch (e) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }
  };
}

module.exports = permit;
