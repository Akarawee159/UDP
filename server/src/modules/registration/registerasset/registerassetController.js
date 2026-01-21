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
    const user = req.user?.username || 'System';

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

    // 3. Prepare Status Info (Dynamic Lookup)
    // Default values according to requirement
    const defaultAssetStatus = '10';
    const defaultIsStatus = '20';

    // ดึงข้อมูลชื่อและสีจาก tb_erp_status
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
        label_register: labelReg,
        partCode: baseAssetCode,

        print_status: '0',
        asset_status: defaultAssetStatus,
        is_status: defaultIsStatus,

        created_by: user
      };

      dataToInsert.push(row);

      // เตรียมข้อมูลสำหรับ Frontend รวมถึงสีและชื่อสถานะ
      responseRows.push({
        ...row,
        // Map ข้อมูลสถานะเพื่อแสดงผล
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
    const newStatus = await model.incrementPrintStatus(assetCode);

    if (newStatus === null) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    res.json({
      success: true,
      message: 'Print status updated',
      print_status: newStatus
    });
  } catch (err) {
    next(err);
  }
}

async function deleteByLot(req, res, next) {
  try {
    const { lot } = req.params;
    const result = await model.deleteByLot(lot);
    res.json({ success: true, message: `ลบข้อมูล Lot ${lot} เรียบร้อย` });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  create,
  updatePrintStatus,
  deleteByLot
};