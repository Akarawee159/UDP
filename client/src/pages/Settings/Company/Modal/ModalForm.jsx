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
            const res = await api.get(`/company/${id}`);
            const data = res?.data?.data;
            if (data) {
                // ✅ Map ข้อมูลให้ตรง Form
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

    // ✅ เหลือ useEffect เดียวที่ถูกต้อง (ใช้ record.id)
    useEffect(() => {
        if (open) {
            form.resetFields();
            setOriginalCode(null);

            if (isEditMode) {
                form.setFieldsValue(record); // Pre-fill ข้อมูลจากตารางก่อน
                setOriginalCode(record.company_code || null);
                // เรียกดึงข้อมูลล่าสุดจาก API โดยใช้ id
                fetchDetail(record.id);
            }
        }
    }, [open, isEditMode, record, form, fetchDetail]);

    // ❌ ลบ useEffect ชุดที่ 2 ที่ใช้ G_ID ออกไปเลย (เพราะมันซ้ำและผิด)
    /* useEffect(() => { ... }, ...); 
    */

    // 3. ฟังก์ชันตรวจสอบรหัสซ้ำ (Debounce)
    const validateCode = (_rule, value) => new Promise((resolve, reject) => {
        clearTimeout(timerRef.current);
        if (!value || (isEditMode && value === originalCode)) { setCheckingCode(false); return resolve(); }
        timerRef.current = setTimeout(async () => {
            try {
                setCheckingCode(true);
                let url = `/company/check-code?code=${encodeURIComponent(value)}`;
                if (isEditMode) url += `&excludeId=${record.id}`;
                const res = await api.get(url);
                if (res?.data?.exists) reject('รหัสนี้มีแล้วในระบบ'); else resolve();
            } catch (err) { resolve(); } finally { setCheckingCode(false); }
        }, 400);
    });

    // 4. Submit Form
    const handleOk = async () => {
        try {
            const raw = await form.validateFields();
            // ✅ ส่งข้อมูลใหม่ทั้งหมด
            const payload = {
                company_code: (raw.company_code || '').trim(),
                business_type: (raw.business_type || '').trim(),
                branch_name: (raw.branch_name || '').trim(),
                company_name_th: (raw.company_name_th || '').trim(),
                company_name_en: (raw.company_name_en || '').trim(),
                address_th: (raw.address_th || '').trim(),
                address_en: (raw.address_en || '').trim(),
                phone: (raw.phone || '').trim(),
                tax_no: (raw.tax_no || '').trim(),
            };

            setLoading(true);
            let resData;

            if (isEditMode) {
                const res = await api.put(`/company/${record.id}`, payload);
                message.success('อัปเดตข้อมูลสำเร็จ');
                resData = res?.data?.data;
            } else {
                const res = await api.post('/company', payload);
                message.success('เพิ่มข้อมูลสำเร็จ');
                resData = res?.data?.data;
            }

            form.resetFields();
            onSuccess?.(resData || null);
            onClose?.();
        } catch (err) {
            if (err?.errorFields) return;
            const apiMsg = err?.response?.data?.message || 'บันทึกไม่สำเร็จ';
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
                    colorPrimary: '#2563eb',
                    borderRadius: 8,
                },
                components: {
                    Button: {
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
                closable={false}
                maskClosable={!loading}
                destroyOnClose
                className="custom-modal-company"
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
                                {isEditMode ? 'แก้ไขข้อมูลชื่อบริษัท' : 'เพิ่มข้อมูลชื่อบริษัท'}
                            </h3>
                            <span className="text-xs text-slate-700">
                                {isEditMode ? 'ปรับปรุงรายละเอียดข้อมูลชื่อบริษัท' : 'กรอกข้อมูลเพื่อสร้างชื่อบริษัทใหม่'}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={handleCancel}
                        disabled={loading}
                        className="text-slate-400 hover:text-slate-700 transition-colors text-3xl"
                    >
                        &times;
                    </button>
                </div>

                <Spin spinning={fetching} tip="กำลังโหลดข้อมูล...">
                    <div className="p-8">
                        <Form form={form} layout="vertical" autoComplete="off">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                {/* Row 1: Code & Type */}
                                <Form.Item label="รหัสบริษัท" name="company_code" rules={[{ required: true }, { validator: validateCode }]} hasFeedback validateStatus={checkingCode ? 'validating' : undefined}>
                                    <Input prefix={<IdcardOutlined className="text-gray-400" />} />
                                </Form.Item>
                                <Form.Item label="ประเภทธุรกิจ" name="business_type">
                                    <Input />
                                </Form.Item>

                                {/* Row 2: Names */}
                                <Form.Item label="ชื่อบริษัท (ไทย)" name="company_name_th" rules={[{ required: true }]}>
                                    <Input prefix={<TagOutlined className="text-gray-400" />} />
                                </Form.Item>
                                <Form.Item label="ชื่อบริษัท (อังกฤษ)" name="company_name_en">
                                    <Input prefix={<TagOutlined className="text-gray-400" />} />
                                </Form.Item>

                                {/* Row 3: Tax & Phone */}
                                <Form.Item label="เลขผู้เสียภาษี" name="tax_no">
                                    <Input />
                                </Form.Item>
                                <Form.Item label="เบอร์โทรศัพท์" name="phone">
                                    <Input />
                                </Form.Item>

                                {/* Row 4: Branch Name */}
                                <Form.Item label="ชื่อสาขา (ถ้ามี)" name="branch_name" className="md:col-span-2">
                                    <Input placeholder="เช่น สำนักงานใหญ่, สาขาลาดพร้าว" />
                                </Form.Item>

                                {/* Row 5: Addresses */}
                                <Form.Item label="ที่อยู่ (ไทย)" name="address_th" className="md:col-span-2">
                                    <Input.TextArea rows={2} />
                                </Form.Item>
                                <Form.Item label="ที่อยู่ (อังกฤษ)" name="address_en" className="md:col-span-2">
                                    <Input.TextArea rows={2} />
                                </Form.Item>
                            </div>
                        </Form>
                    </div>
                </Spin>

                {/* Footer */}
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