import { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Grid, Tag, Popconfirm, DatePicker } from 'antd';
import { SearchOutlined, CheckCircleOutlined, CalendarOutlined, CaretLeftOutlined } from '@ant-design/icons';
import api from "../../../api";
import { getSocket } from '../../../socketClient';
import DataTable from '../../../components/aggrid/DataTable';
import SystemInList from './Page/SystemInList';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import thTH from 'antd/locale/th_TH';
dayjs.locale('th');

function SystemIn() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const { message } = App.useApp();

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedDate, setSelectedDate] = useState(dayjs());

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDraftId, setSelectedDraftId] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const dateParam = selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : undefined;
            const res = await api.get('/smartpackage/systemin', {
                params: { date: dateParam }
            });
            setRows(res?.data?.data || []);
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลรายการรับเข้าของดีไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [message, selectedDate]);

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
            // 'header_update' คือตอนที่กดบันทึก ต้นทาง-สถานที่รับเข้า (Save Header)
            // 'finalized' คือตอนกดยืนยันรับเข้าของดี
            const acts = ['ref_generated', 'header_update', 'finalized', 'unlocked', 'cancel', 'scan', 'return', 'output_confirmed'];

            if (acts.includes(action)) {
                console.log("Socket Refreshing Data:", action);
                fetchData();
            }
        };

        window.addEventListener('hrms:systemin-update', onUpdate);
        return () => window.removeEventListener('hrms:systemin-update', onUpdate);
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
                String(r.is_status) === '130' &&                             // สถานะยังเป็น Draft
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
            await api.post('/smartpackage/systemin/confirm-output', { draft_id });
            message.success('ยืนยันการรับเข้าของดีสำเร็จ');
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
                // 1. กรณีสถานะ '132' แสดงปุ่มกด (Logic เดิม)
                if (String(params.data.is_status) === '132') {
                    return (
                        <div onClick={(e) => e.stopPropagation()}>
                            <Popconfirm
                                title="ยืนยันการรับเข้าของดี"
                                description="คุณต้องการยืนยันรายการนี้เป็น 'รับเข้าของดีสำเร็จ' ใช่หรือไม่?"
                                onCancel={(e) => {
                                    e?.stopPropagation();
                                    handleConfirmOutput(params.data.draft_id);
                                }}
                                onConfirm={(e) => e?.stopPropagation()}
                                cancelText="ยืนยัน"
                                cancelButtonProps={{ type: 'primary', className: "!bg-teal-600 hover:!bg-teal-500" }}
                                okText="ยกเลิก"
                                okButtonProps={{ type: 'default', danger: true }}
                            >
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<CheckCircleOutlined />}
                                    className="!bg-teal-600 hover:!bg-teal-500"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    ยืนยันรับเข้าของดี
                                </Button>
                            </Popconfirm>
                        </div>
                    );
                }

                // ✅ แก้ไขจุดที่ 1: ถ้าสถานะเป็น "รับเข้าของดีเรียบร้อย" ให้แสดงไอคอนสีเขียว
                if (params.data.is_status_name === 'รับเข้าของดีเรียบร้อย') {
                    return (
                        <CheckCircleOutlined className="text-green-700 text-xl" />
                    );
                }

                return null;
            }
        },
        {
            headerName: 'สถานะ',
            field: 'is_status_name',
            width: 150,
            filter: true,
            cellClass: "flex items-center justify-center p-2",
            cellRenderer: p => {
                return (
                    <div className={`w-full text-center py-1 rounded text-xs border ${p.data.is_status_color || 'bg-gray-100'}`}>
                        {p.value || '-'}
                    </div>
                );
            }
        },
        {
            headerName: 'รับเข้าจากปลายทาง (จากใบเบิก)',
            field: 'origin',
            width: 160,
            cellClass: "text-center text-gray-600"
        },
        {
            headerName: 'สถานที่รับเข้า',
            field: 'destination',
            width: 160,
            cellClass: "text-center text-gray-600"
        },
        {
            headerName: 'จำนวน',
            field: 'attendees',
            width: 100,
            cellClass: "flex items-center justify-center p-2",
            cellRenderer: (params) => (
                <Tag color="blue" className="w-full text-center text-sm m-0">
                    {params.value || 0}
                </Tag>
            )
        },
        { headerName: 'ผู้ทำรายการ', field: 'created_by_name', width: 180 }, // ✅ Show Joined Name
        {
            headerName: 'วันที่', field: 'create_date', width: 120,
            valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('th-TH') : '-' // ✅ Thai Date
        },
        { headerName: 'เวลา', field: 'create_time', width: 100 }, // ✅ Show Time
        {
            headerName: 'หมายเหตุ',
            field: 'booking_remark',
            flex: 1,
            width: 180
        },
    ], []);

    return (
        <ConfigProvider
            locale={thTH}
            theme={{ token: { colorPrimary: '#2b7fff', borderRadius: 8 } }}
        >
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
                            icon={<CaretLeftOutlined />}
                            onClick={handleCreate}
                            className="bg-blue-600 hover:bg-blue-500 border-none h-9 rounded-lg px-4 font-medium shadow-md"
                        >
                            สร้างรายการรับเข้าของดี
                        </Button>
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-gray-500 text-sm hidden lg:inline">วันที่:</span>
                            <DatePicker
                                value={selectedDate}
                                onChange={(date) => setSelectedDate(date)}
                                format="DD/MM/YYYY"  // แสดงผลเป็น 04/02/2026
                                allowClear={false}
                                className="w-40 border-gray-200 hover:border-blue-500 focus:border-blue-500"
                                suffixIcon={<CalendarOutlined className="text-blue-600" />}
                            />
                        </div>
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

                <SystemInList
                    open={isModalOpen}
                    onCancel={handleModalClose}
                    targetDraftId={selectedDraftId}
                />
            </div>
        </ConfigProvider>
    );
}

export default SystemIn;