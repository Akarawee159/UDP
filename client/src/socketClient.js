// src/socketClient.js
import { io } from 'socket.io-client';
import api from './api';

let socket = null;
let currentToken = null;

function baseFromApi() {
    const base = api?.defaults?.baseURL || '';
    if (/^https?:\/\//i.test(base)) return base.replace(/\/api\/?$/, '');
    if (base.startsWith('/')) return (window.location.origin + base).replace(/\/api\/?$/, '');
    return window.location.origin;
}

function readStoredToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
}

export function setAuthToken(token) {
    currentToken = token || readStoredToken();
    if (socket) {
        socket.auth = { token: currentToken };
        if (socket.connected) socket.disconnect();
        socket.connect();
    }
}

export function connectWithStoredToken() {
    const token = currentToken || readStoredToken();
    if (!token) return;

    const url = baseFromApi();
    if (!socket) {
        socket = io(url, {
            withCredentials: true,
            autoConnect: false,
            auth: { token },
            transports: ['websocket', 'polling'],
        });

        // --- Helper Function: ช่วยลดการเขียน socket.on ซ้ำๆ ---
        const forward = (socketEvent, windowEvent) => {
            socket.on(socketEvent, (payload) => {
                // ส่ง payload หรือ object ว่างหากไม่มี data
                window.dispatchEvent(new CustomEvent(windowEvent, { detail: payload || {} }));
            });
        };

        // --- 1. กลุ่ม Master Data (ที่มีทั้ง upsert และ delete เหมือนกัน) ---
        const standardEntities = [
            'branch',
            'department',
            'position',
            'company',
            'permission',
            'training-location',
            'zone',
            'countingunit',
            'area',
            'packaging',
            'material',
            'registerasset',
        ];

        standardEntities.forEach(entity => {
            forward(`${entity}:upsert`, `hrms:${entity}-upsert`);
            forward(`${entity}:delete`, `hrms:${entity}-delete`);
        });

        // --- 2. กลุ่ม Custom Events (ชื่อ Event ไม่เป็น pattern หรือมีแค่บางตัว) ---
        const customMappings = [
            { s: 'employee:upsert', w: 'hrms:employee-upsert' },
            { s: 'user:remove', w: 'hrms:user-remove' },
            { s: 'user:upsert', w: 'hrms:user-upsert' },
            { s: 'user:status', w: 'hrms:user-status' },
            { s: 'permission:status', w: 'hrms:permission-status' },
            { s: 'forgot_password:update', w: 'hrms:forgot-password-update' },
            { s: 'auth:password_expired', w: 'hrms:password-expired' },
            { s: 'auth:password_changed', w: 'hrms:password-changed' },
            { s: 'systemout:update', w: 'hrms:systemout-update' },
            { s: 'systemin:update', w: 'hrms:systemin-update' },
            { s: 'systemdefective:update', w: 'hrms:systemdefective-update' },

        ];

        customMappings.forEach(m => forward(m.s, m.w));

        // --- 3. Events ที่มี Logic พิเศษ (ไม่สามารถใช้ forward ตรงๆ ได้) ---

        // เมื่อถูก revoke → เคลียร์ storage และส่งกลับหน้า Login
        socket.on('auth:revoke', () => {
            try { localStorage.clear(); sessionStorage.clear(); } catch { }
            window.location.replace('/');
        });

        socket.on('connect_error', (err) => {
            if (String(err?.message || '').toLowerCase().includes('unauthorized')) {
                try { localStorage.clear(); sessionStorage.clear(); } catch { }
                window.location.replace('/');
            }
        });
    }

    currentToken = token;
    socket.auth = { token: currentToken };
    if (!socket.connected) socket.connect();
}

export function disconnect() {
    if (socket) {
        try {
            socket.removeAllListeners();
            socket.disconnect();
        } catch { }
        socket = null;
    }
}

export function getSocket() {
    return socket;
}