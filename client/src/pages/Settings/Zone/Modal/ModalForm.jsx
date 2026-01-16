import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Form, Input, App, Button, ConfigProvider, Spin, Typography } from 'antd';
import {
    IdcardOutlined, TagOutlined, PlusCircleOutlined, EditOutlined,
    SaveOutlined, DeleteOutlined, BorderOuterOutlined,
    InfoCircleOutlined, EnvironmentOutlined
} from '@ant-design/icons';
import api from "../../../../api";

const { Title, Text } = Typography;

function ModalForm({ open, record, onClose, onSuccess, onDelete }) {
    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };
    const [form] = Form.useForm();

    // ตรวจสอบโหมด
    const isEditMode = !!record?.G_ID;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [checkingCode, setCheckingCode] = useState(false);
    const [originalCode, setOriginalCode] = useState(null);

    const timerRef = useRef(null);

    // ดึงข้อมูลโซน (Edit Mode)
    const fetchDetail = useCallback(async (id) => {
        try {
            setFetching(true);
            const res = await api.get(`/settings/zone/${id}`);
            const data = res?.data?.data;
            if (data) {
                form.setFieldsValue({
                    G_CODE: data.G_CODE || '',
                    G_NAME: data.G_NAME || '',
                });
                setOriginalCode(data.G_CODE || null);
            }
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลโซนไม่สำเร็จ');
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
                form.setFieldsValue({
                    G_CODE: record.G_CODE || '',
                    G_NAME: record.G_NAME || '',
                });
                setOriginalCode(record.G_CODE || null);
                fetchDetail(record.G_ID);
            }
        }
    }, [open, isEditMode, record, form, fetchDetail]);

    // Validation Check Code
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
                let url = `/settings/zone/check-code?code=${encodeURIComponent(code)}`;
                if (isEditMode) url += `&excludeId=${record.G_ID}`;
                const res = await api.get(url);
                setCheckingCode(false);
                if (res?.data?.exists) reject('รหัสโซนนี้มีแล้วในระบบ');
                else resolve();
            } catch (err) {
                setCheckingCode(false);
                console.error(err);
                resolve();
            }
        }, 500);
    });

    const handleOk = async () => {
        try {
            const raw = await form.validateFields();
            const payload = {
                G_CODE: (raw.G_CODE || '').trim(),
                G_NAME: (raw.G_NAME || '').trim(),
            };

            setLoading(true);
            let resData;
            if (isEditMode) {
                const res = await api.put(`/settings/zone/${record.G_ID}`, payload);
                message.success('อัปเดตข้อมูลสำเร็จ');
                resData = res?.data?.data;
            } else {
                const res = await api.post('/settings/zone', payload);
                message.success('เพิ่มข้อมูลสำเร็จ');
                resData = res?.data?.data;
            }
            form.resetFields();
            onSuccess?.(resData || null);
            onClose?.();
        } catch (err) {
            if (err?.errorFields) return;
            const apiMsg = err?.response?.data?.message || (isEditMode ? 'อัปเดตไม่สำเร็จ' : 'เพิ่มข้อมูลไม่สำเร็จ');
            message.error(apiMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => { form.resetFields(); onClose?.(); };

    return (
        <ConfigProvider
            theme={{
                token: { colorPrimary: '#2563eb', borderRadius: 8, fontFamily: "'Prompt', 'Inter', sans-serif" },
                components: {
                    Input: { controlHeight: 40 },
                    Button: { controlHeight: 40 }
                }
            }}
        >
            <Modal
                open={open}
                title={null}
                onCancel={handleCancel}
                footer={null}
                width={850} // ขยายความกว้างสำหรับ Split Layout
                closable={false}
                centered
                maskClosable={false}
                destroyOnClose
                styles={{ content: { padding: 0, borderRadius: '20px', overflow: 'hidden' } }}
            >
                {/* --- Header --- */}
                <div className="bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 z-50">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm text-2xl ${isEditMode ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                            {isEditMode ? <EditOutlined /> : <PlusCircleOutlined />}
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0, fontWeight: 700 }} className="text-slate-800">
                                {isEditMode ? 'แก้ไขข้อมูลโซน' : 'เพิ่มโซนใหม่'}
                            </Title>
                            <Text className="text-slate-500 text-sm font-light">
                                {isEditMode ? 'Zone Information Update' : 'Create New Zone'}
                            </Text>
                        </div>
                    </div>
                    <Button type="text" onClick={handleCancel} className="text-slate-400 hover:text-slate-600 rounded-full w-10 h-10 flex items-center justify-center hover:bg-slate-100">
                        <span className="text-2xl font-light">&times;</span>
                    </Button>
                </div>

                <Spin spinning={fetching} tip="กำลังโหลดข้อมูล...">
                    <Form form={form} layout="vertical" autoComplete="off">

                        {/* --- Split Layout --- */}
                        <div className="flex flex-col md:flex-row h-auto md:h-[400px]">

                            {/* LEFT SIDE: Identity (Code) */}
                            <div className="w-full md:w-[300px] bg-slate-50 p-6 border-r border-gray-100 flex-shrink-0">
                                <div className="text-center mb-8 mt-4">
                                    <div className="w-32 h-32 bg-white rounded-2xl border-2 border-dashed border-slate-200 mx-auto flex flex-col items-center justify-center text-slate-400 mb-4 shadow-sm group hover:border-orange-300 transition-colors cursor-default">
                                        <BorderOuterOutlined style={{ fontSize: '48px' }} className="group-hover:text-orange-500 transition-colors" />
                                        <span className="text-xs mt-3 font-medium tracking-wide uppercase text-slate-400 group-hover:text-orange-500">Zone Area</span>
                                    </div>
                                    <div className="text-slate-500 font-medium text-sm">ข้อมูลหลักโซน</div>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                        <Form.Item
                                            label={<span className="text-slate-600 font-medium">รหัสโซน <span className="text-red-500">*</span></span>}
                                            name="G_CODE"
                                            rules={[{ required: true, message: 'ระบุรหัสโซน' }, { validator: validateCode }]}
                                            hasFeedback
                                            validateStatus={checkingCode ? 'validating' : undefined}
                                            className="mb-0"
                                        >
                                            <Input prefix={<IdcardOutlined className="text-slate-400" />} placeholder="เช่น Z-01" className="font-mono bg-slate-50" maxLength={20} />
                                        </Form.Item>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT SIDE: Details (Name) */}
                            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-white">

                                {/* Section 1: General Info */}
                                <div className="mb-8">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><EnvironmentOutlined /></div>
                                        <h3 className="text-sm font-bold text-slate-700 m-0 uppercase tracking-widest">General Information</h3>
                                        <div className="flex-1 h-px bg-slate-100 ml-2"></div>
                                    </div>

                                    <Form.Item
                                        label="ชื่อโซน (Zone Name)"
                                        name="G_NAME"
                                        rules={[{ required: true, message: 'กรุณาระบุชื่อโซน' }]}
                                    >
                                        <Input prefix={<TagOutlined className="text-slate-400" />} placeholder="ระบุชื่อโซนพื้นที่" />
                                    </Form.Item>

                                    {/* Placeholder for future fields or description */}
                                    <div className="bg-blue-50/50 rounded-lg p-4 flex gap-3 items-start mt-6">
                                        <InfoCircleOutlined className="text-blue-500 mt-1" />
                                        <div className="text-xs text-blue-600/80 leading-relaxed">
                                            โซนคือการกำหนดพื้นที่หรืออาณาเขตเพื่อใช้ในการแบ่งกลุ่มข้อมูลอื่นๆ เช่น ที่ตั้งของคลังสินค้า หรือ พื้นที่รับผิดชอบ
                                        </div>
                                    </div>
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
                                disabled={loading}
                                icon={<DeleteOutlined />}
                                className="hover:bg-red-50 text-red-500 font-medium"
                            >
                                ลบข้อมูล
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