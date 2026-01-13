// ModalGroup.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Form, Select, App, Button, Typography, Tag, Avatar } from 'antd';
import {
    UserSwitchOutlined,
    UserOutlined,
    IdcardOutlined,
    BankOutlined,
    SolutionOutlined,
    SafetyCertificateOutlined,
    ArrowRightOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import api from "../../../../api";

const { Text } = Typography;

// รูปโปรไฟล์ เพิ่มฟังก์ชัน buildBase เพื่อหา Base URL ที่ถูกต้อง
const buildBase = () => {
    const base = api.defaults?.baseURL || "";
    return base.replace(/\/api\/?$/, "");
};

const ModalGroup = ({ open, record, onClose, onSaved }) => {
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState([]);

    //  รูปโปรไฟล์ API คำนวณ URL
    const BE_BASE = useMemo(() => buildBase(), []);
    const profileUrl = record?.profileImg ? `${BE_BASE}/img/profile/${record.profileImg}` : null;

    const fullname = useMemo(() => {
        if (!record) return '';
        const t = record.titlename_th || '';
        const f = record.firstname_th || '';
        const l = record.lastname_th ? ` ${record.lastname_th}` : '';
        return `${t}${f}${l}`.trim();
    }, [record]);

    useEffect(() => {
        if (!open) return;

        (async () => {
            try {
                const { data } = await api.get('/management/groups');
                setGroups(Array.isArray(data?.data) ? data.data : []);
            } catch {
                message.error('ไม่สามารถโหลดรายชื่อกลุ่มสิทธิได้');
            }
        })();

        form.setFieldsValue({
            permission_role: record?.permission_role || undefined,
        });

    }, [open, record, form, message]);

    const handleOk = async () => {
        try {
            const { permission_role } = await form.validateFields();
            if (!record?.employee_id) return;
            setLoading(true);
            await api.patch(`/management/${record.employee_id}/permission`, {
                group_name: permission_role,
            });
            message.success('บันทึกกลุ่มสิทธิสำเร็จ');
            onSaved?.(permission_role);
        } catch (err) {
            if (err?.errorFields) return;
            console.error(err);
            message.error('บันทึกไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            title={null} // Hide default title
            footer={null} // Hide default footer
            closable={false} // ซ่อนปุ่ม X ของ Ant Design เดิมใช้ closable ={false}
            maskClosable={!loading}
            centered
            width={500}
            className="custom-modal-group"
            styles={{
                content: { padding: 0, borderRadius: '16px', overflow: 'hidden' }
            }}
        >
            {/* Custom Header - เปลี่ยนธีมเป็นสีน้ำเงิน */}
            <div className="bg-gray-200 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3 text-gray-800">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-600 text-xl">
                        <UserSwitchOutlined />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold m-0 leading-tight">กำหนดกลุ่มสิทธิ</h3>
                        <span className="text-xs text-gray-700">เปลี่ยนแปลงระดับการเข้าถึงของผู้ใช้งาน</span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    disabled={loading}
                    className="text-gray-400 hover:text-gray-700 transition-colors text-3xl"
                >
                    &times;
                </button>
            </div>

            <div className="p-6">
                {/* User Info Card - เปลี่ยนธีมเป็นสีน้ำเงิน */}
                {record && (
                    <div className="relative bg-white border border-blue-100 rounded-xl p-5 shadow-sm mb-6 overflow-hidden group">
                        {/* Decorative background icon */}
                        <SafetyCertificateOutlined className="absolute -right-4 -bottom-4 text-8xl text-blue-50 opacity-50 pointer-events-none" />

                        <div className="relative z-10">
                            <div className="flex items-start gap-4">
                                <div className="p-1 rounded-full border-2 border-blue-100 bg-white">
                                    <Avatar
                                        size={56}
                                        icon={<UserOutlined />}
                                        src={profileUrl}
                                        className="bg-blue-50 text-blue-600"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-lg font-bold text-gray-800 truncate">{fullname}</h4>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 mt-1">
                                        <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded text-xs font-mono border border-gray-100">
                                            <IdcardOutlined className="text-blue-500" /> {record.employee_id}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <SolutionOutlined className="text-blue-500" /> {record.username}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                                        <BankOutlined /> {record.branch || '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Form Section - เปลี่ยนธีมเป็นสีน้ำเงิน */}
                <Form layout="vertical" form={form}>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-semibold text-gray-700">เปลี่ยนกลุ่มสิทธิ (Role)</label>
                            <div className="text-xs text-blue-600 flex items-center gap-1">
                                ปัจจุบัน: <span className="font-bold bg-blue-100 px-2 py-0.5 rounded text-blue-800">{record?.permission_role || '-'}</span>
                            </div>
                        </div>

                        <Form.Item
                            name="permission_role"
                            className="mb-0"
                            rules={[{ required: true, message: 'กรุณาเลือกกลุ่มสิทธิที่ต้องการ' }]}
                        >
                            <Select
                                placeholder="เลือกกลุ่มสิทธิใหม่"
                                options={groups.map(g => ({ value: g.group_name, label: g.group_name }))}
                                showSearch
                                optionFilterProp="label"
                                loading={groups.length === 0}
                                className="h-11 custom-select"
                                suffixIcon={<UserSwitchOutlined className="text-blue-500" />}
                                style={{ width: '100%' }}
                            />
                        </Form.Item>
                    </div>

                    <div className="mt-2 text-xs text-gray-400 px-1">
                        <ArrowRightOutlined className="mr-1" />
                        การเปลี่ยนสิทธิจะมีผลทันที และอาจทำให้ผู้ใช้งานต้องเข้าสู่ระบบใหม่ในบางกรณี
                    </div>
                </Form>
            </div>

            {/* Custom Footer - เปลี่ยนธีมปุ่มเป็นสีน้ำเงิน */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <Button
                    key="ok"
                    type="primary"
                    onClick={handleOk}
                    loading={loading}
                    icon={!loading && <CheckCircleOutlined />}
                    className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 border-none shadow-md shadow-blue-200 font-semibold"
                >
                    อัปเดต
                </Button>
                <Button
                    key="cancel"
                    onClick={onClose}
                    disabled={loading}
                    className="h-10 px-6 rounded-lg border-gray-300 text-gray-600 hover:text-gray-800 hover:border-gray-400 hover:bg-white"
                >
                    ยกเลิก
                </Button>
            </div>
        </Modal>
    );
};

export default ModalGroup;