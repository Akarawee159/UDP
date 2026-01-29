import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Grid, Tag } from 'antd';
import { SearchOutlined, CaretLeftOutlined, WarningOutlined } from '@ant-design/icons';
import api from "../../../api";
import { getSocket } from '../../../socketClient';
import DataTable from '../../../components/aggrid/DataTable';
import SystemInList from './Page/SystemInList';
import SystemInDefective from './Page/SystemInDefective';

function SystemIn() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const { message } = App.useApp();

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isModalDamagedOpen, setIsModalDamagedOpen] = useState(false);
    const [selectedDraftId, setSelectedDraftId] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/smartpackage/systemin');
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
        const onUpdate = (payload) => {
            // refresh เมื่อมี action ต่างๆ
            const acts = ['confirm', 'header_update', 'finalized', 'unlocked', 'cancel'];
            if (acts.includes(payload?.action) || acts.includes(payload?.detail?.action)) {
                fetchData();
            }
        };
        window.addEventListener('hrms:systemout-update', onUpdate);
        return () => window.removeEventListener('hrms:systemout-update', onUpdate);
    }, [fetchData]);

    // --- Logic สำหรับ รับเข้าของดี ---
    const handleCreate = () => {
        const storedUser = localStorage.getItem('user');
        const currentUser = storedUser ? JSON.parse(storedUser) : null;

        let foundDraft = null;

        if (currentUser && currentUser.employee_id) {
            foundDraft = rows.find(r =>
                String(r.created_by) === String(currentUser.employee_id) &&
                String(r.is_status) === '16' &&
                (!r.refID || r.refID === '')
            );
        }

        if (foundDraft) {
            message.info('ระบบพบ! คุณสร้างรายการแบบร่างไว้ จึงเปิดรายการล่าสุดให้คุณ');
            setSelectedDraftId(foundDraft.draft_id);
        } else {
            setSelectedDraftId(null);
        }

        setIsModalOpen(true);
    };

    // --- Logic สำหรับ รับเข้าของชำรุด (ทำงานเหมือนของดี แต่เปิด Modal Damaged) ---
    const handleCreateDamaged = () => {
        const storedUser = localStorage.getItem('user');
        const currentUser = storedUser ? JSON.parse(storedUser) : null;

        let foundDraft = null;

        if (currentUser && currentUser.employee_id) {
            // ค้นหา Draft ของ User คนนี้
            foundDraft = rows.find(r =>
                String(r.created_by) === String(currentUser.employee_id) &&
                String(r.is_status) === '16' &&
                (!r.refID || r.refID === '')
            );
        }

        if (foundDraft) {
            message.info('ระบบพบ! คุณสร้างรายการแบบร่างไว้ จึงเปิดรายการล่าสุดให้คุณ');
            setSelectedDraftId(foundDraft.draft_id);
        } else {
            setSelectedDraftId(null);
        }

        setIsModalDamagedOpen(true);
    };

    const handleRowClick = (record) => {
        setSelectedDraftId(record.draft_id);
        // หมายเหตุ: ตรงนี้อาจจะต้องเช็คว่า record นี้เป็นของดีหรือของเสียเพื่อเปิด Modal ให้ถูกอัน
        // แต่เบื้องต้นให้เปิด Modal หลัก (SystemInList) ตาม Logic เดิม
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedDraftId(null);
        fetchData();
    };

    // เพิ่มฟังก์ชันสำหรับปิด Modal ของชำรุด
    const handleModalDamagedClose = () => {
        setIsModalDamagedOpen(false);
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

    const columnDefs = useMemo(() => [
        { headerName: 'ลำดับ', width: 60, valueGetter: "node.rowIndex + 1", cellClass: "text-center" },
        { headerName: 'เลขที่เอกสาร', field: 'refID', width: 180, cellClass: "font-bold text-blue-600" },
        {
            headerName: 'สถานะ', field: 'is_status_name', width: 150, cellClass: "text-center",
            cellRenderer: p => {
                return (
                    <span className={`px-2 py-1 rounded text-xs border ${p.data.is_status_color || 'bg-gray-100'}`}>
                        {p.value || '-'}
                    </span>
                );
            }
        },
        { headerName: 'จำนวน', field: 'attendees', width: 100, cellClass: "text-center" },
        { headerName: 'หมายเหตุ', field: 'booking_remark', flex: 1 },
        { headerName: 'ผู้ทำรายการ', field: 'created_by_name', width: 180 },
        {
            headerName: 'วันที่', field: 'create_date', width: 120,
            valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('th-TH') : '-'
        },
        { headerName: 'เวลา', field: 'create_time', width: 100 },
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
                            icon={<CaretLeftOutlined />}
                            onClick={handleCreate}
                            className="bg-green-600 hover:bg-green-500 border-none h-9 rounded-lg px-4 font-medium shadow-md"
                        >
                            รับเข้าของดี
                        </Button>
                        <Button
                            type="primary"
                            icon={<WarningOutlined />}
                            onClick={handleCreateDamaged}
                            className="bg-orange-500 hover:!bg-orange-400 border-none h-9 rounded-lg px-4 font-medium shadow-md"
                        >
                            รับเข้าของชำรุด
                        </Button>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
                    <DataTable
                        rowData={filteredRows}
                        columnDefs={columnDefs}
                        loading={loading}
                        onRowClicked={(params) => handleRowClick(params.data)}
                        rowClass="cursor-pointer hover:bg-blue-50 transition-colors"
                    />
                </div>

                {/* Modal สำหรับของดี */}
                <SystemInList
                    open={isModalOpen}
                    onCancel={handleModalClose}
                    targetDraftId={selectedDraftId}
                />

                {/* Modal สำหรับของชำรุด */}
                <SystemInDefective
                    open={isModalDamagedOpen}
                    onCancel={handleModalDamagedClose}
                    targetDraftId={selectedDraftId}
                />
            </div>
        </ConfigProvider>
    );
}

export default SystemIn;