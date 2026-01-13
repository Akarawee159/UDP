"use strict";

const express = require("express");
const router = express.Router();

const auth = require("../../../auth/middleware/authMiddleware");
const permit = require("../../../auth/middleware/permit");

const permissionController = require("./permissionController");

/**
 * เมนู: การจัดการผู้ใช้งาน (main=20)
 * - กำหนดสิทธิการใช้งาน (sub=202) -> /permission
 */
const PERM_PERMISSION_PAGE = permit({ mainId: "20", subId: "202" });

/** Resource: /permission */

// ✅ FE ต้องใช้: ทุกคนที่ล็อกอินเรียกได้
router.get("/my-menus", auth, permissionController.myMenus);

// ✅ อื่นๆ: ต้องมีสิทธิ sub=202
router.get("/", auth, PERM_PERMISSION_PAGE, permissionController.getAll);
router.post("/", auth, PERM_PERMISSION_PAGE, permissionController.create);
router.put("/:id", auth, PERM_PERMISSION_PAGE, permissionController.update);
router.delete("/:id", auth, PERM_PERMISSION_PAGE, permissionController.remove);
router.patch("/:id/status", auth, PERM_PERMISSION_PAGE, permissionController.updateStatus);
router.get("/by-group/:group", auth, PERM_PERMISSION_PAGE, permissionController.byGroup);

module.exports = router;
