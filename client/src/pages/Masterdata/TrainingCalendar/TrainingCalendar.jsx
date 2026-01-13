import React, { useState, useEffect, useRef } from 'react';
import { Spin, message, Modal, ConfigProvider, Button, Tag, Typography } from 'antd';
import {
    ClockCircleOutlined,
    TeamOutlined,
    EnvironmentOutlined,
    CalendarOutlined,
    InfoCircleOutlined,
    CheckCircleOutlined,
    EditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/th';

// --- FullCalendar Imports ---
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import thLocale from '@fullcalendar/core/locales/th';

import api from '../../../api';

// นำเข้า ModalForm (ตรวจสอบ Path ให้ถูกต้องตามโครงสร้างโปรเจกต์ของคุณ)
// สมมติว่า TrainingCalendar อยู่ใน folder แยก และ ModalForm อยู่ใน Trainings/Modal
import ModalForm from '../Trainings/Modal/ModalForm';

const { Text } = Typography;

function TrainingCalendar() {
    const [loading, setLoading] = useState(false);
    const [events, setEvents] = useState([]);

    // --- State สำหรับ Modal แก้ไข/สร้าง (ModalForm) ---
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formMode, setFormMode] = useState('create'); // 'create' | 'edit'
    const [formInitialValues, setFormInitialValues] = useState(null);

    // --- State สำหรับ Modal ยืนยันการ Drag & Drop ---
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [dragModalData, setDragModalData] = useState(null);

    const calendarRef = useRef(null);

    useEffect(() => {
        fetchData();
    }, []);

    // 1. ดึงข้อมูล
    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/trainings');
            if (res.data?.success) {
                const mappedEvents = (res.data.data || []).flatMap(item => {
                    // --- ✅ เพิ่ม Logic กรองข้อมูลตรงนี้ ---

                    // 1. แปลงจำนวนผู้เข้าร่วมเป็นตัวเลข
                    const attendeeCount = Number(item.attendees || 0);

                    // 2. ตรวจสอบเงื่อนไขที่ไม่ต้องการให้แสดง
                    // - booking_code เป็นค่าว่าง / null / "DRAFT"
                    // - หรือ ไม่มีผู้เข้าร่วม (attendeeCount เป็น 0)
                    if (!item.booking_code || item.booking_code === 'DRAFT' || attendeeCount === 0) {
                        return []; // ไม่แสดงรายการนี้ในปฏิทิน
                    }

                    // --- จบ Logic กรองข้อมูล ---

                    const hasTime = item.start_time && item.end_time;
                    const startDate = dayjs(item.start_date);
                    const endDate = dayjs(item.end_date);

                    // ธีมสี (Blue Gradient Feel)
                    const baseColor = '#eff6ff'; // blue-50
                    const borderColor = '#3b82f6'; // blue-500
                    const textColor = '#1e40af'; // blue-800

                    if (!hasTime) {
                        return [{
                            id: item.booking_courses_id.toString(),
                            groupId: item.booking_courses_id.toString(),
                            title: item.courses_name,
                            start: startDate.format('YYYY-MM-DD'),
                            end: endDate.add(1, 'day').format('YYYY-MM-DD'),
                            allDay: true,
                            backgroundColor: '#2563eb',
                            borderColor: '#1d4ed8',
                            textColor: '#ffffff',
                            extendedProps: { ...item }
                        }];
                    }

                    const dailyEvents = [];
                    let current = startDate;
                    while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
                        const dateStr = current.format('YYYY-MM-DD');
                        dailyEvents.push({
                            id: `${item.booking_courses_id}_${dateStr}`,
                            groupId: item.booking_courses_id.toString(),
                            title: item.courses_name,
                            start: `${dateStr}T${item.start_time}`,
                            end: `${dateStr}T${item.end_time}`,
                            allDay: false,
                            backgroundColor: baseColor,
                            borderColor: borderColor,
                            textColor: textColor,
                            extendedProps: { ...item }
                        });
                        current = current.add(1, 'day');
                    }
                    return dailyEvents;
                });
                setEvents(mappedEvents);
            }
        } catch (err) {
            console.error(err);
            message.error('ไม่สามารถดึงข้อมูลตารางอบรมได้');
        } finally {
            setLoading(false);
        }
    };

    // 2. Trigger เมื่อมีการ Drag/Drop หรือ Resize (จัดการผ่าน Modal ยืนยัน)
    const onEventDropOrResize = (info) => {
        const { event, oldEvent } = info;
        const originalData = event.extendedProps;
        const newStart = dayjs(event.start);
        const oldStart = dayjs(oldEvent.start);

        // คำนวณวันขยับ
        const dayDiff = newStart.startOf('day').diff(oldStart.startOf('day'), 'day');

        const originalStartDate = dayjs(originalData.start_date);
        const originalEndDate = dayjs(originalData.end_date);

        const updatedStartDate = originalStartDate.add(dayDiff, 'day');
        const updatedEndDate = originalEndDate.add(dayDiff, 'day');

        const updatedStartTime = event.allDay ? null : dayjs(event.start).format('HH:mm');
        const updatedEndTime = event.allDay ? null : dayjs(event.end).format('HH:mm');

        setDragModalData({
            info,
            originalData,
            updatedStartDate,
            updatedEndDate,
            updatedStartTime,
            updatedEndTime,
            isAllDay: event.allDay
        });
        setIsConfirmModalOpen(true);
    };

    const handleConfirmUpdate = async () => {
        if (!dragModalData) return;
        const { originalData, updatedStartDate, updatedEndDate, updatedStartTime, updatedEndTime, info } = dragModalData;

        try {
            setLoading(true);
            setIsConfirmModalOpen(false);

            const empRes = await api.get(`/trainings/${originalData.booking_courses_id}/employees`);
            const currentEmployees = empRes.data?.data || [];

            const payload = {
                ...originalData,
                start_date: updatedStartDate.format('YYYY-MM-DD'),
                end_date: updatedEndDate.format('YYYY-MM-DD'),
                start_time: updatedStartTime,
                end_time: updatedEndTime,
                selectedEmployees: currentEmployees
            };

            const res = await api.put(`/trainings/${originalData.booking_courses_id}`, payload);
            if (res.data.success) {
                message.success({ content: 'อัปเดตตารางอบรมเรียบร้อยแล้ว', icon: <CheckCircleOutlined className="text-green-500" /> });
                fetchData();
            }
        } catch (err) {
            console.error(err);
            message.error('เกิดข้อผิดพลาดในการอัปเดต');
            info.revert();
        } finally {
            setLoading(false);
            setDragModalData(null);
        }
    };

    const handleCancelUpdate = () => {
        if (dragModalData?.info) dragModalData.info.revert();
        setIsConfirmModalOpen(false);
        setDragModalData(null);
    };

    // 3. คลิกที่ Event -> เปิด ModalForm (Edit Mode)
    const handleEventClick = (info) => {
        const { extendedProps } = info.event;
        setFormMode('edit');
        setFormInitialValues(extendedProps);
        setIsFormModalOpen(true);
    };

    // 4. คลิกที่ Date Cell -> เปิด ModalForm (Create Mode) พร้อมวันที่เลือก
    const handleDateClick = (info) => {
        setFormMode('create');
        // ส่งวันที่ที่คลิกไปเป็นค่าเริ่มต้น (ModalForm จะต้องรองรับ logic นี้ใน useEffect)
        setFormInitialValues({
            start_date: dayjs(info.dateStr), // info.dateStr format: YYYY-MM-DD
            end_date: dayjs(info.dateStr)    // set end_date เป็นวันเดียวกันไปก่อน
        });
        setIsFormModalOpen(true);
    };

    // 5. ปิด ModalForm และ Refresh ข้อมูลถ้าสำเร็จ
    const handleFormClose = () => {
        setIsFormModalOpen(false);
        setFormInitialValues(null);
    };

    const handleFormSuccess = () => {
        setIsFormModalOpen(false);
        setFormInitialValues(null);
        fetchData();
    };

    // Custom Render Event Content
    const renderEventContent = (eventInfo) => {
        const { extendedProps } = eventInfo.event;
        const isAllDay = eventInfo.event.allDay;

        // 1. คำนวณช่วงวันที่ (วว/ดด - วว/ดด)
        const startDate = dayjs(extendedProps.start_date);
        const endDate = dayjs(extendedProps.end_date);
        const dateRangeText = `${startDate.format('DD/MM')} - ${endDate.format('DD/MM')}`;

        // 2. คำนวณช่วงเวลา (HH:mm - HH:mm) 
        // ไม่ใช้ eventInfo.timeText เดิม เพื่อควบคุม Format ให้เป๊ะ
        const timeStart = dayjs(eventInfo.event.start).format('HH:mm');
        const timeEnd = eventInfo.event.end ? dayjs(eventInfo.event.end).format('HH:mm') : '';
        const timeRangeText = timeEnd ? `${timeStart} - ${timeEnd}` : timeStart;

        // กรณี All Day (แถบสีทึบ)
        if (isAllDay) {
            return (
                <div className="w-full h-full px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 transition-colors text-white overflow-hidden shadow-sm border border-blue-800 flex flex-col justify-center">
                    <div className="text-xs font-semibold truncate">{eventInfo.event.title}</div>
                    <div className="text-[10px] opacity-90 truncate flex items-center gap-1">
                        <CalendarOutlined style={{ fontSize: '9px' }} /> {dateRangeText}
                    </div>
                    {/* ✅ เพิ่ม: แสดงจำนวนผู้เข้าอบรม (ถ้ามี) */}
                    {extendedProps.attendees > 0 && (
                        <div className="text-[10px] opacity-90 truncate flex items-center gap-1 mt-0.5">
                            <TeamOutlined style={{ fontSize: '9px' }} /> {extendedProps.attendees} คน
                        </div>
                    )}
                </div>
            );
        }

        // กรณี Time Grid / Day Grid (แถบสีอ่อน)
        return (
            <div className="flex flex-col h-full w-full overflow-hidden p-1.5 rounded-l-md border-l-4 border-blue-500 bg-blue-50/90 hover:bg-blue-100 transition-colors text-blue-900 shadow-sm">
                <div className="flex flex-wrap items-center gap-1 mb-1">
                    {/* ✅ แก้ไข: แสดงเวลาเริ่ม - สิ้นสุด พร้อมไอคอน */}
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1 rounded flex items-center gap-1">
                        <ClockCircleOutlined style={{ fontSize: '9px' }} />
                        {timeRangeText} น.
                    </span>
                    <span className="text-[9px] text-slate-500 bg-white/50 px-1 rounded border border-slate-200">
                        {dateRangeText}
                    </span>
                    {/* ✅ เพิ่ม: แสดงจำนวนผู้เข้าอบรม (ถ้ามี) */}
                    {extendedProps.attendees > 0 && (
                        <div className="text-[10px] opacity-90 truncate flex items-center gap-1 mt-0.5">
                            <TeamOutlined style={{ fontSize: '9px' }} /> {extendedProps.attendees} คน
                        </div>
                    )}
                </div>

                <div className="font-bold text-[11px] leading-tight mb-1 truncate">
                    {eventInfo.event.title}
                </div>

                <div className="mt-auto space-y-0.5">
                    {extendedProps.location_name && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 truncate">
                            <EnvironmentOutlined /> {extendedProps.location_name}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Styles properties for FullScreen Modal (เลียนแบบหน้า Trainings.jsx)
    const fullScreenModalProps = {
        footer: null,
        destroyOnHidden: true,
        maskClosable: false,
        keyboard: false,
        width: "100vw",
        style: { top: 0, padding: 0, margin: 0, width: '100vw', maxWidth: '100vw', borderRadius: 0 },
        styles: {
            content: { height: '100vh', padding: 0, borderRadius: 0, display: 'flex', flexDirection: 'column' },
            header: { padding: '16px 24px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 18, color: '#1e40af' },
            body: { flex: 1, overflow: 'auto', padding: 24, background: '#f9fafb' },
        },
        title: null,
    };

    // --- เพิ่ม: Logic คำนวณจำนวนสำหรับแสดงผล ---
    const now = dayjs();

    // 1. จำนวนอบรมในเดือนนี้ (นับเฉพาะ Unique ID)
    const monthlyCount = new Set(
        events.filter(e => dayjs(e.start).isSame(now, 'month'))
            .map(e => e.groupId)
    ).size;

    // 2. จำนวนอบรมในปีนี้ (นับเฉพาะ Unique ID)
    const yearlyCount = new Set(
        events.filter(e => dayjs(e.start).isSame(now, 'year'))
            .map(e => e.groupId)
    ).size;

    return (
        <ConfigProvider theme={{ token: { colorPrimary: '#2563eb', fontFamily: 'Sarabun, sans-serif' } }}>
            <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">

                {/* Header Section */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-200 text-white flex items-center justify-center w-12 h-12">
                            <CalendarOutlined className="text-2xl" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 m-0">ตารางแผนการอบรมประจำปี</h1>
                            <p className="text-slate-500 text-sm m-0 mt-1">คลิกวันที่เพื่อเพิ่ม หรือคลิกรายการเพื่อแก้ไข</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* ✅ แก้ไข: จำนวนอบรมในเดือนนี้ */}
                        <div className="text-right hidden md:block border-r border-slate-100 pr-6">
                            <div className="text-xs text-slate-400 uppercase font-semibold">จำนวนอบรมในเดือนนี้</div>
                            <div className="text-2xl font-bold text-blue-600">{monthlyCount}</div>
                        </div>
                        {/* ✅ แก้ไข: จำนวนอบรมในปีนี้ */}
                        <div className="text-right hidden md:block">
                            <div className="text-xs text-slate-400 uppercase font-semibold">จำนวนอบรมในปีนี้</div>
                            <div className="text-2xl font-bold text-slate-700">{yearlyCount}</div>
                        </div>
                    </div>
                </div>

                {/* Calendar Card */}
                <Spin spinning={loading} tip="กำลังโหลดข้อมูล...">
                    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden p-2">
                        <FullCalendar
                            ref={calendarRef}
                            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                            initialView="dayGridMonth"
                            headerToolbar={{
                                left: 'prev,next today',
                                center: 'title',
                                right: 'dayGridMonth,timeGridWeek,timeGridDay' // ✅ เพิ่ม timeGridDay (ปุ่ม วัน)
                            }}
                            buttonText={{
                                today: 'วันนี้',
                                month: 'เดือน',
                                week: 'สัปดาห์',
                                day: 'วัน', // ✅ Text ภาษาไทย
                            }}
                            locale={thLocale}
                            events={events}
                            editable={true}
                            droppable={true}
                            selectable={true}
                            dayMaxEvents={3}
                            allDaySlot={true}
                            slotMinTime="07:00:00"
                            slotMaxTime="20:00:00"
                            height="auto"
                            contentHeight={800}
                            eventClassNames="cursor-pointer border-0"

                            // Handlers
                            eventDrop={onEventDropOrResize}
                            eventResize={onEventDropOrResize}
                            eventContent={renderEventContent}
                            eventClick={handleEventClick} // ✅ คลิก Event -> Edit
                            dateClick={handleDateClick}   // ✅ คลิก Date -> Create
                        />
                    </div>
                </Spin>

                {/* --- Modal ยืนยันการ Drag & Drop --- */}
                <Modal
                    open={isConfirmModalOpen}
                    title={
                        <div className="flex items-center gap-2 text-blue-700 border-b pb-3 mb-4">
                            <EditOutlined className="text-xl" />
                            <span className="text-lg font-bold">ยืนยันการเปลี่ยนแปลงตาราง</span>
                        </div>
                    }
                    onCancel={handleCancelUpdate}
                    centered
                    width={450}
                    footer={
                        <div className="flex justify-end gap-3 pt-2">
                            <Button
                                type="primary"
                                onClick={handleConfirmUpdate}
                                className="bg-blue-600 hover:bg-blue-700 h-10 px-6 rounded-lg font-medium shadow-md shadow-blue-200"
                            >
                                ยืนยันการเปลี่ยนแปลง
                            </Button>
                            <Button
                                onClick={handleCancelUpdate}
                                className="h-10 px-6 rounded-lg text-slate-500 border-slate-300 hover:text-slate-700 hover:border-slate-400"
                            >
                                ยกเลิก
                            </Button>
                        </div>
                    }
                >
                    {dragModalData && (
                        <div className="space-y-4">
                            <p className="text-slate-600">
                                คุณต้องการเปลี่ยนกำหนดการของหลักสูตร: <br />
                                <span className="font-bold text-slate-800 text-lg">{dragModalData.originalData.courses_name}</span>
                            </p>
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 text-sm">วันที่ใหม่:</span>
                                    <Tag color="blue" className="m-0 text-sm px-2 py-0.5">
                                        {dragModalData.updatedStartDate.format('DD/MM/YYYY')} - {dragModalData.updatedEndDate.format('DD/MM/YYYY')}
                                    </Tag>
                                </div>
                                {!dragModalData.isAllDay && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500 text-sm">เวลาใหม่:</span>
                                        <div className="font-semibold text-blue-700 flex items-center gap-1">
                                            <ClockCircleOutlined />
                                            {dragModalData.updatedStartTime} - {dragModalData.updatedEndTime} น.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </Modal>

                {/* --- Modal Form (Create/Edit) --- */}
                <Modal
                    open={isFormModalOpen}
                    onCancel={handleFormClose}
                    {...fullScreenModalProps} // ใช้ Style เดียวกับหน้า Trainings
                >
                    <ModalForm
                        isEditMode={formMode === 'edit'}
                        initialValues={formInitialValues}
                        onClose={handleFormClose}
                        onSuccess={handleFormSuccess}
                    />
                </Modal>

                {/* Styles Injection */}
                <style jsx="true" global="true">{`
                    .fc { font-family: 'Sarabun', sans-serif; }
                    .fc .fc-toolbar-title { font-size: 1.5rem; font-weight: 800; color: #1e293b; }
                    .fc .fc-button-primary {
                        background-color: white; color: #64748b; border: 1px solid #e2e8f0;
                        font-weight: 600; padding: 0.5rem 1.2rem; border-radius: 0.5rem;
                        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); transition: all 0.2s;
                    }
                    .fc .fc-button-primary:hover {
                        background-color: #f1f5f9; color: #2563eb; border-color: #cbd5e1;
                    }
                    .fc .fc-button-primary:not(:disabled).fc-button-active {
                        background-color: #2563eb; border-color: #2563eb; color: white;
                        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);
                    }
                    
                    /* ✅ เปลี่ยนสีพื้นหลังวันปัจจุบันเป็นเหลืองอ่อน */
                    .fc .fc-day-today {
                        background-color: #fefce8 !important; /* Yellow-50 */
                    }

                    .fc-theme-standard td, .fc-theme-standard th { border-color: #f1f5f9; }
                    .fc .fc-col-header-cell-cushion { color: #475569; padding: 12px 0; font-weight: 600; }
                    .fc .fc-daygrid-day-number { color: #64748b; padding: 8px 12px; font-weight: 500; }
                `}</style>
            </div>
        </ConfigProvider>
    );
}

export default TrainingCalendar;