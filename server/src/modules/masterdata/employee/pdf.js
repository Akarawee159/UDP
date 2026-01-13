// .src/modules/masterdata/employee/pdf.js
"use strict";
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

// --- START: Module-Level Helpers & Constants ---

/**
 * โหลดไฟล์ฟอนต์จาก path ที่กำหนดและแปลงเป็น Base64
 * @param {string} fontPath - Path ไปยังไฟล์ .ttf (เทียบกับ Project Root)
 * @returns {string} Base64 encoded string
 */
function loadBase64Font(fontPath) {
  let fullPath = "";
  try {
    // [FIX 2] เปลี่ยนมาอ้างอิงจาก Current Working Directory (Project Root)
    // แทนการใช้ __dirname ซึ่งจะเสถียรกว่า
    fullPath = path.resolve(process.cwd(), fontPath);

    // [DEBUG] เพิ่ม log เพื่อดูว่ามันพยายามอ่าน path ไหน
    console.log(`[PDF Font] Attempting to load font from: ${fullPath}`);

    return fs.readFileSync(fullPath).toString("base64");
  } catch (e) {
    console.error(
      `[PDF Error] Could not load font at ${fontPath} (Resolved to: ${fullPath})`
    );
    console.error(e.message);
    return "";
  }
}

// [PERFORMANCE/DRY] โหลดฟอนต์แค่ครั้งเดียวตอนเริ่มโมดูล
const FONT_REGULAR_BASE64 = loadBase64Font(
  "./src/modules/masterdata/employee/THSarabunNew/THSarabunNew.ttf"
);
const FONT_BOLD_BASE64 = loadBase64Font(
  "./src/modules/masterdata/employee/THSarabunNew/THSarabunNew Bold.ttf"
);

/** (v ?? "") || "-" (ถ้าเป็นค่าว่าง ให้แสดง "-") */
const t = (v) => {
  if (v === null || v === undefined || v === "") {
    return "-";
  }
  return String(v); // Convert numbers, etc., to string
};

/** DD/MM/YYYY */
function fmt(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** "36ปี 0เดือน 24วัน" -> "36ปี" */
function ageYears(v) {
  if (v == null) return "";
  const s = String(v).trim();
  const m = s.match(/(\d+)\s*ปี/); // ดึงตัวเลขหน้าคำว่า "ปี"
  if (m) return `${m[1]}`;
  if (/^\d+$/.test(s)) return `${parseInt(s, 10)}`; // กรณีเก็บเป็นตัวเลขล้วน
  return s; // fallback
}

/** 1989-10-11 -> 11 ต.ค. 2532 (ปฏิทินไทย) */
function fmtTH(d) {
  if (!d) return "";
  const mmTH = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];

  // parse แบบปลอดภัยจากสตริง YYYY-MM-DD
  const m = String(d).match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m) {
    const y = parseInt(m[1], 10),
      mo = parseInt(m[2], 10),
      day = parseInt(m[3], 10);
    return `${day} ${mmTH[mo - 1]} ${y + 543}`;
  }

  // fallback เผื่อรับ Date อื่นๆ
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  return `${dt.getDate()} ${mmTH[dt.getMonth()]} ${dt.getFullYear() + 543}`;
}

/** 1156437890912 -> 1-5643-7890-91-2 */
function fmtIDCard(v) {
  const s_val = t(v); // Get value from t(), might be "-"
  if (s_val === "-") return "-";

  const s = String(s_val).replace(/[^0-9]/g, ""); // Clean non-digits

  if (s.length === 13) {
    return `${s.substring(0, 1)}-${s.substring(1, 5)}-${s.substring(
      5,
      10
    )}-${s.substring(10, 12)}-${s.substring(12)}`;
  }

  return s_val; // Fallback to the original value from t()
}

/** Format phone: 02XXXXXXX -> 02-XXXXXXX, 08XXXXXXXX -> 08X-XXXXXXX */
function fmtPhone(v) {
  const s_val = t(v); // Get value from t(), might be "-"
  if (s_val === "-") return "-";

  const s = String(s_val).replace(/[^0-9]/g, ""); // Clean non-digits
  if (s.length === 0) return "-"; // Was just whitespace or junk

  // Case 1: 02 (9 digits total)
  if (s.startsWith("02") && s.length === 9) {
    return `${s.substring(0, 2)}-${s.substring(2)}`;
  }

  // Case 2: Mobile (10 digits total)
  if (s.startsWith("0") && s.length === 10) {
    return `${s.substring(0, 3)}-${s.substring(3)}`;
  }

  return s_val; // Fallback to the original value from t()
}

/** สร้างกล่องติ๊ก */
const box = (cond) => `
  <span class="chk"><b>${cond ? "✓" : "&nbsp;"}</b></span>
`;

/**
 * [HELPER] โหลดรูปพนักงานจาก (src/img/employee) และแปลงเป็น Base64
 * @param {string} imgFilename
 * @returns {string} Data URI (Base64) or fallback file:/// URL
 */
function loadEmployeeImageBase64(imgFilename) {
  const filename = t(imgFilename);
  if (!filename || filename === "-") return ""; // Check for "-" from new t()

  const baseFilename = path.basename(filename);
  // [FIX] แก้ Path ให้อ้างอิงจาก __dirname ถูกต้อง (ไต่กลับ 3 level)
  const absPath = path.join(__dirname, "../../../img/employee", baseFilename);

  try {
    const buf = fs.readFileSync(absPath);
    const ext = path.extname(baseFilename).toLowerCase();
    const mime = ext === ".png" ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (e) {
    console.warn(
      `[PDF Warn] Could not read image file ${filename} (at ${absPath}): ${e.message}`
    );
    // สำรองเป็น file:/// ถ้าอ่านไฟล์ไม่สำเร็จ (ตามโค้ดเดิม)
    return "file:///" + absPath.replace(/\\/g, "/");
  }
}

// --- END: Module-Level Helpers & Constants ---

/**
 * สร้าง HTML string สำหรับเอกสารประวัติพนักงาน
 * @param {object} row - ข้อมูลพนักงาน
 * @returns {string} HTML content
 */
function getTemplateHtml(row = {}) {
  // --- START: Data Processing & View Logic ---

  // โหลดรูปภาพ (เรียกใช้ Helper)
  const imgSrc = loadEmployeeImageBase64(row.employee_img);

  // Flags
  const isFW = Number(row.foreign_workers) === 1;
  const isFW2 = Number(row.disabled_person) === 1;

  // เพศ (ใช้ t() เพื่อความปลอดภัย แต่จริงๆ ควรเป็นค่าตรง)
  const isMale = /ชาย|male/i.test(t(row.gender));
  const isFemale = /หญิง|female/i.test(t(row.gender));

  // สถานะทหาร
  const ms = t(row.military_status);
  const m_army = /รับราชการทหารแล้ว/i.test(ms);
  const m_reservist = /ปลดเป็นทหารกองเกิน/i.test(ms);
  const m_defer = /ได้รับการผ่อนทหาร/i.test(ms);
  const m_rotc = /รด|นศท|นักศึกษาวิชาทหาร/i.test(ms);
  const m_black = /จับได้ใบดำ/i.test(ms);
  const m_exempt = /ได้รับการยกเว้น/i.test(ms);

  // สถานภาพสมรส
  const mar = t(row.marital_status);
  const s_single = /โสด/i.test(mar);
  const s_married = /สมรส/i.test(mar);
  const s_unreg = /ไม่ได้จดทะเบียน/i.test(mar);
  const s_divorce = /หย่า/i.test(mar);
  const s_separate = /แยกกันอยู่/i.test(mar);
  const s_widow = /หม้าย/i.test(mar);

  // ประเภทที่อยู่อาศัย
  const res = t(row.residence_type);
  const r_own = /บ้านตนเอง/i.test(res);
  const r_dorm = /หอพัก|อพาร์ตเมนต์|อพาร์ตเมนท์/i.test(res);
  const r_rent = /บ้านเช่า|เช่า/i.test(res);
  const r_relative = /ญาติ|ครอบครัว|พักอาศัยกับญาติ/i.test(res);
  const r_other = /อื่น/i.test(res);

  // --- END: Data Processing ---

  // --- START: HTML Template ---
  return `
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  
  <style>
    /* --- START: Embedded Fonts --- */
    ${FONT_REGULAR_BASE64
      ? `
    @font-face {
      font-family: 'THSarabunNew';
      font-style: normal;
      font-weight: 400; /* 400 or 'normal' */
      src: url(data:font/truetype;base64,${FONT_REGULAR_BASE64}) format('truetype');
    }
    `
      : ""
    }

    ${FONT_BOLD_BASE64
      ? `
    @font-face {
      font-family: 'THSarabunNew';
      font-style: normal;
      font-weight: 500; /* 500 or 'bold' */
      src: url(data:font/truetype;base64,${FONT_BOLD_BASE64}) format('truetype');
    }
    `
      : ""
    }
    /* --- END: Embedded Fonts --- */


    /* === CSS ที่เหลือทั้งหมด === */
    @page { 
      size: A4; 
      margin: 10mm 14mm 16mm 14mm;
    }
    * { box-sizing: border-box; }
    body { 
      font-family: 'THSarabunNew', Tahoma, sans-serif; 
      font-size: 20px; 
      color:#000; 
      font-weight: 400; /* [FIX] Default to normal */
    }
    b {
      font-weight: 500; /* [FIX] Ensure b is bold */
    }

    .doc-title { text-align:center; font-weight:500; font-size:22px; margin-bottom: 1mm; }
    .prehead {
      display:grid;
      grid-template-columns: 1fr 34mm;
      column-gap: 10mm;
      align-items: center;
      margin-bottom: 1mm;
    }
    .pre-left .line { margin: 0.5mm 0; }
    .underline { text-decoration: underline; font-weight:500; }
    .photo {
      width: 25mm; height: 33mm; object-fit: cover;
      border: 1.6px solid #000; justify-self: end;
      left: 34px; position: relative; top: -25px;
    }
    .flag-fw { 
        position: absolute; 
        top: 30mm;
        left: 50%;
        transform: translateX(-50%);
        color:#c00; font-weight:400; 
        font-size: 28px;
        margin-top: -10px;
    }
    .section { 
      border: 2px solid #000; 
      padding: 5mm 5mm; 
      margin-bottom: 1mm; 
      margin-top: -8mm;
    }
    .row      { display:flex; flex-wrap:wrap; gap: 4mm 8mm; margin-bottom: 3mm; } 
    .pair     { display:flex; gap: 3mm; align-items: baseline; }
    .label    { white-space:nowrap; min-width: fit-content; font-weight: 400; } /* [FIX] Labels are normal */
    
    /* [FIX] Make all value-holders BOLD by default */
    .value    { white-space:pre-wrap; font-weight: 500; }
    .fullname { white-space:pre-wrap;  position: relative; left: 4mm; font-weight: 500; }
    .age { white-space:pre-wrap;  position: relative; left: 5.5mm; font-weight: 500; }
    .ethnicity { white-space:pre-wrap;  position: relative; left: 12mm; font-weight: 500; }
    .valuereg_addr_no { white-space:pre-wrap;  position: relative; left: -5mm; font-weight: 500; }
    .valuevillage_no { white-space:pre-wrap;  position: relative; left: -13mm; font-weight: 500; }
    .valuevillage_no1 { white-space:pre-wrap;  position: relative; left: -9.5mm; font-weight: 500; }
    .valuejunction { white-space:pre-wrap;  position: relative; left: -7mm; font-weight: 500; }
    .valuejunction1 { white-space:pre-wrap;  position: relative; left: -5.5mm; font-weight: 500; }
    .valueroad { white-space:pre-wrap;  position: relative; left: 2mm; font-weight: 500; }
    .valuesubdistrict { white-space:pre-wrap;  position: relative; left: -3mm; font-weight: 500; }
    .valuedistrict { white-space:pre-wrap;  position: relative; left: -6.5mm; font-weight: 500; }
    .valueprovince { white-space:pre-wrap;  position: relative; left: -1mm; font-weight: 500; }
    .valuepostcode { white-space:pre-wrap;  position: relative; left: -4mm; font-weight: 500; }
    .valuephone { white-space:pre-wrap;  position: relative; left: -9mm; font-weight: 500; }
    
    /* [FIX] These have mixed content, so keep them normal and use <b> inside */
    .value-district  { position: relative; left: 14mm; font-weight: 400; } 
    .valueheight    { white-space:pre-wrap;  position: relative; left: 22mm; font-weight: 400; }
    .valueweight    { white-space:pre-wrap;  position: relative; left: 18mm; font-weight: 400; }
    
    /* Original CSS continues */
    .labelvillage_no { white-space:pre-wrap;  position: relative; left: -8.5mm;}
    .labelvillage_no1 { white-space:pre-wrap;  position: relative; left: -5.5mm;}
    .labeljunction { white-space:pre-wrap;  position: relative; left: -2mm;}
    .labeljunction1 { white-space:pre-wrap;  position: relative; left: -0.5mm;}
    .labelroad { white-space:pre-wrap;  position: relative; left: 7mm;}
    .labelsubdistrict { white-space:pre-wrap;  position: relative; left: 2mm;}
    .labeldistrict { white-space:pre-wrap;  position: relative; left: -1.5mm;}
    .labelprovince { white-space:pre-wrap;  position: relative; left: 4mm;}
    .labelphone { white-space:pre-wrap;  position: relative; left: -4mm;}

    .indent   { padding-left: 24mm; }
    .row .label:nth-child(2) { min-width: 20mm; } 
    .chk-group { display:flex; align-items:center; }
:root{
  --label-w: 26mm;
  --opt-gap: 2mm;
}
.opt-grid{
  display: grid;
  grid-template-columns: var(--label-w) 1fr;
  align-items: baseline;
  column-gap: 5mm;
  margin-bottom: 3mm;
}
.opt-grid .label{
  font-weight: 400;
  white-space: nowrap;
}
.opt-grid .cells{
  display: flex;
  flex-wrap: wrap;
  column-gap: var(--opt-gap);
  row-gap: 2mm;
}

/* ให้ตัวเลือกทุกอันแนบกล่อง+ข้อความตรงกลางเสมอ */
.opt{ 
  display: inline-flex !important; 
  align-items: center !important; 
  gap: 3mm; 
}

.cells.cols-3{
  display: grid;
  grid-template-columns: max-content max-content max-content;
  column-gap: var(--opt-gap);
  row-gap: 2mm;
}
.cells--nowrap{
  display: flex;
  flex-wrap: nowrap;
  column-gap: var(--opt-gap);
}
.addr-grid {
  display: grid;
  grid-template-columns: max-content 1fr max-content 1fr max-content 1fr;
  column-gap: 6mm;
  row-gap: 2mm;
  align-items: center;
  margin-bottom: 3mm;
}
.addr-grid .label { white-space: nowrap; }
.addr-grid .value { min-width: 18mm; }
.row--cols3{
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  column-gap: 12mm;
  row-gap: 0;
  align-items: center;
}
.row--cols3 .pair{
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 2mm;
  align-items: center;
}

.value--sex{
  display: inline-flex;
  gap: 6mm;
  white-space: nowrap;
  font-weight: 400;
}
.value--sex .opt{
  display: inline-flex;
  gap: 1mm;
}

.row--cols3 .pair .label{ white-space: nowrap; }
.row--cols2{
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 12mm;
  row-gap: 0;
  align-items: center;
}
.row--cols2 .pair{
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 2mm;
  align-items: center;
}
.inline-pairs{
  display: grid;
  grid-template-columns: max-content 1fr max-content 1fr;
  column-gap: 3mm;
  align-items: center;
}
.inline-pairs .label{ white-space: nowrap; min-width: 0; }
.opt-grid--mil1 .cells,
.opt-grid--mil2 .cells{
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  column-gap: 1mm;
  row-gap: 2mm;
  margin-bottom: -5mm;
}

/* === Global checkbox centering fix (sex/marital/residence) === */
.chk{
  display: inline-grid !important;
  place-items: center !important;
  width: 14px; height: 14px;
  border: 1.6px solid #000;
  margin: 0 4px 0 8px;
  vertical-align: middle;
}
.chk > b{
  display: block;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5 !important;   /* <— ตรงนี้แก้จุดหลักที่ทำให้ลอยไม่เท่ากัน */
  transform: none !important;
}

.opt-grid--mil1 .chk,
.opt-grid--mil2 .chk{
  display:inline-grid;
  place-items:center;
}
.opt-grid--mil1 .chk > b,
.opt-grid--mil2 .chk > b{
  transform:none !important;
}
    .subhead { font-weight:500; text-decoration: underline; margin: 1mm 0 2mm; }
    .sign-container{
        margin-top: 10mm;
        padding-bottom: 1mm;
        text-align: center;
        margin-bottom: 3mm;
    }
    .sign-container div {
        display: inline-block;
        text-align: center;
        width: 240px;
    }
    .sign-line { 
        border-bottom: 1.6px dotted #444; 
        height: 12px; 
        margin: 0 0 1mm;
    }
    .sign-cap  { 
        text-align:center;
    }
    .doccode{
        position: fixed;
        right: 4mm;
        bottom: 0mm;
        font-size: 20px;
    }
    .abc{
      position: relative;
      top: 3px;
    }
    .abc1{
      position: relative;
      top: 0px;
    }
    .abc2{
      position: relative;
      top: -3.5px;
      left: -15px;
    }
  </style>
</head>
<body>

  <div class="doc-title">ประวัติพนักงาน</div>

<div class="prehead">
  <div class="pre-left">
    <div class="line"><span class="label">ชื่อตำแหน่งงาน:</span> <span class="value">${t(
      row.position
    )}</span></div>
    <div class="line underline">ประวัติพนักงาน</div>

    ${isFW ? `<div class="flag-fw">ต่างด้าว</div>` : ""}
    ${isFW2 ? `<div class="flag-fw">คนพิการ</div>` : ""}
  </div>
  <div class="pre-right">
    ${imgSrc ? `<img class="photo" src="${imgSrc}" />` : `<img class="photo"/>`}
  </div>
</div>

  <div class="section">
    <div class="row">
      <div class="pair"><div class="label">ชื่อ นามสกุล:</div><div class="fullname">${t(
      row.titlename_th
    )} ${t(row.firstname_th)} ${t(row.lastname_th)}</div></div>
    </div>

 <div class="row row--cols3">
  <div class="pair">
    <div class="label">วัน เดือน ปี เกิด:</div>
    <div class="value">${fmtTH(row.birthdate)}</div>
  </div>
  <div class="pair">
    <div class="label">อายุ:</div>
    <div class="age">${ageYears(t(row.age))} &nbsp; ปี</div>
  </div>
  <div class="pair">
<div class="label">เพศ:</div>
<div class="value value--sex">
  <div class="abc1">ชาย</div><div class="abc2">${box(isMale)}</div>
  <div class="abc1">หญิง</div><div class="abc2">${box(isFemale)}</div>
</div>
  </div>
</div>

<div class="row row--cols3">
  <div class="pair">
    <div class="label">เชื้อชาติ:</div>
    <div class="ethnicity">${t(row.ethnicity)}</div>
  </div>
  <div class="pair">
    <div class="label">สัญชาติ:</div>
    <div class="value">${t(row.nationality)}</div>
  </div>
  <div class="pair">
    <div class="label">ศาสนา:</div>
    <div class="value">${t(row.religion)}</div>
  </div>
</div>

<div class="row row--cols2">
  <div class="pair">
    <div class="label">บัตรประชาชนหมายเลข:</div>
    <div class="value">${fmtIDCard(row.id_card)}</div>
  </div>
  <div class="pair">
    <div class="label">เลขที่บัตรประจำตัวพนักงาน:</div>
    <div class="value">${t(row.employee_code)}</div>
  </div>
</div>


    <div class="row">
      <div class="pair"><div class="label">ออกให้ที่:</div></div>
      <div class="pair"><div class="value-district">เขต</div><div class="value-district">
      <b>${t(row.issued_district)}</b> &nbsp; จังหวัด &nbsp; <b>${t(
      row.issued_province
    )}</b></div></div>
      <div class="pair"><div class="valuedistrict"></div><div class="valuedistrict"></div></div>
    </div>

<div class="row row--cols2">
  <div class="pair">
    <div class="label">ส่วนสูง:</div>
    <div class="valueheight"><b>${t(row.height_cm)}</b> &nbsp; ซม.</div>
  </div>
  <div class="pair">
    <div class="label">น้ำหนัก:</div>
    <div class="valueweight">${t(row.weight_kg)} &nbsp; กก.</div>
  </div>
</div>


<div class="opt-grid opt-grid--mil1">
  <div class="label">สถานภาพทางทหาร:</div>
  <div class="cells">
    <div class="opt">${box(m_army)}รับราชการทหารแล้ว</div>
    <div class="opt">${box(m_reservist)}ปลดเป็นทหารกองเกิน</div>
    <div class="opt">${box(m_defer)}ได้รับการผ่อนทหาร</div>
  </div>
</div>

<div class="opt-grid opt-grid--mil2">
  <div></div>
  <div class="cells">
    <div class="opt">${box(m_rotc)}จบ รด.</div>
    <div class="opt">${box(m_black)}จับได้ใบดำ</div>
    <div class="opt">${box(m_exempt)}ได้รับการยกเว้น</div>
  </div>
</div>


<div class="opt-grid">
  <div class="label">สถานภาพ:</div>
  <div class="cells">
    <div class="opt">${box(s_single)}</div><div class="abc">โสด</div>
    <div class="opt">${box(s_married)}</div><div class="abc">สมรส</div>
    <div class="opt">${box(s_unreg)}</div><div class="abc">ไม่จดทะเบียน</div>
    <div class="opt">${box(s_divorce)}</div><div class="abc">หย่า</div>
    <div class="opt">${box(s_separate)}</div><div class="abc">แยกกันอยู่</div>
    <div class="opt">${box(s_widow)}</div><div class="abc">หม้าย</div>
  </div>
</div>

    <div class="row">
      <div class="pair"><div class="label">ชื่อของสามี/ภริยา:</div>
      <div class="value">${t(row.spouse_name)}</div></div>
      <div class="pair"><div class="label">อาชีพของสามี/ภริยา:</div>
      <div class="value">${t(row.spouse_occupation)}</div></div>
    </div>


<div class="addr-grid">
  <div class="label">ที่อยู่ตามทะเบียนบ้าน:</div><div class="valuereg_addr_no">${t(
      row.reg_addr_no
    )}</div>
  <div class="labelvillage_no">หมู่:</div><div class="valuevillage_no">${t(
      row.village_no
    )}</div>
  <div class="labeljunction">ซอย:</div><div class="valuejunction">${t(
      row.junction
    )}</div>
</div>
<div class="addr-grid">
  <div class="labelroad">ถนน:</div><div class="valueroad">${t(row.road)}</div>
  <div class="labelsubdistrict">แขวง/ตำบล:</div><div class="valuesubdistrict">${t(
      row.subdistrict
    )}</div>
  <div class="labeldistrict">เขต/อำเภอ:</div><div class="valuedistrict">${t(
      row.district
    )}</div>
</div>
<div class="addr-grid">
  <div class="labelprovince">จังหวัด:</div><div class="valueprovince">${t(
      row.province
    )}</div>
  <div class="label">รหัสไปรษณีย์:</div><div class="valuepostcode">${t(
      row.postcode
    )}</div>
  <div class="labelphone">เบอร์โทรศัพท์:</div><div class="valuephone">${fmtPhone(
      row.phone_number
    )}</div>
</div>

<div style="height: 3mm;"></div>
<div class="addr-grid">
  <div class="label">ที่อยู่ปัจจุบันเลขที่:</div><div class="value">${t(
      row.curr_addr_no
    )}</div>
  <div class="labelvillage_no1">หมู่:</div><div class="valuevillage_no1">${t(
      row.village_no1
    )}</div>
  <div class="labeljunction1">ซอย:</div><div class="valuejunction1">${t(
      row.junction1
    )}</div>
</div>
<div class="addr-grid">
  <div class="labelroad">ถนน:</div><div class="valueroad">${t(row.road1)}</div>
  <div class="labelsubdistrict">แขวง/ตำบล:</div><div class="valuesubdistrict">${t(
      row.subdistrict1
    )}</div>
  <div class="labeldistrict">เขต/อำเภอ:</div><div class="valuedistrict">${t(
      row.district1
    )}</div>
</div>
<div class="addr-grid">
  <div class="labelprovince">จังหวัด:</div><div class="valueprovince">${t(
      row.province1
    )}</div>
  <div class="label">รหัสไปรษณีย์:</div><div class="valuepostcode">${t(
      row.postcode1
    )}</div>
  <div class="labelphone">เบอร์โทรศัพท์:</div><div class="valuephone">${fmtPhone(
      row.phone_number1
    )}</div>
</div>

<div class="opt-grid">
  <div class="label">ประเภทที่อยู่อาศัย:</div>
  <div class="cells cells--nowrap">
    <div class="opt">${box(r_own)}</div><div class="abc">บ้านตนเอง</div>
    <div class="opt">${box(r_dorm)}</div><div class="abc">หอพัก</div>
    <div class="opt">${box(r_rent)}</div><div class="abc">บ้านเช่า</div>
    <div class="opt">${box(
      r_relative
    )}</div><div class="abc">พักอาศัยกับญาติ</div>
    <div class="opt">${box(r_other)}</div><div class="abc">อื่นๆ</div>
  </div>
</div>

</div>
  
  <div class="subhead">ประวัติการศึกษา</div><br>

  <div class="section">
    <div class="row" style="margin-bottom: 0;">
      <div class="pair"><div class="label">ระดับ:</div><div class="value">${t(
      row.education
    )}</div></div>
      <div class="pair"><div class="label">ชื่อสถานศึกษา:</div><div class="value">${t(
      row.education_institution
    )}</div></div>
      <div class="pair"><div class="label">สำเร็จ พ.ศ.</div><div class="value">${t(
      row.grad_year_be
    )}</div></div>
    </div>
  </div>


  <div class="sign-container">
    <div>
        <div class="sign-line"></div>
        <div class="sign-cap">ลายมือชื่อแผนกบุคคล</div>
    </div>
  </div>

  <div class="doccode">${t(row.docCode)}</div>

</body>
</html>`;
  // --- END: HTML Template ---
}

/* ✅ แก้ไข: เปลี่ยนจาก browserPromise เป็นตัวแปร sharedBrowser เพื่อเช็คสถานะได้ */
let sharedBrowser = null;

async function getBrowser() {
  // 1. ถ้ามี Browser เปิดอยู่แล้ว และยังไม่หลุดการเชื่อมต่อ ให้ใช้ตัวเดิม (เร็วมาก)
  if (sharedBrowser && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }

  // 2. ถ้าไม่มี ให้เปิดใหม่
  // เพิ่ม args เพื่อประสิทธิภาพใน Server environment
  sharedBrowser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // ช่วยลดการใช้ memory /dev/shm
      "--disable-gpu",           // ปิด GPU (Server ส่วนใหญ่ไม่มี)
      "--disable-extensions"
    ],
  });

  return sharedBrowser;
}

/**
 * Orchestrator: สร้าง HTML และแปลงเป็น PDF Buffer
 * @param {object} row
 * @returns {Promise<Buffer>}
 */
async function renderEmployeeForm(row) {
  // เรียกใช้ Browser ตัวกลาง
  const browser = await getBrowser();

  let page = null;
  try {
    // เปิด Tab ใหม่ (เร็วกว่าเปิด Browser ใหม่)
    page = await browser.newPage();

    // 1. สร้าง HTML
    const htmlContent = getTemplateHtml(row);

    // 2. ตั้งค่าเนื้อหา
    // ✅ waitUntil: "domcontentloaded" เร็วที่สุดสำหรับ HTML ที่มี data base64 ครบแล้ว
    await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });

    // 3. สร้าง PDF
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    return buffer;

  } catch (err) {
    console.error("[PDF Error]", err);
    throw err;
  } finally {
    // ✅ ปิดเฉพาะ Tab (Page) ห้ามปิด Browser หลัก
    if (page) await page.close();
  }
}

// (Optional) Cleanup เมื่อปิด Server
process.on("exit", async () => {
  if (sharedBrowser) await sharedBrowser.close();
});

module.exports = { renderEmployeeForm };
