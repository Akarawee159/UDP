import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, App, Popconfirm, ConfigProvider, Typography } from 'antd';
import {
    SaveOutlined,
    DeleteOutlined,
    HomeOutlined,
    UserOutlined,
    TeamOutlined,
    PhoneOutlined,
    EnvironmentOutlined,
    EditOutlined,
    UserAddOutlined
} from '@ant-design/icons';
import Modallocation from '../Modal/Modallocation'; // ตรวจสอบ Path import ให้ถูกต้องตามโครงสร้างโปรเจกต์จริง
import api from "../../../../api";

export default function ModalRelativesForm({
    open = false,
    onClose = () => { },
    onSuccess = () => { },
    employeeId,
    employeeCode, // รับมาเผื่อใช้แสดงผลตอนเพิ่ม
    record, // ถ้ามีค่า = แก้ไข (Edit Mode), ถ้าไม่มี = เพิ่ม (Create Mode)
}) {
    const { message } = App.useApp() || { message: { success: console.log, error: console.error } };
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    // ตรวจสอบโหมด
    const isEditMode = !!(record && record.g_id);

    // Modal เลือกพื้นที่
    const [locationOpen, setLocationOpen] = useState(false);

    useEffect(() => {
        if (open) {
            if (isEditMode) {
                // กรณีแก้ไข: Set ค่าเดิม
                form.setFieldsValue({
                    g_full_name: record.g_full_name || '',
                    g_relation: record.g_relation || '',
                    g_address: record.g_address || '',
                    g_phone: record.g_phone || '',
                });
            } else {
                // กรณีเพิ่ม: Reset Form
                form.resetFields();
            }
        }
    }, [open, isEditMode, record, form]);

    // ฟังก์ชันจัดการที่อยู่ (Logic เดิม)
    const handlePickLocation = (locRow) => {
        if (!locRow) {
            setLocationOpen(false);
            return;
        }

        const currentRaw = (form.getFieldValue('g_address') || '').trim();
        let prefixPart = '';
        if (currentRaw) {
            const marker = 'แขวง';
            const idx = currentRaw.indexOf(marker);
            if (idx !== -1) {
                prefixPart = currentRaw.slice(0, idx).trim();
            } else {
                prefixPart = currentRaw;
            }
        }

        const locationText = [
            `แขวง ${locRow.subdistrict_name_th || ''}`,
            `เขต ${locRow.district_name_th || ''}`,
            `จังหวัด ${locRow.province_name_th || ''}`,
            `รหัสไปรษณีย์ ${locRow.zip_code || ''}`,
        ]
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        const addressText = prefixPart
            ? `${prefixPart} ${locationText}`
            : locationText;

        form.setFieldsValue({
            g_address: addressText,
        });

        setLocationOpen(false);
    };

    // ฟังก์ชันบันทึก (รองรับทั้ง Create และ Update)
    const handleFinish = async (values) => {
        try {
            if (!employeeId) {
                message.error('ไม่พบรหัสพนักงาน');
                return;
            }
            setLoading(true);

            if (isEditMode) {
                // --- Update ---
                await api.put(`/relatives/${employeeId}/${record.g_id}`, values);
                message.success('อัปเดตข้อมูลญาติ/ผู้ติดต่อสำเร็จ');
            } else {
                // --- Create ---
                await api.post(`/relatives/${employeeId}`, values);
                message.success('บันทึกข้อมูลญาติ/ผู้ติดต่อใหม่เรียบร้อย');
            }

            onSuccess?.();
            onClose?.();
        } catch (e) {
            console.error(e);
            message.error(e?.response?.data?.message || 'ดำเนินการไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    // ฟังก์ชันลบ (เฉพาะ Edit Mode)
    const handleDelete = async () => {
        try {
            if (!employeeId || !record?.g_id) return;
            setLoading(true);
            await api.delete(`/relatives/${employeeId}/${record.g_id}`);
            message.success('ลบเรียบร้อย');
            onSuccess?.();
            onClose?.();
        } catch (e) {
            console.error(e);
            message.error(e?.response?.data?.message || 'ลบไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ConfigProvider
            theme={{
                token: {
                    // เปลี่ยน Primary Color เป็น Blue 600 (#2563eb) สำหรับทั้ง Edit และ Create
                    colorPrimary: '#2563eb',
                    borderRadius: 8,
                },
            }}
        >
            <Modal
                open={open}
                onCancel={onClose}
                title={null}
                footer={null}
                destroyOnClose
                maskClosable={!loading}
                centered
                width={500}
                styles={{ content: { padding: 0, borderRadius: '16px', overflow: 'hidden' } }}
            >
                {/* Header - เปลี่ยนธีมเป็นสีน้ำเงิน */}
                <div className={`px-6 py-4 flex items-center justify-between border-b ${isEditMode ? 'bg-blue-50 border-blue-100' : 'bg-blue-50 border-blue-100'}`}>
                    <div className={`flex items-center gap-3 ${isEditMode ? 'text-blue-800' : 'text-blue-800'}`}>
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-xl">
                            {isEditMode ? <EditOutlined className="text-blue-600" /> : <UserAddOutlined className="text-blue-600" />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold m-0 leading-tight">
                                {isEditMode ? 'แก้ไขข้อมูลญาติ' : 'เพิ่มญาติ/ผู้ติดต่อ'}
                            </h3>
                            <span className={`text-xs ${isEditMode ? 'text-blue-600/70' : 'text-blue-600/70'}`}>
                                {isEditMode ? 'ปรับปรุงข้อมูลผู้ติดต่อฉุกเฉิน' : `รหัสพนักงาน: ${employeeCode || '-'}`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Form Body */}
                <div className="p-6">
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleFinish}
                        className="space-y-1"
                    >
                        {/* แสดงรหัสพนักงานเฉพาะตอนเพิ่ม เพื่อยืนยันความถูกต้อง (ReadOnly) */}
                        {!isEditMode && (
                            <Form.Item hidden name="employeeCode_hidden" initialValue={employeeCode}>
                                <Input />
                            </Form.Item>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Form.Item
                                label={<span className="font-semibold text-gray-700">ชื่อ-นามสกุล</span>}
                                name="g_full_name"
                                rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}
                            >
                                <Input
                                    prefix={<UserOutlined className="text-gray-400" />}
                                    placeholder="ระบุชื่อ-นามสกุล"
                                    className="h-10 rounded-lg"
                                    allowClear
                                />
                            </Form.Item>

                            <Form.Item
                                label={<span className="font-semibold text-gray-700">ความสัมพันธ์</span>}
                                name="g_relation"
                            >
                                <Input
                                    prefix={<TeamOutlined className="text-gray-400" />}
                                    placeholder="เช่น บิดา, มารดา, พี่"
                                    className="h-10 rounded-lg"
                                    allowClear
                                />
                            </Form.Item>
                        </div>

                        <Form.Item
                            label={<span className="font-semibold text-gray-700">เบอร์โทรศัพท์</span>}
                            name="g_phone"
                        >
                            <Input
                                prefix={<PhoneOutlined className="text-gray-400" />}
                                placeholder="0xx-xxx-xxxx"
                                maxLength={10}
                                showCount
                                className="h-10 rounded-lg"
                                allowClear
                            />
                        </Form.Item>

                        <div className="pt-2">
                            <div className="flex justify-between items-center mb-2">
                                {/* เปลี่ยน Icon เป็นสีน้ำเงิน */}
                                <label className="font-semibold text-gray-700 flex items-center gap-2">
                                    <EnvironmentOutlined className={isEditMode ? "text-blue-500" : "text-blue-500"} /> ที่อยู่
                                </label>
                                {/* เปลี่ยนปุ่มเป็นสีน้ำเงิน */}
                                <Button
                                    type="dashed"
                                    size="small"
                                    icon={<HomeOutlined />}
                                    onClick={() => setLocationOpen(true)}
                                    className={isEditMode
                                        ? "text-blue-600 border-blue-200 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50"
                                        : "text-blue-600 border-blue-200 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50"
                                    }
                                >
                                    เลือกจากระบบ
                                </Button>
                            </div>
                            <Form.Item name="g_address" className="mb-0">
                                <Input.TextArea
                                    rows={4}
                                    placeholder="บ้านเลขที่ หมู่บ้าน ซอย ถนน..."
                                    className="rounded-lg bg-gray-50 border-gray-200 focus:bg-white transition-all"
                                    allowClear
                                />
                            </Form.Item>
                        </div>
                    </Form>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-between items-center gap-3">
                    <div>
                        {isEditMode && (
                            <Popconfirm
                                title="ยืนยันการลบข้อมูล"
                                description="คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้?"
                                okText="ลบข้อมูล"
                                cancelText="ยกเลิก"
                                okButtonProps={{ danger: true }}
                                onConfirm={handleDelete}
                            >
                                <Button
                                    danger
                                    icon={<DeleteOutlined />}
                                    loading={loading}
                                    className="rounded-lg border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300"
                                >
                                    ลบ
                                </Button>
                            </Popconfirm>
                        )}
                    </div>

                    <div className="flex gap-3">
                        {/* เปลี่ยนปุ่มบันทึกเป็นสีน้ำเงิน */}
                        <Button
                            type="primary"
                            onClick={() => form.submit()}
                            loading={loading}
                            icon={<SaveOutlined />}
                            className={`h-10 px-6 rounded-lg border-none font-semibold shadow-md ${isEditMode
                                ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-200'
                                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-200'
                                }`}
                        >
                            {isEditMode ? 'บันทึกแก้ไข' : 'บันทึก'}
                        </Button>
                        <Button
                            onClick={onClose}
                            disabled={loading}
                            className="h-10 px-6 rounded-lg border-gray-300 text-gray-600 hover:text-gray-800 hover:border-gray-400 hover:bg-white"
                        >
                            ยกเลิก
                        </Button>
                    </div>
                </div>

                {/* Modal เลือกพื้นที่ */}
                <Modallocation
                    open={locationOpen}
                    onClose={() => setLocationOpen(false)}
                    onSelect={handlePickLocation}
                />
            </Modal>
        </ConfigProvider>
    );
}