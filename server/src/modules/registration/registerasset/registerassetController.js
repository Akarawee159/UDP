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

    // 1. Generate LOT
    const todayStr = dayjs().format('DDMMYY');
    const lastLot = await model.getLastLotNumber(todayStr);

    let nextLotSeq = 1;
    if (lastLot) {
      const suffix = lastLot.slice(-4);
      nextLotSeq = parseInt(suffix) + 1;
    }
    const lotNo = `LOT${todayStr}${String(nextLotSeq).padStart(4, '0')}`;

    // 2. Find Last Asset Code
    const lastFullCode = await model.getLastAssetCodeRunning(baseAssetCode);
    let currentCodeSeq = 0;
    if (lastFullCode) {
      const prefixLength = baseAssetCode.length + 1;
      const suffix = lastFullCode.substring(prefixLength);
      if (suffix && !isNaN(suffix)) {
        currentCodeSeq = parseInt(suffix);
      }
    }

    // 3. Prepare Status Info
    const defaultAssetStatus = '10';
    const defaultIsStatus = '20';

    const assetStatusInfo = await model.getErpStatus('A1', defaultAssetStatus);
    const isStatusInfo = await model.getErpStatus('A1', defaultIsStatus);

    const dataToInsert = [];
    const responseRows = [];

    for (let i = 1; i <= qty; i++) {
      currentCodeSeq++;
      const runNumber = String(currentCodeSeq).padStart(7, '0');
      const fullAssetCode = `${baseAssetCode}-${runNumber}`;
      const docVal = body.docID || lotNo;
      const labelReg = `${docVal}|${baseAssetCode}|${fullAssetCode}|${lotNo}|B|`;

      const row = {
        asset_code: fullAssetCode,
        asset_detail: body.asset_detail,
        asset_type: body.asset_type,
        asset_date: body.asset_date,
        doc_no: body.docID || '',
        asset_lot: lotNo,
        asset_holder: body.asset_holder || '',
        asset_location: body.asset_location || '',

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
        asset_usedfor: body.asset_usedfor || '',
        asset_brand: body.asset_brand || '',
        asset_feature: body.asset_feature || '',
        asset_supplier_name: body.asset_supplier_name || '',
        label_register: labelReg,
        partCode: baseAssetCode,

        print_status: '0',
        asset_status: defaultAssetStatus,
        is_status: defaultIsStatus,

        created_by: user
      };

      dataToInsert.push(row);

      // Prepare data for Frontend (merged with Master Data)
      responseRows.push({
        ...row,
        asset_status_name: assetStatusInfo?.G_NAME || defaultAssetStatus,
        asset_status_color: assetStatusInfo?.G_DESCRIPT || '',
        is_status_name: isStatusInfo?.G_NAME || defaultIsStatus,
        is_status_color: isStatusInfo?.G_DESCRIPT || '',
        docID: body.docID,
        partName: body.asset_detail
      });
    }

    // 4. Insert
    await model.createBulk(dataToInsert);

    // --- SOCKET EMIT (Realtime Create) ---
    const io = req.app.get('io');
    if (io) {
      // Loop emit for every new row so all clients update immediately
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

    const result = await model.incrementPrintStatus(assetCode, user);

    if (result === null) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    const statusInfo = await model.getErpStatus('A1', result.is_status);

    const responseData = {
      asset_code: assetCode, // Important for matching
      print_status: result.print_status,
      is_status: result.is_status,
      is_status_name: statusInfo?.G_NAME || result.is_status,
      is_status_color: statusInfo?.G_DESCRIPT || ''
    };

    // --- SOCKET EMIT (Realtime Update) ---
    const io = req.app.get('io');
    if (io) {
      // Send partial update, frontend merge logic handles the rest
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

    // To enable Realtime delete, we need to know WHICH items are being deleted first
    // In a real app, you might want a `getByLot` model function first. 
    // For now, we'll assume the frontend will refresh or we broadcast a "clear lot" event.
    // However, the standard `socketClient` expects { asset_code } or ID.

    // NOTE: Implementing "Fetch before Delete" to emit correct socket events
    const itemsInLot = await model.getLastLotNumber(lot.replace('LOT', '')); // Reuse logic or creating new query is better. 
    // To keep it simple: Just perform delete. If you want strict realtime delete, 
    // you need to fetch IDs first. 

    const result = await model.deleteByLot(lot);

    // For simplicity, we can emit a custom event or rely on manual refresh for Bulk Delete
    // OR we iterate if we had the IDs. 
    // Since `deleteByLot` wipes many, let's skip complex socket loop here 
    // unless you add a `getAssetsByLot` function in Model.

    // Broadcasting a generic reload signal could be an option, 
    // but typically we emit 'registerasset:delete' for specific IDs.

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

    await model.updateStatusCancel(assetCodes, user);

    // --- SOCKET EMIT (Realtime Cancel) ---
    const io = req.app.get('io');
    if (io) {
      assetCodes.forEach(code => {
        // Option A: Emit 'delete' so it disappears from the filtered list (since is_status != 99)
        // Option B: Emit 'upsert' with is_status = 99
        // Based on RegisterAsset.jsx logic, upserting status 99 might not remove it instantly if the filter logic isn't re-run 
        // strictly. However, let's try 'delete' to force removal from UI.
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

module.exports = {
  getAll,
  create,
  updatePrintStatus,
  deleteByLot,
  cancelBulk,
  getHistory
};