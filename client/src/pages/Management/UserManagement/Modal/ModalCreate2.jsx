// src/pages/UserManagement/Modal/ModalCreate2.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Form, Select, App, Input, InputNumber, Button, Row, Col, Typography, Tag, Space } from 'antd';
import {
    UserAddOutlined,
    SolutionOutlined,
    LockOutlined,
    SafetyCertificateOutlined,
    CheckCircleFilled,
    UserOutlined,
    IdcardOutlined,
    BuildOutlined
} from '@ant-design/icons';
import api from "../../../../api";

const { Text } = Typography;

const ModalCreate2 = ({ open, onClose, onSaved }) => {
    const { message } = App.useApp();
    const [form] = Form.useForm();

    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState([]);
    const [titlenames, setTitlenames] = useState([]);

    // State สำหรับตัวเลือกใหม่
    const [companies, setCompanies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [positions, setPositions] = useState([]);

    const [policyDays, setPolicyDays] = useState(90);
    const [dup, setDup] = useState(false);
    const [checking, setChecking] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => {
        if (!open) return;

        (async () => {
            try {
                // Fetch แบบไม่ต้องรอให้ตัวใดตัวหนึ่งพังแล้วล่มทั้งหมด
                const fetchSafe = (url) => api.get(url).catch(() => ({ data: { data: [] } }));

                const [g, t, p, c, b, d, pos] = await Promise.all([
                    api.get('/management/groups'),
                    api.get('/management/titlenames'),
                    api.get('/auth/password-policy').catch(() => ({ data: { policy_days: 90 } })),
                    fetchSafe('/management/options/companies'),
                    fetchSafe('/management/options/branches'),
                    fetchSafe('/management/options/departments'),
                    fetchSafe('/management/options/positions')
                ]);

                setGroups(Array.isArray(g?.data?.data) ? g.data.data : []);
                setTitlenames(Array.isArray(t?.data?.data) ? t.data.data : []);
                if (p?.data?.policy_days) setPolicyDays(p.data.policy_days);

                setCompanies(c?.data?.data || []);
                setBranches(b?.data?.data || []);
                setDepartments(d?.data?.data || []);
                setPositions(pos?.data?.data || []);

            } catch (e) {
                console.error(e);
            }
        })();

        form.resetFields();
        setDup(false);
        setChecking(false);
    }, [open, form]);

    const checkUsername = (username) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        const u = String(username || '').trim();
        if (!u) {
            setDup(false);
            setChecking(false);
            return;
        }
        setChecking(true);
        timerRef.current = setTimeout(async () => {
            try {
                const { data } = await api.get('/management/check-username', {
                    params: { username: u }
                });
                setDup(!!data?.exists);
            } catch {
                setDup(false);
            } finally {
                setChecking(false);
            }
        }, 400);
    };

    const handleOk = async () => {
        try {
            const vals = await form.validateFields();

            if (dup) {
                form.setFields([{ name: 'username', errors: ['ชื่อผู้ใช้งานนี้ถูกใช้แล้ว'] }]);
                return;
            }

            setLoading(true);

            // ค้นหาชื่อเต็มจาก Code ที่เลือก
            const comp = companies.find(c => c.company_code === vals.company_code)?.company_name_th;
            const br = branches.find(b => b.G_CODE === vals.branch_code)?.G_NAME;
            const dep = departments.find(d => d.G_CODE === vals.dep_code)?.G_NAME;
            const pos = positions.find(p => p.G_CODE === vals.position_code)?.G_NAME;

            const payload = {
                titlename_th: vals.titlename_th,
                firstname_th: vals.firstname_th,
                lastname_th: vals.lastname_th,
                username: vals.username,
                password: vals.password,
                permission_role: vals.permission_role,
                policy_days: policyDays,

                // ข้อมูลผูกสังกัด
                company_code: vals.company_code,
                company: comp,
                branch_code: vals.branch_code,
                branch: br,
                dep_code: vals.dep_code,
                department: dep,
                position_code: vals.position_code,
                position: pos,

                // ข้อมูลเวลาเข้าใช้งาน
                time_login_value: vals.time_login_value,
                time_login_unit: vals.time_login_unit
            };

            const { data } = await api.post('/management/affiliate', payload);

            message.success(`สร้างผู้ใช้งานสำเร็จ (รหัส: ${data?.data?.employee_code})`);
            onSaved?.(data?.data);
            onClose();

        } catch (err) {
            if (err?.errorFields) return;
            console.error(err);
            const msg = err?.response?.data?.message || 'บันทึกไม่สำเร็จ';
            message.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            title={null}
            footer={null}
            closable={false}
            maskClosable={!loading}
            width={800} // ขยาย Modal เล็กน้อยเพื่อรองรับฟิลด์ที่มากขึ้น
            centered
            className="custom-modal-create"
            styles={{ content: { padding: 0, borderRadius: '4px', overflow: 'hidden' } }}
        >
            <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-3 text-blue-800">
                    <div className="w-10 h-10 bg-white rounded-md flex items-center justify-center shadow-sm text-blue-600 text-xl">
                        <BuildOutlined />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold m-0 leading-tight">สร้างผู้ใช้งาน</h3>
                        <span className="text-xs text-blue-600/70">สร้างข้อมูลพนักงานใหม่พร้อมบัญชีผู้ใช้งาน</span>
                    </div>
                </div>
                <button onClick={onClose} disabled={loading} className="text-blue-400 hover:text-blue-700 transition-colors text-3xl">
                    &times;
                </button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto">
                <Form layout="vertical" form={form}>

                    {/* Step 1: Employee Info */}
                    <div className="flex items-center gap-2 mb-4">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">ขั้นตอนที่ 1</span>
                        <span className="text-gray-700 text-sm font-bold">ข้อมูลพนักงานและสังกัด</span>
                        <div className="h-px bg-gray-200 flex-1 ml-2"></div>
                    </div>

                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item name="employee_code" label="ไอดีพนักงาน">
                                <Input disabled placeholder="ระบบกำหนดอัตโนมัติ (99xxxxxx)" className="h-10 bg-gray-50 text-gray-500 cursor-not-allowed rounded-md" prefix={<IdcardOutlined className="text-gray-400" />} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item name="titlename_th" label="คำนำหน้า" rules={[{ required: true, message: 'กรุณาเลือกคำนำหน้า' }]}>
                                {/* 🟢 แก้ไข Select โดยใช้ [&_.ant-select-selector]:rounded-md */}
                                <Select placeholder="เลือกคำนำหน้า" className="h-10 [&_.ant-select-selector]:rounded-md" options={titlenames.map(t => ({ value: t.name_th, label: t.name_th }))} showSearch />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item name="firstname_th" label="ชื่อ (ไทย)" rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}>
                                <Input prefix={<UserOutlined className="text-gray-400" />} placeholder="ชื่อจริง" className="h-10 rounded-md" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item name="lastname_th" label="นามสกุล (ไทย)" rules={[{ required: true, message: 'กรุณากรอกนามสกุล' }]}>
                                <Input placeholder="นามสกุล" className="h-10 rounded-md" />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item name="company_code" label="บริษัท">
                                <Select placeholder="เลือกบริษัท" className="h-10 [&_.ant-select-selector]:rounded-md" showSearch optionFilterProp="label"
                                    options={companies.map(c => ({ value: c.company_code, label: c.company_name_th }))} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item name="branch_code" label="สาขา">
                                <Select placeholder="เลือกสาขา" className="h-10 [&_.ant-select-selector]:rounded-md" showSearch optionFilterProp="label"
                                    options={branches.map(b => ({ value: b.G_CODE, label: b.G_NAME }))} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item name="dep_code" label="แผนก">
                                <Select placeholder="เลือกแผนก" className="h-10 [&_.ant-select-selector]:rounded-md" showSearch optionFilterProp="label"
                                    options={departments.map(d => ({ value: d.G_CODE, label: d.G_NAME }))} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item name="position_code" label="ตำแหน่ง">
                                <Select placeholder="เลือกตำแหน่ง" className="h-10 [&_.ant-select-selector]:rounded-md" showSearch optionFilterProp="label"
                                    options={positions.map(p => ({ value: p.G_CODE, label: p.G_NAME }))} />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Step 2: Account Info */}
                    <div className="flex items-center gap-2 mb-4 mt-2">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">ขั้นตอนที่ 2</span>
                        <span className="text-gray-700 text-sm font-bold">ตั้งค่าบัญชีผู้ใช้</span>
                        <div className="h-px bg-gray-200 flex-1 ml-2"></div>
                    </div>

                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="username"
                                label="กำหนดชื่อผู้ใช้งาน (Username)"
                                rules={[{ required: true, message: 'กรุณากรอกชื่อผู้ใช้งาน' }, { min: 3, message: 'อย่างน้อย 3 ตัวอักษร' }]}
                                validateStatus={checking ? 'validating' : (dup ? 'error' : '')}
                                help={dup ? 'ชื่อผู้ใช้งานนี้ถูกใช้แล้ว' : (checking ? 'กำลังตรวจสอบ...' : null)}
                            >
                                <Input prefix={<SolutionOutlined className="text-gray-400" />} placeholder="ระบุ Username" onChange={(e) => checkUsername(e.target.value)} className="h-10 rounded-md" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item name="permission_role" label="กลุ่มสิทธิ" rules={[{ required: true, message: 'กรุณาเลือกกลุ่มสิทธิ' }]}>
                                <Select placeholder="เลือกกลุ่มสิทธิ" options={(groups || []).map(g => ({ value: g.group_name, label: g.group_name }))} showSearch optionFilterProp="label" className="h-10 [&_.ant-select-selector]:rounded-md" suffixIcon={<SafetyCertificateOutlined className="text-gray-400" />} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item name="password" label="รหัสผ่าน" rules={[{ required: true, message: 'กรุณากรอกรหัสผ่าน' }]} hasFeedback>
                                <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="รหัสผ่าน" className="h-10 rounded-md" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item name="confirm" label="ยืนยันรหัสผ่าน" dependencies={['password']} rules={[{ required: true, message: 'กรุณายืนยันรหัสผ่าน' }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('password') === value) return Promise.resolve(); return Promise.reject(new Error('รหัสผ่านไม่ตรงกัน')); }, })]} hasFeedback>
                                <Input.Password prefix={<CheckCircleFilled className="text-gray-400" />} placeholder="ยืนยันรหัสผ่าน" className="h-10 rounded-md" />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            {/* 🟢 แก้ไขส่วน Space.Compact ให้โค้งเฉพาะขอบนอกสุด (ซ้าย-ขวา) */}
                            <Form.Item label="กำหนดเวลาเข้าใช้งานระบบ">
                                <Space.Compact style={{ width: '100%', height: '40px' }} className="[&_.ant-input-number]:rounded-l-md [&_.ant-select-selector]:rounded-r-md">
                                    <Form.Item
                                        name="time_login_value"
                                        noStyle
                                        initialValue={17}
                                        rules={[{ required: true, message: 'กรุณาเลือกกำหนดเวลาเข้าใช้งานระบบ' }]}
                                    >
                                        <InputNumber min={1} placeholder="ระบุตัวเลขเวลา" style={{ width: '60%', height: '100%' }} />
                                    </Form.Item>

                                    <Form.Item
                                        name="time_login_unit"
                                        noStyle
                                        initialValue="hour"
                                    >
                                        <Select style={{ width: '40%', height: '100%' }}>
                                            <Select.Option value="minute">นาที</Select.Option>
                                            <Select.Option value="hour">ชั่วโมง</Select.Option>
                                        </Select>
                                    </Form.Item>
                                </Space.Compact>
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item label="อายุการใช้งานรหัสผ่าน">
                                <div className="flex justify-between items-center h-10 px-3 bg-gray-50 border border-gray-200 rounded-md cursor-default">
                                    <span className="text-gray-500 text-sm flex items-center gap-2"><SafetyCertificateOutlined className="text-blue-500" /><span>กำหนดโดยระบบ</span></span>
                                    <Tag color="blue" bordered={false} className="m-0 px-2 font-semibold text-sm">{policyDays} วัน</Tag>
                                </div>
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <Button key="ok" type="primary" onClick={handleOk} loading={loading} disabled={dup} className="h-10 px-6 rounded-md !bg-blue-600 hover:!bg-blue-500 border-none shadow-md shadow-blue-200 font-semibold">
                    บันทึกและสร้างผู้ใช้งาน
                </Button>
                <Button key="cancel" onClick={onClose} disabled={loading} className="h-10 px-6 rounded-md border-gray-300 text-gray-600 hover:text-gray-800 hover:border-gray-400">
                    ยกเลิก
                </Button>
            </div>
        </Modal>
    );
};

export default ModalCreate2;