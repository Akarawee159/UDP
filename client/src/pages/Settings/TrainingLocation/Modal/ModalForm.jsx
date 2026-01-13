import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Form, Input, App, Button, ConfigProvider, Spin } from 'antd';
import {
    IdcardOutlined,
    TagOutlined,
    PlusCircleOutlined,
    EditOutlined,
    SaveOutlined,
} from '@ant-design/icons';
import api from "../../../../api";

function ModalForm({ open, record, onClose, onSuccess }) {
    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };
    const [form] = Form.useForm();

    // ตรวจสอบโหมด: ถ้ามี record ส่งมา = Edit Mode
    const isEditMode = !!record?.G_ID;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [checkingCode, setCheckingCode] = useState(false);
    const [originalCode, setOriginalCode] = useState(null);

    const timerRef = useRef(null);

    // 1. ฟังก์ชันดึงข้อมูลล่าสุด (เฉพาะ Edit Mode)
    const fetchDetail = useCallback(async (id) => {
        try {
            setFetching(true);
            const res = await api.get(`/training-location/${id}`);
            const data = res?.data?.data;
            if (data) {
                form.setFieldsValue({
                    G_CODE: data.G_CODE || '',
                    G_NAME: data.G_NAME || '',
                    G_NAME_EN: data.G_NAME_EN || '',
                });
                setOriginalCode(data.G_CODE || null);
            }
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลสถานที่อบรมไม่สำเร็จ');
        } finally {
            setFetching(false);
        }
    }, [form, message]);

    // 2. Effect เมื่อเปิด Modal
    useEffect(() => {
        if (open) {
            form.resetFields();
            setOriginalCode(null);

            if (isEditMode) {
                form.setFieldsValue({
                    G_CODE: record.G_CODE || '',
                    G_NAME: record.G_NAME || '',
                    G_NAME_EN: record.G_NAME_EN || '',
                });
                setOriginalCode(record.G_CODE || null);
                fetchDetail(record.G_ID);
            }
        }
    }, [open, isEditMode, record, form, fetchDetail]);

    // 3. ฟังก์ชันตรวจสอบรหัสซ้ำ (Debounce)
    const validateCode = (_rule, value) =>
        new Promise((resolve, reject) => {
            clearTimeout(timerRef.current);

            if (!value || (isEditMode && value === originalCode)) {
                setCheckingCode(false);
                return resolve();
            }

            timerRef.current = setTimeout(async () => {
                try {
                    setCheckingCode(true);
                    let url = `/training-location/check-code?code=${encodeURIComponent(value)}`;
                    if (isEditMode) {
                        url += `&excludeId=${record.G_ID}`;
                    }

                    const res = await api.get(url);
                    if (res?.data?.exists) {
                        reject('รหัสนี้มีแล้วในระบบ');
                    } else {
                        resolve();
                    }
                } catch (err) {
                    console.error(err);
                    resolve();
                } finally {
                    setCheckingCode(false);
                }
            }, 400);
        });

    // 4. Submit Form
    const handleOk = async () => {
        try {
            const raw = await form.validateFields();
            const payload = {
                G_CODE: (raw.G_CODE || '').trim(),
                G_NAME: (raw.G_NAME || '').trim(),
                G_NAME_EN: (raw.G_NAME_EN || '').trim(),
            };

            setLoading(true);
            let resData;

            if (isEditMode) {
                const res = await api.put(`/training-location/${record.G_ID}`, payload);
                message.success('อัปเดตข้อมูลสำเร็จ');
                resData = res?.data?.data;
            } else {
                const res = await api.post('/training-location', payload);
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

    const handleCancel = () => {
        form.resetFields();
        onClose?.();
    };

    return (
        <ConfigProvider
            theme={{
                token: {
                    // เปลี่ยน Primary Color เป็น Blue 600
                    colorPrimary: '#2563eb',
                    borderRadius: 8,
                },
                components: {
                    Button: {
                        // เปลี่ยนเงาปุ่มเป็นสีน้ำเงิน
                        primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)',
                    }
                }
            }}
        >
            <Modal
                open={open}
                title={null}
                onCancel={handleCancel}
                footer={null}
                width={560}
                closable={false} // ซ่อนปุ่ม X ของ Ant Design เดิมใช้ closable 
                maskClosable={!loading}
                destroyOnClose
                className="custom-modal-training-location"
                styles={{ content: { padding: 0, borderRadius: '16px', overflow: 'hidden' } }}
            >
                {/* Header - เปลี่ยนธีมเป็นสีน้ำเงิน */}
                <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-blue-800">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-600 text-xl">
                            {isEditMode ? <EditOutlined /> : <PlusCircleOutlined />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold m-0 leading-tight">
                                {isEditMode ? 'แก้ไขข้อมูลสถานที่อบรม' : 'เพิ่มข้อมูลสถานที่อบรม'}
                            </h3>
                            <span className="text-xs text-blue-600/70">
                                {isEditMode ? 'ปรับปรุงรายละเอียดข้อมูลสถานที่อบรม' : 'กรอกข้อมูลเพื่อสร้างสถานที่อบรมใหม่'}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={handleCancel}
                        disabled={loading}
                        className="text-blue-400 hover:text-blue-700 transition-colors text-3xl"
                    >
                        &times;
                    </button>
                </div>

                <Spin spinning={fetching} tip="กำลังโหลดข้อมูล...">
                    <div className="p-8">
                        <Form
                            form={form}
                            layout="vertical"
                            autoComplete="off"
                            className="space-y-2"
                        >
                            <Form.Item
                                label={<span className="font-semibold text-gray-700">รหัสสถานที่อบรม</span>}
                                name="G_CODE"
                                rules={[
                                    { required: true, message: 'กรุณาระบุรหัสสถานที่อบรม' },
                                    { validator: validateCode },
                                ]}
                                hasFeedback
                                validateStatus={checkingCode ? 'validating' : undefined}
                            >
                                {/* เปลี่ยน Hover/Focus Border เป็นสีน้ำเงิน */}
                                <Input
                                    prefix={<IdcardOutlined className="text-gray-400" />}
                                    placeholder="เช่น DEPT01"
                                    className="h-11 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400 bg-gray-50 focus:bg-white transition-all"
                                    allowClear
                                />
                            </Form.Item>
                            <Form.Item
                                label={<span className="font-semibold text-gray-700">ชื่อสถานที่อบรม (ไทย)</span>}
                                name="G_NAME"
                                rules={[{ required: true, message: 'กรุณาระบุชื่อสถานที่อบรม (ไทย)' }]}
                            >
                                <Input
                                    prefix={<TagOutlined className="text-gray-400" />}
                                    placeholder="ระบุชื่อภาษาไทย"
                                    className="h-11 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400 bg-gray-50 focus:bg-white transition-all"
                                    allowClear
                                />
                            </Form.Item>
                            <Form.Item
                                label={<span className="font-semibold text-gray-700">ชื่อสถานที่อบรม (อังกฤษ)</span>}
                                name="G_NAME_EN"
                            >
                                <Input
                                    prefix={<TagOutlined className="text-gray-400" />}
                                    placeholder="ระบุชื่อภาษาอังกฤษ"
                                    className="h-11 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400 bg-gray-50 focus:bg-white transition-all"
                                    allowClear
                                />
                            </Form.Item>
                        </Form>
                    </div>
                </Spin>

                {/* Footer - เปลี่ยนธีมปุ่มเป็นสีน้ำเงิน */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <Button
                        key="submit"
                        type="primary"
                        loading={loading}
                        onClick={handleOk}
                        icon={<SaveOutlined />}
                        className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 border-none shadow-md shadow-blue-200 font-semibold"
                    >
                        {isEditMode ? 'บันทึกการเปลี่ยนแปลง' : 'บันทึกข้อมูล'}
                    </Button>
                    <Button
                        key="back"
                        onClick={handleCancel}
                        disabled={loading}
                        className="h-10 px-6 rounded-lg border-gray-300 text-gray-600 hover:text-gray-800 hover:border-gray-400 hover:bg-white"
                    >
                        ยกเลิก
                    </Button>
                </div>
            </Modal>
        </ConfigProvider>
    );
}

export default ModalForm;