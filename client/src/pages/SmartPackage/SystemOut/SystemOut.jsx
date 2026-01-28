import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Grid, Tag } from 'antd';
import { SearchOutlined, CaretRightOutlined } from '@ant-design/icons';
import api from "../../../api";
import { getSocket } from '../../../socketClient';
import DataTable from '../../../components/aggrid/DataTable';
import SystemOutList from './Page/SystemOutList'; // Import Component Modal

function SystemOut() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const { message } = App.useApp();

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDraftId, setSelectedDraftId] = useState(null);

    // Fetch Bookings
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

    // Socket Listener
    useEffect(() => {
        const s = getSocket();
        if (!s) return;
        const onUpdate = (payload) => {
            // ถ้ามีการ confirm ใบเบิก ให้โหลดตารางใหม่
            if (payload?.detail?.action === 'confirm' || payload?.action === 'confirm') {
                fetchData();
            }
        };
        // ฟัง event ที่ส่งมาจาก Controller (systemout:update -> hrms:systemout-update)
        window.addEventListener('hrms:systemout-update', onUpdate);
        return () => window.removeEventListener('hrms:systemout-update', onUpdate);
    }, [fetchData]);

    // Open Modal: Create New
    const handleCreate = () => {
        setSelectedDraftId(null); // Null = New
        setIsModalOpen(true);
    };

    // Open Modal: Edit/View (Row Click)
    const handleRowClick = (record) => {
        setSelectedDraftId(record.draft_id); // Pass Draft ID
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedDraftId(null);
        fetchData(); // Refresh list on close
    };

    // Filter Logic
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
        { headerName: 'Draft ID', field: 'draft_id', width: 140, hide: true },
        { headerName: 'เลขที่เอกสาร', field: 'refID', width: 180, cellClass: "font-bold text-blue-600" },
        {
            headerName: 'สถานะ', field: 'is_status', width: 120, cellClass: "text-center",
            cellRenderer: p => {
                const isDraft = String(p.value) === '16';
                return <Tag color={isDraft ? 'orange' : 'green'}>{isDraft ? 'Draft' : 'Confirmed'}</Tag>
            }
        },
        { headerName: 'จำนวนรายการ', field: 'attendees', width: 120, cellClass: "text-center" },
        { headerName: 'หมายเหตุ', field: 'booking_remark', flex: 1 },
        { headerName: 'ผู้ทำรายการ', field: 'created_by', width: 120 },
        { headerName: 'วันที่สร้าง', field: 'create_date', width: 120, valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString() : '-' },
    ], []);

    return (
        <ConfigProvider theme={{ token: { colorPrimary: '#34a853', borderRadius: 8 } }}>
            <div className={`h-screen flex flex-col bg-gray-50 ${isMd ? 'p-4' : 'p-2'}`}>

                {/* --- Header Section (Updated Design) --- */}
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
                {/* --------------------------------------- */}

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

                {/* Modal Component */}
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