"use strict";
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const dayjs = require("dayjs");

// logo path
const LOGO_PATH = "./src/img/logo/logo.png";

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
const FONT_REGULAR_BASE64 = loadBase64File("./src/fonts/THSarabunNew/THSarabunNew.ttf");
const FONT_BOLD_BASE64 = loadBase64File("./src/fonts/THSarabunNew/THSarabunNewBold.ttf");
const LOGO_BASE64 = loadBase64File(LOGO_PATH);

// 📌 เพิ่มการรับค่า createDate และ createTime
async function generateUsagePDF(items, origin, destination, printByName, createDate, createTime) {
    const printDate = dayjs().format('DD/MM/YYYY');
    const printTime = dayjs().format('HH:mm');

    const rowsHtml = items.map((item, index) => {
        const scanDate = item.scan_at ? dayjs(item.scan_at).format('DD/MM/YYYY') : '-';
        const scanTime = item.scan_at ? dayjs(item.scan_at).format('HH:mm') : '-';

        const qrText = item.label_register || item.asset_code;
        const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrText)}&size=80`;

        return `
            <tr style="page-break-inside: avoid;">
                <td style="text-align: center;">${index + 1}</td>
                <td>${item.asset_code}</td>
                <td style="text-align: center;">${scanDate}</td>
                <td style="text-align: center;">${scanTime}</td>
                <td>${item.scan_by_name || '-'}</td>
                <td style="text-align: center;">
                    <img src="${qrUrl}" style="width: 2cm; height: 2cm; object-fit: contain; display: block; margin: 0 auto;" />
                </td>
            </tr>
        `;
    }).join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @font-face {
                font-family: 'THSarabunNew';
                src: url(data:font/truetype;charset=utf-8;base64,${FONT_REGULAR_BASE64}) format('truetype');
                font-weight: normal;
            }
            @font-face {
                font-family: 'THSarabunNew';
                src: url(data:font/truetype;charset=utf-8;base64,${FONT_BOLD_BASE64}) format('truetype');
                font-weight: bold;
            }
            body {
                font-family: 'THSarabunNew', sans-serif;
                font-size: 14pt;
                margin: 0;
                padding: 0;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 0;
            }
            th, td {
                border: 1px solid #000;
                padding: 4px;
                vertical-align: middle;
            }
            th {
                background-color: #f0f0f0;
                font-weight: bold;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <table>
            <thead style="display: table-header-group;">
                <tr>
                    <th style="width: 5%;">ลำดับ</th>
                    <th style="width: 25%;">ทะเบียนบรรจุภัณฑ์</th>
                    <th style="width: 15%;">วันที่สแกน</th>
                    <th style="width: 10%;">เวลา</th>
                    <th style="width: 20%;">ผู้ทำรายการ</th>
                    <th style="width: 25%;">QR Code</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    </body>
    </html>
    `;

    // 📌 4. Header Template ปรับเพิ่มบรรทัดแสดงวันที่และเวลาเบิกใช้งาน
    const headerTemplate = `
        <style>
            @font-face { font-family: 'THSarabunNew'; src: url(data:font/truetype;charset=utf-8;base64,${FONT_REGULAR_BASE64}) format('truetype'); }
            @font-face { font-family: 'THSarabunNew'; src: url(data:font/truetype;charset=utf-8;base64,${FONT_BOLD_BASE64}) format('truetype'); font-weight: bold; }
            .header-box { width: 100%; padding: 0 15mm; font-family: 'THSarabunNew', sans-serif; font-size: 14pt; color: #000; -webkit-print-color-adjust: exact; }
            
            /* 👇 ปรับ margin-bottom จาก 5px เป็น 0px เพื่อลดช่องว่างด้านล่างโลโก้/ชื่อบริษัท */
            .flex-row { display: flex; align-items: center; margin-bottom: 0px; } 
            
            .logo-img { width: 100px; height: 100px; object-fit: contain; margin-right: 15px; }
            .company-name { font-size: 18pt; font-weight: bold; margin: 0; }
            .company-info p { margin: 0; line-height: 1.1; font-size: 14pt; }
            
            /* 👇 ปรับ margin-top จาก 5px เป็น 0px เพื่อดันข้อความชิดขึ้นบน */
            .title-text { text-align: center; font-size: 16pt; font-weight: bold; margin-top: 0px; } 
            
            .subtitle-text { text-align: center; font-size: 14pt; margin-top: 0px; }
        </style>
        <div class="header-box">
            <div class="flex-row">
                <img src="data:image/png;base64,${LOGO_BASE64}" class="logo-img" />
                <div class="company-info">
                    <div class="company-name">บริษัท อุดมชัย เพ้นท์ จำกัด</div>
                    <p>ที่อยู่: 597/1 ซอย 14 บี ตำบล แพรกษา อำเภอเมืองสมุทรปราการ สมุทรปราการ 10280</p>
                    <p>โทรศัพท์: 02 710 6397</p>
                </div>
            </div>
<div class="title-text">
                แจ้งชำรุด รับเข้าจาก: <span style="color: blue; text-decoration: underline; font-weight: bold;">${origin || '-'}</span> ถึง ต้นทางที่รับ: <span style="color: blue; text-decoration: underline; font-weight: bold;">${destination || '-'}</span> (จำนวน <span class="totalPages"></span> หน้า)
            </div>
            <div class="subtitle-text">
                วันที่รับเข้า: ${createDate} เวลา: ${createTime} น.
            </div>
        </div>
    `;

    const footerTemplate = `
        <style>
            @font-face { font-family: 'THSarabunNew'; src: url(data:font/truetype;charset=utf-8;base64,${FONT_REGULAR_BASE64}) format('truetype'); }
            .footer-box { width: 100%; padding: 0 15mm; font-family: 'THSarabunNew', sans-serif; font-size: 12pt; color: #333; display: flex; justify-content: space-between; align-items: flex-end; -webkit-print-color-adjust: exact; }
        </style>
        <div class="footer-box">
            <div>พิมพ์เมื่อ: ${printDate} เวลา ${printTime} น. | ผู้พิมพ์: ${printByName || '-'}</div>
            <div>หน้า <span class="totalPages"></span>-<span class="pageNumber"></span></div>
        </div>
    `;

    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        // เพิ่ม margin top ให้เพียงพอกับพื้นที่บรรทัดใหม่ที่เพิ่มเข้ามา
        margin: { top: '47mm', right: '14mm', bottom: '14mm', left: '14mm' },
        displayHeaderFooter: true,
        headerTemplate: headerTemplate,
        footerTemplate: footerTemplate
    });

    await browser.close();
    return pdfBuffer;
}

module.exports = { generateUsagePDF };