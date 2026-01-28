import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Grid, Tag } from 'antd';
import { SearchOutlined, CaretRightOutlined, WarningOutlined } from '@ant-design/icons'; // เพิ่ม WarningOutlined หรือจะใช้ CaretRight เหมือนเดิมก็ได้
import api from "../../../api";
import { getSocket } from '../../../socketClient';
import DataTable from '../../../components/aggrid/DataTable';
import SystemOutList from './Page/SystemOutList';

function SystemIn() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const { message } = App.useApp();

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDraftId, setSelectedDraftId] = useState(null);

    // ✅ เพิ่ม State เพื่อระบุประเภทการรับเข้า (normal = ของดี, damaged = ของชำรุด)
    const [receiveType, setReceiveType] = useState('normal');

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
        const onUpdate = (payload) => {
            const acts = ['confirm', 'header_update', 'finalized', 'unlocked', 'cancel'];
            if (acts.includes(payload?.action) || acts.includes(payload?.detail?.action)) {
                fetchData();
            }
        };
        window.addEventListener('hrms:systemout-update', onUpdate);
        return () => window.removeEventListener('hrms:systemout-update', onUpdate);
    }, [fetchData]);

    const handleCreate = () => {
        setSelectedDraftId(null);
        setReceiveType('normal'); // ✅ ระบุว่าเป็นของดี
        setIsModalOpen(true);
    };

    // ✅ เพิ่มฟังก์ชันสำหรับปุ่มของชำรุด
    const handleCreateDamaged = () => {
        setSelectedDraftId(null);
        setReceiveType('damaged'); // ✅ ระบุว่าเป็นของชำรุด
        setIsModalOpen(true);
    };

    const handleRowClick = (record) => {
        setSelectedDraftId(record.draft_id);
        // กรณีแก้ไข อาจจะต้องเช็ค record ว่าเป็นแบบไหน หรือให้เป็น normal ไปก่อน
        setReceiveType('normal');
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedDraftId(null);
        setReceiveType('normal'); // reset
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

                        {/* ปุ่มรับเข้าของดี (เดิม) */}
                        <Button
                            type="primary"
                            icon={<CaretRightOutlined />}
                            onClick={handleCreate}
                            className="bg-green-600 hover:bg-green-500 border-none h-9 rounded-lg px-4 font-medium shadow-md"
                        >
                            รับเข้าของดี
                        </Button>

                        {/* ✅ ปุ่มรับเข้าของชำรุด (ใหม่) */}
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

                <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
                    <DataTable
                        rowData={filteredRows}
                        columnDefs={columnDefs}
                        loading={loading}
                        onRowClicked={(params) => handleRowClick(params.data)}
                        rowClass="cursor-pointer hover:bg-blue-50 transition-colors"
                    />
                </div>

                <SystemOutList
                    open={isModalOpen}
                    onCancel={handleModalClose}
                    targetDraftId={selectedDraftId}
                    receiveType={receiveType} // ✅ ส่งประเภทรายการไปให้ Modal (ต้องไปรับ prop นี้ใน SystemOutList ด้วย)
                />
            </div>
        </ConfigProvider>
    );
}

export default SystemIn;