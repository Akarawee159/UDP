import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Button, App, Popconfirm, ConfigProvider } from 'antd';
import {
    SaveOutlined,
    DeleteOutlined,
    EditOutlined,
    FileAddOutlined,
    UserOutlined,
    BankOutlined,
    PhoneOutlined,
    DollarOutlined,
    TeamOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from "../../../../api";
import { ThaiDateInput } from '../../../../components/form/ThaiDateInput';

const DATE_FORMAT = 'DD/MM/YYYY';

export default function ModalWorkHistoryForm({
    open = false,
    onClose = () => { },
    onSuccess,
    employeeId,
    employeeCode,
    record
}) {
    const { message } = App.useApp() || { message: { success: console.log, error: console.error } };
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    const isEditMode = !!(record && (record.wh_id || record.id));

    useEffect(() => {
        if (open) {
            if (isEditMode) {
                // --- Edit Mode ---
                const fetchData = async () => {
                    const whId = record.wh_id || record.id;
                    try {
                        const { data } = await api.get(`/workhistory/detail/${whId}`);
                        const r = data?.data || record;

                        form.setFieldsValue({
                            wh_company_name: r.wh_company_name || '',
                            wh_phone: r.wh_phone || '',
                            wh_position: r.wh_position || '',
                            wh_salary: r.wh_salary ?? null,
                            wh_supervisor_name: r.wh_supervisor_name || '',
                            wh_supervisor_position: r.wh_supervisor_position || '',
                            wh_supervisor_phone: r.wh_supervisor_phone || '',
                            wh_job_description: r.wh_job_description || '',
                            wh_start_date: r.wh_start_date ? dayjs(r.wh_start_date) : null,
                            wh_end_date: r.wh_end_date ? dayjs(r.wh_end_date) : null,
                            wh_reason_for_leaving: r.wh_reason_for_leaving || ''
                        });
                    } catch (e) {
                        console.error("Fetch detail error", e);
                        form.setFieldsValue({
                            ...record,
                            wh_start_date: record.wh_start_date ? dayjs(record.wh_start_date) : null,
                            wh_end_date: record.wh_end_date ? dayjs(record.wh_end_date) : null,
                        });
                    }
                };
                fetchData();
            } else {
                // --- Create Mode ---
                form.resetFields();
                form.setFieldsValue({
                    wh_start_date: dayjs(),
                });
            }
        }
    }, [open, isEditMode, record, form]);

    const onFinish = async (values) => {
        try {
            setSubmitting(true);
            const payload = { ...values };

            ['wh_start_date', 'wh_end_date'].forEach(k => {
                if (payload[k]) payload[k] = dayjs(payload[k]).format('YYYY-MM-DD');
            });

            if (isEditMode) {
                const whId = record.wh_id || record.id;
                await api.put(`/workhistory/${whId}`, payload);
                message.success('อัปเดตประวัติการทำงานสำเร็จ');
            } else {
                if (!employeeId) {
                    message.error('ไม่พบรหัสพนักงาน');
                    setSubmitting(false);
                    return;
                }
                await api.post(`/workhistory/${employeeId}`, payload);
                message.success('บันทึกประวัติการทำงานแล้ว');
            }

            onSuccess?.();
            onClose();
        } catch (e) {
            console.error(e);
            message.error(e?.response?.data?.message || 'ดำเนินการไม่สำเร็จ');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!isEditMode) return;
        try {
            setSubmitting(true);
            const whId = record.wh_id || record.id;
            await api.delete(`/workhistory/${whId}`);
            message.success('ลบประวัติการทำงานสำเร็จ');
            onSuccess?.();
            onClose();
        } catch (e) {
            console.error(e);
            message.error(e?.response?.data?.message || 'ลบไม่สำเร็จ');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ConfigProvider
            theme={{
                token: {
                    // เปลี่ยน Primary Color เป็น Blue 600 (#2563eb)
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
                onCancel={onClose}
                title={null}
                footer={null}
                destroyOnClose
                width={800}
                maskClosable={!submitting}
                centered
                className="custom-modal-work-history"
                styles={{ content: { padding: 0, borderRadius: '16px', overflow: 'hidden' } }}
            >
                {/* Header - เปลี่ยนธีมเป็นสีน้ำเงิน */}
                <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-blue-800">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-600 text-xl">
                            {isEditMode ? <EditOutlined /> : <FileAddOutlined />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold m-0 leading-tight">
                                {isEditMode ? "แก้ไขประวัติการทำงาน" : "บันทึกประวัติการทำงาน"}
                            </h3>
                            <span className="text-xs text-blue-600/70">
                                {isEditMode ? "ปรับปรุงข้อมูลการทำงานเดิม" : "เพิ่มข้อมูลประสบการณ์ทำงานใหม่"}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-6 max-h-[75vh] overflow-y-auto">
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={onFinish}
                        size="middle"
                    >
                        {/* Read-only Employee Code (Create Mode Only) */}
                        {!isEditMode && (
                            <div className="mb-6 bg-gray-50 p-3 rounded-lg border border-gray-200 flex items-center gap-3">
                                <UserOutlined className="text-gray-400" />
                                <span className="text-gray-500 text-sm">เพิ่มข้อมูลให้กับพนักงานรหัส:</span>
                                <span className="font-bold text-gray-700">{employeeCode || '-'}</span>
                            </div>
                        )}

                        {/* Section 1: ข้อมูลทั่วไป - เปลี่ยนสีหัวข้อ */}
                        <h4 className="text-sm font-bold text-blue-600 mb-3 flex items-center gap-2">
                            <BankOutlined /> ข้อมูลบริษัทเดิม
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                            <Form.Item label="ชื่อสถานประกอบการ" name="wh_company_name">
                                <Input placeholder="ชื่อบริษัท" className="rounded-lg" />
                            </Form.Item>
                            <Form.Item label="เบอร์โทรศัพท์" name="wh_phone">
                                <Input prefix={<PhoneOutlined className="text-gray-400" />} placeholder="เบอร์โทรศัพท์บริษัท" maxLength={10} className="rounded-lg" />
                            </Form.Item>
                            <Form.Item label="ตำแหน่ง" name="wh_position">
                                <Input placeholder="ตำแหน่งที่ทำ" className="rounded-lg" />
                            </Form.Item>
                            <Form.Item label="เงินเดือน" name="wh_salary">
                                <InputNumber
                                    min={0}
                                    style={{ width: '100%' }}
                                    placeholder="0.00"
                                    prefix={<DollarOutlined className="text-gray-400" />}
                                    className="rounded-lg w-full"
                                />
                            </Form.Item>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <Form.Item label="วันที่เข้าทำงาน" name="wh_start_date">
                                <ThaiDateInput />
                            </Form.Item>
                            <Form.Item label="วันที่ออกจากงาน" name="wh_end_date">
                                <ThaiDateInput />
                            </Form.Item>
                        </div>

                        <Form.Item label="ลักษณะงานที่ทำ" name="wh_job_description">
                            <Input.TextArea rows={3} placeholder="รายละเอียดหน้าที่ความรับผิดชอบ" className="rounded-lg" />
                        </Form.Item>

                        <div className="border-t border-gray-100 my-6"></div>

                        {/* Section 2: หัวหน้างาน - เปลี่ยนสีหัวข้อ */}
                        <h4 className="text-sm font-bold text-blue-600 mb-3 flex items-center gap-2">
                            <TeamOutlined /> ข้อมูลหัวหน้างาน / การลาออก
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Form.Item label="ชื่อผู้บังคับบัญชา" name="wh_supervisor_name">
                                <Input placeholder="ชื่อหัวหน้า" className="rounded-lg" />
                            </Form.Item>
                            <Form.Item label="ตำแหน่งของหัวหน้า" name="wh_supervisor_position">
                                <Input placeholder="ตำแหน่ง" className="rounded-lg" />
                            </Form.Item>
                            <Form.Item label="เบอร์โทรศัพท์ (หัวหน้า)" name="wh_supervisor_phone">
                                <Input placeholder="เบอร์ติดต่อ" maxLength={10} className="rounded-lg" />
                            </Form.Item>
                        </div>

                        <Form.Item label="สาเหตุที่ออก" name="wh_reason_for_leaving">
                            <Input.TextArea rows={2} placeholder="ระบุสาเหตุการลาออก" className="rounded-lg" />
                        </Form.Item>
                    </Form>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-between items-center">
                    <div>
                        {isEditMode && (
                            <Popconfirm
                                title="ยืนยันการลบข้อมูล"
                                description="คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการทำงานนี้?"
                                okText="ลบข้อมูล"
                                cancelText="ยกเลิก"
                                okButtonProps={{ danger: true }}
                                onConfirm={handleDelete}
                            >
                                <Button
                                    danger
                                    icon={<DeleteOutlined />}
                                    loading={submitting}
                                    className="rounded-lg border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300"
                                >
                                    ลบรายการ
                                </Button>
                            </Popconfirm>
                        )}
                    </div>

                    <div className="flex gap-3">
                        {/* เปลี่ยนปุ่มบันทึกเป็นสีน้ำเงิน */}
                        <Button
                            type="primary"
                            onClick={() => form.submit()}
                            loading={submitting}
                            icon={<SaveOutlined />}
                            className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 border-none shadow-md shadow-blue-200 font-semibold"
                        >
                            {isEditMode ? 'บันทึกการเปลี่ยนแปลง' : 'บันทึกข้อมูล'}
                        </Button>
                        <Button
                            onClick={onClose}
                            disabled={submitting}
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