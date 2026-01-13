// src/components/form/ThaiDateInput.jsx
// ช่องกรอกวันที่แบบ Mask + ปฏิทิน ภาษาไทย ปี พ.ศ.

import React, { useEffect, useRef, useState } from 'react';
import { DatePicker, Input } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import thLocale from 'antd/es/date-picker/locale/th_TH';

import {
  formatThaiDate,
  parseThaiInputToDayjs,
} from '../../utils/date/dateUtils';

const DATE_FORMAT = 'DD/MM/YYYY';
const thaiDateFormat = (value) => formatThaiDate(value, DATE_FORMAT);

const thaiDatePickerLocale = {
  ...thLocale,
  lang: {
    ...thLocale.lang,
    yearFormat: 'BBBB',
    cellYearFormat: 'BBBB',
    fieldDateFormat: 'BBBB-MM-DD',
    fieldDateTimeFormat: 'BBBB-MM-DD HH:mm:ss',
  },
};

const commonDateProps = {
  style: { width: '100%' },
  placeholder: 'กรุณาเลือกวันที่',
  format: thaiDateFormat,
  locale: thaiDatePickerLocale,
  inputReadOnly: false,
};

// input วันที่แบบ Mask:
// - แสดง __/__/____ รอไว้ตลอด (ใช้ _ เป็น mask)
// - พิมพ์วัน/เดือน/ปี ตรงตำแหน่งไหนก็ได้
// - Backspace/Delete ลบกลับเป็น _ ทีละตัว
// - คลิก icon ปฏิทินเท่านั้นถึงจะเปิด calendar
export const ThaiDateInput = ({ value, onChange, disabled, onValueChange }) => {
  const mask = '__/__/____';
  const inputRef = useRef(null);
  const [text, setText] = useState(mask);
  const [open, setOpen] = useState(false);
  const skipSyncRef = useRef(false);

  const isEditableIndex = (i) =>
    i === 0 || i === 1 || i === 3 || i === 4 || (i >= 6 && i <= 9);
  const isDayPos = (i) => i === 0 || i === 1;
  const isMonthPos = (i) => i === 3 || i === 4;
  const isYearPos = (i) => i >= 6 && i <= 9;

  const moveCaretTo = (pos) => {
    const el = inputRef.current;
    if (!el) return;
    if (typeof window === 'undefined') return;
    const safePos = Math.max(0, Math.min(mask.length, pos));
    window.requestAnimationFrame(() => {
      el.setSelectionRange(safePos, safePos);
    });
  };

  const nextEditable = (pos) => {
    let p = pos;
    while (p < mask.length && !isEditableIndex(p)) p++;
    return p;
  };

  const prevEditable = (pos) => {
    let p = pos - 1;
    while (p >= 0 && !isEditableIndex(p)) p--;
    return p;
  };

  // sync จาก value (dayjs) -> text ในช่อง input
  useEffect(() => {
    // ถ้า value เปลี่ยนเพราะเรากดคีย์เอง (ผ่าน syncFormValue) ไม่ต้อง sync ทับ text
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }

    if (!value) {
      setText(mask);
    } else {
      const formatted = thaiDateFormat(value); // DD/MM/2568
      setText(formatted || mask);
    }
  }, [value]);

  const syncFormValue = (displayText) => {
    const digits = displayText.replace(/[^0-9]/g, ''); // รวมเลขทั้งหมด

    // ตั้งธงไว้ว่า value ถูกอัปเดตจากการพิมพ์ใน input
    skipSyncRef.current = true;

    if (digits.length !== 8) {
      // ยังไม่ครบ 8 หลัก ให้เคลียร์ค่าในฟอร์ม แต่คง text ไว้ (อย่า reset mask)
      if (onChange) onChange(null);
      if (onValueChange) onValueChange(null);
      return;
    }

    const dayStr = displayText.slice(0, 2);
    const monthStr = displayText.slice(3, 5);
    const yearStr = displayText.slice(6, 10);
    const parsed = parseThaiInputToDayjs(`${dayStr}/${monthStr}/${yearStr}`);

    if (parsed) {
      if (onChange) onChange(parsed);
      if (onValueChange) onValueChange(parsed);
    } else {
      if (onChange) onChange(null);
      if (onValueChange) onValueChange(null);
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    const el = e.target;
    const key = e.key;
    let start = el.selectionStart ?? 0;
    let end = el.selectionEnd ?? start;

    // ปล่อยผ่านปุ่มพวกเลื่อนเคอร์เซอร์ / Tab
    if (
      key === 'Tab' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'Home' ||
      key === 'End'
    ) {
      return;
    }

    // เราจะจัดการทุกอย่างเอง
    if (/^\d$/.test(key)) {
      e.preventDefault();

      const chars = text.split('');

      // ถ้ามี selection ให้ถือว่าใช้ตำแหน่งเริ่มต้น แล้วไม่ต้องสนใจส่วนที่เหลือ
      let pos = start;
      if (!isEditableIndex(pos)) pos = nextEditable(pos);
      if (pos >= mask.length) return;

      // ทดลองใส่ตัวเลขลงไปก่อน เพื่อตรวจว่าเกินเงื่อนไขหรือไม่
      const tempChars = [...chars];
      tempChars[pos] = key;

      // ----- ตรวจ day: ไม่เกิน 31 -----
      if (isDayPos(pos)) {
        const d1 = tempChars[0];
        const d2 = tempChars[1];
        let dayDigits = '';
        if (d1 !== '_') dayDigits += d1;
        if (d2 !== '_') dayDigits += d2;

        if (dayDigits.length === 1) {
          const d = parseInt(dayDigits, 10);
          // หลักแรกของวันต้องเป็น 0–3 (เพื่อให้ 01–31 ได้)
          if (d > 3) {
            return; // ไม่ยอมให้พิมพ์
          }
        } else if (dayDigits.length === 2) {
          const d = parseInt(dayDigits, 10);
          // วันต้องอยู่ระหว่าง 1–31
          if (d < 1 || d > 31) {
            return;
          }
        }
      }

      // ----- ตรวจ month: ไม่เกิน 12 -----
      if (isMonthPos(pos)) {
        const m1 = tempChars[3];
        const m2 = tempChars[4];
        let monthDigits = '';
        if (m1 !== '_') monthDigits += m1;
        if (m2 !== '_') monthDigits += m2;

        if (monthDigits.length === 1) {
          const m = parseInt(monthDigits, 10);
          // หลักแรกของเดือนต้องเป็น 0 หรือ 1 (เพื่อให้ 01–12)
          if (m > 1) {
            return;
          }
        } else if (monthDigits.length === 2) {
          const m = parseInt(monthDigits, 10);
          // เดือนไม่เกิน 12 และต้องไม่เป็น 00
          if (m < 1 || m > 12) {
            return;
          }
        }
      }

      // ----- ตรวจ year: ไม่เกิน 9999 -----
      if (isYearPos(pos)) {
        const yChars = [tempChars[6], tempChars[7], tempChars[8], tempChars[9]];
        const yearDigits = yChars.filter((c) => c !== '_').join('');

        // เช็คตอนมีครบ 4 หลัก
        if (yearDigits.length === 4) {
          const y = parseInt(yearDigits, 10);
          if (y > 9999) {
            return;
          }
        }
      }

      // ถ้าผ่านทุกเงื่อนไขแล้ว ค่อยอัปเดตค่าจริง
      chars[pos] = key;
      const joined = chars.join('');
      setText(joined);
      syncFormValue(joined);

      const nextPos = nextEditable(pos + 1);
      moveCaretTo(nextPos);
      return;
    }

    if (key === 'Backspace') {
      e.preventDefault();

      const chars = text.split('');

      // ถ้ามี selection (เช่น ลากเลือกทั้งช่อง)
      // ให้ถือว่า cursor อยู่ท้าย selection แล้วลบทีละหลัก
      if (start !== end) {
        start = end;
        end = start;
      }

      const target = prevEditable(start);
      if (target < 0) return;

      chars[target] = '_';
      const joined = chars.join('');
      setText(joined);
      syncFormValue(joined);
      moveCaretTo(target);
      return;
    }

    if (key === 'Delete') {
      e.preventDefault();

      const chars = text.split('');
      let pos = start;

      // ถ้ามี selection ให้ลบจากตำแหน่งเริ่มต้นทีละหลัก
      if (start !== end) {
        pos = start;
      }

      if (!isEditableIndex(pos)) pos = nextEditable(pos);
      if (pos >= mask.length) return;

      chars[pos] = '_';
      const joined = chars.join('');
      setText(joined);
      syncFormValue(joined);
      moveCaretTo(pos);
      return;
    }

    if (key === '/') {
      // กด / เพื่อข้ามกลุ่ม
      e.preventDefault();
      if (start <= 2) moveCaretTo(3);
      else if (start <= 5) moveCaretTo(6);
      else moveCaretTo(10);
      return;
    }

    // บล็อกตัวอักษรอื่น ๆ ที่ไม่ต้องการ
    if (key.length === 1) {
      e.preventDefault();
    }
  };

  const handleFocus = () => {
    const digits = text.replace(/[^0-9]/g, '');
    if (!digits.length) {
      moveCaretTo(0);
    }
  };

  const handleClick = (e) => {
    const el = e.target;
    let pos = el.selectionStart ?? 0;
    if (!isEditableIndex(pos)) {
      if (pos <= 2) pos = 0;
      else if (pos <= 5) pos = 3;
      else pos = 6;
      moveCaretTo(pos);
    }
  };

  const handleCalendarChange = (d) => {
    setOpen(false);
    if (!d) {
      setText(mask);
      if (onChange) onChange(null);
      if (onValueChange) onValueChange(null);
      return;
    }
    const formatted = thaiDateFormat(d); // เช่น 24/05/2568
    setText(formatted || mask);
    if (onChange) onChange(d);
    if (onValueChange) onValueChange(d);
  };

  return (
    <div style={{ position: 'relative' }}>
      <Input
        ref={inputRef}
        value={text}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        onChange={() => {}}
        onFocus={handleFocus}
        onClick={handleClick}
        placeholder="__/__/____"
        suffix={
          <CalendarOutlined
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) setOpen(true);
            }}
            style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
          />
        }
      />
      {/* ใช้ DatePicker เป็นตัวแสดงปฏิทินอย่างเดียว (input ของมันถูกซ่อนไว้) */}
      <DatePicker
        {...commonDateProps}
        value={value}
        disabled={disabled}
        open={open}
        onOpenChange={setOpen}
        onChange={handleCalendarChange}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

export default ThaiDateInput;
