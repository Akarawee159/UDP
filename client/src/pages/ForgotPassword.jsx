// src/components/ForgotPassword.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Steps, Tooltip, ConfigProvider } from 'antd';
import {
    UserOutlined,
    IdcardOutlined,
    QuestionCircleOutlined,
    SendOutlined,
    LoadingOutlined,
    CheckCircleOutlined,
    SolutionOutlined,
    KeyOutlined,
    SearchOutlined,
    ArrowLeftOutlined,
    SyncOutlined,
    FileSearchOutlined
} from '@ant-design/icons';
import api from '../api';

const { Step } = Steps;

export default function ForgotPassword({ open, onClose }) {
    const [form] = Form.useForm();
    const [searchForm] = Form.useForm();

    const [loading, setLoading] = useState(false);
    const [refreshLoading, setRefreshLoading] = useState(false);
    const [trackingUser, setTrackingUser] = useState(null);
    const [isSearchMode, setIsSearchMode] = useState(false);

    useEffect(() => {
        if (open) {
            form.resetFields();
            searchForm.resetFields();
            setTrackingUser(null);
            setIsSearchMode(false);
        }
    }, [open, form, searchForm]);

    // Real-time Listener (Socket)
    useEffect(() => {
        const handleStatusUpdate = (event) => {
            const { employee_code, is_status } = event.detail;
            if (trackingUser && trackingUser.employee_code === employee_code) {
                setTrackingUser(prev => ({ ...prev, is_status: String(is_status) }));
                if (String(is_status) === '6') {
                    message.success('รีเซ็ทรหัสผ่านเรียบร้อยแล้ว');
                }
            }
        };

        window.addEventListener('hrms:forgot-password-update', handleStatusUpdate);
        window.addEventListener('hrms:employee-upsert', handleStatusUpdate);

        return () => {
            window.removeEventListener('hrms:forgot-password-update', handleStatusUpdate);
            window.removeEventListener('hrms:employee-upsert', handleStatusUpdate);
        };
    }, [trackingUser]);

    const handleRequestSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);
            const res = await api.post('/forgotpassword/request', {
                employee_code: values.employee_id,
                username: values.username
            });
            if (res.data?.success) {
                setTrackingUser({
                    employee_code: values.employee_id,
                    is_status: res.data.data.status
                });
                message.success(res.data.message);
            }
        } catch (error) {
            if (error.response?.data?.message) message.error(error.response.data.message);
            else message.error('เกิดข้อผิดพลาด');
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = async () => {
        try {
            const values = await searchForm.validateFields();
            setLoading(true);
            const res = await api.post('/forgotpassword/check-status', {
                keyword: values.keyword
            });

            if (res.data?.success) {
                setTrackingUser({
                    employee_code: res.data.data.employee_code,
                    is_status: res.data.data.is_status
                });
                message.success('พบข้อมูลคำขอ');
            }

        } catch (error) {
            if (error.response?.status === 404) {
                message.warning('ไม่พบคำขอที่กำลังดำเนินการ');
            } else if (error.response?.status === 400) {
                message.error('กรุณาระบุข้อมูลที่ถูกต้อง');
            } else {
                message.error('เกิดข้อผิดพลาดในการค้นหา');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleManualRefresh = async () => {
        if (!trackingUser?.employee_code) return;

        try {
            setRefreshLoading(true);
            const res = await api.post('/forgotpassword/check-status', {
                keyword: trackingUser.employee_code
            });

            if (res.data?.success) {
                const newStatus = String(res.data.data.is_status);
                if (newStatus !== trackingUser.is_status) {
                    setTrackingUser(prev => ({ ...prev, is_status: newStatus }));
                    message.success('อัปเดตสถานะล่าสุดแล้ว');
                } else {
                    message.info('สถานะเป็นปัจจุบันแล้ว');
                }
            }
        } catch (error) {
            console.error("Refresh error", error);
            message.error('ไม่สามารถดึงสถานะล่าสุดได้');
        } finally {
            setRefreshLoading(false);
        }
    };

    const getCurrentStep = (status) => {
        const s = String(status);
        if (s === '4') return 0;
        if (s === '5') return 1;
        if (s === '6') return 2;
        return 0;
    };

    const renderTimeline = () => (
        <div className="animate-fade-in relative">
            {/* เปลี่ยนธีม Tracking Box เป็นสีน้ำเงิน */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-6 flex items-center justify-between shadow-sm">
                <div>
                    <div className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-0.5">Tracking ID</div>
                    <div className="text-lg font-bold text-blue-800 leading-none">{trackingUser.employee_code}</div>
                </div>
                <Tooltip title="กดเพื่อเช็คสถานะล่าสุด">
                    <Button
                        type="text"
                        shape="circle"
                        icon={<SyncOutlined spin={refreshLoading} />}
                        onClick={handleManualRefresh}
                        disabled={refreshLoading}
                        // ปุ่ม Refresh สีน้ำเงิน
                        className="text-blue-600 hover:bg-blue-200 bg-blue-100 border border-blue-200"
                    />
                </Tooltip>
            </div>

            <div className="px-2">
                <Steps
                    direction="vertical"
                    current={getCurrentStep(trackingUser.is_status)}
                    items={[
                        {
                            title: 'ส่งคำขอแล้ว',
                            description: 'ระบบได้รับข้อมูลแล้ว รอผู้ดูแลระบบตรวจสอบ',
                            icon: getCurrentStep(trackingUser.is_status) === 0 ? <LoadingOutlined /> : <CheckCircleOutlined />
                        },
                        {
                            title: 'กำลังดำเนินการ',
                            description: 'ผู้ดูแลระบบกำลังทำการรีเซ็ทรหัสผ่านให้คุณ',
                            icon: <SolutionOutlined />
                        },
                        {
                            title: 'เสร็จสิ้น',
                            description: 'รหัสผ่านถูกรีเซ็ตแล้ว กรุณาตรวจสอบช่องทางที่ตกลงไว้',
                            icon: <KeyOutlined />
                        }
                    ]}
                />
            </div>

            <div className="flex flex-col gap-2 mt-8 pt-4 border-t border-gray-100">
                {/* ปุ่มปิดหน้าต่าง สีน้ำเงิน */}
                <Button
                    type="primary"
                    onClick={onClose}
                    className="h-10 rounded-lg bg-blue-600 hover:bg-blue-500 border-none shadow-md font-semibold"
                >
                    ปิดหน้าต่าง
                </Button>
                {/* ปุ่มตรวจสอบรายการอื่น สีเทา/น้ำเงิน */}
                <Button
                    type="text"
                    onClick={() => {
                        setTrackingUser(null);
                        setIsSearchMode(true);
                        searchForm.resetFields();
                    }}
                    className="text-gray-500 hover:text-blue-600"
                >
                    ตรวจสอบรายการอื่น
                </Button>
            </div>
        </div>
    );

    const renderForms = () => (
        <div className="transition-all duration-300">
            {!isSearchMode ? (
                /* --- โหมด 1: แจ้งลืมรหัสผ่าน (Form) --- */
                <>
                    {/* เปลี่ยนสี Alert เป็นสีส้ม (คงเดิมเพื่อความหมาย Warning/Info) */}
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6 flex gap-3 items-start">
                        <QuestionCircleOutlined className="text-orange-400 mt-1 text-lg" />
                        <div className="text-sm text-orange-800">
                            <div className="font-bold mb-1">แจ้งลืมรหัสผ่าน</div>
                            <p className="opacity-90 leading-relaxed">กรุณาระบุข้อมูลเพื่อยืนยันตัวตน ระบบจะส่งคำขอไปยังผู้ดูแลระบบเพื่อดำเนินการตรวจสอบ</p>
                        </div>
                    </div>

                    <Form
                        key="request-form"
                        form={form}
                        layout="vertical"
                        onFinish={handleRequestSubmit}
                        requiredMark={false}
                        className="space-y-3"
                    >
                        <Form.Item
                            name="employee_id"
                            label={<span className="font-semibold text-gray-700">รหัสพนักงาน</span>}
                            rules={[{ required: true, message: 'กรุณาระบุรหัสพนักงาน' }]}
                        >
                            {/* เปลี่ยน Focus Border เป็นสีน้ำเงิน */}
                            <Input prefix={<IdcardOutlined className="text-gray-400" />} placeholder="เช่น EMP001" className="h-11 rounded-lg bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 transition-all" />
                        </Form.Item>
                        <Form.Item
                            name="username"
                            label={<span className="font-semibold text-gray-700">ชื่อผู้ใช้งาน (Username)</span>}
                            rules={[{ required: true, message: 'กรุณาระบุชื่อผู้ใช้งาน' }]}
                        >
                            {/* เปลี่ยน Focus Border เป็นสีน้ำเงิน */}
                            <Input prefix={<UserOutlined className="text-gray-400" />} placeholder="Username ของคุณ" className="h-11 rounded-lg bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 transition-all" />
                        </Form.Item>

                        <div className="pt-4 flex flex-col gap-3">
                            {/* ปุ่มส่งคำขอ สีน้ำเงิน */}
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                icon={<SendOutlined />}
                                block
                                className="h-11 bg-blue-600 hover:bg-blue-500 border-none shadow-lg shadow-blue-100 rounded-xl font-semibold text-base"
                            >
                                ส่งคำขอรีเซ็ต
                            </Button>

                            {/* ปุ่มติดตามสถานะ สีน้ำเงิน */}
                            <Button
                                type="dashed"
                                block
                                className="h-11 text-gray-500 hover:text-blue-600 hover:border-blue-400 rounded-xl"
                                onClick={() => {
                                    searchForm.resetFields();
                                    setIsSearchMode(true);
                                }}
                            >
                                ติดตามสถานะคำขอเดิม
                            </Button>
                        </div>
                    </Form>
                </>
            ) : (
                /* --- โหมด 2: ติดตามสถานะ (Search) --- */
                <>
                    {/* เปลี่ยนสี Alert เป็นสีฟ้าอ่อน */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex gap-3 items-start">
                        <FileSearchOutlined className="text-blue-400 mt-1 text-lg" />
                        <div className="text-sm text-blue-800">
                            <div className="font-bold mb-1">ติดตามสถานะ</div>
                            <p className="opacity-90 leading-relaxed">กรอกรหัสพนักงาน หรือ ชื่อผู้ใช้งาน เพื่อตรวจสอบความคืบหน้าของคำขอที่คุณส่งไป</p>
                        </div>
                    </div>

                    <Form
                        key="search-form"
                        form={searchForm}
                        layout="vertical"
                        onFinish={handleSearchSubmit}
                        className="space-y-3"
                    >
                        <Form.Item
                            name="keyword"
                            label={<span className="font-semibold text-gray-700">ข้อมูลค้นหา</span>}
                            rules={[{ required: true, message: 'กรุณาระบุข้อมูลเพื่อค้นหา' }]}
                        >
                            {/* เปลี่ยน Focus Border เป็นสีน้ำเงิน */}
                            <Input
                                prefix={<SearchOutlined className="text-gray-400" />}
                                placeholder="รหัสพนักงาน หรือ Username"
                                className="h-11 rounded-lg bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 transition-all"
                            />
                        </Form.Item>

                        <div className="pt-4 flex flex-col gap-3">
                            {/* ปุ่มค้นหาสถานะ สีน้ำเงิน */}
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                icon={<SearchOutlined />}
                                block
                                className="h-11 bg-blue-600 hover:bg-blue-500 border-none shadow-lg shadow-blue-100 rounded-xl font-semibold text-base"
                            >
                                ค้นหาสถานะ
                            </Button>
                            <Button
                                type="text"
                                icon={<ArrowLeftOutlined />}
                                block
                                className="h-11 text-gray-500 hover:text-gray-800 rounded-xl"
                                onClick={() => {
                                    form.resetFields();
                                    setIsSearchMode(false);
                                }}
                            >
                                ย้อนกลับ
                            </Button>
                        </div>
                    </Form>
                </>
            )}
        </div>
    );

    return (
        <ConfigProvider
            theme={{
                token: {
                    // เปลี่ยน Primary Color เป็น Blue 600
                    colorPrimary: '#2563eb',
                    borderRadius: 8,
                },
                components: {
                    Steps: {
                        // เปลี่ยน Steps เป็น Blue 500
                        colorPrimary: '#3b82f6',
                    }
                }
            }}
        >
            <Modal
                open={open}
                title={null}
                onCancel={onClose}
                footer={null}
                centered
                maskClosable={false}
                width={480}
                className="custom-modal-forgot"
                styles={{ content: { padding: 0, borderRadius: '20px', overflow: 'hidden' } }}
            >
                {/* Header - เปลี่ยนธีมเป็นสีน้ำเงิน */}
                <div className={`px-6 py-4 border-b flex items-center justify-between ${trackingUser ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm text-xl ${trackingUser ? 'bg-white text-blue-600' : (isSearchMode ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600')}`}>
                            {trackingUser ? <SolutionOutlined /> : (isSearchMode ? <FileSearchOutlined /> : <KeyOutlined />)}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold m-0 leading-tight text-gray-800">
                                {trackingUser ? 'ผลการดำเนินการ' : (isSearchMode ? 'ติดตามสถานะ' : 'ลืมรหัสผ่าน?')}
                            </h3>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6">
                    {trackingUser ? renderTimeline() : renderForms()}
                </div>
            </Modal>
        </ConfigProvider>
    );
}