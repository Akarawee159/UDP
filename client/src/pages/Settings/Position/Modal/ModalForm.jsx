import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Modal, Form, Input, App, Button, ConfigProvider, Spin, Select } from 'antd';
import {
    IdcardOutlined,
    TagOutlined,
    PlusCircleOutlined,
    EditOutlined,
    SaveOutlined,
    ApartmentOutlined,
    DeleteOutlined // ✅ เพิ่ม Icon Delete
} from '@ant-design/icons';
import api from "../../../../api";

// ✅ รับ prop onDelete เพิ่ม
function ModalForm({ open, record, onClose, onSuccess, onDelete }) {
    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };
    const [form] = Form.useForm();
    const isEditMode = !!record?.G_ID;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [checkingCode, setCheckingCode] = useState(false);
    const [originalCode, setOriginalCode] = useState(null);

    const [deptList, setDeptList] = useState([]);
    const timerRef = useRef(null);

    // 1. โหลดรายชื่อแผนก
    useEffect(() => {
        const fetchDepts = async () => {
            try {
                const res = await api.get('/settings/position/department-codes');
                setDeptList(res?.data?.data || []);
            } catch (err) {
                console.error("Fetch departments error:", err);
            }
        };
        fetchDepts();
    }, []);

    const deptOptions = useMemo(() => {
        return deptList.map(d => ({
            label: `${d.G_CODE} : ${d.G_NAME}`,
            value: d.G_CODE
        }));
    }, [deptList]);

    const fetchDetail = useCallback(async (id) => {
        try {
            setFetching(true);
            const res = await api.get(`/settings/position/${id}`);
            const data = res?.data?.data;
            if (data) {
                form.setFieldsValue({
                    G_CODE: data.G_CODE || '',
                    G_NAME: data.G_NAME || '',
                    department_code: data.department_code || undefined,
                });
                setOriginalCode(data.G_CODE || null);
            }
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลตำแหน่งงานไม่สำเร็จ');
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
                    department_code: record.department_code || undefined,
                });
                setOriginalCode(record.G_CODE || null);
                fetchDetail(record.G_ID);
            }
        }
    }, [open, isEditMode, record, form, fetchDetail]);

    const validateCode = (_rule, value) => new Promise((resolve, reject) => {
        clearTimeout(timerRef.current);
        if (!value || (isEditMode && value === originalCode)) { setCheckingCode(false); return resolve(); }
        timerRef.current = setTimeout(async () => {
            try {
                setCheckingCode(true);
                let url = `/settings/position/check-code?code=${encodeURIComponent(value)}`;
                if (isEditMode) url += `&excludeId=${record.G_ID}`;
                const res = await api.get(url);
                if (res?.data?.exists) reject('รหัสนี้มีแล้วในระบบ'); else resolve();
            } catch (err) { resolve(); } finally { setCheckingCode(false); }
        }, 400);
    });

    const handleOk = async () => {
        try {
            const raw = await form.validateFields();
            const payload = {
                G_CODE: (raw.G_CODE || '').trim(),
                G_NAME: (raw.G_NAME || '').trim(),
                department_code: raw.department_code,
            };

            setLoading(true);
            let resData;
            if (isEditMode) {
                const res = await api.put(`/settings/position/${record.G_ID}`, payload);
                message.success('อัปเดตข้อมูลสำเร็จ');
                resData = res?.data?.data;
            } else {
                const res = await api.post('/settings/position', payload);
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
                width={560}
                closable={false}
                centered
                // ✅ ป้องกันคลิกปิด
                maskClosable={false}
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
                                {isEditMode ? 'แก้ไขตำแหน่งงาน' : 'เพิ่มตำแหน่งงาน'}
                            </h3>
                            <span className="text-xs text-slate-700">
                                {isEditMode ? 'ปรับปรุงรายละเอียดตำแหน่งเดิม' : 'สร้างตำแหน่งงานใหม่ในระบบ'}
                            </span>
                        </div>
                    </div>
                    <button onClick={handleCancel} disabled={loading} className="text-slate-400 hover:text-slate-700 transition-colors text-3xl">&times;</button>
                </div>

                <Spin spinning={fetching} tip="กำลังโหลดข้อมูล...">
                    <div className="p-8">
                        <Form form={form} layout="vertical" autoComplete="off" className="space-y-2">

                            {/* Row 1: G_CODE */}
                            <Form.Item label={<span className="font-semibold text-gray-700">รหัสตำแหน่งงาน</span>} name="G_CODE" rules={[{ required: true, message: 'กรุณาระบุรหัสตำแหน่งงาน' }, { validator: validateCode }]} hasFeedback validateStatus={checkingCode ? 'validating' : undefined}>
                                {/* ✅ ปรับเป็น h-9 */}
                                <Input prefix={<IdcardOutlined className="text-gray-400" />} placeholder="เช่น POS001" className="h-9 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400  focus:bg-white transition-all" allowClear />
                            </Form.Item>

                            {/* Row 2: G_NAME */}
                            <Form.Item label={<span className="font-semibold text-gray-700">ชื่อตำแหน่งงาน (ไทย)</span>} name="G_NAME" rules={[{ required: true, message: 'กรุณาระบุชื่อตำแหน่งงาน (ไทย)' }]}>
                                {/* ✅ ปรับเป็น h-9 */}
                                <Input prefix={<TagOutlined className="text-gray-400" />} placeholder="ระบุชื่อภาษาไทย" className="h-9 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400  focus:bg-white transition-all" allowClear />
                            </Form.Item>

                            {/* Row 3: Department Code */}
                            <Form.Item label={<span className="font-semibold text-gray-700">อยู่ภายใต้แผนก</span>} name="department_code">
                                {/* ✅ ปรับเป็น h-9 */}
                                <Select
                                    placeholder="เลือกแผนก"
                                    className="h-9 custom-select-rounded"
                                    options={deptOptions}
                                    allowClear
                                    showSearch
                                    filterOption={(input, option) =>
                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    suffixIcon={<ApartmentOutlined className="text-gray-400" />}
                                />
                            </Form.Item>

                        </Form>
                    </div>
                </Spin>

                {/* Footer - ปรับ Layout */}
                <div className={` px-6 py-4 border-t border-gray-100 flex ${isEditMode ? 'justify-between' : 'justify-end'} items-center gap-3`}>

                    {/* ปุ่มลบ (แสดงเฉพาะโหมดแก้ไข) */}
                    {isEditMode && (
                        <Button
                            danger
                            type="text"
                            onClick={onDelete}
                            disabled={loading}
                            icon={<DeleteOutlined />}
                            className="hover:bg-red-50 text-red-500"
                        >
                            ลบข้อมูล
                        </Button>
                    )}

                    <div className="flex gap-3">
                        <Button key="submit" type="primary" loading={loading} onClick={handleOk} icon={<SaveOutlined />} className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 border-none shadow-md shadow-blue-200 font-semibold">
                            {isEditMode ? 'บันทึกการเปลี่ยนแปลง' : 'บันทึกข้อมูล'}
                        </Button>
                        <Button key="back" onClick={handleCancel} disabled={loading} className="h-10 px-6 rounded-lg border-gray-300 text-gray-600 hover:text-gray-800 hover:border-gray-400 hover:bg-white">
                            ยกเลิก
                        </Button>
                    </div>
                </div>
            </Modal>
        </ConfigProvider>
    );
}

export default ModalForm;