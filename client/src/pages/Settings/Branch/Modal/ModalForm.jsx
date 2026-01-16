import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Modal, Form, Input, Select, App, Button, ConfigProvider, Spin, Typography, Row, Col } from 'antd';
import {
    IdcardOutlined, TagOutlined, ApartmentOutlined, SaveOutlined,
    EditOutlined, PlusCircleOutlined, DeleteOutlined, ShopOutlined,
    EnvironmentOutlined, ClusterOutlined
} from '@ant-design/icons';
import api from "../../../../api";

const { Title, Text } = Typography;

const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

function ModalForm({ open, record, onClose, onSuccess, onDelete }) {
    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };
    const [form] = Form.useForm();

    const isEditMode = !!record?.G_ID;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false); // เพิ่ม state fetching
    const [codesLoading, setCodesLoading] = useState(false);
    const [companyCodes, setCompanyCodes] = useState([]);
    const [checkingCode, setCheckingCode] = useState(false);
    const [originalCode, setOriginalCode] = useState(null);
    const timerRef = useRef(null); // ใช้ ref สำหรับ timeout validation

    // 1. ดึงรายชื่อบริษัทสำหรับ Dropdown
    const fetchCompanyCodes = async () => {
        try {
            setCodesLoading(true);
            const res = await api.get('/settings/branch/company-codes');
            setCompanyCodes(res?.data?.data || []);
        } catch (err) {
            console.error(err);
            message.error('ดึงรายรหัสบริษัท ไม่สำเร็จ!');
        } finally {
            setCodesLoading(false);
        }
    };

    // 2. ดึงข้อมูลรายละเอียดสาขา (Edit Mode)
    const fetchById = useCallback(async (G_ID) => {
        try {
            setFetching(true);
            const res = await api.get(`/settings/branch/${G_ID}`);
            const row = res?.data?.data;
            if (row) {
                form.setFieldsValue({
                    G_CODE: row.G_CODE || '',
                    G_NAME: row.G_NAME || '',
                    G_ADDRESS: row.G_ADDRESS || '',
                    company_code: row.company_code || '',
                });
                setOriginalCode(row.G_CODE || null);
            }
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลสาขาไม่สำเร็จ');
        } finally {
            setFetching(false);
        }
    }, [form, message]);

    useEffect(() => {
        if (open) {
            clearTimeout(timerRef.current);
            form.resetFields();
            setOriginalCode(null);
            fetchCompanyCodes();
            if (isEditMode) {
                fetchById(record.G_ID);
            }
        }
    }, [open, record, isEditMode, fetchById]);

    const handleOk = async () => {
        try {
            const raw = await form.validateFields();
            const payload = {
                G_CODE: (raw.G_CODE || '').trim(),
                G_NAME: (raw.G_NAME || '').trim(),
                G_ADDRESS: (raw.G_ADDRESS || '').trim(),
                company_code: (raw.company_code || '').trim(),
            };

            setLoading(true);
            let resData;

            if (isEditMode) {
                const { data } = await api.put(`/settings/branch/${record.G_ID}`, payload);
                message.success('อัปเดตข้อมูลสำเร็จ');
                resData = data?.data;
            } else {
                const { data } = await api.post('/settings/branch', payload);
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

    const selectOptions = useMemo(
        () => companyCodes.map(c => ({
            label: `${c.company_code} : ${c.company_name_th || ''}`,
            value: c.company_code
        })),
        [companyCodes]
    );

    // Validation Logic
    const validateBranchCode = (_rule, value) => new Promise((resolve, reject) => {
        const code = (value || '').trim();
        if (!code) return resolve();
        if (isEditMode && code === originalCode) return resolve();

        if (timerRef.current) clearTimeout(timerRef.current);
        setCheckingCode(true);

        timerRef.current = setTimeout(async () => {
            try {
                let url = `/settings/branch/check-code?code=${encodeURIComponent(code)}`;
                if (isEditMode) {
                    url += `&excludeId=${record.G_ID}`;
                }
                const res = await api.get(url);
                setCheckingCode(false);

                if (res.data.exists) {
                    reject(new Error('รหัสนี้มีแล้วในระบบ'));
                } else {
                    resolve();
                }
            } catch (err) {
                setCheckingCode(false);
                console.error('Code check failed', err);
                // กรณีเช็คไม่ได้ อนุโลมให้ผ่านไปก่อน หรือจะ reject ก็ได้ตาม policy
                resolve();
            }
        }, 500);
    });

    const handleCancel = () => {
        form.resetFields();
        onClose?.();
    };

    return (
        <ConfigProvider
            theme={{
                token: { colorPrimary: '#2563eb', borderRadius: 8, fontFamily: "'Prompt', 'Inter', sans-serif" },
                components: {
                    Input: { controlHeight: 40 },
                    Select: { controlHeight: 40 },
                    Button: { controlHeight: 40 }
                }
            }}
        >
            <Modal
                open={open}
                title={null}
                onCancel={handleCancel}
                maskClosable={false}
                destroyOnClose
                width={900}
                closable={false}
                centered
                footer={null}
                styles={{ content: { padding: 0, borderRadius: '20px', overflow: 'hidden' } }}
            >
                {/* --- Header --- */}
                <div className="bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 z-50">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm text-2xl ${isEditMode ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                            {isEditMode ? <EditOutlined /> : <PlusCircleOutlined />}
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0, fontWeight: 700 }} className="text-slate-800">
                                {isEditMode ? 'แก้ไขข้อมูลสาขา' : 'เพิ่มสาขาใหม่'}
                            </Title>
                            <Text className="text-slate-500 text-sm font-light">
                                {isEditMode ? 'Branch Information Update' : 'Create New Branch'}
                            </Text>
                        </div>
                    </div>
                    <Button type="text" onClick={handleCancel} className="text-slate-400 hover:text-slate-600 rounded-full w-10 h-10 flex items-center justify-center hover:bg-slate-100">
                        <span className="text-2xl font-light">&times;</span>
                    </Button>
                </div>

                <Spin spinning={fetching} tip="กำลังโหลดข้อมูล...">
                    <Form form={form} layout="vertical" autoComplete="off">

                        {/* --- Main Content Split Layout --- */}
                        <div className="flex flex-col md:flex-row h-auto md:h-[450px]">

                            {/* LEFT SIDE: Identity */}
                            <div className="w-full md:w-[320px] bg-slate-50 p-6 border-r border-gray-100 flex-shrink-0">
                                <div className="text-center mb-8 mt-2">
                                    <div className="w-32 h-32 bg-white rounded-2xl border-2 border-dashed border-slate-200 mx-auto flex flex-col items-center justify-center text-slate-400 mb-4 shadow-sm group hover:border-purple-300 transition-colors cursor-default">
                                        <ShopOutlined style={{ fontSize: '48px' }} className="group-hover:text-purple-500 transition-colors" />
                                        <span className="text-xs mt-3 font-medium tracking-wide uppercase text-slate-400 group-hover:text-purple-500">Branch Profile</span>
                                    </div>
                                    <div className="text-slate-500 font-medium text-sm">ข้อมูลหลักสาขา</div>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                        <Form.Item
                                            label={<span className="text-slate-600 font-medium">รหัสสาขา <span className="text-red-500">*</span></span>}
                                            name="G_CODE"
                                            rules={[{ required: true, message: 'ระบุรหัสสาขา' }, { validator: validateBranchCode }]}
                                            hasFeedback
                                            validateStatus={checkingCode ? 'validating' : undefined}
                                            className="mb-4"
                                        >
                                            <Input prefix={<IdcardOutlined className="text-slate-400" />} placeholder="เช่น BKK-01" className="font-mono bg-slate-50" maxLength={20} />
                                        </Form.Item>

                                        <Form.Item
                                            label={<span className="text-slate-600 font-medium">ชื่อสาขา <span className="text-red-500">*</span></span>}
                                            name="G_NAME"
                                            rules={[{ required: true, message: 'ระบุชื่อสาขา' }]}
                                            className="mb-0"
                                        >
                                            <Input prefix={<TagOutlined className="text-slate-400" />} placeholder="เช่น สำนักงานใหญ่" />
                                        </Form.Item>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT SIDE: Affiliation & Address */}
                            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-white">

                                {/* Section 1: Affiliation */}
                                <div className="mb-8">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><ClusterOutlined /></div>
                                        <h3 className="text-sm font-bold text-slate-700 m-0 uppercase tracking-widest">Affiliation (สังกัด)</h3>
                                        <div className="flex-1 h-px bg-slate-100 ml-2"></div>
                                    </div>

                                    <Row gutter={16}>
                                        <Col span={24}>
                                            <Form.Item
                                                label="อยู่ภายใต้บริษัท (Company)"
                                                name="company_code"
                                                rules={[{ required: true, message: 'กรุณาเลือกบริษัทต้นสังกัด' }]}
                                            >
                                                <Select
                                                    showSearch
                                                    loading={codesLoading}
                                                    placeholder="เลือกบริษัท"
                                                    options={selectOptions}
                                                    optionFilterProp="label"
                                                    className="w-full"
                                                    suffixIcon={<ApartmentOutlined className="text-slate-400" />}
                                                    // Dropdown props for better UX
                                                    popupMatchSelectWidth={false}
                                                    dropdownStyle={{ minWidth: 300 }}
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>

                                {/* Section 2: Location */}
                                <div>
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><EnvironmentOutlined /></div>
                                        <h3 className="text-sm font-bold text-slate-700 m-0 uppercase tracking-widest">Location (ที่ตั้ง)</h3>
                                        <div className="flex-1 h-px bg-slate-100 ml-2"></div>
                                    </div>

                                    <Row gutter={16}>
                                        <Col span={24}>
                                            <Form.Item label="ที่อยู่สาขา" name="G_ADDRESS" rules={[{ required: true, message: 'กรุณาระบุที่อยู่' }]}>
                                                <Input.TextArea
                                                    rows={4}
                                                    placeholder="บ้านเลขที่, ถนน, แขวง/ตำบล, เขต/อำเภอ, จังหวัด"
                                                    className="rounded-xl"
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
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
                                ลบข้อมูลสาขา
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