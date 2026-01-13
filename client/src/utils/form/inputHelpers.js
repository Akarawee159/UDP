// src/utils/form/inputHelpers.js
// Helper ด้านอินพุต/validation สำหรับฟอร์ม

// กรองอินพุตให้เหลือเฉพาะ "ตัวเลข"
export const onlyDigits = (value = '') => value.replace(/\D/g, '');

// กรองอินพุตให้เหลือเฉพาะ "A-Z a-z 0-9"
export const onlyAlnum = (value = '') =>
  value.replace(/[^A-Za-z0-9]/g, '');

// ตรวจว่าค่าเป็น "ตัวเลข" ตามจำนวนหลักที่กำหนด
export const isDigits = (value, length) =>
  new RegExp(`^\\d{${length}}$`).test(value || '');

// ตรวจว่าค่าเป็น "ตัวอักษร/ตัวเลข" ในช่วงความยาวที่กำหนด
export const isAlnumRange = (value, min, max) =>
  new RegExp(`^[A-Za-z0-9]{${min},${max}}$`).test(value || '');

// Antd Form rule: ตัวเลขจำนวนหลัก "ตายตัว" เช่น 13 หลัก
export const digitsRule = (length, message) => ({
  validator(_, value) {
    if (!value) return Promise.resolve(); // ไม่บังคับกรอก
    return isDigits(value, length)
      ? Promise.resolve()
      : Promise.reject(
          new Error(message || `กรอกเป็นตัวเลข ${length} หลัก`)
        );
  },
});

// Antd Form rule: A-Z a-z 0-9 ความยาวช่วง min–max
export const alnumRule = (min, max, message) => ({
  validator(_, value) {
    if (!value) return Promise.resolve();
    return isAlnumRange(value, min, max)
      ? Promise.resolve()
      : Promise.reject(
          new Error(
            message ||
              `กรอกเป็น A-Z,a-z,0-9 ความยาว ${min}-${max} ตัว`
          )
        );
  },
});

// (เผื่อใช้ภายหลัง) จำกัดความยาวทั่วไป (ภาษาไทย/อังกฤษก็ได้)
export const lengthBetweenRule = (min, max, message) => ({
  validator(_, value) {
    if (!value) return Promise.resolve();
    const len = String(value).length;
    if (len < min || len > max) {
      return Promise.reject(
        new Error(message || `กรุณากรอก ${min}-${max} ตัวอักษร`)
      );
    }
    return Promise.resolve();
  },
});
