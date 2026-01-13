import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Modal, Form, Input, Select, App, Button, ConfigProvider } from 'antd';
import {
    BranchesOutlined,
    IdcardOutlined,
    TagOutlined,
    ApartmentOutlined,
    SaveOutlined,
    EditOutlined,
    PlusCircleOutlined
} from '@ant-design/icons';
import api from "../../../../api";

// Helper function สำหรับ Debounce
const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

function ModalForm({ open, record, onClose, onSuccess }) {
    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };
    const [form] = Form.useForm();

    // ตรวจสอบโหมด: ถ้ามี record ส่งมา = Edit Mode
    const isEditMode = !!record?.G_ID;

    const [loading, setLoading] = useState(false);
    const [codesLoading, setCodesLoading] = useState(false);
    const [companyCodes, setCompanyCodes] = useState([]);
    const [checkingCode, setCheckingCode] = useState(false);

    const [originalCode, setOriginalCode] = useState(null);

    const fetchCompanyCodes = async () => {
        try {
            setCodesLoading(true);
            const res = await api.get('/branch/company-codes');
            setCompanyCodes(res?.data?.data || []);
        } catch (err) {
            console.error(err);
            message.error('ดึงรายรหัสบริษัท ไม่สำเร็จ!');
        } finally {
            setCodesLoading(false);
        }
    };

    const fetchById = async (G_ID) => {
        try {
            const res = await api.get(`/branch/${G_ID}`);
            const row = res?.data?.data;
            if (row) {
                form.setFieldsValue({
                    G_CODE: row.G_CODE || '',
                    G_NAME: row.G_NAME || '',
                    company_code: row.company_code || '',
                });
                setOriginalCode(row.G_CODE || null);
            }
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลสาขาไม่สำเร็จ');
        }
    };

    useEffect(() => {
        if (open) {
            form.resetFields();
            setOriginalCode(null);
            fetchCompanyCodes();

            if (isEditMode) {
                fetchById(record.G_ID);
            }
        }
    }, [open, record]);

    const handleOk = async () => {
        try {
            const raw = await form.validateFields();
            const payload = {
                G_CODE: (raw.G_CODE || '').trim(),
                G_NAME: (raw.G_NAME || '').trim(),
                company_code: (raw.company_code || '').trim(),
            };

            setLoading(true);
            let resData;

            if (isEditMode) {
                const { data } = await api.put(`/branch/${record.G_ID}`, payload);
                message.success('อัปเดตข้อมูลสำเร็จ');
                resData = data?.data;
            } else {
                const { data } = await api.post('/branch', payload);
                message.success('เพิ่มข้อมูลสำเร็จ');
                resData = data?.data;
            }

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

    // ✅ แก้ไข useMemo สำหรับสร้าง Options
    const selectOptions = useMemo(
        () => companyCodes.map(c => ({
            // label: แสดง "รหัส : ชื่อบริษัท"
            label: `${c.company_code} : ${c.company_name_th || ''}`,
            // value: ส่งค่า "รหัส" ไปเก็บเหมือนเดิม
            value: c.company_code
        })),
        [companyCodes]
    );

    const debouncedCheck = useCallback(
        debounce(async (code, callback) => {
            if (!code) {
                setCheckingCode(false);
                callback();
                return;
            }
            if (isEditMode && code === originalCode) {
                setCheckingCode(false);
                callback();
                return;
            }

            try {
                setCheckingCode(true);
                let url = `/branch/check-code?code=${encodeURIComponent(code)}`;
                if (isEditMode) {
                    url += `&excludeId=${record.G_ID}`;
                }

                const res = await api.get(url);
                if (res.data.exists) {
                    callback('รหัสนี้มีแล้วในระบบ');
                } else {
                    callback();
                }
            } catch (err) {
                console.error('Code check failed', err);
                callback('ไม่สามารถตรวจสอบรหัสซ้ำได้');
            } finally {
                setCheckingCode(false);
            }
        }, 400),
        [isEditMode, record, originalCode]
    );

    const validateBranchCode = (_rule, value, callback) => {
        debouncedCheck(value, callback);
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
                onCancel={onClose}
                maskClosable={!loading}
                destroyOnClose
                width={600}
                closable={false} // ซ่อนปุ่ม X ของ Ant Design เดิมใช้ closable 
                centered
                footer={null}
                className="custom-modal-branch"
                styles={{ content: { padding: 0, borderRadius: '16px', overflow: 'hidden' } }}
            >
                {/* Header - เปลี่ยนธีมเป็นสีน้ำเงิน */}
                <div className="bg-slate-200 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-800">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-600 text-xl">
                            {isEditMode ? <EditOutlined /> : <PlusCircleOutlined />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold m-0 leading-tight">
                                {isEditMode ? 'แก้ไขข้อมูลสาขา' : 'เพิ่มสาขาใหม่'}
                            </h3>
                            <span className="text-xs text-slate-700">
                                {isEditMode ? 'ปรับปรุงรายละเอียดข้อมูลสาขา' : 'กรอกข้อมูลเพื่อสร้างสาขาใหม่'}
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

                <div className="p-8">
                    <Form form={form} layout="vertical" className="space-y-2">
                        <div className="grid grid-cols-1 gap-4">
                            {/* Row 1: Branch Code */}
                            <Form.Item
                                label={<span className="font-semibold text-gray-700">รหัสสาขา</span>}
                                name="G_CODE"
                                rules={[
                                    { required: true, message: 'กรุณาระบุรหัสสาขา' },
                                    { validator: validateBranchCode }
                                ]}
                                hasFeedback
                                validateStatus={checkingCode ? 'validating' : undefined}
                            >
                                {/* เปลี่ยน Focus/Hover Border เป็นสีน้ำเงิน */}
                                <Input
                                    prefix={<IdcardOutlined className="text-gray-400" />}
                                    placeholder="เช่น AP1071"
                                    className="h-11 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400 bg-gray-50 focus:bg-white transition-all"
                                    allowClear
                                />
                            </Form.Item>
                            <Form.Item
                                label={<span className="font-semibold text-gray-700">ชื่อสาขา (ไทย)</span>}
                                name="G_NAME"
                                rules={[{ required: true, message: 'กรุณาระบุชื่อสาขา (ไทย)' }]}
                            >
                                <Input
                                    prefix={<TagOutlined className="text-gray-400" />}
                                    placeholder="เช่น สำนักงานใหญ่"
                                    className="h-11 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400 bg-gray-50 focus:bg-white transition-all"
                                    allowClear
                                />
                            </Form.Item>


                            {/* Row 3: Company Code */}
                            <Form.Item
                                label={<span className="font-semibold text-gray-700">อยู่ภายใต้รหัสบริษัท</span>}
                                name="company_code"
                                rules={[{ required: true, message: 'กรุณาเลือก รหัสบริษัท' }]}
                            >
                                <Select
                                    showSearch
                                    loading={codesLoading}
                                    placeholder="เลือก รหัสบริษัท"
                                    options={selectOptions}
                                    optionFilterProp="label"
                                    // เปลี่ยน class เป็นสีน้ำเงิน (ถ้ามี css) หรือใช้ default config provider
                                    className="h-11 custom-select-blue"
                                    suffixIcon={<ApartmentOutlined className="text-gray-400" />}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </div>
                    </Form>
                </div>

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
                        onClick={onClose}
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