// src/modules/registration/registerasset/registerassetController.js
'use strict';

const model = require('./registerassetModel');
const dayjs = require('dayjs');

async function getAll(_req, res, next) {
  try {
    const rows = await model.getAll();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const body = req.body;
    const qty = parseInt(body.quantity) || 1;
    const baseAssetCode = body.asset_code;
    const user = req.user?.employee_id || 'System';

    // 1. Generate LOT (รูปแบบ YYMMDD + ลำดับ 2 หลัก)
    const todayStr = dayjs().format('YYMMDD');
    const lastLot = await model.getLastLotNumber(todayStr);
    let nextLotSeq = 1;
    if (lastLot) {
      const suffix = lastLot.slice(-2); // ตัดเอา 2 ตัวท้ายมาบวกเพิ่ม
      nextLotSeq = parseInt(suffix) + 1;
    }
    const lotNo = `${todayStr}${String(nextLotSeq).padStart(2, '0')}`;

    // 2. Prepare Status (สถานะเริ่มต้นแบบใหม่)
    const defaultAssetStatus = '100';
    const defaultIsStatus = '120';
    const assetStatusInfo = await model.getErpStatus('A1', defaultAssetStatus);
    const isStatusInfo = await model.getErpStatus('A1', defaultIsStatus);

    const dataToInsert = [];
    const responseRows = [];

    // [Timezone Fix]
    const bangkokDate = new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
    const createdTimestamp = dayjs(bangkokDate).format('YYYY-MM-DD HH:mm:ss');

    // 3. เตรียมข้อมูล Prefix สำหรับรหัสทรัพย์สิน และ Label
    // กรณีไม่มี doc_no ให้ใช้ XXXXX แทนตามเงื่อนไขข้อ 3
    const docNo = body.doc_no || 'XXXXX';
    const dept = body.asset_responsible_department || 'XX';
    const modelName = body.asset_model || 'XX';

    // ------------------------------------------------------------------
    // แก้ไขข้อ 2: เก็บค่า 01, 02 ไว้สร้างรหัส และแปลงเป็นข้อความเพื่อลง DB
    // ------------------------------------------------------------------
    const usedForCode = body.asset_usedfor || 'XX'; // เอาไว้สร้าง Code

    let usedForText = ''; // เอาไว้ลง Database
    if (usedForCode === '01') {
      usedForText = 'ใช้ภายใน';
    } else if (usedForCode === '02') {
      usedForText = 'ใช้ภายนอก';
    } else {
      usedForText = usedForCode; // กันเหนียวกรณีมีค่าอื่นๆ หลุดมา
    }

    for (let i = 1; i <= qty; i++) {
      // รหัสทรัพย์สินใหม่ให้เริ่มนับลำดับ 4 หลักใหม่ เริ่มต้นที่ 0001
      const runNumber = String(i).padStart(4, '0');

      // รูปแบบ: ฝ่าย-การใช้งาน-โมเดล-เลขเอกสาร-Lot-ลำดับ4หลัก
      // ใช้ usedForCode (01 หรือ 02) ในการสร้างรหัสทรัพย์สิน
      const fullAssetCode = `${dept}-${usedForCode}-${modelName}-${docNo}-${lotNo}-${runNumber}`;

      // สร้าง Label Register ใหม่
      const labelReg = `${docNo}|${baseAssetCode}|${fullAssetCode}|${lotNo}|B|`;

      const row = {
        asset_code: fullAssetCode,
        asset_detail: body.asset_detail || '',
        asset_color: body.asset_color || '',
        asset_type: body.asset_type || '',
        asset_unitname: body.asset_unitname || '',
        asset_date: body.asset_date || null,
        create_date: createdTimestamp,
        doc_no: body.doc_no || '',
        asset_lot: lotNo,
        // เพิ่มคอลัมน์ใหม่ที่ต้องการบันทึกลง DB
        asset_responsible_department: body.asset_responsible_department || '',
        asset_model: body.asset_model || '',

        asset_holder: body.asset_holder || '',
        asset_location: body.asset_location || '',
        current_address: body.current_address || '',
        asset_origin: body.asset_origin || '',
        asset_width: body.asset_width || 0,
        asset_width_unit: body.asset_width_unit || '',
        asset_length: body.asset_length || 0,
        asset_length_unit: body.asset_length_unit || '',
        asset_height: body.asset_height || 0,
        asset_height_unit: body.asset_height_unit || '',
        asset_capacity: body.asset_capacity || 0,
        asset_capacity_unit: body.asset_capacity_unit || '',
        asset_weight: body.asset_weight || 0,
        asset_weight_unit: body.asset_weight_unit || '',
        asset_img: body.asset_img || '',
        asset_dmg_001: body.drawing_001 || '',
        asset_dmg_002: body.drawing_002 || '',
        asset_dmg_003: body.drawing_003 || '',
        asset_dmg_004: body.drawing_004 || '',
        asset_dmg_005: body.drawing_005 || '',
        asset_dmg_006: body.drawing_006 || '',
        asset_remark: body.asset_remark || '',
        asset_usedfor: usedForText,
        asset_brand: body.asset_brand || '',
        asset_source: body.asset_source || '',
        asset_feature: body.asset_feature || '',
        asset_supplier_name: body.asset_supplier_name || '',

        label_register: labelReg,
        partCode: baseAssetCode, // บันทึกแค่รหัสสินทรัพย์หลัก parts[1]
        print_status: '0',       // ค่าเริ่มต้นการพิมพ์
        asset_status: defaultAssetStatus, // ค่า 10
        is_status: defaultIsStatus,       // ค่า 20

        created_by: user,
        created_at: createdTimestamp
      };

      dataToInsert.push(row);

      responseRows.push({
        ...row,
        asset_status_name: assetStatusInfo?.G_NAME || defaultAssetStatus,
        asset_status_color: assetStatusInfo?.G_DESCRIPT || '',
        is_status_name: isStatusInfo?.G_NAME || defaultIsStatus,
        is_status_color: isStatusInfo?.G_DESCRIPT || '',
        docID: body.doc_no,
        partName: body.asset_detail
      });
    }

    await model.createBulk(dataToInsert);

    const io = req.app.get('io');
    if (io) {
      responseRows.forEach(row => {
        io.emit('registerasset:upsert', row);
      });
    }

    res.json({
      success: true,
      message: `สร้างรายการสำเร็จ ${qty} รายการ`,
      data: responseRows,
      lot: lotNo
    });

  } catch (err) {
    next(err);
  }
}

async function updatePrintStatus(req, res, next) {
  try {
    const { assetCode } = req.params;
    const user = req.user?.employee_id || 'System';

    // Model จะจัดการเรื่องเวลา Updated At (Bangkok) เอง
    const result = await model.incrementPrintStatus(assetCode, user);

    if (result === null) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    const statusInfo = await model.getErpStatus('A1', result.is_status);

    const responseData = {
      asset_code: assetCode,
      print_status: result.print_status,
      is_status: result.is_status,
      is_status_name: statusInfo?.G_NAME || result.is_status,
      is_status_color: statusInfo?.G_DESCRIPT || ''
    };

    const io = req.app.get('io');
    if (io) {
      io.emit('registerasset:upsert', responseData);
    }

    res.json({
      success: true,
      message: 'Print status updated',
      ...responseData
    });
  } catch (err) {
    next(err);
  }
}

async function deleteByLot(req, res, next) {
  try {
    const { lot } = req.params;
    // การลบไม่ต้องใช้ Timestamp
    const result = await model.deleteByLot(lot);
    res.json({ success: true, message: `ลบข้อมูล Lot ${lot} เรียบร้อย` });
  } catch (err) {
    next(err);
  }
}

async function cancelBulk(req, res, next) {
  try {
    const { assetCodes } = req.body;
    const user = req.user?.employee_id || 'System';

    if (!assetCodes || !Array.isArray(assetCodes) || assetCodes.length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่พบรายการที่ต้องการยกเลิก' });
    }

    // เรียก Model
    const result = await model.updateStatusCancel(assetCodes, user);

    // กรณีติด Validation (Status != 100)
    if (!result.success && result.errorType === 'INVALID_STATUS') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_STATUS',
        message: 'ไม่สามารถยกเลิกรายการได้เนื่องจากสถานะไม่ถูกต้อง',
        invalidItem: result.invalidItem
      });
    }

    // กรณีไม่พบข้อมูล หรือ Error อื่นๆ จาก Model
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message || 'เกิดข้อผิดพลาดในการยกเลิก' });
    }

    // กรณีสำเร็จ
    const io = req.app.get('io');
    if (io) {
      assetCodes.forEach(code => {
        io.emit('registerasset:delete', { asset_code: code });
      });
    }

    res.json({
      success: true,
      message: `ยกเลิกรายการสำเร็จ ${assetCodes.length} รายการ`
    });
  } catch (err) {
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const { assetCode } = req.params;
    const rows = await model.getHistoryByCode(assetCode);

    res.json({
      success: true,
      asset_code: assetCode,
      data: rows
    });
  } catch (err) {
    next(err);
  }
}

async function getOptions(req, res, next) {
  try {
    const [employees, suppliers] = await Promise.all([
      model.getEmployeeOptions(),
      model.getSupplierOptions()
    ]);

    res.json({
      success: true,
      data: {
        employees,
        suppliers
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  create,
  updatePrintStatus,
  deleteByLot,
  cancelBulk,
  getHistory,
  getOptions
};