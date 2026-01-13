// src/utils/dateHelpers.js
import dayjs from 'dayjs';

/**
 * คำนวณอายุจากวันเกิด
 * @param {dayjs|Date} date - วันเกิด
 * @returns {Object} { ageString: "xxปี xxเดือน xxวัน", years, months, days } หรือ null
 */
export const calculateAgeThai = (date) => {
  if (!date) return null;

  const birthDate = dayjs(date).startOf('day');
  const today = dayjs().startOf('day');

  // กันกรณีเลือกวันที่ในอนาคต
  if (birthDate.isAfter(today)) {
    return null;
  }

  const years = today.diff(birthDate, 'year');
  const months = today.diff(birthDate.add(years, 'year'), 'month');
  const days = today.diff(
    birthDate.add(years, 'year').add(months, 'month'),
    'day'
  );

  const ageString = `${years}ปี ${months}เดือน ${days}วัน`;

  return {
    ageString,
    years,
    months,
    days
  };
};