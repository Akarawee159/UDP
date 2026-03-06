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
    QrcodeOutlined,
    DropboxOutlined,
    EnvironmentOutlined,
    BarChartOutlined,
} from '@ant-design/icons';
import api from '../api';
import useAuth from '../hooks/useAuth';
import logo from '../assets/logo_login.png';

import ModalExpired from '../layouts/Modal/ModalExpired';
import ForgotPassword from './ForgotPassword';

const REMEMBER_KEY = 'BOX_QR_REMEMBER';

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
            <div className="grid place-items-center h-10 w-10 shrink-0 rounded-xl bg-white/10 border border-white/20">
                <span className="text-white/90 text-lg">{icon}</span>
            </div>
            <div className="min-w-0 text-left">
                <div className="font-semibold leading-tight text-white text-sm sm:text-base">{title}</div>
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

            // ล้างสถานะ logout ออก เพื่อให้ api.js ยอมแนบ Token กลับไปเหมือนเดิม
            window.__LOGGING_OUT__ = false;

            login(accessToken, user, { remember: formData.rememberMe, refreshToken });
            message.success('เข้าสู่ระบบสำเร็จ');

            setAuthToken(accessToken);
            connectWithStoredToken();

            navigate('/home');
        } catch (err) {
            const apiMsg = err?.response?.data?.message;
            const apiCode = err?.response?.data?.code;
            const status = err?.response?.status;

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

    const handleExpiredSuccess = async () => {
        setExpiredOpen(false);
        setResetToken(null);
        setFormData(prev => ({ ...prev, password: '' }));
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-slate-50 via-slate-50 to-slate-50 overflow-hidden">
            {/* --- Global decorative layers --- */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-24 -left-24 w-[20rem] sm:w-[28rem] h-[20rem] sm:h-[28rem] rounded-full bg-slate-700/20 blur-3xl" />
                <div className="absolute -bottom-24 -right-24 w-[24rem] sm:w-[32rem] h-[24rem] sm:h-[32rem] rounded-full bg-slate-700/20 blur-3xl" />
                <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_12px_12px,rgba(220,38,38,.22)_2px,transparent_2px)] [background-size:24px_24px]" />
            </div>

            <div className="relative w-full max-w-6xl bg-white/90 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/40 overflow-hidden">

                <div className="flex flex-col-reverse lg:flex-row min-h-[auto] lg:min-h-[540px]">

                    {/* Left Side: Branding */}
                    <div className="relative flex-1 bg-gradient-to-br from-red-800 via-red-700 to-red-600 text-white p-6 sm:p-10 lg:p-12 overflow-hidden flex flex-col justify-center">
                        <div className="pointer-events-none absolute inset-0">
                            <div className="absolute -top-20 -left-24 w-60 sm:w-80 h-60 sm:h-80 rounded-full bg-white/10 blur-3xl" />
                            <div className="absolute -bottom-24 -right-24 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-red-400/20 blur-3xl" />
                            <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_12px_12px,rgba(255,255,255,.35)_2px,transparent_2px)] [background-size:24px_24px]" />
                            <QrcodeOutlined aria-hidden className="absolute right-4 sm:right-6 top-4 sm:top-6 text-white/10 text-4xl sm:text-6xl" />
                            <DropboxOutlined aria-hidden className="absolute left-4 sm:left-5 bottom-4 sm:bottom-6 text-white/10 text-5xl sm:text-7xl" />
                        </div>

                        <div className="relative z-10 w-full">
                            {/* ✅ ปรับ justify-center ในขนาด sm เพื่อให้อยู่กึ่งกลางหน้าจอแท็บเล็ต และ justify-start บนหน้าจอ lg */}
                            <div className="flex flex-col sm:flex-row items-center sm:justify-center lg:justify-start gap-4 sm:gap-5 mb-6 text-center sm:text-left">
                                <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 shrink-0 rounded-2xl bg-white/15 border border-white/20 overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.15)]">
                                    <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                                </div>

                                <div className="min-w-0">
                                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">SMART PACKAGE TRACKING</h1>
                                    <p className="text-red-100/90 text-sm sm:text-base lg:text-[20px] mt-1 sm:mt-2">ระบบติดตามบรรจุภัณฑ์</p>
                                </div>
                            </div>

                            {/* ✅ เปลี่ยน sm:mx-0 เป็น lg:mx-0 เพื่อให้อยู่กึ่งกลางจนกว่าจะถึงหน้าจอ Desktop */}
                            <div className="mt-6 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto lg:mx-0">
                                <FeatureItem icon={<QrcodeOutlined />} title="สแกน QR" desc="รับเข้า / จ่ายออก" />
                                <FeatureItem icon={<DropboxOutlined />} title="สถานะกล่อง" desc="ปกติ, รอซ่อม, ชำรุด" />
                                <FeatureItem icon={<EnvironmentOutlined />} title="ติดตามพิกัด" desc="Location & History" />
                                <FeatureItem icon={<BarChartOutlined />} title="รายงาน" desc="Excel, Graph, Timeline" />
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Form */}
                    <div className="relative flex-1 p-6 sm:p-10 lg:p-12 bg-white overflow-hidden flex flex-col justify-center">
                        <div className="pointer-events-none absolute inset-0">
                            <div className="absolute -top-10 -right-10 w-40 sm:w-60 h-40 sm:h-60 rounded-full bg-red-100/40 blur-3xl" />
                            <div className="absolute -bottom-10 -left-10 w-40 sm:w-60 h-40 sm:h-60 rounded-full bg-orange-100/40 blur-3xl" />
                        </div>

                        <div className="relative z-10 max-w-md mx-auto w-full">
                            <h3 className="text-2xl sm:text-3xl font-black text-red-900 mb-1 text-center">ยินดีต้อนรับ</h3>
                            <p className="text-gray-500 text-center mb-6 sm:mb-8 text-xs sm:text-sm">กรุณาเข้าสู่ระบบเพื่อติดตามสถานะกล่อง</p>

                            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">ชื่อผู้ใช้</label>
                            <div className="relative mb-4 sm:mb-5">
                                <UserOutlined className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    name="username"
                                    autoComplete="username"
                                    value={formData.username}
                                    onChange={onChange}
                                    className="w-full pl-12 pr-4 py-2.5 sm:py-3 text-sm sm:text-base bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition-all"
                                    placeholder="กรอกชื่อผู้ใช้"
                                />
                            </div>

                            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">รหัสผ่าน</label>
                            <div className="relative mb-2">
                                <LockOutlined className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    autoComplete="current-password"
                                    value={formData.password}
                                    onChange={onChange}
                                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                                    className="w-full pl-12 pr-14 py-2.5 sm:py-3 text-sm sm:text-base bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition-all"
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
                                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded border flex items-center justify-center transition-colors ${formData.rememberMe ? 'bg-red-600 border-red-600' : 'bg-white border-gray-300'}`}>
                                        {formData.rememberMe && <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>}
                                    </div>
                                    <span className="text-xs sm:text-sm text-gray-600 group-hover:text-gray-800">จำฉันไว้</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setForgotPwOpen(true)}
                                    className="text-xs sm:text-sm font-semibold text-red-600 hover:text-red-700 hover:underline"
                                >
                                    ลืมรหัสผ่าน?
                                </button>
                            </div>

                            <button
                                onClick={submit}
                                disabled={isLoading}
                                className="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 disabled:opacity-60 text-white py-3 sm:py-3.5 text-sm sm:text-base font-bold shadow-lg shadow-red-200 transition-all transform active:scale-[0.98]"
                            >
                                {isLoading ? 'กำลังเข้าสู่ระบบ...' : (<>เข้าสู่ระบบ <ArrowRightOutlined className="ml-2" /></>)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <ForgotPassword
                open={forgotPwOpen}
                onClose={() => setForgotPwOpen(false)}
            />

            <ModalExpired
                open={expiredOpen}
                resetToken={resetToken}
                onClose={() => setExpiredOpen(false)}
                onForceLogout={handleExpiredSuccess}
            />
        </div>
    );
}