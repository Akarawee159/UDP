'use strict';
const model = require('./permissionModel');

const parseJSON = (v) => { try { return Array.isArray(v) ? v : JSON.parse(v ?? '[]'); } catch { return []; } };
const rowToDTO = (r) => (!r ? null : ({
  id: r.permission_id,
  groupName: r.group_name,
  mainIds: parseJSON(r.main_menu),
  subIds: parseJSON(r.sub_menu),
  actionPermissions: parseJSON(r.action_permission),
  privilege_access: r.privilege_access || 'Normal',
  is_status: Number(r.is_status ?? 0)
}));

const ADMIN_ID = 1;
const ADMIN_NAME = 'administrator';
const REQ_MAIN = '20';
const REQ_SUBS = ['201', '202'];

function isAdminRow(row) {
  if (!row) return false;
  const byId = Number(row.permission_id) === ADMIN_ID;
  const byName = String(row.group_name || '').trim().toLowerCase() === ADMIN_NAME;
  return byId && byName;
}

/** GET /permission */
async function getAll(_req, res) {
  try {
    const rows = await model.getAll();
    const data = rows.map(rowToDTO);
    return res.status(200).json({ success: true, message: 'OK', count: data.length, data });
  } catch (err) {
    console.error('Failed to get all permissions:', err);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสิทธิ์' });
  }
}

/** POST /permission */
async function create(req, res) {
  try {
    const io = req.app.get('io');
    const { groupName, mainIds = [], subIds = [], actionPermissions = [], privilege_access } = req.body || {};
    const name = String(groupName || '').trim();
    if (!name || !Array.isArray(mainIds))
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });

    if (await model.existsByName(name)) {
      return res.status(409).json({ success: false, message: 'ชื่อนี้มีอยู่แล้ว' });
    }

    const id = await model.create({
      groupName: name,
      mainIds,
      subIds,
      actionPermissions,
      privilege_access: privilege_access === 'Allow' ? 'Allow' : 'Normal'
    });

    const row = await model.getById(id);
    const dto = rowToDTO(row);
    io?.emit('permission:upsert', dto);
    return res.status(201).json({ success: true, message: 'created', data: dto });
  } catch (err) {
    console.error('Failed to create permission:', err);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์' });
  }
}

/** PUT /permission/:id */
async function update(req, res) {
  try {
    const io = req.app.get('io');
    const id = Number(req.params.id);
    const { groupName, mainIds = [], subIds = [], actionPermissions = [], privilege_access } = req.body || {};
    const name = String(groupName || '').trim();
    if (!id || !name || !Array.isArray(mainIds))
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });

    const current = await model.getById(id);
    if (!current) return res.status(404).json({ success: false, message: 'ไม่พบรายการ' });

    // ✅ ปกป้องกลุ่ม administrator
    if (isAdminRow(current)) {
      const newNameNorm = name.toLowerCase();
      if (newNameNorm !== ADMIN_NAME) {
        return res.status(403).json({ success: false, code: 'ADMIN_PROTECTED_NAME', message: 'ห้ามเปลี่ยนชื่อกลุ่ม administrator' });
      }
      const mains = (mainIds || []).map(String);
      const subs = (subIds || []).map(String);
      if (!mains.includes(REQ_MAIN)) {
        return res.status(400).json({ success: false, code: 'ADMIN_REQUIRED_MAIN', message: `กลุ่ม administrator ต้องมีเมนูหลัก ${REQ_MAIN}` });
      }
      for (const s of REQ_SUBS) {
        if (!subs.includes(s)) {
          return res.status(400).json({ success: false, code: 'ADMIN_REQUIRED_SUB', message: `กลุ่ม administrator ต้องมีเมนูย่อย ${REQ_SUBS.join(', ')}` });
        }
      }
    }

    // กันชื่อซ้ำ (ยกเว้นแถวตัวเอง)
    if (await model.existsByNameExcludingId(id, name)) {
      return res.status(409).json({ success: false, message: 'ชื่อนี้มีอยู่แล้ว' });
    }

    // ✅ ตรวจสอบสถานะเดิมและใหม่
    const oldAccess = current.privilege_access || 'Normal';
    const newAccess = privilege_access === 'Allow' ? 'Allow' : 'Normal';

    const n = await model.updateById(id, {
      groupName: name,
      mainIds,
      subIds,
      actionPermissions,
      privilege_access: newAccess
    });
    if (!n) return res.status(404).json({ success: false, message: 'ไม่พบรายการ' });

    // ✅ ถ้ามีการปิด Switch (Allow -> Normal) ให้ Reset สถานะพนักงานในกลุ่มและเตะออก
    if (oldAccess === 'Allow' && newAccess === 'Normal') {
      // ใช้ชื่อกลุ่มเดิม (current.group_name) ในการหาคน เพราะในจังหวะนี้ถ้าเปลี่ยนชื่อกลุ่ม คนอาจจะยังลิงก์กับชื่อเก่าอยู่
      const affectedEmpIds = await model.revokeAndResetStatusByGroup(current.group_name);

      affectedEmpIds.forEach(empId => {
        // แจ้งเตือน Client ให้ logout
        io?.to(`emp:${empId}`).emit('auth:revoke', { keep_status: false });
        // แจ้งหน้าจอ Monitor ว่าสถานะเป็น 1 (Active)
        io?.emit('user:status', { employee_id: empId, is_status: 1 });
      });
    }

    const row = await model.getById(id);
    const dto = rowToDTO(row);

    // 🎯 realtime
    io?.emit('permission:upsert', dto);

    return res.status(200).json({ success: true, message: 'updated', data: dto });
  } catch (err) {
    console.error('Failed to update permission:', err);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตสิทธิ์' });
  }
}

// ... (ส่วนที่เหลือ remove, byGroup, myMenus, updateStatus เหมือนเดิม)
async function remove(req, res) {
  try {
    const io = req.app.get('io');
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'id ไม่ถูกต้อง' });

    const current = await model.getById(id);
    if (!current) return res.status(404).json({ success: false, message: 'ไม่พบรายการ' });

    if (isAdminRow(current)) {
      return res.status(403).json({ success: false, code: 'ADMIN_PROTECTED_DELETE', message: 'ห้ามลบกลุ่ม administrator' });
    }

    const n = await model.deleteById(id);
    if (!n) return res.status(404).json({ success: false, message: 'ไม่พบรายการ' });

    io?.emit('permission:delete', { id });

    return res.status(200).json({ success: true, message: 'deleted' });
  } catch (err) {
    console.error('Failed to delete permission:', err);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบสิทธิ์' });
  }
}

async function byGroup(req, res) {
  try {
    const name = String(req.params.group || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'group name required' });
    const row = await model.getByGroupName(name);
    if (!row) return res.status(404).json({ success: false, message: 'not found' });
    return res.json({ success: true, data: rowToDTO(row) });
  } catch (err) {
    console.error('Failed to get permission by group:', err);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
}

async function myMenus(req, res) {
  try {
    const empId = req.user?.employee_id;
    if (!empId) return res.status(401).json({ success: false, message: 'unauthorized' });
    const row = await model.getMenusByEmployeeId(empId);
    if (!row) return res.status(404).json({ success: false, message: 'not found' });
    return res.json({ success: true, data: rowToDTO(row) });
  } catch (err) {
    console.error('Failed to get my menus:', err);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
}

async function updateStatus(req, res) {
  try {
    const io = req.app.get('io');
    const id = Number(req.params.id);
    const status = Number(req.body?.is_status);
    if (!id || ![0, 1].includes(status))
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });

    const n = await model.updateStatusById(id, status);
    if (!n) return res.status(404).json({ success: false, message: 'ไม่พบรายการ' });

    io?.emit('permission:status', { id, is_status: status });

    return res.json({ success: true, message: 'updated', data: { id, is_status: status } });
  } catch (err) {
    console.error('Failed to update permission status:', err);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ' });
  }
}

module.exports = {
  getAll,
  create,
  update,
  remove,
  byGroup,
  myMenus,
  updateStatus
};