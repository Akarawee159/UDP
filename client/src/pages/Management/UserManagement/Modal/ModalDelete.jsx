// src/pages/UserManagement/Modal/ModalDelete.jsx
import React, { useMemo } from 'react';
import { Modal, App, Button, Typography, Avatar } from 'antd';
import {
    ExclamationCircleFilled,
    UserOutlined,
    IdcardOutlined,
    BankOutlined,
    SolutionOutlined,
    SafetyCertificateOutlined,
    DeleteOutlined,
    WarningOutlined
} from '@ant-design/icons';
import api from "../../../../api";

const { Text } = Typography;

// ✅ เพิ่มฟังก์ชัน buildBase เหมือนใน ModalSetting เพื่อหา Base URL ที่ถูกต้อง
const buildBase = () => {
    const base = api.defaults?.baseURL || "";
    return base.replace(/\/api\/?$/, ""); // Convert from .../api → ...
};

const ModalDelete = ({ open, record, onClose, onDeleted }) => {
    const { message } = App.useApp();
    const [loading, setLoading] = React.useState(false);

    // ✅ คำนวณ URL ของรูปโปรไฟล์
    const BE_BASE = useMemo(() => buildBase(), []);
    const profileUrl = record?.profileImg ? `${BE_BASE}/img/profile/${record.profileImg}` : null;

    const fullname = useMemo(() => {
        if (!record) return '-';
        const t = record.titlename_th || '';
        const f = record.firstname_th || '';
        const l = record.lastname_th ? ` ${record.lastname_th}` : '';
        return `${t}${f}${l}`.trim();
    }, [record]);

    const handleDelete = async () => {
        if (!record?.employee_id) return;
        setLoading(true);
        try {
            await api.patch(`/management/${record.employee_id}/clear-account`);
            message.success('ลบผู้ใช้งาน (เคลียร์ข้อมูล) สำเร็จ');
            onDeleted?.(record.employee_id);
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.message || 'ลบผู้ใช้งานไม่สำเร็จ';
            message.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title={null} // Custom Header
            footer={null} // Custom Footer
            closable={false} // ซ่อนปุ่ม X ของ Ant Design เดิมใช้ closable ={false}
            maskClosable={!loading}
            centered
            width={480}
            className="custom-modal-delete"
            styles={{
                content: { padding: 0, borderRadius: '16px', overflow: 'hidden' }
            }}
        >
            {/* Custom Header (Red for Danger) */}
            <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center justify-between">
                <div className="flex items-center gap-3 text-red-800">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-red-500 text-xl">
                        <DeleteOutlined />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold m-0 leading-tight">ยืนยันการลบผู้ใช้งาน</h3>
                        <span className="text-xs text-red-600/70">การดำเนินการนี้ไม่สามารถกู้คืนได้</span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    disabled={loading}
                    className="text-red-400 hover:text-red-700 transition-colors text-3xl"
                >
                    &times;
                </button>
            </div>

            {record ? (
                <div className="p-6">
                    {/* Warning Banner */}
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6 flex gap-3 items-start">
                        <WarningOutlined className="text-orange-500 mt-1 text-lg" />
                        <div>
                            <div className="font-bold text-orange-800 text-sm mb-1">เคลียร์ข้อมูลบัญชีผู้ใช้ (Soft Delete)</div>
                            <p className="text-xs text-orange-700/80 leading-relaxed">
                                ระบบจะทำการลบข้อมูลการเข้าสู่ระบบ (Username, Password, Role) ออกทั้งหมด แต่ข้อมูลประวัติพนักงานจะยังคงอยู่ในฐานข้อมูล
                            </p>
                        </div>
                    </div>

                    {/* User Card */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
                        {/* Background Decor */}
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <UserOutlined style={{ fontSize: '80px' }} />
                        </div>

                        <div className="flex items-center gap-4 relative z-10">
                            <div className="p-1 rounded-full border border-gray-100 bg-white">
                                {/* ✅ แก้ไข src ให้ใช้ตัวแปร profileUrl ที่คำนวณไว้ */}
                                <Avatar
                                    size={56}
                                    icon={<UserOutlined />}
                                    src={profileUrl}
                                    className="bg-gray-100 text-gray-400"
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="text-lg font-bold text-gray-800 truncate">{fullname}</h4>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                                    <span className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                        <IdcardOutlined /> {record.employee_id}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <BankOutlined /> {record.branch}
                                    </span>
                                </div>
                                <div className="mt-2 flex items-center gap-3 text-xs">
                                    <span className="flex items-center gap-1 text-gray-600 font-medium">
                                        <SolutionOutlined /> {record.username}
                                    </span>
                                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 flex items-center gap-1">
                                        <SafetyCertificateOutlined /> {record.permission_role || '-'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 text-center">
                        <p className="text-gray-600 text-sm">
                            คุณแน่ใจหรือไม่ว่าต้องการลบสิทธิ์การใช้งานของ <br />
                            <span className="font-bold text-gray-800">{fullname}</span> ?
                        </p>
                    </div>
                </div>
            ) : (
                <div className="p-8 text-center text-gray-500">ไม่พบข้อมูลผู้ใช้งาน</div>
            )}

            {/* Custom Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <Button
                    danger
                    type="primary"
                    onClick={handleDelete}
                    loading={loading}
                    icon={<DeleteOutlined />}
                    className="h-10 px-6 rounded-lg shadow-md font-semibold"
                >
                    ยืนยันการลบ
                </Button>
                <Button
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

export default ModalDelete;