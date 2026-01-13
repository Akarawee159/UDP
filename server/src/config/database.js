const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // --- Options ที่สามารถเพิ่มได้ ---
  waitForConnections: true,    // รอคิวเมื่อ connection เต็ม (ดีกว่า error ทันที)
  connectionLimit: 10,         // จำนวน connection สูงสุดใน pool (ค่า default คือ 10)
  queueLimit: 0                // จำนวน client ที่รอคิวได้ (0 คือไม่จำกัด)
});

db.getConnection()
  .then(() => console.log("✅ Connected to MySQL successfully"))
  .catch(err => console.error("❌ Failed to connect MySQL:", err));


// ⭐️ --- เพิ่มส่วนนี้เข้าไป --- ⭐️
// Ping ฐานข้อมูลทุก 30 วินาที เพื่อกัน Connection หลับ (Keep-alive)
// ป้องกัน Error: read ECONNRESET
setInterval(() => {
  if (db) {
    db.query('SELECT 1')
      .then(() => {
        // (เลือกเปิด comment ได้ ถ้าต้องการ debug)
        // console.log('[db] Keep-alive ping OK');
      })
      .catch((err) => {
        // ถ้า Ping ล้มเหลว (เช่น DB ล่ม) ให้แสดง log
        console.error('[db] Keep-alive ping FAILED:', err.code || err.message);
      });
  }
}, 30_000); // 30 วินาที (30,000 มิลลิวินาที)


module.exports = db;