"use strict";
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

// logo path
const LOGO_PATH = "./src/modules/reports/reportTraining/logo.png";

function loadBase64File(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    return fs.readFileSync(fullPath).toString("base64");
  } catch (e) {
    console.error(`[PDF Error] Could not load file at ${filePath}`);
    console.error(e.message);
    return "";
  }
}
const FONT_REGULAR_BASE64 = loadBase64File("./src/modules/reports/reportTraining/THSarabunNew/THSarabunNew.ttf");
const FONT_BOLD_BASE64 = loadBase64File("./src/modules/reports/reportTraining/THSarabunNew/THSarabunNew Bold.ttf");
const LOGO_BASE64 = loadBase64File(LOGO_PATH);

const esc = (s) =>
  (s ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function thaiDate(d) {
  if (!d) return "";
  // รองรับ Date หรือ "YYYY-MM-DD"
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear() + 543;
  return `${dd}/${mm}/${yyyy}`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out.length ? out : [[]];
}

function courseFontPx(name) {
  const len = (name || "").toString().trim().length;
  if (len > 140) return 11;
  if (len > 110) return 12;
  if (len > 80) return 13;
  if (len > 60) return 14;
  return 16; // ปกติ
}


function buildHTML({ employee, history, docNo }) {
  const perPage = 12;
  const pages = chunk(history || [], perPage);

  const logoDataUri = LOGO_BASE64
    ? `data:image/png;base64,${LOGO_BASE64}`
    : "";

  const fontRegular = FONT_REGULAR_BASE64;
  const fontBold = FONT_BOLD_BASE64;

  const empCode = esc(employee?.employee_code);
  const empName = esc(employee?.fullname_th);
  const empPos = esc(employee?.position);
  const empDep = esc(employee?.department);
  const empSite = esc(employee?.worksites);
  const empSign = thaiDate(employee?.sign_date);
  const empResign = thaiDate(employee?.resign_date);

  const docText = esc(docNo || "");

  const pageHtml = pages
    .map((rows, pageIndex) => {
      const filled = [...rows];
      while (filled.length < perPage) filled.push(null);

      const bodyRows = filled
        .map((r, idx) => {
          if (!r) {
            return `
              <tr>
                <td class="c">${idx + 1 + pageIndex * perPage}</td>
                <td></td><td></td><td></td><td></td><td></td>
              </tr>
            `;
          }

          const courseName = esc(r.courses_name || "");
          const dateTrain =
            r.start_date || r.end_date
              ? (r.start_date && r.end_date && r.start_date !== r.end_date)
                ? `${thaiDate(r.start_date)} - ${thaiDate(r.end_date)}`
                : `${thaiDate(r.start_date || r.end_date)}`
              : "";

          const duration = esc(r.duration_date || "");
          const location = esc(r.location_name || "");
          const remark = esc(r.remark || "");
          const courseRaw = (r.courses_name || "").toString();
          const courseFont = courseFontPx(courseRaw);

          return `
            <tr>
              <td class="c">${idx + 1 + pageIndex * perPage}</td>

              <td class="course" style="font-size:${courseFont}px">
                <div class="clamp2">${courseName}</div>
              </td>

              <td class="c">${dateTrain}</td>
              <td class="c">${duration}</td>
              <td>${location}</td>
              <td>${remark}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <section class="page">
          <div class="top">
            <div class="brand">
              <div class="logo">
                ${logoDataUri ? `<img src="${logoDataUri}" />` : ""}
              </div>
              <div class="company">บริษัท เอ แอนด์ พี เมนเทแนนซ์ เซอร์วิส (ประเทศไทย) จำกัด</div>
            </div>
          </div>
          <div class="title">ประวัติการฝึกอบรม</div>
          <div class="info">
            <div class="row">
              <div class="field"><span class="lbl">รหัสพนักงาน:</span><span class="val">${empCode}</span></div>
              <div class="field"><span class="lbl">ชื่อ:</span><span class="val">${empName}</span></div>
              <div class="field"><span class="lbl">ตำแหน่งงาน:</span><span class="val">${empPos}</span></div>
              <div class="field"><span class="lbl">แผนก:</span><span class="val">${empDep}</span></div>
            </div>
            <div class="row">
              <div class="field wide"><span class="lbl">Site งาน:</span><span class="val">${empSite}</span></div>
              <div class="field"><span class="lbl">วันเริ่มงาน:</span><span class="val">${empSign}</span></div>
              <div class="field"><span class="lbl">วันที่ออก:</span><span class="val">${empResign}</span></div>
            </div>
          </div>

          <div class="hr"></div>

          <table class="tbl">
            <thead>
              <tr>
                <th style="width:60px">ลำดับที่</th>
                <th>ชื่อหลักสูตร</th>
                <th style="width:140px">วันที่ที่ฝึกอบรม</th>
                <th style="width:100px">ระยะเวลาที่ฝึกอบรม</th>
                <th style="width:200px">สถานที่ฝึกอบรม</th>
                <th style="width:200px">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>

          <div class="docno">${docText}</div>
        </section>
      `;
    })
    .join("");

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: "THSarabunNew"; font-size: 16px; color: #000; line-height: 1.15; }

        @font-face {
          font-family: "THSarabunNew";
          src: url(data:font/ttf;base64,${fontRegular}) format("truetype");
          font-weight: normal;
        }
        @font-face {
          font-family: "THSarabunNew";
          src: url(data:font/ttf;base64,${fontBold}) format("truetype");
          font-weight: bold;
        }

        /* A4 landscape สูงใช้งาน ~186mm (210-24) */
        .page { position: relative; min-height: 186mm; }
        .page:not(:last-child) { page-break-after: always; }

        /* Header */
        .top { display:flex; align-items:center; justify-content:center; position: relative; padding-top: 2mm; }
        .brand { display:flex; align-items:center; gap: 8px; }
        .logo { width: 60px; height: 60px; }
        .logo img { width: 60px; height: 60px; object-fit: contain; }
        .company { font-size: 18px; font-weight: bold; text-align:center; line-height: 1.1; }
        .box { position:absolute; right: 0; top: 4mm; width: 90px; height: 26px; border: 1px solid #000; }

        .title { text-align:center; font-size: 24px; font-weight: bold; margin: 1mm 0 6mm; }

        .info { font-size: 16px; }
        .row { display:flex; gap: 10px; margin-bottom: 2.5mm; }
        .field { display:flex; align-items:flex-end; gap:6px; flex:1; }
        .field.wide { flex: 2; }
        .lbl { white-space: nowrap; }
        .val { display:inline-block; flex:1; border-bottom: 1px solid #000; min-height: 14px; padding: 0 2px; }

        .hr { border-top: 2px solid #000; margin: 2mm 0 2mm; }

        /* Table: ล็อกไม่ให้ขึ้นบรรทัดใหม่ + ลด padding */
        .tbl { width: 100%; border-collapse: collapse; font-size: 16px; table-layout: fixed; }
        .tbl th, .tbl td { border: 1px solid #000; padding: 0.9mm 1.2mm; vertical-align: middle; }
        .tbl th { text-align: center; font-weight: bold; }
        .tbl td { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        /* override เฉพาะคอลัมน์ชื่อหลักสูตร */
        .tbl td.course { 
          white-space: normal; 
          vertical-align: top;
          text-overflow: clip;
        }

        .tbl td.course .clamp2{
          line-height: 1.05;
          overflow: hidden;
          overflow-wrap: anywhere;
          word-break: break-word;

          /* จำกัด 2 บรรทัด */
          max-height: 2.1em;

          /* ช่วย clamp 2 บรรทัดใน Chromium (Puppeteer) */
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .c { text-align:center; }

        .docno { position:absolute; right: 0; bottom: 6mm; font-size: 16px; }

      </style>
    </head>
    <body>
      ${pageHtml}
    </body>
  </html>
  `;
}

/* =========================================
   ✅ ส่วนที่แก้ไข: จัดการ Browser Instance 
   ========================================= */
let sharedBrowser = null;

async function getBrowser() {
  // ถ้ามี Browser อยู่แล้วและยังไม่หลุดการเชื่อมต่อ ให้ใช้ตัวเดิม
  if (sharedBrowser && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }

  // ถ้าไม่มี ให้เปิดใหม่
  sharedBrowser = await puppeteer.launch({
    headless: "new", // หรือ true
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // ช่วยเรื่อง memory ใน docker/linux
      "--disable-gpu" // ปิด GPU เพื่อความเร็วใน Server
    ],
  });
  return sharedBrowser;
}

async function reportTraining({ employee, history, docNo }) {
  // 1. เรียกใช้ Browser ตัวกลาง
  const browser = await getBrowser();

  let page = null;
  try {
    // 2. เปิด Tab (Page) ใหม่แทนการเปิด Browser ใหม่
    page = await browser.newPage();

    const html = buildHTML({ employee, history, docNo });

    // 3. ✅ ปรับ waitUntil ให้เร็วขึ้น
    // เนื่องจาก Font/Img เป็น Base64 หมดแล้ว ไม่ต้องรอ networkidle0 (ซึ่งช้ากว่า)
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
    });

    return pdfBuffer;

  } catch (err) {
    console.error("PDF Generation Error:", err);
    throw err;
  } finally {
    // 4. ✅ ปิดเฉพาะ Page (Tab) ห้ามปิด Browser
    if (page) await page.close();
  }
}

// ถ้าต้องการปิด Browser ตอนปิด Server (Optional แต่แนะนำ)
process.on('exit', async () => {
  if (sharedBrowser) await sharedBrowser.close();
});

module.exports = { reportTraining };
