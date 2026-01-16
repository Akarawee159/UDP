import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Form, Input, App, Button, ConfigProvider, Spin, Row, Col, Typography } from 'antd';
import {
    IdcardOutlined, TagOutlined, EditOutlined, SaveOutlined,
    DeleteOutlined, PlusCircleOutlined, BankOutlined,
    GlobalOutlined, EnvironmentOutlined, PhoneOutlined,
    SafetyCertificateOutlined, BranchesOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import api from "../../../../api";

const { Title, Text } = Typography;

function ModalForm({ open, record, onClose, onSuccess, onDelete }) {
    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };
    const [form] = Form.useForm();

    // ตรวจสอบโหมด: ถ้ามี record ส่งมา = Edit Mode
    const isEditMode = !!record?.id;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [checkingCode, setCheckingCode] = useState(false);
    const [originalCode, setOriginalCode] = useState(null);

    const timerRef = useRef(null);

    // 1. ฟังก์ชันดึงข้อมูลล่าสุด (เฉพาะ Edit Mode)
    const fetchDetail = useCallback(async (id) => {
        try {
            setFetching(true);
            const res = await api.get(`/settings/company/${id}`);
            const data = res?.data?.data;
            if (data) {
                form.setFieldsValue(data);
                setOriginalCode(data.company_code || null);
            }
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลไม่สำเร็จ');
        } finally {
            setFetching(false);
        }
    }, [form, message]);

    useEffect(() => {
        if (open) {
            clearTimeout(timerRef.current);
            form.resetFields();
            setOriginalCode(null);

            if (isEditMode) {
                form.setFieldsValue(record);
                setOriginalCode(record.company_code || null);
                fetchDetail(record.id);
            }
        }
    }, [open, isEditMode, record, form, fetchDetail]);

    // Validation
    const validateCode = (_rule, value) => new Promise((resolve, reject) => {
        clearTimeout(timerRef.current);
        const code = (value || '').trim();
        if (!code || (isEditMode && code === originalCode)) {
            setCheckingCode(false);
            return resolve();
        }

        setCheckingCode(true);
        timerRef.current = setTimeout(async () => {
            try {
                let url = `/settings/company/check-code?code=${encodeURIComponent(code)}`;
                if (isEditMode) url += `&excludeId=${record.id}`;
                const res = await api.get(url);
                setCheckingCode(false);
                if (res?.data?.exists) reject('รหัสนี้มีแล้วในระบบ');
                else resolve();
            } catch (err) {
                setCheckingCode(false);
                resolve(); // ถ้าเช็คไม่ได้ ให้ผ่านไปก่อน
            }
        }, 600);
    });

    const handleOk = async () => {
        try {
            const raw = await form.validateFields();
            const payload = { ...raw };

            setLoading(true);
            let resData;

            if (isEditMode) {
                const res = await api.put(`/settings/company/${record.id}`, payload);
                message.success('อัปเดตข้อมูลสำเร็จ');
                resData = res?.data?.data;
            } else {
                const res = await api.post('/settings/company', payload);
                message.success('เพิ่มข้อมูลสำเร็จ');
                resData = res?.data?.data;
            }

            form.resetFields();
            onSuccess?.(resData || null);
            onClose?.();
        } catch (err) {
            if (err?.errorFields) return;
            message.error(err?.response?.data?.message || 'บันทึกไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose?.();
    };

    return (
        <ConfigProvider
            theme={{
                token: { colorPrimary: '#2563eb', borderRadius: 8, fontFamily: "'Prompt', 'Inter', sans-serif" },
                components: {
                    Input: { controlHeight: 42 }, // ปรับความสูง Input ให้ดู Modern
                    Button: { controlHeight: 40 }
                }
            }}
        >
            <Modal
                open={open}
                title={null}
                onCancel={handleCancel}
                footer={null}
                width={1000}
                closable={false}
                maskClosable={false}
                destroyOnClose
                centered
                styles={{ content: { padding: 0, borderRadius: '20px', overflow: 'hidden' } }}
            >
                {/* --- Header --- */}
                <div className="bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 z-50">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm text-2xl ${isEditMode ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {isEditMode ? <EditOutlined /> : <PlusCircleOutlined />}
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0, fontWeight: 700 }} className="text-slate-800">
                                {isEditMode ? 'แก้ไขข้อมูลบริษัท' : 'เพิ่มบริษัทใหม่'}
                            </Title>
                            <Text className="text-slate-500 text-sm font-light">
                                {isEditMode ? 'Company Information Update' : 'Create New Company Profile'}
                            </Text>
                        </div>
                    </div>
                    <Button type="text" onClick={handleCancel} className="text-slate-400 hover:text-slate-600 rounded-full w-10 h-10 flex items-center justify-center hover:bg-slate-100">
                        <span className="text-2xl font-light">&times;</span>
                    </Button>
                </div>

                <Spin spinning={fetching} tip="กำลังโหลดข้อมูล...">
                    <Form form={form} layout="vertical" autoComplete="off">

                        {/* --- Main Content Split Layout --- */}
                        <div className="flex flex-col md:flex-row h-auto md:h-[550px]">

                            {/* LEFT SIDE: Identity & Basic Info */}
                            <div className="w-full md:w-[340px] bg-slate-50 p-6 border-r border-gray-100 flex-shrink-0">
                                <div className="text-center mb-8 mt-2">
                                    <div className="w-32 h-32 bg-white rounded-2xl border-2 border-dashed border-slate-200 mx-auto flex flex-col items-center justify-center text-slate-400 mb-4 shadow-sm group hover:border-blue-300 transition-colors cursor-default">
                                        <BankOutlined style={{ fontSize: '48px' }} className="group-hover:text-blue-500 transition-colors" />
                                        <span className="text-xs mt-3 font-medium tracking-wide uppercase text-slate-400 group-hover:text-blue-500">Company Profile</span>
                                    </div>
                                    <div className="text-slate-500 font-medium text-sm">ข้อมูลหลักองค์กร</div>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                        <Form.Item
                                            label={<span className="text-slate-600 font-medium">รหัสบริษัท <span className="text-red-500">*</span></span>}
                                            name="company_code"
                                            rules={[{ required: true, message: 'ระบุรหัส' }, { validator: validateCode }]}
                                            hasFeedback
                                            validateStatus={checkingCode ? 'validating' : undefined}
                                            className="mb-4"
                                        >
                                            <Input prefix={<IdcardOutlined className="text-slate-400" />} placeholder="Ex. COMP-001" className="font-mono bg-slate-50" maxLength={20} />
                                        </Form.Item>

                                        <Form.Item
                                            label={<span className="text-slate-600 font-medium">ชื่อบริษัท (ไทย) <span className="text-red-500">*</span></span>}
                                            name="company_name_th"
                                            rules={[{ required: true, message: 'ระบุชื่อบริษัท' }]}
                                            className="mb-4"
                                        >
                                            <Input prefix={<TagOutlined className="text-slate-400" />} placeholder="ชื่อภาษาไทย" />
                                        </Form.Item>

                                        <Form.Item
                                            label={<span className="text-slate-600 font-medium">ชื่อบริษัท (ENG)</span>}
                                            name="company_name_en"
                                            className="mb-0"
                                        >
                                            <Input prefix={<GlobalOutlined className="text-slate-400" />} placeholder="English Name" />
                                        </Form.Item>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT SIDE: Details & Address */}
                            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-white">

                                {/* Section 1: Business Details */}
                                <div className="mb-8">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><SafetyCertificateOutlined /></div>
                                        <h3 className="text-sm font-bold text-slate-700 m-0 uppercase tracking-widest">Business Info</h3>
                                        <div className="flex-1 h-px bg-slate-100 ml-2"></div>
                                    </div>

                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item label="ประเภทธุรกิจ" name="business_type">
                                                <Input prefix={<InfoCircleOutlined className="text-slate-400" />} placeholder="เช่น ผลิตชิ้นส่วนยานยนต์" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="เลขผู้เสียภาษี (Tax ID)" name="tax_no">
                                                <Input prefix={<IdcardOutlined className="text-slate-400" />} placeholder="13 หลัก" className="font-mono" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="ชื่อสาขา (ถ้ามี)" name="branch_name">
                                                <Input prefix={<BranchesOutlined className="text-slate-400" />} placeholder="เช่น สำนักงานใหญ่" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="เบอร์โทรศัพท์" name="phone">
                                                <Input prefix={<PhoneOutlined className="text-slate-400" />} placeholder="02-xxx-xxxx" />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>

                                {/* Section 2: Location */}
                                <div>
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><EnvironmentOutlined /></div>
                                        <h3 className="text-sm font-bold text-slate-700 m-0 uppercase tracking-widest">Address & Location</h3>
                                        <div className="flex-1 h-px bg-slate-100 ml-2"></div>
                                    </div>

                                    <Row gutter={16}>
                                        <Col span={24}>
                                            <Form.Item label="ที่อยู่ (ภาษาไทย)" name="address_th">
                                                <Input.TextArea
                                                    rows={3}
                                                    placeholder="เลขที่, หมู่, ถนน, แขวง/ตำบล, เขต/อำเภอ, จังหวัด, รหัสไปรษณีย์"
                                                    className="rounded-xl"
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col span={24}>
                                            <Form.Item label="Address (English)" name="address_en">
                                                <Input.TextArea
                                                    rows={3}
                                                    placeholder="Full address in English"
                                                    className="rounded-xl"
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>

                            </div>
                        </div>
                    </Form>
                </Spin>

                {/* --- Footer --- */}
                <div className="bg-white px-6 py-4 border-t border-gray-100 flex justify-between items-center z-50 rounded-b-2xl">
                    <div>
                        {isEditMode && (
                            <Button
                                danger
                                type="text"
                                onClick={onDelete}
                                disabled={loading || fetching}
                                icon={<DeleteOutlined />}
                                className="hover:bg-red-50 text-red-500 font-medium"
                            >
                                ลบข้อมูลบริษัท
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button
                            type="primary"
                            loading={loading}
                            onClick={handleOk}
                            icon={<SaveOutlined />}
                            className="px-6 rounded-lg shadow-lg shadow-blue-200 bg-blue-600 hover:bg-blue-500 font-medium"
                        >
                            {isEditMode ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}
                        </Button>
                        <Button
                            onClick={handleCancel}
                            disabled={loading}
                            className="px-6 rounded-lg border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300"
                        >
                            ยกเลิก
                        </Button>
                    </div>
                </div>
            </Modal>
        </ConfigProvider>
    );
}

export default ModalForm;