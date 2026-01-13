// src/layouts/Modal/ModalReset.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Form, Input, App, Button, Typography, Tag, Avatar } from 'antd'; // ❌ ลบ InputNumber ออก
import {
    KeyOutlined,
    UserOutlined,
    IdcardOutlined,
    BankOutlined,
    SolutionOutlined,
    LockOutlined,
    CheckCircleOutlined,
    WarningOutlined,
    SafetyCertificateOutlined
} from '@ant-design/icons';
import api from "../../../../api";

const { Text } = Typography;

const buildBase = () => {
    const base = api.defaults?.baseURL || "";
    return base.replace(/\/api\/?$/, "");
};

const ModalReset = ({ open, record, onClose }) => {
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;
    const [loading, setLoading] = useState(false);

    // ✅ State สำหรับเก็บค่าวันจาก DB
    const [policyDays, setPolicyDays] = useState(90);

    const BE_BASE = useMemo(() => buildBase(), []);
    const profileUrl = record?.profileImg ? `${BE_BASE}/img/profile/${record.profileImg}` : null;

    const fullname = useMemo(() => {
        if (!record) return '';
        const t = record.titlename_th || '';
        const f = record.firstname_th || '';
        const l = record.lastname_th ? ` ${record.lastname_th}` : '';
        return `${t}${f}${l}`.trim();
    }, [record]);

    // ✅ Fetch Policy Days เมื่อเปิด Modal
    useEffect(() => {
        if (open) {
            form.resetFields();
            const fetchPolicy = async () => {
                try {
                    // เรียก API Public ที่สร้างไว้
                    const { data } = await api.get('/auth/password-policy');
                    if (data?.policy_days) {
                        setPolicyDays(data.policy_days);
                    }
                } catch (error) {
                    console.error("Failed to fetch password policy", error);
                }
            };
            fetchPolicy();
        }
    }, [open, form]);

    const getCurrentEmployeeId = () => {
        try {
            const u =
                JSON.parse(localStorage.getItem('auth') || sessionStorage.getItem('auth') || 'null') ||
                JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
            if (u?.employee_id) return String(u.employee_id);

            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) return null;
            const payload = JSON.parse(atob(token.split('.')[1] || ''));
            return payload?.employee_id ? String(payload.employee_id) : null;
        } catch {
            return null;
        }
    };

    const revokeSessions = async (employeeId) => {
        await api.post('/auth/revoke-sessions', {
            employee_id: String(employeeId),
            keep_status: true
        });
    };

    const hardLogoutSelf = async () => {
        if (typeof window !== 'undefined') window.__LOGGING_OUT__ = true;
        try {
            const refreshToken =
                localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
            if (refreshToken) {
                await api.post('/auth/logout', { refreshToken });
            } else {
                const me = getCurrentEmployeeId();
                if (me) await revokeSessions(me);
            }
        } catch (e) {
            console.warn('logout api failed:', e?.message || e);
        } finally {
            try {
                const keys = ['token', 'refreshToken', 'user', 'auth', 'rememberMe', 'persistAuth', 'HRMS_REMEMBER', 'sidebarOpen'];
                keys.forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
                localStorage.clear(); sessionStorage.clear();
            } catch { }
            window.location.replace('/');
        }
    };

    const handleOk = async () => {
        try {
            const { password } = await form.validateFields();
            if (!record?.employee_id) return;

            setLoading(true);

            // ✅ ส่ง policyDays ที่ดึงจาก DB ไปที่ API
            await api.patch(`/management/${record.employee_id}/password`, {
                new_password: password,
                expiry_days: Number(policyDays || 90)
            });

            const me = getCurrentEmployeeId();
            const isSelf = me && String(record.employee_id) === String(me);

            try {
                await revokeSessions(record.employee_id);
            } catch { }

            onClose?.();

            if (isSelf) {
                message.success('รีเซ็ทรหัสผ่านสำเร็จ กำลังออกจากระบบ…');
                await hardLogoutSelf();
            } else {
                message.success('รีเซ็ทรหัสผ่านสำเร็จ และบังคับให้ผู้ใช้ออกจากระบบแล้ว');
            }
        } catch (err) {
            if (err?.errorFields) return;
            console.error(err);
            message.error('ไม่สามารถรีเซ็ทรหัสผ่านได้');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            title={null}
            footer={null}
            closable={false}
            maskClosable={!loading}
            centered
            width={500}
            className="custom-modal-reset"
            styles={{
                content: { padding: 0, borderRadius: '16px', overflow: 'hidden' }
            }}
        >
            <div className="bg-gray-200 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3 text-gray-800">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-600 text-xl">
                        <KeyOutlined />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold m-0 leading-tight">รีเซ็ตรหัสผ่าน</h3>
                        <span className="text-xs text-gray-700">กำหนดรหัสผ่านใหม่สำหรับผู้ใช้งาน</span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    disabled={loading}
                    className="text-gray-400 hover:text-gray-700 transition-colors text-3xl"
                >
                    &times;
                </button>
            </div>

            <div className="p-6">
                {record && (
                    <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm mb-6 flex items-start gap-4">
                        <div className="p-1 rounded-full border border-gray-100">
                            <Avatar
                                size={56}
                                icon={<UserOutlined />}
                                src={profileUrl}
                                className="bg-blue-50 text-blue-600"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-base font-bold text-gray-800 truncate">{fullname}</h4>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                                <span className="flex items-center gap-1">
                                    <IdcardOutlined className="text-blue-500" /> {record.employee_id}
                                </span>
                                <span className="flex items-center gap-1">
                                    <BankOutlined className="text-blue-500" /> {record.branch || '-'}
                                </span>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                <Tag color="blue" className="m-0 text-[10px] px-1.5 border-0 bg-blue-50 text-blue-700 font-semibold">
                                    {record.permission_role || '-'}
                                </Tag>
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                    <SolutionOutlined /> {record.username}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <Form form={form} layout="vertical" className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        <Form.Item
                            name="password"
                            label="รหัสผ่านใหม่"
                            rules={[
                                { required: true, message: 'กรุณากรอกรหัสผ่านใหม่' },
                                { pattern: strong, message: 'ต้องมี ตัวเล็ก/ใหญ่/ตัวเลข/อักขระพิเศษ และ ≥ 8 ตัว' }
                            ]}
                            hasFeedback
                            className="mb-0"
                        >
                            <Input.Password
                                prefix={<LockOutlined className="text-gray-400" />}
                                placeholder="อย่างน้อย 8 ตัวอักษร"
                                autoComplete="new-password"
                                className="h-10 rounded-lg"
                            />
                        </Form.Item>

                        <Form.Item
                            name="confirm"
                            label="ยืนยันรหัสผ่านใหม่"
                            dependencies={['password']}
                            rules={[
                                { required: true, message: 'กรุณายืนยันรหัสผ่านใหม่อีกครั้ง' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('password') === value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('รหัสผ่านไม่ตรงกัน'));
                                    },
                                }),
                            ]}
                            hasFeedback
                            className="mb-0"
                        >
                            <Input.Password
                                prefix={<CheckCircleOutlined className="text-gray-400" />}
                                placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                                autoComplete="new-password"
                                className="h-10 rounded-lg"
                            />
                        </Form.Item>

                        {/* ✅ เปลี่ยนจาก InputNumber เป็นการแสดงค่าจาก DB */}
                        <Form.Item label="อายุการใช้งานรหัสผ่าน (ตามนโยบายบริษัท)">
                            <div className="flex justify-between items-center h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-blue-200 transition-colors cursor-default">
                                <span className="text-gray-500 text-sm flex items-center gap-2">
                                    <SafetyCertificateOutlined className="text-blue-500" />
                                    <span>กำหนดโดยระบบ</span>
                                </span>
                                <Tag color="blue" bordered={false} className="m-0 px-2 font-semibold text-sm">
                                    {policyDays} วัน
                                </Tag>
                            </div>
                        </Form.Item>

                    </div>

                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 flex gap-2 items-start text-xs text-orange-700">
                        <WarningOutlined className="mt-0.5" />
                        <span>การรีเซ็ตรหัสผ่านจะทำให้ผู้ใช้งานรายนี้ <b>ถูกบังคับให้ออกจากระบบ (Force Logout)</b> จากทุกอุปกรณ์ทันที</span>
                    </div>
                </Form>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <Button
                    key="ok"
                    type="primary"
                    onClick={handleOk}
                    loading={loading}
                    className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 border-none shadow-md shadow-blue-200 font-semibold"
                >
                    รีเซ็ตรหัสผ่าน
                </Button>
                <Button
                    key="cancel"
                    onClick={onClose}
                    disabled={loading}
                    className="h-10 px-6 rounded-lg border-gray-300 text-gray-600 hover:text-gray-800 hover:border-gray-400 hover:bg-white"
                >
                    ยกเลิก
                </Button>
            </div>
        </Modal>
    );
};

export default ModalReset;