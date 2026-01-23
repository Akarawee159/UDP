/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // ✅ เพิ่มส่วนนี้เข้าไป
  safelist: [
    // 1. ระบุชื่อ Class ตรงๆ ที่ใช้ใน Database แน่ๆ
    'bg-green-100', 'text-green-700', 'border-green-200',
    'bg-red-50', 'text-red-600', 'border-red-200',

    // 2. (แนะนำ) หรือใช้ Pattern เพื่อรองรับสีอื่นๆ ในอนาคตโดยไม่ต้องแก้โค้ดใหม่
    // เช่น รองรับ bg-, text-, border- ของสีหลักๆ ทั้งหมด
    {
      pattern: /(bg|text|border)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|cyan|teal|sky|blue|indigo|violet|purple|fuchsia|rose|pink)-(50|100|200|300|400|500|600|700|800|900|950)/,
      variants: ['hover', 'focus'], // ถ้ารองรับ hover ด้วย
    },
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}