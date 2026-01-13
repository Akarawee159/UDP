// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { setAuthToken, connectWithStoredToken } from '../socketClient';
import { useNavigate } from 'react-router-dom';
import {
    EyeOutlined,
    EyeInvisibleOutlined,
    UserOutlined,
    LockOutlined,
    ArrowRightOutlined,
    // เปลี่ยนไอคอนให้เข้ากับระบบ Box QR Code
    QrcodeOutlined,
    DropboxOutlined,
    EnvironmentOutlined,
    BarChartOutlined,
} from '@ant-design/icons';
import api from '../api';
import useAuth from '../hooks/useAuth';
import logo from '../assets/logo_login.png';

// ✅ Import ModalExpired และ ForgotPassword เข้ามาใช้งาน
import ModalExpired from '../layouts/Modal/ModalExpired';
import ForgotPassword from './ForgotPassword';

const REMEMBER_KEY = 'BOX_QR_REMEMBER'; // เปลี่ยน Key ให้ตรงกับโปรเจคใหม่

/** base64url → JSON (payload) */
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(json);
    } catch {
        return null;
    }
}

/** ตรวจว่า JWT ยังไม่หมดอายุ (เผื่อเวลา 30 วินาที) */
function isTokenValid(token) {
    const payload = parseJwt(token);
    if (!payload || !payload.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp - now > 30;
}

function FeatureItem({ icon, title, desc }) {
    return (
        <div className="group flex items-center gap-3 bg-white/10 border border-white/20 rounded-2xl p-3 hover:bg-white/15 hover:border-white/30 transition">
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-white/10 border border-white/20">
                <span className="text-white/90 text-lg">{icon}</span>
            </div>
            <div className="min-w-0">
                <div className="font-semibold leading-tight text-white">{title}</div>
                {/* เปลี่ยน Text สีรองเป็นโทนแดงอ่อน */}
                <div className="text-red-50/90 text-xs truncate">{desc}</div>
            </div>
        </div>
    );
}

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // State สำหรับ Modal
    const [expiredOpen, setExpiredOpen] = useState(false);
    const [forgotPwOpen, setForgotPwOpen] = useState(false);

    const [resetToken, setResetToken] = useState(null);

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        rememberMe: true,
    });

    // โหลดสถานะ remember
    useEffect(() => {
        let saved = localStorage.getItem(REMEMBER_KEY);
        if (saved === null) {
            localStorage.setItem(REMEMBER_KEY, '1');
            saved = '1';
        }
        setFormData(p => ({ ...p, rememberMe: saved === '1' }));
    }, []);

    // Auto Login check
    useEffect(() => {
        const remembered = localStorage.getItem(REMEMBER_KEY) === '1';
        if (!remembered) return;
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        if (token && user && isTokenValid(token)) {
            navigate('/home', { replace: true });
        }
    }, [navigate]);

    const onChange = (e) => {
        const { name, value, type, checked } = e.target;
        const next = type === 'checkbox' ? checked : value;
        setFormData((p) => ({ ...p, [name]: next }));
        if (name === 'rememberMe') {
            try { localStorage.setItem(REMEMBER_KEY, next ? '1' : '0'); } catch { }
        }
    };

    const submit = async () => {
        if (!formData.username || !formData.password) {
            message.warning('กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน');
            return;
        }
        setIsLoading(true);
        try {
            const { data } = await api.post('/auth/login', {
                username: formData.username,
                password: formData.password,
            });
            const { accessToken, refreshToken, user } = data;

            login(accessToken, user, { remember: formData.rememberMe, refreshToken });
            message.success('เข้าสู่ระบบสำเร็จ');

            setAuthToken(accessToken);
            connectWithStoredToken();

            navigate('/home');
        } catch (err) {
            const apiMsg = err?.response?.data?.message;
            const apiCode = err?.response?.data?.code;
            const status = err?.response?.status;

            // ✅ กรณีรหัสหมดอายุ: เก็บ Token และเปิด Modal
            if (status === 419 && apiCode === 'PASSWORD_EXPIRED') {
                setResetToken(err?.response?.data?.resetToken || null);
                setExpiredOpen(true);
                return;
            }

            if (apiCode === 'USER_BUSY') {
                message.error('ผู้ใช้นี้กำลังใช้งานอยู่');
            } else if (apiCode === 'USER_FORBIDDEN') {
                message.error('ผู้ใช้นี้ ไม่อนุญาตให้ใช้งาน');
            } else if (apiCode === 'ACCOUNT_INACTIVE') {
                message.error(apiMsg || 'บัญชีผู้ใช้งานถูกปิดใช้งาน');
            } else if (apiCode === 'BAD_CREDENTIALS' || status === 401) {
                message.error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
            } else {
                message.error(apiMsg || 'เข้าสู่ระบบไม่สำเร็จ');
            }
            console.error('Login error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // ✅ Callback เมื่อเปลี่ยนรหัสผ่านสำเร็จผ่าน ModalExpired
    const handleExpiredSuccess = async () => {
        setExpiredOpen(false);
        setResetToken(null);
        // เคลียร์ช่องรหัสผ่านเพื่อให้ผู้ใช้กรอกใหม่
        setFormData(prev => ({ ...prev, password: '' }));
    };

    return (
        // เปลี่ยน Gradient Background เป็น Red Theme (แดง-ขาว)
        <div className="relative min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-slate-50 to-slate-50 overflow-hidden">
            {/* --- Global decorative layers (Red Theme) --- */}
            <div className="pointer-events-none absolute inset-0">
                {/* เปลี่ยนสี Orb เป็นสีแดง */}
                <div className="absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full bg-slate-700/20 blur-3xl" />
                {/* เปลี่ยนสี Orb เป็นสีส้มแดง */}
                <div className="absolute -bottom-24 -right-24 w-[32rem] h-[32rem] rounded-full bg-slate-700/20 blur-3xl" />
                {/* เปลี่ยนจุด Pattern เป็นสีแดงเข้ม */}
                <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_12px_12px,rgba(220,38,38,.22)_2px,transparent_2px)] [background-size:24px_24px]" />
            </div>

            <div className="relative w-full max-w-6xl bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/40 overflow-hidden">

                <div className="flex flex-col xl:flex-row min-h-[540px]">
                    {/* Left Side: Branding - เปลี่ยน Gradient เป็นสีแดงเข้ม (600-800) */}
                    <div className="relative flex-1 bg-gradient-to-br from-red-800 via-red-700 to-red-600 text-white p-10 overflow-hidden">
                        <div className="pointer-events-none absolute inset-0">
                            <div className="absolute -top-20 -left-24 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
                            <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-red-400/20 blur-3xl" />
                            <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_12px_12px,rgba(255,255,255,.35)_2px,transparent_2px)] [background-size:24px_24px]" />
                            {/* เปลี่ยนไอคอน Background Decorative เป็น QR Code */}
                            <QrcodeOutlined aria-hidden className="absolute right-6 top-6 text-white/10 text-6xl" />
                            <DropboxOutlined aria-hidden className="absolute left-5 bottom-6 text-white/10 text-7xl" />
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-5 mb-6">
                                <div className="w-46 h-46 rounded-2xl bg-white/15 border border-white/20 overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.15)]">
                                    <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                                </div>

                                <div className="min-w-0">
                                    <h1 className="text-4xl font-extrabold tracking-tight">SMART PACKAGE TRACKING</h1>
                                    {/* เปลี่ยน Text สีรอง */}
                                    <p className="text-red-100/90 text-[20px] mt-2">ระบบติดตามบรรจุภัณฑ์</p>
                                </div>
                            </div>

                            {/* เปลี่ยน Feature Grid ให้ตรงกับระบบ Box Tracking */}
                            <div className="mt-10 grid grid-cols-2 gap-3 max-w-xl">
                                <FeatureItem icon={<QrcodeOutlined />} title="สแกน QR" desc="รับเข้า / จ่ายออก" />
                                <FeatureItem icon={<DropboxOutlined />} title="สถานะกล่อง" desc="ปกติ, รอซ่อม, ชำรุด" />
                                <FeatureItem icon={<EnvironmentOutlined />} title="ติดตามพิกัด" desc="Location & History" />
                                <FeatureItem icon={<BarChartOutlined />} title="รายงาน" desc="Excel, Graph, Timeline" />
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Form */}
                    <div className="relative flex-1 p-10 bg-white overflow-hidden flex flex-col justify-center">
                        <div className="pointer-events-none absolute inset-0">
                            {/* เปลี่ยนสี Blob หลังฟอร์ม เป็นแดง */}
                            <div className="absolute -top-10 -right-10 w-60 h-60 rounded-full bg-red-100/40 blur-3xl" />
                            <div className="absolute -bottom-10 -left-10 w-60 h-60 rounded-full bg-orange-100/40 blur-3xl" />
                        </div>

                        <div className="relative z-10 max-w-md mx-auto w-full">
                            {/* เปลี่ยนหัวข้อเป็นสีแดงเข้ม */}
                            <h3 className="text-3xl font-black text-red-900 mb-1 text-center">ยินดีต้อนรับ</h3>
                            <p className="text-gray-500 text-center mb-8 text-sm">กรุณาเข้าสู่ระบบเพื่อติดตามสถานะกล่อง</p>

                            <label className="block text-sm font-semibold text-gray-700 mb-2">ชื่อผู้ใช้</label>
                            <div className="relative mb-5">
                                <UserOutlined className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    name="username"
                                    autoComplete="username"
                                    value={formData.username}
                                    onChange={onChange}
                                    // เปลี่ยน Focus Ring เป็นสีแดง
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition-all"
                                    placeholder="กรอกชื่อผู้ใช้"
                                />
                            </div>

                            <label className="block text-sm font-semibold text-gray-700 mb-2">รหัสผ่าน</label>
                            <div className="relative mb-2">
                                <LockOutlined className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    autoComplete="current-password"
                                    value={formData.password}
                                    onChange={onChange}
                                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                                    // เปลี่ยน Focus Ring เป็นสีแดง
                                    className="w-full pl-12 pr-14 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition-all"
                                    placeholder="กรอกรหัสผ่าน"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                                </button>
                            </div>

                            <div className="flex items-center justify-between mt-4 mb-6">
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={formData.rememberMe}
                                    onClick={() => {
                                        const next = !formData.rememberMe;
                                        setFormData((p) => ({ ...p, rememberMe: next }));
                                        try { localStorage.setItem(REMEMBER_KEY, next ? '1' : '0'); } catch { }
                                    }}
                                    className="group inline-flex items-center gap-2 select-none cursor-pointer"
                                >
                                    {/* เปลี่ยนสี Checkbox เป็นแดง */}
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.rememberMe ? 'bg-red-600 border-red-600' : 'bg-white border-gray-300'}`}>
                                        {formData.rememberMe && <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>}
                                    </div>
                                    <span className="text-sm text-gray-600 group-hover:text-gray-800">จำฉันไว้</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setForgotPwOpen(true)}
                                    // เปลี่ยนสีลิงก์เป็นแดง
                                    className="text-sm font-semibold text-red-600 hover:text-red-700 hover:underline"
                                >
                                    ลืมรหัสผ่าน?
                                </button>
                            </div>

                            <button
                                onClick={submit}
                                disabled={isLoading}
                                // เปลี่ยนสีปุ่มหลักเป็น gradient แดง (Red 600 - Red 500) และเงาสีแดง
                                className="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 disabled:opacity-60 text-white py-3.5 font-bold shadow-lg shadow-red-200 transition-all transform active:scale-[0.98]"
                            >
                                {isLoading ? 'กำลังเข้าสู่ระบบ...' : (<>เข้าสู่ระบบ <ArrowRightOutlined className="ml-2" /></>)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ✅ Modal 1: ใช้งาน ForgotPassword Component แทน Modalc เดิม */}
            <ForgotPassword
                open={forgotPwOpen}
                onClose={() => setForgotPwOpen(false)}
            />

            {/* ✅ Modal 2: Component ModalExpired */}
            <ModalExpired
                open={expiredOpen}
                resetToken={resetToken}
                onClose={() => setExpiredOpen(false)}
                onForceLogout={handleExpiredSuccess}
            />
        </div>
    );
}