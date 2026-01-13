import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'; // ✅ เพิ่ม useMemo
// ✅ เพิ่ม Select
import { Modal, Form, Input, App, Button, ConfigProvider, Spin, Select } from 'antd';
import {
    IdcardOutlined,
    TagOutlined,
    PlusCircleOutlined,
    EditOutlined,
    SaveOutlined,
    BankOutlined // ✅ เพิ่ม Icon
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

    // ✅ State สำหรับเก็บรายชื่อสาขา
    const [branchList, setBranchList] = useState([]);

    const timerRef = useRef(null);

    // ✅ 1. โหลดรายชื่อสาขาตอน Component Mount
    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await api.get('/department/branch-codes');
                setBranchList(res?.data?.data || []);
            } catch (err) {
                console.error("Fetch branches error:", err);
            }
        };
        fetchBranches();
    }, []);

    // ✅ 2. แปลงข้อมูลสาขาเป็น Options ของ Select
    const branchOptions = useMemo(() => {
        return branchList.map(b => ({
            label: `${b.G_CODE} : ${b.G_NAME}`, // รูปแบบ KP001 : สำนักงานใหญ่
            value: b.G_CODE
        }));
    }, [branchList]);

    const fetchDetail = useCallback(async (id) => {
        try {
            setFetching(true);
            const res = await api.get(`/department/${id}`);
            const data = res?.data?.data;
            if (data) {
                form.setFieldsValue({
                    G_CODE: data.G_CODE || '',
                    G_NAME: data.G_NAME || '',
                    branch_code: data.branch_code || undefined,
                });
                setOriginalCode(data.G_CODE || null);
            }
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลแผนกไม่สำเร็จ');
        } finally {
            setFetching(false);
        }
    }, [form, message]);

    useEffect(() => {
        if (open) {
            form.resetFields();
            setOriginalCode(null);

            if (isEditMode) {
                // Pre-fill ข้อมูลเบื้องต้น (ถ้ามีใน record แล้ว)
                form.setFieldsValue({
                    G_CODE: record.G_CODE || '',
                    G_NAME: record.G_NAME || '',
                    branch_code: record.branch_code || undefined,
                });
                setOriginalCode(record.G_CODE || null);
                fetchDetail(record.G_ID);
            }
        }
    }, [open, isEditMode, record, form, fetchDetail]);

    // ... validateCode เหมือนเดิม ...
    const validateCode = (_rule, value) => new Promise((resolve, reject) => {
        clearTimeout(timerRef.current);
        if (!value || (isEditMode && value === originalCode)) { setCheckingCode(false); return resolve(); }
        timerRef.current = setTimeout(async () => {
            try {
                setCheckingCode(true);
                let url = `/department/check-code?code=${encodeURIComponent(value)}`;
                if (isEditMode) url += `&excludeId=${record.G_ID}`;
                const res = await api.get(url);
                if (res?.data?.exists) reject('รหัสนี้มีแล้วในระบบ'); else resolve();
            } catch (err) { console.error(err); resolve(); } finally { setCheckingCode(false); }
        }, 400);
    });

    const handleOk = async () => {
        try {
            const raw = await form.validateFields();
            const payload = {
                G_CODE: (raw.G_CODE || '').trim(),
                G_NAME: (raw.G_NAME || '').trim(),
                branch_code: raw.branch_code,
            };

            setLoading(true);
            let resData;
            if (isEditMode) {
                const res = await api.put(`/department/${record.G_ID}`, payload);
                message.success('อัปเดตข้อมูลสำเร็จ');
                resData = res?.data?.data;
            } else {
                const res = await api.post('/department', payload);
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
                maskClosable={!loading}
                destroyOnClose
                styles={{ content: { padding: 0, borderRadius: '16px', overflow: 'hidden' } }}
            >
                {/* Header */}
                <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-blue-800">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-600 text-xl">
                            {isEditMode ? <EditOutlined /> : <PlusCircleOutlined />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold m-0 leading-tight">
                                {isEditMode ? 'แก้ไขข้อมูลแผนก' : 'เพิ่มข้อมูลแผนก'}
                            </h3>
                        </div>
                    </div>
                    <button onClick={handleCancel} disabled={loading} className="text-blue-400 hover:text-blue-700 transition-colors text-3xl">&times;</button>
                </div>

                <Spin spinning={fetching} tip="กำลังโหลดข้อมูล...">
                    <div className="p-8">
                        <Form form={form} layout="vertical" autoComplete="off" className="space-y-2">

                            {/* Row 1: G_CODE */}
                            <Form.Item label={<span className="font-semibold text-gray-700">รหัสแผนก</span>} name="G_CODE" rules={[{ required: true, message: 'กรุณาระบุรหัสแผนก' }, { validator: validateCode }]} hasFeedback validateStatus={checkingCode ? 'validating' : undefined}>
                                <Input prefix={<IdcardOutlined className="text-gray-400" />} placeholder="เช่น DEPT01" className="h-11 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400 bg-gray-50 focus:bg-white transition-all" allowClear />
                            </Form.Item>

                            {/* Row 2: G_NAME */}
                            <Form.Item label={<span className="font-semibold text-gray-700">ชื่อแผนก (ไทย)</span>} name="G_NAME" rules={[{ required: true, message: 'กรุณาระบุชื่อแผนก (ไทย)' }]}>
                                <Input prefix={<TagOutlined className="text-gray-400" />} placeholder="ระบุชื่อภาษาไทย" className="h-11 rounded-lg border-gray-200 focus:border-blue-500 hover:border-blue-400 bg-gray-50 focus:bg-white transition-all" allowClear />
                            </Form.Item>

                            {/* Row 3: Branch Code (New) */}
                            <Form.Item
                                label={<span className="font-semibold text-gray-700">อยู่ภายใต้สาขา</span>}
                                name="branch_code"
                            >
                                <Select
                                    placeholder="เลือกสาขา"
                                    className="h-11 custom-select-rounded"
                                    options={branchOptions}
                                    allowClear
                                    showSearch
                                    filterOption={(input, option) =>
                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    suffixIcon={<BankOutlined className="text-gray-400" />}
                                />
                            </Form.Item>
                        </Form>
                    </div>
                </Spin>

                {/* Footer */}
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