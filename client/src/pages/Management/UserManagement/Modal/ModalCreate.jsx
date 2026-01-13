// src/pages/UserManagement/Modal/ModalCreate.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Form, Select, App, Input, Button, Flex, Typography, Tag } from 'antd'; // ❌ ลบ InputNumber ออก
import {
    UserAddOutlined,
    BranchesOutlined,
    UserOutlined,
    IdcardOutlined,
    BankOutlined,
    SolutionOutlined,
    LockOutlined,
    HomeOutlined,
    SafetyCertificateOutlined,
    CheckCircleFilled
} from '@ant-design/icons';
import api from "../../../../api";

const { Text, Title } = Typography;

const ModalCreate = ({ open, onClose, onSaved }) => {
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [groups, setGroups] = useState([]);
    const [selected, setSelected] = useState(null);

    // ✅ State สำหรับเก็บค่าวันจาก DB
    const [policyDays, setPolicyDays] = useState(90);

    // state และตัวช่วยนับจำนวนต่อสาขา
    const [branchCounts, setBranchCounts] = useState({});

    // Realtime duplicate check state
    const [dup, setDup] = useState(false);
    const [checking, setChecking] = useState(false);
    const timerRef = useRef(null);

    const rtRef = useRef(null);
    const scheduleRefresh = (branch, delay = 250) => {
        if (rtRef.current) clearTimeout(rtRef.current);
        rtRef.current = setTimeout(() => {
            if (branch) fetchEmployees(branch);
            prefetchEligibleCounts(branch ? [branch] : branches);
        }, delay);
    };

    useEffect(() => {
        if (!open) return;

        const onUpsert = (e) => {
            const row = e.detail || {};
            const selectedBranch = form.getFieldValue('branch');

            if (row?.branch) {
                if (selectedBranch && String(selectedBranch) === String(row.branch)) {
                    scheduleRefresh(row.branch);
                } else {
                    prefetchEligibleCounts([row.branch]);
                }
                return;
            }

            if (selectedBranch) scheduleRefresh(selectedBranch);
            else prefetchEligibleCounts(branches);
        };

        const onRemove = () => {
            const selectedBranch = form.getFieldValue('branch');
            if (selectedBranch) scheduleRefresh(selectedBranch);
            else prefetchEligibleCounts(branches);
        };

        window.addEventListener('hrms:user-upsert', onUpsert);
        window.addEventListener('hrms:user-remove', onRemove);
        return () => {
            window.removeEventListener('hrms:user-upsert', onUpsert);
            window.removeEventListener('hrms:user-remove', onRemove);
        };
    }, [open, branches, form]);


    const fullname = useMemo(() => {
        if (!selected) return '-';
        const t = selected.titlename_th || '';
        const f = selected.firstname_th || '';
        const l = selected.lastname_th ? ` ${selected.lastname_th}` : '';
        return `${t}${f}${l}`.trim();
    }, [selected]);

    useEffect(() => {
        if (!open) return;
        (async () => {
            try {
                const { data: b } = await api.get('/management/branches');
                const listBranches = Array.isArray(b?.data) ? b.data : [];
                setBranches(listBranches);

                await prefetchEligibleCounts(listBranches);

                const { data: g } = await api.get('/management/groups');
                setGroups(Array.isArray(g?.data) ? g.data : []);
            } catch (e) {
                message.error('โหลดข้อมูลเริ่มต้นไม่สำเร็จ');
            }
        })();

        // ✅ Fetch Policy Days
        (async () => {
            try {
                const { data } = await api.get('/auth/password-policy');
                if (data?.policy_days) {
                    setPolicyDays(data.policy_days);
                }
            } catch {
                // เงียบไว้ ใช้ค่า default 90
            }
        })();

        form.resetFields();
        setEmployees([]);
        setSelected(null);
        setDup(false);
        setChecking(false);
        if (timerRef.current) clearTimeout(timerRef.current);
    }, [open, form, message]);

    const prefetchEligibleCounts = async (branchList = []) => {
        const entries = await Promise.all(
            branchList.map(async (b) => {
                try {
                    const { data } = await api.get('/management/employees', {
                        params: { branch: b, withoutUsername: '1' }
                    });
                    const list = Array.isArray(data?.data) ? data.data : [];
                    return [b, list.length];
                } catch {
                    return [b, 0];
                }
            })
        );
        setBranchCounts(Object.fromEntries(entries));
    };

    const fetchEmployees = async (branch) => {
        try {
            const { data } = await api.get('/management/employees', { params: { branch, withoutUsername: '1' } });
            setEmployees(Array.isArray(data?.data) ? data.data : []);
        } catch {
            message.error('โหลดรายชื่อพนักงานไม่สำเร็จ');
            setEmployees([]);
        }
    };

    const handleBranchChange = (branch) => {
        form.setFieldsValue({ employee_id: undefined, username: undefined, permission_role: undefined, password: undefined, confirm: undefined });
        setSelected(null);
        setDup(false);
        setChecking(false);
        if (branch) fetchEmployees(branch);
    };

    const handleEmployeeChange = (empId) => {
        const rec = employees.find(e => String(e.employee_id) === String(empId)) || null;
        setSelected(rec);
        form.setFieldsValue({
            username: rec?.username || undefined,
            permission_role: rec?.permission_role || undefined,
            password: undefined,
            confirm: undefined,
        });
        setDup(false);
        setChecking(false);
    };

    const checkUsername = (username) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        const u = String(username || '').trim();
        if (!u || !selected?.employee_id) {
            setDup(false);
            setChecking(false);
            return;
        }
        setChecking(true);
        timerRef.current = setTimeout(async () => {
            try {
                const { data } = await api.get('/management/check-username', {
                    params: { username: u, excludeId: selected.employee_id }
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
            if (!selected?.employee_id) {
                message.warning('กรุณาเลือกพนักงานก่อนทำการบันทึก');
                return;
            }
            if (dup) {
                form.setFields([{ name: 'username', errors: ['ชื่อผู้ใช้งานนี้ถูกใช้แล้ว'] }]);
                return;
            }

            setLoading(true);
            const employee_id = selected.employee_id;
            const u = String(vals.username || '').trim();

            // 1. Update Username
            if (u && u !== String(selected.username || '').trim()) {
                await api.patch(`/management/${employee_id}/username`, { username: u });
            }

            // 2. Update Password (✅ ใช้ policyDays ที่ดึงจาก DB)
            await api.patch(`/management/${employee_id}/password`, {
                new_password: vals.password,
                expiry_days: Number(policyDays || 90)
            });

            // 3. Update Permission
            if (vals.permission_role) {
                await api.patch(`/management/${employee_id}/permission`, { group_name: vals.permission_role });
            }

            // 4. Update Status เป็น 3
            await api.patch(`/management/${employee_id}/status`, { is_status: 3 });

            message.success('สร้างผู้ใช้งานสำเร็จ');
            onSaved?.({
                employee_id,
                username: u || selected.username || '',
                permission_role: vals.permission_role,
                company: selected.company,
                branch: selected.branch,
                titlename_th: selected.titlename_th,
                firstname_th: selected.firstname_th,
                lastname_th: selected.lastname_th,
                profileImg: selected.profileImg || null,
                is_status: 3,
            });

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
            width={600}
            centered
            className="custom-modal-create"
            styles={{ content: { padding: 0, borderRadius: '16px', overflow: 'hidden' } }}
        >
            <div className="bg-gray-200 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3 text-gray-800">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-600 text-xl">
                        <UserAddOutlined />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold m-0 leading-tight">สร้างผู้ใช้งานใหม่</h3>
                        <span className="text-xs text-gray-700">สร้างบัญชีและกำหนดสิทธิการใช้งาน</span>
                    </div>
                </div>
                <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-700 transition-colors text-3xl">
                    &times;
                </button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto">
                <Form layout="vertical" form={form}>

                    {/* Step 1 Badge */}
                    <div className="flex items-center gap-2 mb-4">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">ขั้นตอนที่ 1</span>
                        <span className="text-gray-500 text-sm font-medium">เลือกพนักงาน</span>
                        <div className="h-px bg-gray-100 flex-1 ml-2"></div>
                    </div>

                    <Flex gap="middle" align="start" className="mb-2">
                        <Form.Item name="branch" label="สาขา" rules={[{ required: true, message: 'กรุณาเลือกสาขา' }]} className="flex-1">
                            <Select
                                placeholder="เลือกสาขา"
                                options={(branches || []).map(b => ({
                                    value: b,
                                    label: `${b} (${branchCounts[b] ?? 0})`
                                }))}
                                showSearch
                                optionFilterProp="label"
                                onChange={handleBranchChange}
                                suffixIcon={<BranchesOutlined className="text-gray-400" />}
                                className="h-10"
                            />
                        </Form.Item>
                        <Form.Item name="employee_id" label="พนักงาน (ยังไม่มีบัญชี)" rules={[{ required: true, message: 'กรุณาเลือกพนักงาน' }]} className="flex-1">
                            <Select
                                placeholder="เลือกพนักงาน"
                                options={(employees || []).map(e => ({
                                    value: e.employee_id,
                                    label: `${e.firstname_th || ''} ${e.lastname_th || ''} (${e.employee_id})`
                                }))}
                                showSearch
                                optionFilterProp="label"
                                onChange={handleEmployeeChange}
                                disabled={!form.getFieldValue('branch')}
                                suffixIcon={<UserOutlined className="text-gray-400" />}
                                className="h-10"
                            />
                        </Form.Item>
                    </Flex>

                    {/* Selected User Card Info */}
                    {selected && (
                        <div className="mb-8 bg-gradient-to-r from-rose-50 to-white border border-rose-200 rounded-xl p-4 shadow-sm animate-fadeIn relative overflow-hidden">
                            <IdcardOutlined className="absolute -right-4 -bottom-4 text-8xl text-rose-100/50 pointer-events-none" />
                            <div className="relative z-10">
                                <div className="flex flex-wrap items-center gap-x-3 mb-1">
                                    <div className="text-lg font-bold text-rose-900">
                                        {fullname}
                                    </div>
                                    <div className="px-2 py-0.5 bg-white border border-rose-200 rounded text-xs font-mono text-rose-600 font-semibold flex items-center gap-1">
                                        <span className="opacity-50">ID:</span> {selected.employee_id}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-rose-700/80 font-medium">
                                    <div className="flex items-center gap-1.5">
                                        <HomeOutlined />
                                        <span>{selected.company || '-'}</span>
                                    </div>
                                    <div className="hidden sm:block w-1 h-1 bg-rose-300 rounded-full"></div>
                                    <div className="flex items-center gap-1.5">
                                        <BankOutlined />
                                        <span>{selected.branch || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2 Badge */}
                    <div className={`transition-all duration-300 ${!selected ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">ขั้นตอนที่ 2</span>
                            <span className="text-gray-500 text-sm font-medium">ตั้งค่าบัญชีผู้ใช้</span>
                            <div className="h-px bg-gray-100 flex-1 ml-2"></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Username */}
                            <Form.Item
                                name="username"
                                label="กำหนดชื่อผู้ใช้งาน (Username)"
                                rules={[{ required: true, message: 'กรุณากรอกชื่อผู้ใช้งาน' }, { min: 3, message: 'อย่างน้อย 3 ตัวอักษร' }]}
                                validateStatus={checking ? 'validating' : (dup ? 'error' : '')}
                                help={dup ? 'ชื่อผู้ใช้งานนี้ถูกใช้แล้ว' : (checking ? 'กำลังตรวจสอบ...' : null)}
                                className="md:col-span-2"
                            >
                                <Input
                                    prefix={<SolutionOutlined className="text-gray-400" />}
                                    placeholder="ระบุ Username"
                                    onChange={(e) => checkUsername(e.target.value)}
                                    className="h-10"
                                />
                            </Form.Item>

                            {/* Password */}
                            <Form.Item name="password" label="รหัสผ่าน"
                                rules={[
                                    { required: true, message: 'กรุณากรอกรหัสผ่าน' },
                                    { pattern: strong, message: 'ต้องมี ตัวเล็ก/ใหญ่/ตัวเลข/อักขระพิเศษ และ ≥ 8 ตัว' }
                                ]}
                                hasFeedback>
                                <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="รหัสผ่าน" className="h-10" />
                            </Form.Item>

                            {/* Confirm Password */}
                            <Form.Item name="confirm" label="ยืนยันรหัสผ่าน" dependencies={['password']}
                                rules={[{ required: true, message: 'กรุณายืนยันรหัสผ่าน' }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('password') === value) return Promise.resolve(); return Promise.reject(new Error('รหัสผ่านไม่ตรงกัน')); }, })]}
                                hasFeedback>
                                <Input.Password prefix={<CheckCircleFilled className="text-gray-400" />} placeholder="ยืนยันรหัสผ่าน" className="h-10" />
                            </Form.Item>

                            {/* Permission */}
                            <Form.Item name="permission_role" label="กลุ่มสิทธิ" rules={[{ required: true, message: 'กรุณาเลือกกลุ่มสิทธิ' }]}>
                                <Select
                                    placeholder="เลือกกลุ่มสิทธิ"
                                    options={(groups || []).map(g => ({ value: g.group_name, label: g.group_name }))}
                                    showSearch
                                    optionFilterProp="label"
                                    className="h-10"
                                    suffixIcon={<SafetyCertificateOutlined className="text-gray-400" />}
                                />
                            </Form.Item>

                            {/* ✅ ปรับ UI ใหม่: ใช้ Form.Item เพื่อให้ Label ตรงกับช่องข้างๆ และกำหนดความสูง h-10 */}
                            <Form.Item label="อายุการใช้งานรหัสผ่าน (ตามนโยบายบริษัท)">
                                <div className="flex justify-between items-center h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-blue-200 transition-colors cursor-default">
                                    <span className="text-gray-500 text-sm flex items-center gap-2">
                                        <SafetyCertificateOutlined className="text-blue-500" />
                                        <span>กำหนดโดยระบบ</span>
                                    </span>
                                    <Tag color="blue" bordered={false} className="m-0 px-2 font-semibold text-sm">
                                        {policyDays} วัน
                                    </Tag>
                                </div>
                            </Form.Item>

                        </div>
                    </div>
                </Form>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <Button
                    key="ok"
                    type="primary"
                    onClick={handleOk}
                    loading={loading}
                    disabled={!selected || dup}
                    className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 border-none shadow-md shadow-blue-200 font-semibold"
                >
                    สร้างผู้ใช้งาน
                </Button>
                <Button key="cancel" onClick={onClose} disabled={loading} className="h-10 px-6 rounded-lg border-gray-300 text-gray-600 hover:text-gray-800 hover:border-gray-400">
                    ยกเลิก
                </Button>
            </div>
        </Modal>
    );
};

export default ModalCreate;