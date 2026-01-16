import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Form, Input, App, Button, ConfigProvider, Spin, InputNumber, Row, Col, Select, Typography } from 'antd';
import {
    IdcardOutlined, TagOutlined, EditOutlined, SaveOutlined,
    DeleteOutlined, CodepenOutlined, ExpandAltOutlined, DeploymentUnitOutlined,
    ColumnWidthOutlined, ColumnHeightOutlined, GatewayOutlined
} from '@ant-design/icons';
import api from "../../../../api";

const { Title, Text } = Typography;

function ModalForm({ open, record, onClose, onSuccess, onDelete }) {
    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };
    const [form] = Form.useForm();
    const isEditMode = !!record?.G_ID;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [checkingCode, setCheckingCode] = useState(false);
    const [originalCode, setOriginalCode] = useState(null);
    const [unitOptions, setUnitOptions] = useState([]);
    const timerRef = useRef(null);

    // Fetch Units
    const fetchUnits = useCallback(async () => {
        try {
            const res = await api.get('/settings/countingunit');
            const units = res?.data?.data || [];
            const options = units
                .map(u => ({ label: u.G_NAME, value: u.G_NAME }))
                .filter((v, i, a) => a.findIndex(t => t.value === v.value) === i);
            setUnitOptions(options);
        } catch (err) {
            console.error('Failed to fetch counting units', err);
        }
    }, []);

    const fetchDetail = useCallback(async (id) => {
        try {
            setFetching(true);
            const res = await api.get(`/settings/packaging/${id}`);
            const data = res?.data?.data;
            if (data) {
                form.setFieldsValue(data);
                setOriginalCode(data.G_CODE || null);
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
            fetchUnits();
            clearTimeout(timerRef.current);
            form.resetFields();
            setOriginalCode(null);

            if (isEditMode) {
                form.setFieldsValue(record);
                setOriginalCode(record.G_CODE || null);
                fetchDetail(record.G_ID);
            }
        }
    }, [open, isEditMode, record, form, fetchDetail, fetchUnits]);

    // Validation
    const validateCode = (_rule, value) => new Promise((resolve, reject) => {
        const code = (value || '').trim();
        if (!code) return resolve();
        if (isEditMode && code === originalCode) return resolve();
        if (timerRef.current) clearTimeout(timerRef.current);
        setCheckingCode(true);
        timerRef.current = setTimeout(async () => {
            try {
                const res = await api.get('/settings/packaging/check-code', {
                    params: { code, excludeId: isEditMode ? record.G_ID : undefined }
                });
                setCheckingCode(false);
                if (res.data?.exists) reject(new Error('รหัสซ้ำ'));
                else resolve();
            } catch (err) {
                setCheckingCode(false);
                reject(new Error('ตรวจสอบล้มเหลว'));
            }
        }, 600);
    });

    const handleOk = async () => {
        try {
            const raw = await form.validateFields();
            const payload = {
                ...raw,
                G_CODE: (raw.G_CODE || '').trim(),
                G_NAME: (raw.G_NAME || '').trim(),
            };

            setLoading(true);
            let resData;
            if (isEditMode) {
                const res = await api.put(`/settings/packaging/${record.G_ID}`, payload);
                message.success('อัปเดตข้อมูลสำเร็จ');
                resData = res?.data?.data;
            } else {
                const res = await api.post('/settings/packaging', payload);
                message.success('เพิ่มข้อมูลสำเร็จ');
                resData = res?.data?.data;
            }
            form.resetFields();
            onSuccess?.(resData || null);
            onClose?.();
        } catch (err) {
            if (err?.errorFields) return;
            const apiMsg = err?.response?.data?.message || 'เกิดข้อผิดพลาด';
            message.error(apiMsg);
        } finally {
            setLoading(false);
        }
    };

    // --- Components ---
    const SpecInput = ({ label, fieldName, unitName, placeholder, icon }) => (
        <div className="mb-4">
            <div className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                {icon} {label}
            </div>
            <div className="flex">
                <Form.Item name={fieldName} noStyle>
                    <InputNumber
                        placeholder={placeholder}
                        className="!rounded-r-none flex-1 border-r-0"
                        min={0}
                        precision={2}
                    />
                </Form.Item>
                <Form.Item name={unitName} noStyle>
                    <Select
                        options={unitOptions}
                        placeholder="หน่วย"
                        style={{ width: 90 }}
                        className="custom-select-right"
                        showSearch
                        allowClear
                        // ✅ แก้ไข: ให้ Dropdown ขยายความกว้างตามเนื้อหา ไม่ถูกจำกัดแค่ 90px
                        popupMatchSelectWidth={false}
                        dropdownStyle={{ minWidth: 120 }}
                        // ✅ แก้ไข: ป้องกันการถูก Modal บัง (Render ไปที่ Body)
                        getPopupContainer={(trigger) => document.body}
                    />
                </Form.Item>
            </div>
        </div>
    );

    return (
        <ConfigProvider
            theme={{
                token: { colorPrimary: '#2563eb', borderRadius: 8, fontFamily: "'Prompt', 'Inter', sans-serif" },
                components: {
                    Input: { controlHeight: 40 },
                    InputNumber: { controlHeight: 40 },
                    Select: { controlHeight: 40 },
                    Button: { controlHeight: 40 }
                }
            }}
        >
            <Modal
                open={open}
                title={null}
                onCancel={() => { form.resetFields(); onClose?.(); }}
                footer={null}
                width={900}
                closable={false}
                centered
                maskClosable={false}
                destroyOnClose
                // ✅ เอา overflow: hidden ออก เพื่อให้ Dropdown ไม่ถูกตัดถ้ามันยาวทะลุ Modal
                styles={{ content: { padding: 0, borderRadius: '20px' } }}
            >
                {/* --- Header (เพิ่ม rounded-t-2xl เพื่อให้มุมบนยังโค้งอยู่) --- */}
                <div className="bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 z-50 rounded-t-2xl">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm text-2xl ${isEditMode ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                            {isEditMode ? <EditOutlined /> : <CodepenOutlined />}
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0, fontWeight: 700 }} className="text-slate-800">
                                {isEditMode ? 'แก้ไขบรรจุภัณฑ์' : 'เพิ่มบรรจุภัณฑ์'}
                            </Title>
                            <Text className="text-slate-500 text-sm">
                                {isEditMode ? 'Packaging Settings' : 'Create New Packaging'}
                            </Text>
                        </div>
                    </div>
                    <Button type="text" onClick={() => onClose?.()} className="text-slate-400 hover:text-slate-600 rounded-full w-10 h-10 flex items-center justify-center">
                        <span className="text-2xl font-light">&times;</span>
                    </Button>
                </div>

                <Spin spinning={fetching} tip="กำลังโหลดข้อมูล...">
                    <Form form={form} layout="vertical" autoComplete="off">
                        {/* ✅ เพิ่ม rounded-b-2xl ที่ container หลักแทน */}
                        <div className="flex flex-col md:flex-row h-[60vh] md:h-[500px]">

                            {/* --- LEFT: Identity --- */}
                            <div className="w-full md:w-[320px] bg-slate-50 p-6 border-r border-gray-100 flex-shrink-0 overflow-y-auto">
                                <div className="text-center mb-6">
                                    <div className="w-32 h-32 bg-white rounded-xl border-2 border-dashed border-slate-200 mx-auto flex flex-col items-center justify-center text-slate-300 mb-4">
                                        <CodepenOutlined style={{ fontSize: '48px' }} />
                                        <span className="text-xs mt-2">Packaging Model</span>
                                    </div>
                                    <div className="text-slate-500 text-sm">ระบุข้อมูลพื้นฐาน</div>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                        <Form.Item label="รหัส (Code)" name="G_CODE" rules={[{ required: true, message: 'ระบุรหัส' }, { validator: validateCode }]} hasFeedback validateStatus={checkingCode ? 'validating' : undefined} className="mb-4">
                                            <Input prefix={<IdcardOutlined className="text-slate-400" />} placeholder="Ex. BOX-A4" className="font-mono" maxLength={20} />
                                        </Form.Item>
                                        <Form.Item label="ชื่อบรรจุภัณฑ์" name="G_NAME" rules={[{ required: true, message: 'ระบุชื่อ' }]} className="mb-0">
                                            <Input prefix={<TagOutlined className="text-slate-400" />} placeholder="ชื่อเรียก" />
                                        </Form.Item>
                                    </div>
                                </div>
                            </div>

                            {/* --- RIGHT: Specifications --- */}
                            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-white">

                                {/* Section 1: Dimensions */}
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><ExpandAltOutlined /></div>
                                        <h3 className="text-sm font-bold text-slate-700 m-0 uppercase tracking-wide">Dimension Specs</h3>
                                        <div className="flex-1 h-px bg-gray-100 ml-2"></div>
                                    </div>

                                    <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100">
                                        <Row gutter={16}>
                                            <Col span={8}>
                                                <SpecInput label="ความกว้าง" fieldName="G_WIDTH" unitName="G_WIDTH_UNIT" placeholder="0.00" icon={<ColumnWidthOutlined />} />
                                            </Col>
                                            <Col span={8}>
                                                <SpecInput label="ความยาว" fieldName="G_LENGTH" unitName="G_LENGTH_UNIT" placeholder="0.00" icon={<ColumnHeightOutlined className="rotate-90" />} />
                                            </Col>
                                            <Col span={8}>
                                                <SpecInput label="ความสูง" fieldName="G_HEIGHT" unitName="G_HEIGHT_UNIT" placeholder="0.00" icon={<ColumnHeightOutlined />} />
                                            </Col>
                                        </Row>
                                        <div className="text-xs text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
                                            <div className="w-16 h-px bg-slate-200"></div>
                                            <span>กว้าง x ยาว x สูง</span>
                                            <div className="w-16 h-px bg-slate-200"></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Properties */}
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><DeploymentUnitOutlined /></div>
                                        <h3 className="text-sm font-bold text-slate-700 m-0 uppercase tracking-wide">Capacity & Weight</h3>
                                        <div className="flex-1 h-px bg-gray-100 ml-2"></div>
                                    </div>

                                    <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100">
                                        <Row gutter={16}>
                                            <Col span={12}>
                                                <SpecInput label="ความจุ (Capacity)" fieldName="G_CAPACITY" unitName="G_CAPACITY_UNIT" placeholder="0.00" icon={<GatewayOutlined />} />
                                            </Col>
                                            <Col span={12}>
                                                <SpecInput label="น้ำหนัก (Weight)" fieldName="G_WEIGHT" unitName="G_WEIGHT_UNIT" placeholder="0.00" icon={<span className="font-bold">W</span>} />
                                            </Col>
                                        </Row>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </Form>
                </Spin>

                {/* --- Footer (เพิ่ม rounded-b-2xl) --- */}
                <div className="bg-white px-6 py-4 border-t border-gray-100 flex justify-between items-center rounded-b-2xl">
                    <div>
                        {isEditMode && (
                            <Button danger type="text" onClick={onDelete} disabled={loading} icon={<DeleteOutlined />} className="hover:bg-red-50">
                                ลบข้อมูล
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button type="primary" loading={loading} onClick={handleOk} icon={<SaveOutlined />} className="px-6 rounded-lg shadow-lg shadow-blue-200">
                            {isEditMode ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}
                        </Button>
                        <Button onClick={() => { form.resetFields(); onClose?.(); }} disabled={loading} className="px-6 rounded-lg">
                            ยกเลิก
                        </Button>
                    </div>
                </div>
            </Modal>

            <style>{`
                .custom-select-right .ant-select-selector {
                    border-top-left-radius: 0 !important;
                    border-bottom-left-radius: 0 !important;
                    background-color: #f8fafc !important;
                }
            `}</style>
        </ConfigProvider>
    );
}

export default ModalForm;