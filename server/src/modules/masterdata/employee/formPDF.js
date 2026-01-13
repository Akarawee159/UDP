// .src/modules/masterdata/employee/pdf.js
"use strict";
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");



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
  const m = s.match(/(\d+)\s*ปี/);           // ดึงตัวเลขหน้าคำว่า "ปี"
  if (m) return `${m[1]}ปี`;
  if (/^\d+$/.test(s)) return `${parseInt(s, 10)}ปี`; // กรณีเก็บเป็นตัวเลขล้วน
  return s; // fallback
}

/** 1989-10-11 -> 11 ต.ค. 2532 (ปฏิทินไทย) */
function fmtTH(d) {
  if (!d) return "";
  const mmTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  // parse แบบปลอดภัยจากสตริง YYYY-MM-DD
  const m = String(d).match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m) {
    const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), day = parseInt(m[3], 10);
    return `${day} ${mmTH[mo - 1]} ${y + 543}`;
  }

  // fallback เผื่อรับ Date อื่นๆ
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  return `${dt.getDate()} ${mmTH[dt.getMonth()]} ${dt.getFullYear() + 543}`;
}


function template(row = {}) {
  // --- START: Font Loading ---
  // อ่านไฟล์ฟอนต์จาก CWD (Current Working Directory) ที่รัน Node.js
  // และแปลงเป็น Base64 เพื่อฝังใน CSS
  let fontRegularBase64 = "";
  let fontBoldBase64 = "";

  try {
    const fontRegularPath = path.resolve("./THSarabunNew/THSarabunNew.ttf");
    fontRegularBase64 = fs.readFileSync(fontRegularPath).toString("base64");
  } catch (e) {
    console.error(`[PDF Error] Could not load regular font at ./THSarabunNew/THSarabunNew.ttf: ${e.message}`);
  }

  try {
    const fontBoldPath = path.resolve("./THSarabunNew/THSarabunNew Bold.ttf");
    fontBoldBase64 = fs.readFileSync(fontBoldPath).toString("base64");
  } catch (e) {
    console.error(`[PDF Error] Could not load bold font at ./THSarabunNew/THSarabunNew Bold.ttf: ${e.message}`);
  }
  // --- END: Font Loading ---

  const t = (v) => (v ?? "") || "";
  const isFW = Number(row.foreign_workers) === 1;
  const isFW2 = Number(row.disabled_person) === 1;
  // กล่องติ๊กที่ “นิ่ง” ทุกบริบท
// กล่องติ๊กที่ “นิ่ง” ทุกบริบท (เวอร์ชันใหม่)
const box = (cond) => `
  <span class="chk" style="
    display:inline-grid; place-items:center;
    width:12px; height:12px; border:1.6px solid #000;
    margin:0 4px 0 8px; vertical-align:middle;
  ">
    <b style="font-size:10.5px; font-weight:700; line-height:1;">
      ${cond ? "✓" : "&nbsp;"}
    </b>
  </span>`;




  // เพศ
  const isMale = /ชาย|male/i.test(t(row.gender));
  const isFemale = /หญิง|female/i.test(t(row.gender));

  // สถานะทหาร
  const ms = t(row.military_status);
  const m_army = /รับราชการทหารแล้ว/i.test(ms);
  const m_reservist = /ปลดเป็นทหารกองเกิน/i.test(ms);
  const m_defer = /ได้รับการผ่อนทหาร/i.test(ms); // ได้รับการผ่อนทหาร (ผ่อนผัน)
  const m_rotc = /รด|นศท|นักศึกษาวิชาทหาร/i.test(ms); // จบ รด.
  const m_black = /จับได้ใบดำ/i.test(ms); // จับได้ใบดำ
  const m_exempt = /ได้รับการยกเว้น/i.test(ms); // ได้รับการยกเว้น

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

  // รูปพนักงาน (ใช้ไฟล์ในโฟลเดอร์ src/img/employee)
  let imgSrc = "";
  if (t(row.employee_img)) {
    const filename = path.basename(String(row.employee_img));
    const absPath = path.join(__dirname, "../../../img/employee", filename);
    try {
      const buf = fs.readFileSync(absPath);
      const ext = path.extname(filename).toLowerCase();
      const mime = ext === ".png" ? "image/png" : "image/jpeg";
      imgSrc = `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
      // สำรองเป็น file:/// ถ้าอ่านไฟล์ไม่สำเร็จ
      imgSrc = "file:///" + absPath.replace(/\\/g, "/");
    }
  }

  return `
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  
  <style>
    /* --- START: Embedded Fonts --- */
    ${fontRegularBase64 ? `
    @font-face {
      font-family: 'THSarabunNew';
      font-style: normal;
      font-weight: 400; /* 400 or 'normal' */
      src: url(data:font/truetype;base64,${fontRegularBase64}) format('truetype');
    }
    ` : ''}

    ${fontBoldBase64 ? `
    @font-face {
      font-family: 'THSarabunNew';
      font-style: normal;
      font-weight: 700; /* 700 or 'bold' */
      src: url(data:font/truetype;base64,${fontBoldBase64}) format('truetype');
    }
    ` : ''}
    /* --- END: Embedded Fonts --- */


 @page { 
      size: A4; 
      margin: 10mm 14mm 16mm 14mm; /* << แก้ไขบรรทัดนี้ */
      /* - ขวา: เปลี่ยนจาก 14mm เป็น 10mm (ขยายไปทางขวา 4mm)
         - ซ้าย: เปลี่ยนจาก 14mm เป็น 10mm (ขยายไปทางซ้าย 4mm)
      */
    }
    * { box-sizing: border-box; }
    
    /* === EDITED: Set base font as requested === */
    body { 
      font-family: 'THSarabunNew', Tahoma, sans-serif; 
      font-size: 13px; 
      color:#000; 
      /* 'label' (non-bold) will use font-weight 400 by default */
    }
    
    /* === EDITED: Ensure bold elements use font-weight 700 to match @font-face === */


    .doc-title { text-align:center; font-weight:700; font-size:20px; margin-bottom: 2mm; }

    /* พื้นที่บรรทัดที่ 2–3 + รูปด้านขวา */
    .prehead {
      display:grid;
      grid-template-columns: 1fr 34mm; /* ลดพื้นที่รูปเล็กน้อย */
      column-gap: 10mm;
      align-items:start;
      margin-bottom: 2mm; /* ลด margin */
    }
    .pre-left .line { margin: 0.5mm 0; } /* ลด margin ในบรรทัด */
    .underline { text-decoration: underline; font-weight:700; } /* Use 700 for bold */
    .photo {
      width: 25mm; height: 33mm; object-fit: cover; /* ลดขนาดรูป */
      border: 1.6px solid #000; justify-self: end;
      left: 34px; position: relative; top: -25px;
    }
    .flag-fw { 
        position: absolute; 
        top: 31mm; /* ปรับตำแหน่งให้ตรงกับกลางบรรทัด 2-3 (ย้ายจาก 60mm) */
        left: 50%;
        transform: translateX(-50%);
        color:#c00; font-weight:400; 
        font-size: 28px;
        margin-top: -10px; /* ชดเชยเล็กน้อย (จะดึงขึ้นไปอยู่ระหว่างบรรทัด) */
    }

    /* กรอบข้อมูล */
    .section { 
      border: 2px solid #000; 
      padding: 5mm 5mm; 
      margin-bottom: 4mm; 
      margin-top: -8mm; /* << เพิ่มบรรทัดนี้เพื่อเลื่อนขึ้น */
    }

    /* ปรับ gap เพื่อให้ใกล้เคียงเอกสารต้นฉบับ */
    .row      { display:flex; flex-wrap:wrap; gap: 4mm 8mm; margin-bottom: 5mm; } /* ลด gap และ margin-bottom */ 
    .pair     { display:flex; gap: 3mm; align-items: baseline; }
    .label    { white-space:nowrap; min-width: fit-content; }

    /* ชื่อ-สกุล */
    .fullname { white-space:pre-wrap;  position: relative; left: 3mm;}

    /* วันเดือนปีเกิด */
    .age { white-space:pre-wrap;  position: relative; left: 4.5mm;}

    /* เชื้อชาติ */
    .ethnicity { white-space:pre-wrap;  position: relative; left: 11mm;}

    /* บ้านเลขที่ */
    .valuereg_addr_no { white-space:pre-wrap;  position: relative; left: -5mm;}

    /* หมู่ที่ */
    .labelvillage_no { white-space:pre-wrap;  position: relative; left: -8.5mm;}
    .valuevillage_no { white-space:pre-wrap;  position: relative; left: -13mm;}

    .labelvillage_no1 { white-space:pre-wrap;  position: relative; left: -5.5mm;}
    .valuevillage_no1 { white-space:pre-wrap;  position: relative; left: -9.5mm;}

  
    /* ซอย */
    .labeljunction { white-space:pre-wrap;  position: relative; left: -2mm;}
    .valuejunction { white-space:pre-wrap;  position: relative; left: -7mm;}

    .labeljunction1 { white-space:pre-wrap;  position: relative; left: -0.5mm;}
    .valuejunction1 { white-space:pre-wrap;  position: relative; left: -5.5mm;}

    /* ถนน */
    .labelroad { white-space:pre-wrap;  position: relative; left: 7mm;}
    .valueroad { white-space:pre-wrap;  position: relative; left: 2mm;}

    /* แขวง/ตำบล */
    .labelsubdistrict { white-space:pre-wrap;  position: relative; left: 2mm;}
    .valuesubdistrict { white-space:pre-wrap;  position: relative; left: -3mm;}

    /* เขต/อำเภอ */
    .labeldistrict { white-space:pre-wrap;  position: relative; left: -1.5mm;}
    .valuedistrict { white-space:pre-wrap;  position: relative; left: -6.5mm;}

    /* จังหวัด */
    .labelprovince { white-space:pre-wrap;  position: relative; left: 4mm;}
    .valueprovince { white-space:pre-wrap;  position: relative; left: -1mm;}

    /* รหัสไปษณีย์ */
    .valuepostcode { white-space:pre-wrap;  position: relative; left: -4mm;}

    /* เบอร์โทรศัพท์ */
    .labelphone { white-space:pre-wrap;  position: relative; left: -4mm;}
    .valuephone { white-space:pre-wrap;  position: relative; left: -9mm;}

    /* ออกให้ที่ */
    .value-district  {position: relative; left: 14mm;}

    /* ส่วนสูง */
    .valueheight    { white-space:pre-wrap;  position: relative; left: 22mm;}


    .value    { white-space:pre-wrap;}
    .indent   { padding-left: 24mm; } /* ใช้ดันบรรทัดที่ 9 ให้เริ่มตรงกับบรรทัด 8 */
    
    /* ปรับความกว้างของ label บางตัว */
    .row .label:nth-child(2) { min-width: 20mm; } 

    .chk { display:inline-flex; align-items:center; justify-content:center; width:12px; height:12px; line-height:1; border:1.6px solid #000; margin:0 4px 0 8px; font-size:10px; }
    .chk-group { display:flex; align-items:center; }


:root{
  --label-w: 26mm;   /* ความกว้างคอลัมน์ “สถานะทางทหาร/สถานะภาพ” ปรับได้ */
  --opt-gap: 2mm;   /* ระยะห่างระหว่างตัวเลือก */
}

/* กล่องตัวเลือกแบบหัวข้อ + ช่องตัวเลือก */
.opt-grid{
  display: grid;
  grid-template-columns: var(--label-w) 1fr;
  align-items: baseline;
  column-gap: 5mm;
  margin-bottom: 3mm;
}
.opt-grid .label{
  font-weight: 400; /* Ensure labels use regular font */
  white-space: nowrap;   /* ป้องกันหัวข้อยาวตัดบรรทัด เช่น 'สถานะทางทหาร:' */
}
.opt-grid .cells{
  display: flex;
  flex-wrap: wrap;
  column-gap: var(--opt-gap);
  row-gap: 2mm;
}
.opt{ display: inline-flex; align-items: center; gap: 1mm; }

/* ล็อก 3 คอลัมน์แนวตั้งให้ตรงกันระหว่างแถว 8–9 (สถานะทหาร) */
.cells.cols-3{
  display: grid;
  grid-template-columns: max-content max-content max-content;
  column-gap: var(--opt-gap);
  row-gap: 2mm;
}

/* บังคับประเภทที่อยู่อาศัยให้อยู่บรรทัดเดียว */
.cells--nowrap{
  display: flex;
  flex-wrap: nowrap;
  column-gap: var(--opt-gap);
}

/* กริดแถวที่อยู่ 13–15, 17–19 ให้ยืดเต็มกรอบและอ่านง่ายเหมือนภาพ */
.addr-grid {
  display: grid;
  grid-template-columns: max-content 1fr max-content 1fr max-content 1fr;
  column-gap: 6mm;      /* เดิม 6mm → โปร่งเหมือนตัวอย่าง */
  row-gap: 2mm;
  align-items: baseline;
  margin-bottom: 3mm;
}
.addr-grid .label { white-space: nowrap; }
.addr-grid .value { min-width: 18mm; }   /* กันคอลัมน์บีบจนถ้อยคำชนกัน */

/* แถว 2–3: จัดเป็น 3 คอลัมน์เท่ากันและยืดเต็มกรอบ */
.row--cols3{
  display: grid;
  grid-template-columns: 1fr 1fr 1fr; /* 3 คอลัมน์กว้างเท่ากัน */
  column-gap: 12mm;                   /* ปรับระยะห่างคอลัมน์ได้ */
  row-gap: 0;
  align-items: baseline;
}
/* ให้แต่ละคอลัมน์เป็นคู่ label + value */
.row--cols3 .pair{
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 2mm;
  align-items: baseline;
}

/* บังคับ 'เพศ' ให้อยู่บรรทัดเดียวกัน */
.value--sex{
  display: inline-flex;
  align-items: center;
  gap: 6mm;           /* ระยะห่างระหว่างตัวเลือก ปรับได้ */
  white-space: nowrap;/* กันตัดบรรทัด */
}
/* ใช้โครง opt เดียวกับชุด checkbox อื่นๆ เพื่อจัดเรียงแนวนอนสวยๆ */
.value--sex .opt{
  display: inline-flex;
  align-items: center;
  gap: 3mm;
}
.row--cols3 .pair .label{ white-space: nowrap; }


/* แถว 5 และ 7: 2 คอลัมน์เท่ากัน ยืดเต็มกรอบ */
.row--cols2{
  display: grid;
  grid-template-columns: 1fr 1fr;  /* ซ้าย=ขวา */
  column-gap: 12mm;
  row-gap: 0;
  align-items: baseline;
}
.row--cols2 .pair{
  display: grid;
  grid-template-columns: max-content 1fr; /* label + value */
  column-gap: 2mm;
  align-items: baseline;
}

/* กลุ่ม label/value ย่อยในค่า "ออกในที่:" → อำเภอ + จังหวัด */
.inline-pairs{
  display: grid;
  grid-template-columns: max-content 1fr max-content 1fr; /* อำเภอ | ค่า | จังหวัด | ค่า */
  column-gap: 3mm;
  align-items: baseline;
}
.inline-pairs .label{ white-space: nowrap; min-width: 0; }


/* ===== แถวเช็กบ็อกซ์ทหาร ===== */
/* บรรทัด 8 (แถวบน) + บรรทัด 9 (แถวล่าง) ใช้คอลัมน์กว้างเท่ากัน */
.opt-grid--mil1 .cells,
.opt-grid--mil2 .cells{
  display: grid;
  grid-template-columns: 1fr 1fr 1fr; /* 3 คอลัมน์เท่าๆ กัน -> แถว 8/9 จะตรงกันเป๊ะ */
  column-gap: 1mm;                   /* ปรับระยะระหว่างคอลัมน์เฉพาะบล็อกนี้ได้ */
  row-gap: 2mm;
  margin-bottom: 3mm; /* << **คุณสามารถปรับระยะห่างบรรทัดได้จากตรงนี้ครับ** */
}

/* จัดกึ่งกลาง “✓” ให้เป๊ะทุกรายการ */
.chk{
  display:inline-grid;
  place-items:center;
  width:12px; height:12px;
  line-height:1;
  border:1.6px solid #000;
  margin:0 4px 0 8px;
}
.chk > b{
  line-height:1;
  /* สำคัญ: ตัดการเลื่อนแกน Y ออก */
  transform:none !important;
}

/* ยกเลิก/ทับสไตล์พิเศษของบรรทัดทหารให้ใช้ศูนย์กลางเดียวกัน */
.opt-grid--mil1 .chk,
.opt-grid--mil2 .chk{
  display:inline-grid;
  place-items:center;
}
.opt-grid--mil1 .chk > b,
.opt-grid--mil2 .chk > b{
  transform:none !important;
}



    /* กรอบการศึกษา (หัว/กรอบใหม่) */
    .subhead { font-weight:700; text-decoration: underline; margin: 1mm 0 2mm; } /* Use 700 for bold */

    /* เส้นจุด + บรรทัดลายมือชื่อ */
    /* ปรับการจัดวางให้เส้นประมีความยาวพอดีกับข้อความ 'ลายมือชื่อแผนกบุคคล' */
    .sign-container{
        margin-top: 10mm;      /* ขยับลง ~1 บรรทัด */
        padding-bottom: 1mm;  /* เผื่อระยะก่อนรหัสเอกสาร */
        text-align: center;
    }
    .sign-container div {
        display: inline-block;
        text-align: center;
        width: 240px; /* กำหนดความกว้างให้พอดีกับข้อความ */
    }
    .sign-line { 
        border-bottom: 1.6px dotted #444; 
        height: 12px; 
        margin: 0 0 1mm;
    }
    .sign-cap  { 
        text-align:center;
    }

    /* รหัสเอกสารมุมล่างขวา (ตำแหน่งนี้ใช้ fixed position ซึ่งจะอยู่ด้านล่างสุดของหน้าเสมอ) */
    .doccode{
        position: fixed;
        right: 4mm;   /* << ปรับจาก 20mm เป็น 14mm */
        bottom: 0mm;   /* เว้นล่างเท่าเดิมตามที่ขอเลื่อนลง 1 บรรทัดแล้ว */
        font-size: 11px;
    }
  </style>
</head>
<body>

  <div class="doc-title">ประวัติพนักงาน</div>

<div class="prehead">
  <div class="pre-left">
    <div class="line"><span class="label">ชื่อตำแหน่งงาน:</span> <span class="value"><b>${t(row.position)}</b></span></div>
    <br><div class="line underline">ประวัติพนักงาน</div>

    ${isFW ? `<div class="flag-fw">ต่างด้าว</div>` : ""}
    ${isFW2 ? `<div class="flag-fw">คนพิการ</div>` : ""}
  </div>
  <div class="pre-right">
    ${imgSrc ? `<img class="photo" src="${imgSrc}" />`
      : `<img class="photo"/>`}
  </div>
</div>

  <div class="section">
    <div class="row">
      <div class="pair"><div class="label">ชื่อ นามสกุล:</div><div class="fullname"><b>${t(
        row.titlename_th
      )} ${t(row.firstname_th)} ${t(row.lastname_th)}</b></div></div>
    </div>

 <div class="row row--cols3">
  <div class="pair">
    <div class="label">วัน เดือน ปี เกิด:</div>
    <div class="value"><b>${fmtTH(row.birthdate)}</b></div>
  </div>
  <div class="pair">
    <div class="label">อายุ:</div>
    <div class="age"><b>${ageYears(t(row.age))}</b></div>
  </div>
  <div class="pair">
<div class="label">เพศ:</div>
<div class="value value--sex">
  <span class="opt">${box(isMale)} ชาย</span>
  <span class="opt">${box(isFemale)} หญิง</span>
</div>
  </div>
</div>

<div class="row row--cols3">
  <div class="pair">
    <div class="label">เชื้อชาติ:</div>
    <div class="ethnicity"><b>${t(row.ethnicity)}</b></div>
  </div>
  <div class="pair">
    <div class="label">สัญชาติ:</div>
    <div class="value"><b>${t(row.nationality)}</b></div>
  </div>
  <div class="pair">
    <div class="label">ศาสนา:</div>
    <div class="value"><b>${t(row.religion)}</b></div>
  </div>
</div>

<div class="row row--cols2">
  <div class="pair">
    <div class="label">บัตรประชาชนหมายเลข:</div>
    <div class="value"><b>${t(row.id_card)}</b></div>
  </div>
  <div class="pair">
    <div class="label">เลขที่บัตรประจำตัวพนักงาน:</div>
    <div class="value"><b>${t(row.employee_code)}</b></div>
  </div>
</div>


    <div class="row">
      <div class="pair"><div class="label">ออกให้ที่:</div></div>
      <div class="pair"><div class="value-district">เขต</div><div class="value-district">
      <b>${t(row.issued_district)}</b> &nbsp; จังหวัด &nbsp; <b>${t(row.issued_province)}</b></div></div>
      <div class="pair"><div class="valuedistrict"></div><div class="valuedistrict"></div></div>
    </div>

<div class="row row--cols2">
  <div class="pair">
    <div class="label">ส่วนสูง:</div>
    <div class="valueheight"><b>${t(row.height_cm)}</b> &nbsp; ซม.</div>
  </div>
  <div class="pair">
    <div class="label">น้ำหนัก:</div>
    <div class="value"><b>${t(row.weight_kg)}</b> &nbsp; กก.</div>
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
  <div class="label">สถานภาพสมรส:</div>
  <div class="cells">
    <div class="opt">${box(s_single)} โสด</div>
    <div class="opt">${box(s_married)} สมรส</div>
    <div class="opt">${box(s_unreg)} ไม่จดทะเบียน</div>
    <div class="opt">${box(s_divorce)} หย่า</div>
    <div class="opt">${box(s_separate)} แยกกันอยู่</div>
    <div class="opt">${box(s_widow)} หม้าย</div>
  </div>
</div>

    <div class="row">
      <div class="pair"><div class="label">ชื่อของสามี/ภริยา:</div>
      <div class="value"><b>${t(row.spouse_name)}</b></div></div>
      <div class="pair"><div class="label">อาชีพของสามี/ภริยา:</div>
      <div class="value"><b>${t(row.spouse_occupation)}</b></div></div>
    </div>


<div class="addr-grid">
  <div class="label">ที่อยู่ตามทะเบียนบ้าน:</div><div class="valuereg_addr_no"><b>${t(row.reg_addr_no)}</b></div>
  <div class="labelvillage_no">หมู่:</div><div class="valuevillage_no"><b>${t(row.village_no)}</b></div>
  <div class="labeljunction">ซอย:</div><div class="valuejunction"><b>${t(row.junction)}</b></div>
</div>
<div class="addr-grid">
  <div class="labelroad">ถนน:</div><div class="valueroad"><b>${t(row.road)}</b></div>
  <div class="labelsubdistrict">แขวง/ตำบล:</div><div class="valuesubdistrict"><b>${t(row.subdistrict)}</b></div>
  <div class="labeldistrict">เขต/อำเภอ:</div><div class="valuedistrict"><b>${t(row.district)}</b></div>
</div>
<div class="addr-grid">
  <div class="labelprovince">จังหวัด:</div><div class="valueprovince"><b>${t(row.province)}</b></div>
  <div class="label">รหัสไปษณีย์:</div><div class="valuepostcode"><b>${t(row.postcode)}</b></div>
  <div class="labelphone">เบอร์โทรศัพท์:</div><div class="valuephone"><b>${t(row.phone_number)}</b></div>
</div>

<div style="height: 3mm;"></div>
<div class="addr-grid">
  <div class="label">ที่อยู่ปัจจุบันเลขที่:</div><div class="value"><b>${t(row.curr_addr_no)}</b></div>
  <div class="labelvillage_no1">หมู่:</div><div class="valuevillage_no1"><b>${t(row.village_no1)}</b></div>
  <div class="labeljunction1">ซอย:</div><div class="valuejunction1"><b>${t(row.junction1)}</b></div>
</div>
<div class="addr-grid">
  <div class="labelroad">ถนน:</div><div class="valueroad"><b>${t(row.road1)}</b></div>
  <div class="labelsubdistrict">แขวง/ตำบล:</div><div class="valuesubdistrict"><b>${t(row.subdistrict1)}</b></div>
  <div class="labeldistrict">เขต/อำเภอ:</div><div class="valuedistrict"><b>${t(row.district1)}</b></div>
</div>
<div class="addr-grid">
  <div class="labelprovince">จังหวัด:</div><div class="valueprovince"><b>${t(row.province1)}</b></div>
  <div class="label">รหัสไปษณีย์:</div><div class="valuepostcode"><b>${t(row.postcode1)}</b></div>
  <div class="labelphone">เบอร์โทรศัพท์:</div><div class="valuephone"><b>${t(row.phone_number1)}</b></div>
</div>
<br>
<div class="opt-grid">
  <div class="label">ประเภทของที่อยู่อาศัย:</div>
  <div class="cells cells--nowrap">
    <div class="opt">${box(r_own)} บ้านตนเอง</div>
    <div class="opt">${box(r_dorm)} หอพัก/อพาร์ตเมนท์</div>
    <div class="opt">${box(r_rent)} บ้านเช่า</div>
    <div class="opt">${box(r_relative)} พักอาศัยกับญาติ</div>
    <div class="opt">${box(r_other)} อื่นๆ</div>
  </div>
</div>

</div>
  
  <div class="subhead">ประวัติการศึกษา</div><br><br>

  <div class="section">
    <div class="row" style="margin-bottom: 0;">
      <div class="pair"><div class="label">ระดับ:</div><div class="value"><b>${t(
        row.education
      )}</b></div></div>
      <div class="pair"><div class="label">ชื่อสถานศึกษา:</div><div class="value"><b>${t(
        row.education_institution
      )}</b></div></div>
      <div class="pair"><div class="label">สำเร็จ พ.ศ.</div><div class="value"><b>${t(
        row.grad_year_be
      )}</b></div></div>
    </div>
  </div>


  <div class="sign-container">
    <div>
        <div class="sign-line"></div>
        <div class="sign-cap">ลายมือชื่อแผนกบุคคล</div>
    </div>
  </div>

  <div class="doccode">APC/F-HR-10 / 17-01-65</div>

</body>
</html>`;
}
let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }).catch(err => { browserPromise = null; throw err; });
  }
  return browserPromise;
}

async function renderEmployeeForm(row) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // รอ DOM ก็พอ (ไวกว่า networkidle0 เพราะฟอนต์ถูกฝังมาแล้ว)
    await page.setContent(template(row), { waitUntil: 'domcontentloaded' });

    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '12mm', left: '10mm', right: '10mm' },
      preferCSSPageSize: true,
    });

    return buffer;
  } finally {
    await page.close();
  }
}

module.exports = { renderEmployeeForm };