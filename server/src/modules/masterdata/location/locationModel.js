// src/modules/masterdata/location/locationModel.js
'use strict';
const db = require('../../../config/database');

// ดึง list จังหวัดเดิม (เผื่อส่วนอื่นเรียกใช้)
async function getAll() {
  const sql = `
    SELECT *
    FROM provinces
    ORDER BY name_th ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

// ค้นหา/แบ่งหน้า พื้นที่
// q = คำค้น (จังหวัด / อำเภอ / ตำบล / รหัสไปรษณีย์บางส่วนได้)
// page = หน้าที่ต้องการ (เริ่ม 1)
// pageSize = จำนวนต่อหน้า (เราจะใช้ 20)
async function searchLocations(q, page, pageSize) {
  const term = `%${q}%`;
  const offset = (page - 1) * pageSize;
  const hasQ = q.trim() !== '';

  // สร้าง WHERE ตามที่ผู้ใช้พิมพ์หา
  // แปลง zip_code (INT) เป็น string ด้วย CAST เพื่อให้ LIKE ทำงานได้
  const whereClause = hasQ
    ? `WHERE p.name_th LIKE ?
        OR d.name_th LIKE ?
        OR sd.name_th LIKE ?
        OR CAST(sd.zip_code AS CHAR) LIKE ?`
    : ``;

  const params = hasQ ? [term, term, term, term] : [];

  // ดึงข้อมูลตามโครงสร้าง:
  // จังหวัด (p) -> อำเภอ (d) -> ตำบล (sd)
  const dataSql = `
    SELECT
      sd.id        AS subdistrict_id,
      sd.name_th   AS subdistrict_name_th,
      sd.zip_code  AS zip_code,

      d.id         AS district_id,
      d.name_th    AS district_name_th,

      p.id         AS province_id,
      p.name_th    AS province_name_th

    FROM provinces p
    JOIN districts d
      ON d.province_id = p.id
    JOIN sub_districts sd
      ON sd.district_id = d.id

    ${whereClause}

    ORDER BY p.name_th ASC, d.name_th ASC, sd.name_th ASC
    LIMIT ? OFFSET ?
  `;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM provinces p
    JOIN districts d
      ON d.province_id = p.id
    JOIN sub_districts sd
      ON sd.district_id = d.id
    ${whereClause}
  `;

  // main data
  const [dataRows] = await db.query(dataSql, [...params, pageSize, offset]);

  // total count
  const [countRows] = await db.query(countSql, params);
  const total = countRows?.[0]?.total || 0;

  return {
    rows: dataRows,
    total,
  };
}

module.exports = {
  getAll,
  searchLocations,
};
