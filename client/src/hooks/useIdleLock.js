// src/hooks/useIdleLock.js
import { useEffect, useRef, useState } from 'react';

export const LOCK_KEY = 'HRMS_LOCKED';
export const BEFORE_LOCK_KEY = 'HRMS_BEFORE_LOCK';
export const LAST_ACTIVE_KEY = 'HRMS_LAST_ACTIVE';

// cross-component events
export const LOCK_EVENT = 'hrms:lock';
export const UNLOCK_EVENT = 'hrms:unlock';
export const dispatchLock = () => window.dispatchEvent(new Event(LOCK_EVENT));
export const dispatchUnlock = () => window.dispatchEvent(new Event(UNLOCK_EVENT));

export const getIsLocked = () => localStorage.getItem(LOCK_KEY) === '1';

export default function useIdleLock({
  timeout = 480_000,
  onLock,
  onUnlock,
  disabled = false, // ปิด “จับเวลา” แต่ยัง sync ข้ามแท็บได้
  activeBroadcastThrottleMs = 3000,
} = {}) {
  const timerRef = useRef(null);
  const lastBroadcastRef = useRef(0);
  const [locked, setLocked] = useState(getIsLocked());

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const lockNow = () => {
    if (disabled) return;
    localStorage.setItem(LOCK_KEY, '1');
    setLocked(true);
    dispatchLock();
    clearTimer();
    onLock?.(); // แท็บที่ “เป็นคนล็อก”
  };

  const resetTimer = () => {
    if (locked || disabled) return;
    clearTimer();
    timerRef.current = setTimeout(lockNow, timeout);
  };

  const unlock = () => {
    localStorage.removeItem(LOCK_KEY);
    setLocked(false);
    dispatchUnlock();
    resetTimer();
  };

  const broadcastActive = () => {
    const now = Date.now();
    if (now - lastBroadcastRef.current < activeBroadcastThrottleMs) return;
    lastBroadcastRef.current = now;
    try { localStorage.setItem(LAST_ACTIVE_KEY, String(now)); } catch { }
  };

  useEffect(() => {
    // sync locked จาก storage ทุกครั้ง
    const storageLocked = getIsLocked();
    if (storageLocked !== locked) setLocked(storageLocked);

    // อีเวนต์ในแท็บเดียวกัน
    const onUnlockEvt = () => { setLocked(false); resetTimer(); };
    const onLockEvt = () => { setLocked(true); clearTimer(); };
    window.addEventListener(UNLOCK_EVENT, onUnlockEvt);
    window.addEventListener(LOCK_EVENT, onLockEvt);

    // ✅ sync หลายแท็บ (ล็อก/ปลดล็อก + activity)
    const onStorage = (ev) => {
      // 1) lock/unlock ข้ามแท็บ
      if (ev.key === LOCK_KEY) {
        const isLocked = ev.newValue === '1';
        setLocked(isLocked);

        if (isLocked) {
          clearTimer();
          onLock?.();     // ✅ ให้ทุกแท็บเด้งไป /lock
        } else {
          resetTimer();
          onUnlock?.();   // ✅ ให้ทุกแท็บปลดล็อก/กลับหน้าเดิม
        }
      }

      // 2) activity ข้ามแท็บ: ถ้าแท็บไหนใช้งานอยู่ ให้แท็บอื่น reset timer ด้วย
      if (ev.key === LAST_ACTIVE_KEY) {
        if (!getIsLocked() && !disabled) resetTimer();
      }
    };
    window.addEventListener('storage', onStorage);

    // ✅ disabled = ไม่จับเวลา/ไม่ผูก activity แต่ “ยังฟัง storage อยู่” เพื่อปลดล็อกข้ามแท็บได้
    if (!disabled) {
      resetTimer();

      const activity = () => {
        broadcastActive();
        resetTimer();
      };

      const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
      events.forEach((e) => window.addEventListener(e, activity, { passive: true }));

      return () => {
        events.forEach((e) => window.removeEventListener(e, activity));
        window.removeEventListener(UNLOCK_EVENT, onUnlockEvt);
        window.removeEventListener(LOCK_EVENT, onLockEvt);
        window.removeEventListener('storage', onStorage);
        clearTimer();
      };
    }

    return () => {
      window.removeEventListener(UNLOCK_EVENT, onUnlockEvt);
      window.removeEventListener(LOCK_EVENT, onLockEvt);
      window.removeEventListener('storage', onStorage);
      clearTimer();
    };
  }, [locked, timeout, disabled, onLock, onUnlock, activeBroadcastThrottleMs]);

  return { locked, lockNow, unlock, resetTimer };
}
