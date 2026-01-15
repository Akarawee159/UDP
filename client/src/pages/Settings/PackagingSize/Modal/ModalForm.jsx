// src/pages/Masterdata/PackagingSize/Modal/ModalForm.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Form, Input, App, Button, ConfigProvider, Spin, InputNumber, Row, Col, AutoComplete, Divider } from 'antd';
import {
    IdcardOutlined,
    TagOutlined,
    PlusCircleOutlined,
    EditOutlined,
    SaveOutlined,
    ColumnWidthOutlined,
    BgColorsOutlined, // ใช้แทน icon weight/capacity
    DeploymentUnitOutlined
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

    // State สำหรับเก็บรายการหน่วยนับ
    const [unitOptions, setUnitOptions] = useState([]);

    const timerRef = useRef(null);

    // ✅ ดึงรายการหน่วยนับ (Counting Unit) เพื่อมาทำ AutoComplete
    const fetchUnits = useCallback(async () => {
        try {
            const res = await api.get('/settings/countingunit');
            const units = res?.data?.data || [];
            // แปลงเป็น format ที่ AutoComplete ต้องการ: { value: 'ชื่อหน่วย' }
            const options = units
                .map(u => ({ value: u.G_NAME }))
                .filter((v, i, a) => a.findIndex(t => t.value === v.value) === i); // unique
            setUnitOptions(options);
        } catch (err) {
            console.error('Failed to fetch counting units', err);
        }
    }, []);

    const fetchDetail = useCallback(async (id) => {
        try {
            setFetching(true);
            const res = await api.get(`/settings/packaging/${id}`);
            const data = res?.data?.data;
            if (data) {
                form.setFieldsValue({
                    G_CODE: data.G_CODE || '',
                    G_NAME: data.G_NAME || '',
                    // Dimensions
                    G_WIDTH: data.G_WIDTH, G_WIDTH_UNIT: data.G_WIDTH_UNIT,
                    G_LENGTH: data.G_LENGTH, G_LENGTH_UNIT: data.G_LENGTH_UNIT,
                    G_HEIGHT: data.G_HEIGHT, G_HEIGHT_UNIT: data.G_HEIGHT_UNIT,
                    // Capacity & Weight
                    G_CAPACITY: data.G_CAPACITY, G_CAPACITY_UNIT: data.G_CAPACITY_UNIT,
                    G_WEIGHT: data.G_WEIGHT, G_WEIGHT_UNIT: data.G_WEIGHT_UNIT,
                });
                setOriginalCode(data.G_CODE || null);
            }
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลขนาดบรรจุภัณฑ์ไม่สำเร็จ');
        } finally {
            setFetching(false);
        }
    }, [form, message]);

    useEffect(() => {
        if (open) {
            fetchUnits(); // โหลดหน่วยนับเมื่อเปิด Modal
            clearTimeout(timerRef.current);
            form.resetFields();
            setOriginalCode(null);

            if (isEditMode) {
                // Set ค่าจาก record ไปก่อน (เผื่อไม่ต้อง fetch detail)
                form.setFieldsValue({
                    G_CODE: record.G_CODE || '',
                    G_NAME: record.G_NAME || '',
                    G_WIDTH: record.G_WIDTH, G_WIDTH_UNIT: record.G_WIDTH_UNIT,
                    G_LENGTH: record.G_LENGTH, G_LENGTH_UNIT: record.G_LENGTH_UNIT,
                    G_HEIGHT: record.G_HEIGHT, G_HEIGHT_UNIT: record.G_HEIGHT_UNIT,
                    G_CAPACITY: record.G_CAPACITY, G_CAPACITY_UNIT: record.G_CAPACITY_UNIT,
                    G_WEIGHT: record.G_WEIGHT, G_WEIGHT_UNIT: record.G_WEIGHT_UNIT,
                });
                setOriginalCode(record.G_CODE || null);
                // Fetch detail เพื่อความชัวร์ (บางที record ในตารางอาจไม่ครบ)
                fetchDetail(record.G_ID);
            }
        }
    }, [open, isEditMode, record, form, fetchDetail, fetchUnits]);

    // Validation เช็ค Code ซ้ำ (เหมือนเดิม)
    const validateCode = (_rule, value) => new Promise((resolve, reject) => {
        const code = (value || '').trim();
        if (!code) return resolve();
        if (isEditMode && code === originalCode) return resolve();

        if (timerRef.current) clearTimeout(timerRef.current);
        setCheckingCode(true);

        timerRef.current = setTimeout(async () => {
            try {
                const res = await api.get('/settings/packaging/check-code', {
                    params: { code, excludeId: isEditMode ? record.G_ID : undefined }
                });
                setCheckingCode(false);
                if (res.data?.exists) {
                    reject(new Error('รหัสนี้มีอยู่แล้ว'));
                } else {
                    resolve();
                }
            } catch (err) {
                setCheckingCode(false);
                reject(new Error('ตรวจสอบรหัสไม่ได้'));
            }
        }, 600);
    });

    const handleOk = async () => {
        try {
            const raw = await form.validateFields();
            // จัดเตรียม Payload
            const payload = {
                ...raw,
                G_CODE: (raw.G_CODE || '').trim(),
                G_NAME: (raw.G_NAME || '').trim(),
            };

            setLoading(true);
            let resData;
            if (isEditMode) {
                const res = await api.put(`/settings/packaging/${record.G_ID}`, payload);
                message.success('อัปเดตข้อมูลสำเร็จ');
                resData = res?.data?.data;
            } else {
                const res = await api.post('/settings/packaging', payload);
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

    // Component สำหรับ Input + Unit (Reusable)
    const SpecInput = ({ label, fieldName, unitName, placeholder }) => (
        <Form.Item label={label} style={{ marginBottom: 0 }}>
            <Row gutter={8}>
                <Col span={14}> {/* หรือ span={13} ตามที่คุณปรับก่อนหน้า */}
                    <Form.Item name={fieldName} noStyle>
                        <InputNumber
                            placeholder={placeholder}
                            style={{ width: '100%' }}
                            min={0}
                            precision={2}   // บังคับเก็บและแสดง 2 ตำแหน่ง
                            step={0.01}     // ให้ปุ่มลูกศรขึ้นลงทีละ 0.01

                        // (Optional) ถ้าอยากให้แสดง 0.00 ตลอดเวลาแม้ตอนพิมพ์
                        // formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        // parser={(value) => value?.replace(/\$\s?|(,*)/g, '')}
                        />
                    </Form.Item>
                </Col>
                <Col span={10}> {/* หรือ span={11} */}
                    <Form.Item name={unitName} noStyle>
                        <AutoComplete
                            options={unitOptions}
                            placeholder="หน่วย"
                            filterOption={(inputValue, option) =>
                                option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                            }
                            popupMatchSelectWidth={false} // ให้ popup กว้างตาม content
                        />
                    </Form.Item>
                </Col>
            </Row>
        </Form.Item>
    );

    return (
        <ConfigProvider theme={{ token: { colorPrimary: '#2563eb', borderRadius: 8 } }}>
            <Modal
                open={open}
                title={null}
                onCancel={handleCancel}
                footer={null}
                width={900} // ขยายความกว้างหน่อย
                closable={false}
                centered
                maskClosable={!loading}
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
                                {isEditMode ? 'แก้ไขข้อมูลขนาดบรรจุภัณฑ์' : 'เพิ่มข้อมูลขนาดบรรจุภัณฑ์'}
                            </h3>
                            <span className="text-xs text-slate-700">
                                {isEditMode ? 'ปรับปรุงรายละเอียดและสเปค' : 'สร้างรายการใหม่'}
                            </span>
                        </div>
                    </div>
                    <button onClick={handleCancel} disabled={loading} className="text-slate-400 hover:text-slate-700 transition-colors text-3xl">&times;</button>
                </div>

                <Spin spinning={fetching} tip="กำลังโหลดข้อมูล...">
                    <div className="p-8">
                        <Form form={form} layout="vertical" autoComplete="off" className="space-y-4">

                            {/* Row 1: Code & Name */}
                            <Row gutter={16}>
                                <Col span={10}>
                                    <Form.Item label="รหัส (Code)" name="G_CODE" rules={[{ required: true, message: 'ระบุรหัส' }, { validator: validateCode }]} hasFeedback validateStatus={checkingCode ? 'validating' : undefined}>
                                        <Input prefix={<IdcardOutlined className="text-gray-400" />} placeholder="เช่น BOX-01" />
                                    </Form.Item>
                                </Col>
                                <Col span={14}>
                                    <Form.Item label="ชื่อบรรจุภัณฑ์" name="G_NAME" rules={[{ required: true, message: 'ระบุชื่อ' }]}>
                                        <Input prefix={<TagOutlined className="text-gray-400" />} placeholder="ชื่อขนาดบรรจุภัณฑ์" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Divider orientation="left" style={{ margin: '10px 0' }}><span className="text-xs text-gray-500">ข้อมูลขนาดและสเปค</span></Divider>

                            {/* Row 2: Width / Length / Height */}
                            <Row gutter={16}>
                                <Col span={8}>
                                    <SpecInput label="ความกว้าง" fieldName="G_WIDTH" unitName="G_WIDTH_UNIT" placeholder="กว้าง" />
                                </Col>
                                <Col span={8}>
                                    <SpecInput label="ความยาว" fieldName="G_LENGTH" unitName="G_LENGTH_UNIT" placeholder="ยาว" />
                                </Col>
                                <Col span={8}>
                                    <SpecInput label="ความสูง" fieldName="G_HEIGHT" unitName="G_HEIGHT_UNIT" placeholder="สูง" />
                                </Col>
                            </Row>

                            {/* Row 3: Capacity / Weight */}
                            <Row gutter={16} className="mt-2">
                                <Col span={12}>
                                    <SpecInput label="ความจุ (Capacity)" fieldName="G_CAPACITY" unitName="G_CAPACITY_UNIT" placeholder="ความจุ" />
                                </Col>
                                <Col span={12}>
                                    <SpecInput label="น้ำหนัก (Weight)" fieldName="G_WEIGHT" unitName="G_WEIGHT_UNIT" placeholder="น้ำหนัก" />
                                </Col>
                            </Row>

                        </Form>
                    </div>
                </Spin>

                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <Button key="submit" type="primary" loading={loading} onClick={handleOk} icon={<SaveOutlined />} className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold">
                        {isEditMode ? 'บันทึก' : 'สร้างข้อมูล'}
                    </Button>
                    <Button key="back" onClick={handleCancel} disabled={loading} className="h-10 px-6 rounded-lg border-gray-300">
                        ยกเลิก
                    </Button>
                </div>
            </Modal>
        </ConfigProvider>
    );
}

export default ModalForm;