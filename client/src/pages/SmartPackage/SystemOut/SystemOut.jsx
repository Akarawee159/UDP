import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Grid, Tag, Popconfirm } from 'antd';
import { SearchOutlined, CaretRightOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from "../../../api";
import { getSocket } from '../../../socketClient';
import DataTable from '../../../components/aggrid/DataTable';
import SystemOutList from './Page/SystemOutList';

function SystemOut() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const { message } = App.useApp();

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDraftId, setSelectedDraftId] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/smartpackage/systemout');
            setRows(res?.data?.data || []);
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลรายการใบเบิกไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const s = getSocket();
        if (!s) return;

        const onUpdate = (event) => {
            // แกะ payload จาก event.detail
            const payload = event.detail;
            const action = payload?.action;

            // รายการ Action ที่ควรสั่งให้ Refresh ตารางหลัก
            // 'ref_generated' คือตอนที่กดสร้างเลขใบเบิก (Generate Ref)
            // 'header_update' คือตอนที่กดบันทึก ต้นทาง-ไปยังปลายทาง (Save Header)
            // 'finalized' คือตอนกดยืนยันจ่ายออก
            const acts = ['ref_generated', 'header_update', 'finalized', 'unlocked', 'cancel', 'scan', 'return', 'output_confirmed'];

            if (acts.includes(action)) {
                console.log("Socket Refreshing Data:", action);
                fetchData();
            }
        };

        window.addEventListener('hrms:systemout-update', onUpdate);
        return () => window.removeEventListener('hrms:systemout-update', onUpdate);
    }, [fetchData]);

    const handleCreate = () => {
        // 1. ดึงข้อมูล User ปัจจุบัน (ปกติมักเก็บใน localStorage ชื่อ 'user')
        const storedUser = localStorage.getItem('user');
        const currentUser = storedUser ? JSON.parse(storedUser) : null;

        let foundDraft = null;

        // 2. ถ้ามีข้อมูล User ให้ทำการค้นหา Draft ที่ค้างอยู่
        if (currentUser && currentUser.employee_id) {
            // ค้นหาจาก rows (ซึ่งเรียงลำดับล่าสุดมาแล้วจาก BE)
            foundDraft = rows.find(r =>
                String(r.created_by) === String(currentUser.employee_id) && // เป็นของผู้ใช้คนนี้
                String(r.is_status) === '110' &&                             // สถานะยังเป็น Draft
                (!r.refID || r.refID === '')                                // ยังไม่ได้ Gen เลขที่ใบเบิก
            );
        }

        // 3. กำหนด Logic การเปิด Modal
        if (foundDraft) {
            message.info('ระบบพบ! คุณสร้างรายการแบบร่างไว้ จึงเปิดรายการล่าสุดให้คุณ');
            setSelectedDraftId(foundDraft.draft_id); // ใช้ ID เดิมเพื่อ Resume
        } else {
            setSelectedDraftId(null); // เป็น null เพื่อให้ Modal ไปสร้างใหม่ (init-booking)
        }

        setIsModalOpen(true);
    };

    const handleRowClick = (record) => {
        setSelectedDraftId(record.draft_id);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedDraftId(null);
        fetchData();
    };

    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const term = searchTerm.toLowerCase();
        return rows.filter(r =>
            (r.refID || '').toLowerCase().includes(term) ||
            (r.booking_remark || '').toLowerCase().includes(term)
        );
    }, [rows, searchTerm]);

    // ฟังก์ชันสำหรับเรียก API เมื่อกดยืนยัน
    const handleConfirmOutput = async (draft_id) => {
        try {
            setLoading(true);
            await api.post('/smartpackage/systemout/confirm-output', { draft_id });
            message.success('ยืนยันการจ่ายออกสำเร็จ');
            fetchData(); // รีโหลดข้อมูลทันที (เผื่อ socket ช้า)
        } catch (err) {
            console.error(err);
            message.error('ไม่สามารถยืนยันรายการได้');
        } finally {
            setLoading(false);
        }
    };

    const columnDefs = useMemo(() => [
        { headerName: 'ลำดับ', width: 60, valueGetter: "node.rowIndex + 1", cellClass: "flex items-center justify-center py-1" },
        { headerName: 'เลขที่เอกสาร', field: 'refID', width: 180, cellClass: "font-bold text-blue-600" },
        {
            headerName: 'การดำเนินการ',
            width: 140,
            cellClass: "flex items-center justify-center py-1",
            cellRenderer: (params) => {
                // แสดงปุ่มเฉพาะเมื่อสถานะเป็น '112'
                if (String(params.data.is_status) === '112') {
                    return (
                        <div onClick={(e) => e.stopPropagation()}> {/* ✅ ครอบ div กันเหนียวอีกชั้น */}
                            <Popconfirm
                                title="ยืนยันการจ่ายออก"
                                description="คุณต้องการยืนยันรายการนี้เป็น 'จ่ายออกสำเร็จ' ใช่หรือไม่?"

                                // 🟢 สลับ Logic: เอาฟังก์ชันยืนยันมาใส่ใน onCancel (ปุ่มซ้าย)
                                onCancel={(e) => {
                                    e?.stopPropagation(); // กัน Trigger Row Click
                                    handleConfirmOutput(params.data.draft_id);
                                }}
                                onConfirm={(e) => e?.stopPropagation()} // ปุ่มขวา (ยกเลิก) ไม่ทำอะไรแค่ปิด popup

                                // 🟢 สลับ Text และ Style:
                                cancelText="ยืนยัน" // ปุ่มซ้าย ให้ชื่อว่า "ยืนยัน"
                                cancelButtonProps={{
                                    type: 'primary',
                                    className: "bg-teal-600 hover:bg-teal-500" // ใส่สีเขียวให้ปุ่มซ้าย
                                }}

                                okText="ยกเลิก" // ปุ่มขวา ให้ชื่อว่า "ยกเลิก"
                                okButtonProps={{
                                    type: 'default',
                                    danger: true // (Optional) ใส่สีแดงหรือเทาให้ปุ่มยกเลิก
                                }}
                            >
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<CheckCircleOutlined />}
                                    className="bg-teal-600 hover:bg-teal-500"
                                    onClick={(e) => e.stopPropagation()} // กัน Trigger Row Click ที่ตัวปุ่ม
                                >
                                    ยืนยันจ่ายออก
                                </Button>
                            </Popconfirm>
                        </div>
                    );
                }
                return null;
            }
        },
        {
            headerName: 'สถานะ', field: 'is_status_name', width: 150, cellClass: "text-center",
            cellRenderer: p => {
                // ✅ ใช้สีและชื่อจาก DB
                return (
                    <span className={`px-2 py-1 rounded text-xs border ${p.data.is_status_color || 'bg-gray-100'}`}>
                        {p.value || '-'}
                    </span>
                );
            }
        },
        {
            headerName: 'สถานที่จ่ายออก',
            field: 'origin',
            width: 160,
            cellClass: "text-center text-gray-600"
        },
        {
            headerName: 'ไปยังปลายทาง',
            field: 'destination',
            width: 160,
            cellClass: "text-center text-gray-600"
        },
        {
            headerName: 'จำนวน',
            field: 'attendees',
            width: 100,
            cellClass: "flex items-center justify-center py-1",
            cellRenderer: (params) => (
                <Tag color="blue" className="text-sm px-2">
                    {params.value || 0}
                </Tag>
            )
        },
        { headerName: 'หมายเหตุ', field: 'booking_remark', flex: 1 },
        { headerName: 'ผู้ทำรายการ', field: 'created_by_name', width: 180 }, // ✅ Show Joined Name
        {
            headerName: 'วันที่', field: 'create_date', width: 120,
            valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('th-TH') : '-' // ✅ Thai Date
        },
        { headerName: 'เวลา', field: 'create_time', width: 100 }, // ✅ Show Time
    ], []);

    return (
        <ConfigProvider theme={{ token: { colorPrimary: '#34a853', borderRadius: 8 } }}>
            <div className={`h-screen flex flex-col bg-gray-50 ${isMd ? 'p-4' : 'p-2'}`}>
                <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none">
                    <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
                        <Input
                            prefix={<SearchOutlined className="text-gray-400" />}
                            placeholder="ค้นหา เลขที่เอกสาร..."
                            allowClear
                            variant="borderless"
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-64 bg-transparent"
                        />
                        <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
                        <Button
                            type="primary"
                            icon={<CaretRightOutlined />}
                            onClick={handleCreate}
                            className="bg-green-600 hover:bg-green-500 border-none h-9 rounded-lg px-4 font-medium shadow-md"
                        >
                            สร้างรายการจ่ายออก
                        </Button>
                    </div>
                </div>

                <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
                    <DataTable
                        rowData={filteredRows}
                        columnDefs={columnDefs}
                        loading={loading}

                        // 🔴 แก้ไข: เปลี่ยนจาก onRowClicked เป็น onCellClicked
                        onCellClicked={(params) => {
                            // ป้องกัน Error โดยเช็คว่ามี colDef หรือไม่
                            if (!params.colDef) return;

                            // ถ้าคลิกที่คอลัมน์ "การดำเนินการ" ให้ return ออกไปเลย (ไม่เปิด Modal)
                            if (params.colDef.headerName === 'การดำเนินการ') return;

                            // ถ้าเป็นคอลัมน์อื่น ให้เปิด Modal ตามปกติ
                            handleRowClick(params.data);
                        }}

                        rowClass="cursor-pointer hover:bg-blue-50 transition-colors"
                    />
                </div>

                <SystemOutList
                    open={isModalOpen}
                    onCancel={handleModalClose}
                    targetDraftId={selectedDraftId}
                />
            </div>
        </ConfigProvider>
    );
}

export default SystemOut;