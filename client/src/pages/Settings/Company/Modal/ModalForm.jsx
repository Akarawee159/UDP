import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Form, Input, App, Button, ConfigProvider, Spin } from 'antd';
import {
    IdcardOutlined,
    TagOutlined,
    PlusCircleOutlined,
    EditOutlined,
    SaveOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import api from "../../../../api";

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
        if (!value || (isEditMode && value === originalCode)) { setCheckingCode(false); return resolve(); }
        timerRef.current = setTimeout(async () => {
            try {
                setCheckingCode(true);
                let url = `/settings/company/check-code?code=${encodeURIComponent(value)}`;
                if (isEditMode) url += `&excludeId=${record.id}`;
                const res = await api.get(url);
                if (res?.data?.exists) reject('รหัสนี้มีแล้วในระบบ'); else resolve();
            } catch (err) { resolve(); } finally { setCheckingCode(false); }
        }, 400);
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
        <ConfigProvider theme={{ token: { colorPrimary: '#2563eb', borderRadius: 8 } }}>
            <Modal
                open={open}
                title={null}
                onCancel={handleCancel}
                footer={null}
                width={1100}
                closable={false}
                maskClosable={false}
                destroyOnClose
                centered
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
                                {isEditMode ? 'แก้ไขข้อมูลบริษัท' : 'เพิ่มข้อมูลบริษัท'}
                            </h3>
                            <span className="text-xs text-slate-700">
                                {isEditMode ? 'ปรับปรุงรายละเอียดข้อมูล' : 'กรอกข้อมูลเพื่อสร้างใหม่'}
                            </span>
                        </div>
                    </div>
                    <button onClick={handleCancel} disabled={loading} className="text-slate-400 hover:text-slate-700 transition-colors text-3xl">&times;</button>
                </div>

                <Spin spinning={fetching} tip="กำลังโหลดข้อมูล...">
                    <div className="p-8">
                        <Form form={form} layout="vertical" autoComplete="off">

                            {/* Grid Layout 4 Columns */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                                {/* Row 1: รหัส, ชื่อไทย, ชื่ออังกฤษ, ประเภท */}
                                <Form.Item label={<span className="font-semibold text-gray-700">รหัสบริษัท</span>} name="company_code" rules={[{ required: true, message: 'กรุณาระบุรหัส' }, { validator: validateCode }]} hasFeedback validateStatus={checkingCode ? 'validating' : undefined}>
                                    {/* ✅ ปรับ h-9 */}
                                    <Input prefix={<IdcardOutlined className="text-gray-400" />} placeholder="เช่น UPD" className="h-9 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400  focus:bg-white transition-all" />
                                </Form.Item>
                                <Form.Item label={<span className="font-semibold text-gray-700">ชื่อบริษัท (ไทย)</span>} name="company_name_th" rules={[{ required: true, message: 'กรุณาระบุชื่อบริษัท' }]}>
                                    {/* ✅ ปรับ h-9 */}
                                    <Input prefix={<TagOutlined className="text-gray-400" />} placeholder="ระบุชื่อบริษัท" className="h-9 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400  focus:bg-white transition-all" />
                                </Form.Item>
                                <Form.Item label={<span className="font-semibold text-gray-700">ชื่อบริษัท (อังกฤษ)</span>} name="company_name_en">
                                    {/* ✅ ปรับ h-9 */}
                                    <Input prefix={<TagOutlined className="text-gray-400" />} placeholder="Company Name" className="h-9 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400  focus:bg-white transition-all" />
                                </Form.Item>
                                <Form.Item label={<span className="font-semibold text-gray-700">ประเภทธุรกิจ</span>} name="business_type">
                                    {/* ✅ ปรับ h-9 */}
                                    <Input placeholder="เช่น พ่นสีฉีดพลาสติก" className="h-9 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400  focus:bg-white transition-all" />
                                </Form.Item>

                                {/* Row 2: ผู้เสียภาษี, เบอร์โทร, สาขา */}
                                <Form.Item label={<span className="font-semibold text-gray-700">เลขผู้เสียภาษี</span>} name="tax_no">
                                    {/* ✅ ปรับ h-9 */}
                                    <Input placeholder="ระบุเลขผู้เสียภาษี" className="h-9 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400  focus:bg-white transition-all" />
                                </Form.Item>
                                <Form.Item label={<span className="font-semibold text-gray-700">เบอร์โทรศัพท์</span>} name="phone">
                                    {/* ✅ ปรับ h-9 */}
                                    <Input placeholder="ระบุเบอร์โทร" className="h-9 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400  focus:bg-white transition-all" />
                                </Form.Item>
                                <Form.Item label={<span className="font-semibold text-gray-700">ชื่อสาขา (ถ้ามี)</span>} name="branch_name" className="md:col-span-2">
                                    {/* ✅ ปรับ h-9 */}
                                    <Input placeholder="เช่น สำนักงานใหญ่" className="h-9 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400  focus:bg-white transition-all" />
                                </Form.Item>

                                {/* Row 3: ที่อยู่ (TextArea) - ไม่ต้องใส่ h-9 แต่ใส่ style อื่นๆ ให้เหมือนกัน */}
                                <Form.Item label={<span className="font-semibold text-gray-700">ที่อยู่ (ไทย)</span>} name="address_th" className="md:col-span-2">
                                    <Input.TextArea rows={2} placeholder="บ้านเลขที่, ถนน, แขวง/ตำบล" className="rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400  focus:bg-white transition-all" />
                                </Form.Item>
                                <Form.Item label={<span className="font-semibold text-gray-700">ที่อยู่ (อังกฤษ)</span>} name="address_en" className="md:col-span-2">
                                    <Input.TextArea rows={2} placeholder="Address detail" className="rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400  focus:bg-white transition-all" />
                                </Form.Item>

                            </div>
                        </Form>
                    </div>
                </Spin>

                {/* Footer */}
                <div className={` px-6 py-4 border-t border-gray-100 flex ${isEditMode ? 'justify-between' : 'justify-end'} items-center gap-3`}>

                    {/* ปุ่มลบ (แสดงเฉพาะโหมดแก้ไข) */}
                    {isEditMode && (
                        <Button
                            danger
                            type="text"
                            onClick={onDelete}
                            disabled={loading || fetching}
                            icon={<DeleteOutlined />}
                            className="hover:bg-red-50 text-red-500"
                        >
                            ลบข้อมูล
                        </Button>
                    )}

                    <div className="flex gap-3">
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
                </div>
            </Modal>
        </ConfigProvider>
    );
}

export default ModalForm;