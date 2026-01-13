// src/pages/Masterdata/Trainings/Modal/ModalForm.jsx
import React, { useState, useEffect } from 'react';
import {
    Row, Col, Input, Select, Button, Table, Typography,
    TimePicker, Card, message, Popconfirm, Tag
} from 'antd';
import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import ThaiDateInput from '../../../../components/form/ThaiDateInput';
import ModalEmployee from './ModalEmployee';
import api from '../../../../api';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

function ModalForm({ isEditMode = false, initialValues = null, onClose, onSuccess }) {
    // --- States ---
    const [coursesList, setCoursesList] = useState([]);
    const [locationsList, setLocationsList] = useState([]);

    // Check Changes State
    const [isChanged, setIsChanged] = useState(false);
    const [originalEmployees, setOriginalEmployees] = useState([]);

    // Form Values
    const [formData, setFormData] = useState({
        courses_code: null,
        courses_name: '',
        start_date: null,
        end_date: null,
        duration_date: '',
        start_time: null,
        end_time: null,
        duration_time: '',
        location_code: null,
        location_name: '',
        remark: '',
    });

    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
    const [searchText, setSearchText] = useState('');

    // Status State
    const [currentStatus, setCurrentStatus] = useState(3);

    // --- 1. Fetch Options ---
    useEffect(() => {
        fetchOptions();
    }, []);

    const fetchOptions = async () => {
        try {
            const res = await api.get('/trainings/options');
            if (res.data.success) {
                setCoursesList(res.data.courses);
                setLocationsList(res.data.locations);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // --- 2. Handle Edit Mode (Populate Data) ---
    useEffect(() => {
        if (isEditMode && initialValues) {
            // Populate Form
            setFormData({
                ...initialValues,
                start_date: initialValues.start_date ? dayjs(initialValues.start_date) : null,
                end_date: initialValues.end_date ? dayjs(initialValues.end_date) : null,
                start_time: initialValues.start_time ? dayjs(initialValues.start_time, 'HH:mm:ss') : null,
                end_time: initialValues.end_time ? dayjs(initialValues.end_time, 'HH:mm:ss') : null,
            });

            const fetchBookingEmployees = async () => {
                try {
                    const res = await api.get(`/trainings/${initialValues.booking_courses_id}/employees`);
                    if (res.data.success) {
                        setSelectedEmployees(res.data.data);
                        setOriginalEmployees(res.data.data);
                    }
                } catch (err) {
                    console.error("Failed to fetch booking employees:", err);
                    message.error("ไม่สามารถดึงรายชื่อพนักงานได้");
                }
            };
            fetchBookingEmployees();

        } else {
            // Reset form for create mode
            setFormData({
                courses_code: null, courses_name: '',
                start_date: null, end_date: null, duration_date: '',
                start_time: null, end_time: null, duration_time: '',
                location_code: null, location_name: '', remark: ''
            });
            setSelectedEmployees([]);
            setOriginalEmployees([]);
            setIsChanged(true);
        }
    }, [isEditMode, initialValues]);

    // --- Calculate Status Real-time ---
    useEffect(() => {
        const calculateStatus = () => {
            if (!formData.start_date || !formData.end_date) return 3;

            const now = dayjs();
            const sDate = formData.start_date.format('YYYY-MM-DD');
            const eDate = formData.end_date.format('YYYY-MM-DD');

            // Handle Time
            const sTime = formData.start_time ? formData.start_time.format('HH:mm:ss') : '00:00:00';
            const eTime = formData.end_time ? formData.end_time.format('HH:mm:ss') : '23:59:59';

            const start = dayjs(`${sDate} ${sTime}`);
            const end = dayjs(`${eDate} ${eTime}`);

            if (now.isBefore(start)) return 3; // Waiting
            if (now.isAfter(end)) return 2; // Done
            return 1; // In Progress
        };
        setCurrentStatus(calculateStatus());
    }, [formData.start_date, formData.end_date, formData.start_time, formData.end_time]);

    // --- Check Changes Logic ---
    useEffect(() => {
        if (!isEditMode) return;

        const checkChanges = () => {
            const val = (v) => v || '';
            const dateStr = (d) => d ? d.format('YYYY-MM-DD') : '';
            const timeStr = (t) => t ? t.format('HH:mm:ss') : '';

            const isFormDirty =
                val(formData.courses_code) !== val(initialValues?.courses_code) ||
                val(formData.courses_name) !== val(initialValues?.courses_name) ||
                val(formData.location_code) !== val(initialValues?.location_code) ||
                val(formData.location_name) !== val(initialValues?.location_name) ||
                val(formData.remark) !== val(initialValues?.remark) ||
                dateStr(formData.start_date) !== val(initialValues?.start_date) ||
                dateStr(formData.end_date) !== val(initialValues?.end_date) ||
                timeStr(formData.start_time) !== val(initialValues?.start_time) ||
                timeStr(formData.end_time) !== val(initialValues?.end_time);

            const currentIds = selectedEmployees.map(e => e.employee_code).sort();
            const originalIds = originalEmployees.map(e => e.employee_code).sort();
            const isEmpDirty = JSON.stringify(currentIds) !== JSON.stringify(originalIds);

            setIsChanged(isFormDirty || isEmpDirty);
        };

        checkChanges();
    }, [formData, selectedEmployees, initialValues, originalEmployees, isEditMode]);

    // --- Duration Calculations ---
    useEffect(() => {
        if (formData.start_date && formData.end_date) {
            const diff = formData.end_date.diff(formData.start_date, 'day') + 1;
            setFormData((prev) => ({ ...prev, duration_date: diff > 0 ? `${diff} วัน` : '' }));
        } else {
            setFormData((prev) => ({ ...prev, duration_date: '' }));
        }
    }, [formData.start_date, formData.end_date]);

    useEffect(() => {
        if (formData.start_time && formData.end_time) {
            const diffMins = formData.end_time.diff(formData.start_time, 'minute');
            const h = Math.floor(diffMins / 60);
            const m = diffMins % 60;
            let str = '';
            if (h > 0) str += `${h} ชั่วโมง `;
            if (m > 0) str += `${m} นาที`;
            setFormData((prev) => ({ ...prev, duration_time: str.trim() }));
        } else {
            setFormData((prev) => ({ ...prev, duration_time: '' }));
        }
    }, [formData.start_time, formData.end_time]);

    // --- Handlers ---
    const handleCourseChange = (val, type) => {
        const target = coursesList.find(c => (type === 'code' ? c.code === val : c.name === val));
        if (target) {
            setFormData(prev => ({ ...prev, courses_code: target.code, courses_name: target.name }));
        } else {
            setFormData(prev => ({
                ...prev,
                courses_code: type === 'code' ? val : prev.courses_code,
                courses_name: type === 'name' ? val : prev.courses_name,
            }));
        }
    };

    const handleLocationChange = (val, type) => {
        const target = locationsList.find(l => (type === 'code' ? l.code === val : l.name === val));
        if (target) {
            setFormData(prev => ({ ...prev, location_code: target.code, location_name: target.name }));
        }
    };

    const handleAddEmployees = (newEmps) => {
        const existingCodes = new Set(selectedEmployees.map((e) => e.employee_code));
        const uniqueNew = newEmps.filter((e) => !existingCodes.has(e.employee_code));
        setSelectedEmployees([...selectedEmployees, ...uniqueNew]);
    };

    const handleRemoveEmployee = (code) => {
        setSelectedEmployees(prev => prev.filter((e) => e.employee_code !== code));
    };

    const handleSubmit = async () => {
        if (!formData.courses_code || !formData.start_date || !formData.end_date) {
            message.warning('กรุณากรอกข้อมูลหลักสูตรและวันที่ให้ครบถ้วน');
            return;
        }

        try {
            const payload = {
                ...formData,
                start_date: formData.start_date.format('YYYY-MM-DD'),
                end_date: formData.end_date.format('YYYY-MM-DD'),
                start_time: formData.start_time ? formData.start_time.format('HH:mm:ss') : null,
                end_time: formData.end_time ? formData.end_time.format('HH:mm:ss') : null,
                selectedEmployees: selectedEmployees,
            };

            if (isEditMode) {
                const id = initialValues.booking_courses_id;
                const res = await api.put(`/trainings/${id}`, payload);
                if (res.data.success) {
                    message.success('แก้ไขข้อมูลสำเร็จ');
                    if (onSuccess) onSuccess();
                }
            } else {
                const res = await api.post('/trainings', payload);
                if (res.data.success) {
                    message.success('บันทึกข้อมูลสำเร็จ');
                    if (onSuccess) onSuccess();
                }
            }
        } catch (err) {
            console.error(err);
            message.error('บันทึกข้อมูลไม่สำเร็จ');
        }
    };

    // ✅ Updated: Helper Render Status Badge
    const getStatusTag = () => {
        // เงื่อนไข: ถ้าไม่มี booking_code (Draft/Create Mode) หรือ ไม่มีผู้เข้าร่วม
        const hasBookingCode = isEditMode && initialValues?.booking_code;
        const hasAttendees = selectedEmployees && selectedEmployees.length > 0;

        if (!hasBookingCode || !hasAttendees) {
            return <Tag color="magenta">โปรดระบุผู้เข้าร่วม</Tag>;
        }

        // กรณีปกติ ดูตาม Time-based Status (currentStatus คำนวณจาก useEffect)
        switch (currentStatus) {
            case 1:
                return <Tag color="success">อยู่ระหว่างอบรม</Tag>;
            case 2:
                return <Tag color="default">อบรมเสร็จสิ้น</Tag>;
            case 3:
                return <Tag color="warning">ยังไม่ถึงวันที่อบรม</Tag>;
            default:
                return null;
        }
    };

    const empColumns = [
        { title: 'รหัสพนักงาน', dataIndex: 'employee_code', key: 'employee_code' },
        { title: 'ชื่อพนักงาน', dataIndex: 'fullname_th', key: 'fullname_th' },
        { title: 'ตำแหน่งงาน', dataIndex: 'position', key: 'position' },
        { title: 'แผนก', dataIndex: 'department', key: 'department' },
        { title: 'ไซต์งาน', dataIndex: 'worksites', key: 'worksites' },
        {
            title: 'วันที่เริ่มงาน',
            dataIndex: 'sign_date',
            key: 'sign_date',
            render: (val) => val ? dayjs(val).add(543, 'year').format('DD/MM/YYYY') : '-'
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <Popconfirm
                    title="ลบพนักงานคนนี้?"
                    description="พนักงานจะถูกนำออกจากหลักสูตรนี้"
                    cancelText="ยกเลิก"
                    okText="ลบออก"
                    okButtonProps={{ type: 'primary', danger: true }}
                    onConfirm={() => handleRemoveEmployee(record.employee_code)}
                >
                    <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
            ),
        },
    ];

    const filteredSelectedEmployees = selectedEmployees.filter(item => {
        const s = searchText.toLowerCase();
        return Object.values(item).some(v => v && String(v).toLowerCase().includes(s));
    });

    return (
        <div style={{ padding: 20, background: '#fff' }}>
            <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 20 }}>
                <Col span={12}>
                    <Title level={3} style={{ margin: 0 }}>
                        {isEditMode ? 'แก้ไขหลักสูตรการอบรม' : 'สร้างหลักสูตรการอบรม'}
                    </Title>
                </Col>
                <Col span={12} style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                    {/* ✅ Display Real-time Status */}
                    <div>สถานะ: {getStatusTag()}</div>
                    <Text type="secondary" strong>
                        {isEditMode && initialValues?.booking_code ? `BOOKING CODE: ${initialValues.booking_code}` : 'DRAFT-ID: AUTO GEN'}
                    </Text>
                </Col>
            </Row>

            <Card style={{ marginBottom: 20 }}>
                <Row gutter={[16, 16]}>
                    <Col span={6}>
                        <label>รหัสหลักสูตร</label>
                        <Select
                            showSearch
                            style={{ width: '100%' }}
                            placeholder="รหัสหลักสูตร"
                            optionFilterProp="children"
                            value={formData.courses_code}
                            onChange={(v) => handleCourseChange(v, 'code')}
                        >
                            {coursesList.map((c) => (<Option key={c.code} value={c.code}>{c.code}</Option>))}
                        </Select>
                    </Col>
                    <Col span={18}>
                        <label>ชื่อหลักสูตร</label>
                        <Select
                            showSearch
                            style={{ width: '100%' }}
                            placeholder="ชื่อหลักสูตร"
                            optionFilterProp="children"
                            value={formData.courses_name}
                            onChange={(v) => handleCourseChange(v, 'name')}
                        >
                            {coursesList.map((c) => (<Option key={c.code} value={c.name}>{c.name}</Option>))}
                        </Select>
                    </Col>
                    <Col span={6}>
                        <label>วันเริ่มอบรม</label>
                        <ThaiDateInput
                            value={formData.start_date}
                            onChange={(d) => setFormData({ ...formData, start_date: d })}
                        />
                    </Col>
                    <Col span={6}>
                        <label>วันสิ้นสุดอบรม</label>
                        <ThaiDateInput
                            value={formData.end_date}
                            onChange={(d) => setFormData({ ...formData, end_date: d })}
                        />
                    </Col>
                    <Col span={12}>
                        <label>ระยะเวลา (วัน)</label>
                        <Input value={formData.duration_date} readOnly style={{ background: '#f5f5f5' }} />
                    </Col>
                    <Col span={6}>
                        <label>เวลาเริ่ม</label>
                        <TimePicker
                            format="HH:mm"
                            style={{ width: '100%' }}
                            value={formData.start_time}
                            onChange={(t) => setFormData({ ...formData, start_time: t })}
                        />
                    </Col>
                    <Col span={6}>
                        <label>เวลาสิ้นสุด</label>
                        <TimePicker
                            format="HH:mm"
                            style={{ width: '100%' }}
                            value={formData.end_time}
                            onChange={(t) => setFormData({ ...formData, end_time: t })}
                        />
                    </Col>
                    <Col span={12}>
                        <label>ระยะเวลา (ชม.)</label>
                        <Input value={formData.duration_time} readOnly style={{ background: '#f5f5f5' }} />
                    </Col>
                    <Col span={6}>
                        <label>รหัสสถานที่</label>
                        <Select
                            showSearch
                            style={{ width: '100%' }}
                            placeholder="รหัสสถานที่"
                            value={formData.location_code}
                            onChange={(v) => handleLocationChange(v, 'code')}
                        >
                            {locationsList.map((l) => (<Option key={l.code} value={l.code}>{l.code}</Option>))}
                        </Select>
                    </Col>
                    <Col span={18}>
                        <label>สถานที่อบรม</label>
                        <Select
                            showSearch
                            style={{ width: '100%' }}
                            placeholder="สถานที่อบรม"
                            value={formData.location_name}
                            onChange={(v) => handleLocationChange(v, 'name')}
                        >
                            {locationsList.map((l) => (<Option key={l.code} value={l.name}>{l.name}</Option>))}
                        </Select>
                    </Col>
                    <Col span={24}>
                        <label>หมายเหตุ</label>
                        <TextArea
                            rows={2}
                            value={formData.remark}
                            onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                        />
                    </Col>
                </Row>
            </Card>

            <Card style={{ marginBottom: 20 }}>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col span={12}>
                        <Title level={5}>รายชื่อพนักงานที่เข้าร่วมอบรม</Title>
                        <Input
                            placeholder="ค้นหาในรายการที่เลือก..."
                            style={{ width: '100%', marginTop: 8 }}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </Col>
                    <Col span={12} style={{ textAlign: 'right', display: 'flex', alignItems: 'end', justifyContent: 'flex-end' }}>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsEmpModalOpen(true)}>
                            เลือกพนักงาน
                        </Button>
                    </Col>
                </Row>

                <Table
                    dataSource={filteredSelectedEmployees}
                    columns={empColumns}
                    rowKey="employee_code"
                    pagination={{ pageSize: 10 }}
                    size="small"
                    bordered
                />
            </Card>

            <Row justify="end" gutter={16}>
                <Col>
                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        onClick={handleSubmit}
                        disabled={isEditMode && !isChanged}
                    >
                        {isEditMode ? 'บันทึกการแก้ไข' : 'สร้างหลักสูตรการอบรม'}
                    </Button>
                </Col>
                <Col>
                    <Button onClick={onClose}>ยกเลิก</Button>
                </Col>
            </Row>

            <ModalEmployee
                open={isEmpModalOpen}
                onCancel={() => setIsEmpModalOpen(false)}
                onConfirm={handleAddEmployees}
                existingData={selectedEmployees}
            />
        </div>
    );
}

export default ModalForm;