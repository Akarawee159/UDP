'use strict';
const helmet = require('helmet');

function useSecurityHeaders(app) {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    app.set('trust proxy', 1);  // อยู่หลัง proxy 1 ชั้น
  } else {
    app.disable('trust proxy');  // dev/local ไม่ผ่าน proxy
  }

  // ค่าเริ่มต้นสำหรับ API-only: ปิด CSP/COEP ไว้ก่อน
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // ลด referrer leakage
  app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));

  // เปิด HSTS เมื่อ production + https
  if (isProd) {
    app.use(helmet.hsts({
      maxAge: 60 * 60 * 24 * 180, // 180 days
      includeSubDomains: true,
      preload: false,
    }));
  }
}

module.exports = { useSecurityHeaders };
