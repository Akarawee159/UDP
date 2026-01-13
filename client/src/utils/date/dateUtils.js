// src/utils/date/dateUtils.js
// ตัวช่วยเกี่ยวกับวันที่แบบ พ.ศ. ใช้ร่วมทั้งโปรเจ็กต์

import dayjs from 'dayjs';
import 'dayjs/locale/th';
import buddhistEra from 'dayjs/plugin/buddhistEra';

// ตั้งค่า dayjs ให้รองรับ พ.ศ. และ locale ไทย
dayjs.extend(buddhistEra);
dayjs.locale('th');

// helper ภายใน: แปลงปี ค.ศ. -> พ.ศ. แบบไม่บวกซ้ำ
const toThaiYearNumber = (d) => {
  if (!d || !d.isValid || !d.isValid()) return '';
  const y = d.year();
  // ถ้าปี > 2400 สมมติว่าเป็น พ.ศ. อยู่แล้ว ไม่ต้องบวก 543
  return y > 2400 ? y : y + 543;
};

// แปลง dayjs/Date/string -> string 'DD/MM/YYYY' ปี พ.ศ.
// เช่น 22/11/2025 => "22/11/2568"
export const formatThaiDate = (value, format = 'DD/MM/YYYY') => {
  if (!value) return '';

  let d;
  if (dayjs.isDayjs && dayjs.isDayjs(value)) {
    d = value;
  } else {
    d = dayjs(value, ['DD/MM/YYYY', 'YYYY-MM-DD', format], true);
  }

  if (!d.isValid()) return '';

  const thaiYear = toThaiYearNumber(d);
  return d.format('DD/MM') + '/' + thaiYear;
};

// กรณีมี string ตรง ๆ เช่น "22/11/2025"
export const toThaiYearFromString = (dateStr, format = 'DD/MM/YYYY') => {
  if (!dateStr) return '';
  const d = dayjs(dateStr, format, true);
  if (!d.isValid()) return dateStr;
  const thaiYear = toThaiYearNumber(d);
  return d.format('DD/MM') + '/' + thaiYear;
};

// แปลง string ที่ผู้ใช้พิมพ์เอง 'DD/MM/YYYY' (ปี พ.ศ. หรือ ค.ศ.) -> dayjs (ปี ค.ศ.)
export const parseThaiInputToDayjs = (input) => {
  if (!input) return null;
  const t = String(input).trim();

  // รองรับรูปแบบ xx/xx/xxxx
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);

  if (
    Number.isNaN(day) ||
    Number.isNaN(month) ||
    Number.isNaN(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  // ถ้าปีมากกว่า 2400 สมมติว่าเป็น พ.ศ. แล้วแปลงเป็น ค.ศ.
  const adYear = year > 2400 ? year - 543 : year;

  const d = dayjs(
    `${adYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    'YYYY-MM-DD',
    true
  );

  return d.isValid() ? d : null;
};

// เผื่ออยากใช้ dayjs ที่เซ็ต locale/BE แล้วที่อื่น
export { dayjs };
