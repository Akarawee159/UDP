// src/pages/Masterdata/Location/Modal/ModalForm.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Form, Input, App, Button, ConfigProvider, Spin } from 'antd';
import {
    IdcardOutlined,
    TagOutlined,
    PlusCircleOutlined,
    EditOutlined,
    SaveOutlined
} from '@ant-design/icons';
import api from "../../../../api";

function ModalForm({ open, record, onClose, onSuccess }) {
    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };
    const [form] = Form.useForm();
    const isEditMode = !!record?.G_ID;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [checkingCode, setCheckingCode] = useState(false);
    const [originalCode, setOriginalCode] = useState(null);

    const timerRef = useRef(null);

    const fetchDetail = useCallback(async (id) => {
        try {
            setFetching(true);
            const res = await api.get(`/settings/area/${id}`);
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
            message.error('ดึงข้อมูลโลเคชั่นไม่สำเร็จ');
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

    // Validation เช็ค Code ซ้ำ
    const validateCode = (_rule, value) => new Promise((resolve, reject) => {
        const code = (value || '').trim();
        if (!code) return resolve();
        if (isEditMode && code === originalCode) return resolve();

        if (timerRef.current) clearTimeout(timerRef.current);
        setCheckingCode(true);

        timerRef.current = setTimeout(async () => {
            try {
                const res = await api.get('/settings/area/check-code', {
                    params: { code, excludeId: isEditMode ? record.G_ID : undefined }
                });
                setCheckingCode(false);
                if (res.data?.exists) {
                    reject(new Error('รหัสโลเคชั่นนี้มีอยู่ในระบบแล้ว'));
                } else {
                    resolve();
                }
            } catch (err) {
                setCheckingCode(false);
                reject(new Error('ไม่สามารถตรวจสอบรหัสซ้ำได้'));
            }
        }, 600);
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
                const res = await api.put(`/settings/area/${record.G_ID}`, payload);
                message.success('อัปเดตข้อมูลสำเร็จ');
                resData = res?.data?.data;
            } else {
                const res = await api.post('/settings/area', payload);
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
        <ConfigProvider theme={{ token: { colorPrimary: '#2563eb', borderRadius: 8 } }}>
            <Modal
                open={open}
                title={null}
                onCancel={handleCancel}
                footer={null}
                width={480}
                closable={false}
                centered
                maskClosable={!loading}
                destroyOnClose
                styles={{ content: { padding: 0, borderRadius: '16px', overflow: 'hidden' } }}
            >
                {/* Header */}
                <div className="bg-slate-200 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-800">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-600 text-xl">
                            {isEditMode ? <EditOutlined /> : <PlusCircleOutlined />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold m-0 leading-tight">
                                {isEditMode ? 'แก้ไขข้อมูลโลเคชั่น' : 'เพิ่มข้อมูลโลเคชั่น'}
                            </h3>
                            <span className="text-xs text-slate-700">
                                {isEditMode ? 'ปรับปรุงรายละเอียดโลเคชั่นเดิม' : 'สร้างโลเคชั่นใหม่ในระบบ'}
                            </span>
                        </div>
                    </div>
                    <button onClick={handleCancel} disabled={loading} className="text-slate-400 hover:text-slate-700 transition-colors text-3xl">&times;</button>
                </div>

                <Spin spinning={fetching} tip="กำลังโหลดข้อมูล...">
                    <div className="p-8">
                        <Form form={form} layout="vertical" autoComplete="off" className="space-y-2">
                            <Form.Item label={<span className="font-semibold text-gray-700">รหัสโลเคชั่น</span>} name="G_CODE" rules={[{ required: true, message: 'กรุณาระบุรหัสโลเคชั่น' }, { validator: validateCode }]} hasFeedback validateStatus={checkingCode ? 'validating' : undefined}>
                                <Input prefix={<IdcardOutlined className="text-gray-400" />} placeholder="เช่น ZONE01" className="h-11 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400 bg-gray-50 focus:bg-white transition-all" allowClear />
                            </Form.Item>
                            <Form.Item label={<span className="font-semibold text-gray-700">ชื่อโลเคชั่น</span>} name="G_NAME" rules={[{ required: true, message: 'กรุณาระบุชื่อโลเคชั่น' }]}>
                                <Input prefix={<TagOutlined className="text-gray-400" />} placeholder="ระบุชื่อโลเคชั่น" className="h-11 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400 bg-gray-50 focus:bg-white transition-all" allowClear />
                            </Form.Item>
                        </Form>
                    </div>
                </Spin>

                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <Button key="submit" type="primary" loading={loading} onClick={handleOk} icon={<SaveOutlined />} className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 border-none shadow-md shadow-blue-200 font-semibold">
                        {isEditMode ? 'บันทึกการเปลี่ยนแปลง' : 'บันทึกข้อมูล'}
                    </Button>
                    <Button key="back" onClick={handleCancel} disabled={loading} className="h-10 px-6 rounded-lg border-gray-300 text-gray-600 hover:text-gray-800 hover:border-gray-400 hover:bg-white">
                        ยกเลิก
                    </Button>
                </div>
            </Modal>
        </ConfigProvider>
    );
}

export default ModalForm;