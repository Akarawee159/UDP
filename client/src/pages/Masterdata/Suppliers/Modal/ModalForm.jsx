import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Form, Input, App, Button, ConfigProvider, Spin, Row, Col, Typography } from 'antd';
import {
    IdcardOutlined, TagOutlined, EditOutlined, SaveOutlined,
    DeleteOutlined, PlusCircleOutlined, BankOutlined,
    InfoCircleOutlined, PhoneOutlined, SafetyCertificateOutlined,
    BranchesOutlined, EnvironmentOutlined, BarcodeOutlined
} from '@ant-design/icons';
import api from "../../../../api";

const { Title, Text } = Typography;

function ModalForm({ open, record, onClose, onSuccess, onDelete }) {
    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };
    const [form] = Form.useForm();

    // ใช้ supplier_code เป็นตัวเช็คว่าเป็น Edit Mode
    const isEditMode = !!record?.supplier_code;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    // State สำหรับสถานะการตรวจสอบซ้ำ
    const [checkingCode1, setCheckingCode1] = useState(false);
    const [checkingCode2, setCheckingCode2] = useState(false);

    // เก็บค่าเดิมไว้เปรียบเทียบตอนแก้ไข
    const [originalCode, setOriginalCode] = useState(null);

    const timerRef = useRef(null);

    // ฟังก์ชันดึงรายละเอียด (กรณี Edit)
    const fetchDetail = useCallback(async (code) => {
        try {
            setFetching(true);
            const res = await api.get(`/masterdata/supplier/${encodeURIComponent(code)}`);
            const data = res?.data?.data;
            if (data) {
                form.setFieldsValue(data);
                setOriginalCode(data.supplier_code); // จำ code หลักเดิมไว้
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
                // Set ค่าเบื้องต้นจาก record ก่อน fetch
                form.setFieldsValue(record);
                setOriginalCode(record.supplier_code);
                fetchDetail(record.supplier_code);
            }
        }
    }, [open, isEditMode, record, form, fetchDetail]);

    // --- Dynamic Validator Check ---
    const checkDuplicateApi = async (field, value) => {
        let url = `/masterdata/supplier/check-duplicate?field=${field}&value=${encodeURIComponent(value)}`;
        // ถ้าแก้ไข ให้ส่ง excludeCode ไปด้วย (ส่งค่า PK เดิม)
        if (isEditMode && originalCode) {
            url += `&excludeCode=${encodeURIComponent(originalCode)}`;
        }
        const res = await api.get(url);
        return res?.data?.exists;
    };

    const validateField = (fieldName, setChecking) => (_rule, value) => new Promise((resolve, reject) => {
        clearTimeout(timerRef.current);
        const inputVal = (value || '').trim();

        // ถ้าไม่มีค่า หรือ (ในโหมดแก้ไข และค่าเท่ากับค่าใน record เดิม) ไม่ต้องเช็ค
        if (!inputVal || (isEditMode && record && inputVal === record[fieldName])) {
            setChecking(false);
            return resolve();
        }

        setChecking(true);
        // Debounce 600ms
        timerRef.current = setTimeout(async () => {
            try {
                const isDup = await checkDuplicateApi(fieldName, inputVal);
                setChecking(false);
                if (isDup) reject('รหัสนี้มีในระบบแล้ว');
                else resolve();
            } catch (err) {
                setChecking(false);
                resolve(); // ถ้า error ให้ผ่านไปก่อน
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
                // ส่ง PUT ไปที่ originalCode (เพราะ user อาจแก้ supplier_code ใหม่)
                const res = await api.put(`/masterdata/supplier/${encodeURIComponent(originalCode)}`, payload);
                message.success('อัปเดตข้อมูลสำเร็จ');
                resData = res?.data?.data;
            } else {
                const res = await api.post('/masterdata/supplier', payload);
                message.success('เพิ่มข้อมูลสำเร็จ');
                resData = res?.data?.data;
            }

            form.resetFields();
            onSuccess?.(resData);
            onClose?.();
        } catch (err) {
            if (err?.errorFields) return;
            message.error(err?.response?.data?.message || 'บันทึกไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ConfigProvider
            theme={{
                token: { colorPrimary: '#2563eb', borderRadius: 8, fontFamily: "'Prompt', 'Inter', sans-serif" },
                components: { Input: { controlHeight: 42 }, Button: { controlHeight: 40 } }
            }}
        >
            <Modal
                open={open}
                title={null}
                onCancel={onClose}
                footer={null}
                width={1000}
                closable={false}
                maskClosable={false}
                destroyOnClose
                centered
                styles={{ content: { padding: 0, borderRadius: '20px', overflow: 'hidden' } }}
            >
                {/* Header */}
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
                                Supplier Management
                            </Text>
                        </div>
                    </div>
                    <Button type="text" onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-full w-10 h-10 flex items-center justify-center hover:bg-slate-100">
                        <span className="text-2xl font-light">&times;</span>
                    </Button>
                </div>

                <Spin spinning={fetching} tip="กำลังโหลด...">
                    <Form form={form} layout="vertical" autoComplete="off">
                        <div className="flex flex-col md:flex-row h-auto md:h-[550px]">

                            {/* LEFT SIDE: Codes & Basic Info */}
                            <div className="w-full md:w-[340px] bg-slate-50 p-6 border-r border-gray-100 flex-shrink-0">
                                <div className="text-center mb-8 mt-2">
                                    <div className="w-32 h-32 bg-white rounded-2xl border-2 border-dashed border-slate-200 mx-auto flex flex-col items-center justify-center text-slate-400 mb-4 shadow-sm group hover:border-blue-300 transition-colors cursor-default">
                                        <BankOutlined style={{ fontSize: '48px' }} className="group-hover:text-blue-500 transition-colors" />
                                    </div>
                                    <div className="text-slate-500 font-medium text-sm">ข้อมูลหลักองค์กร</div>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                        {/* รหัสย่อ */}
                                        <Form.Item
                                            label={<span className="text-slate-600 font-medium">รหัสย่อ <span className="text-red-500">*</span></span>}
                                            name="supplier_code"
                                            rules={[
                                                { required: true, message: 'ระบุรหัส' },
                                                { validator: validateField('supplier_code', setCheckingCode1) }
                                            ]}
                                            hasFeedback
                                            validateStatus={checkingCode1 ? 'validating' : undefined}
                                            className="mb-4"
                                        >
                                            <Input prefix={<IdcardOutlined className="text-slate-400" />} placeholder="Ex. SUP-EXT-001" className="font-mono bg-slate-50" />
                                        </Form.Item>

                                        {/* รหัสลูกค้าภายใน (เพิ่มใหม่) */}
                                        <Form.Item
                                            label={<span className="text-slate-600 font-medium">รหัสลูกค้า</span>}
                                            name="supplier_code2"
                                            rules={[
                                                { validator: validateField('supplier_code2', setCheckingCode2) }
                                            ]}
                                            hasFeedback
                                            validateStatus={checkingCode2 ? 'validating' : undefined}
                                            className="mb-4"
                                        >
                                            <Input prefix={<BarcodeOutlined className="text-slate-400" />} placeholder="Ex. INT-001" className="font-mono bg-slate-50" />
                                        </Form.Item>

                                    </div>
                                </div>
                            </div>

                            {/* RIGHT SIDE: Details */}
                            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-white">
                                <div className="mb-8">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><SafetyCertificateOutlined /></div>
                                        <h3 className="text-sm font-bold text-slate-700 m-0 uppercase tracking-widest">Business Info</h3>
                                        <div className="flex-1 h-px bg-slate-100 ml-2"></div>
                                    </div>
                                    {/* ... Fields อื่นๆ เหมือนเดิม ... */}
                                    <Row gutter={16}>
                                        <Col span={24}>
                                            <Form.Item
                                                label={<span className="text-slate-600 font-medium">ชื่อบริษัท<span className="text-red-500">*</span></span>}
                                                name="supplier_name"
                                                rules={[{ required: true, message: 'ระบุชื่อบริษัท' }]}
                                                className="mb-0"
                                            >
                                                <Input prefix={<TagOutlined className="text-slate-400" />} placeholder="ระบุชื่อบริษัท" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="ประเภทธุรกิจ" name="supplier_type">
                                                <Input prefix={<InfoCircleOutlined className="text-slate-400" />} />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="เลขผู้เสียภาษี (Tax ID)" name="tax_id">
                                                <Input prefix={<IdcardOutlined className="text-slate-400" />} />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="ชื่อสาขา (ถ้ามี)" name="branch_name">
                                                <Input prefix={<BranchesOutlined className="text-slate-400" />} />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="เบอร์โทรบริษัท" name="contact_phone">
                                                <Input prefix={<PhoneOutlined className="text-slate-400" />} />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="เบอร์โทรศัพท์" name="supplier_phone">
                                                <Input prefix={<PhoneOutlined className="text-slate-400" />} />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="ชื่อผู้ติดต่อ" name="contact_name">
                                                <Input prefix={<BranchesOutlined className="text-slate-400" />} />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>

                                <div>
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><EnvironmentOutlined /></div>
                                        <h3 className="text-sm font-bold text-slate-700 m-0 uppercase tracking-widest">Address & Location</h3>
                                        <div className="flex-1 h-px bg-slate-100 ml-2"></div>
                                    </div>
                                    <Row gutter={16}>
                                        <Col span={24}>
                                            <Form.Item label="ที่อยู่" name="supplier_address">
                                                <Input.TextArea rows={3} className="rounded-xl" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={24}>
                                            <Form.Item label="หมายเหตุ" name="remark">
                                                <Input.TextArea rows={3} className="rounded-xl" />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>
                            </div>
                        </div>
                    </Form>
                </Spin>

                <div className="bg-white px-6 py-4 border-t border-gray-100 flex justify-between items-center z-50 rounded-b-2xl">
                    <div>
                        {isEditMode && (
                            <Button danger type="text" onClick={onDelete} disabled={loading || fetching} icon={<DeleteOutlined />}>
                                ลบข้อมูลบริษัท
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button type="primary" loading={loading} onClick={handleOk} icon={<SaveOutlined />} className="px-6 bg-blue-600 hover:bg-blue-500">
                            {isEditMode ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}
                        </Button>
                        <Button onClick={onClose} disabled={loading}>ยกเลิก</Button>
                    </div>
                </div>
            </Modal>
        </ConfigProvider>
    );
}
export default ModalForm;