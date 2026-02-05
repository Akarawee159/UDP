import React, { useState, useEffect, useMemo } from 'react';
import { Input, App, Grid, Tag } from 'antd';
import { SearchOutlined, ClockCircleOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from "../../../../api";
import DataTable from '../../../../components/aggrid/DataTable';

// --- Mock Data (ข้อมูลจำลอง) ---
const MOCK_DATA = [
    {
        asset_action: 'สร้าง',
        is_status: '120',
        is_status_name: 'ชำรุด',
        is_status_color: 'bg-yellow-100 text-yellow-600',
        print_status: 0,
        created_at: '2026-02-05T09:00:00',
        booking_created_by: 'Admin',
        asset_status_name: 'ส่งซ่อม',
        asset_status_color: 'bg-red-100 text-red-600',
        refID: 'RP20260205001',
        asset_origin: 'Store A',
        asset_destination: 'Line 1',
        asset_location: 'Building A',
        asset_holder: 'Somchai',
        asset_remark: 'ทดสอบรายการแจ้งซ่อม 1'
    },
    {
        asset_action: 'สร้าง',
        is_status: '121',
        is_status_name: 'ชำรุด',
        is_status_color: 'bg-yellow-100 text-yellow-600',
        print_status: 1,
        updated_at: '2026-02-05T10:30:00',
        updated_by: 'Staff 1',
        asset_status_name: 'ส่งซ่อม',
        asset_status_color: 'bg-red-100 text-red-600',
        refID: 'RP20260205002',
        asset_origin: 'Store B',
        asset_destination: 'Line 2',
        asset_location: 'Building B',
        asset_holder: 'Somsri',
        asset_remark: 'หน้าจอแตก'
    }
];

function RepairRequestLog() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const { message } = App.useApp();

    const [loading, setLoading] = useState(false);
    const [rowData, setRowData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // TODO: เมื่อมี API จริง ให้เปิดบรรทัดล่างนี้ และลบ MOCK_DATA
                // const res = await api.get('/repair/requests/all');
                // setRowData(res.data.data || []); 

                // ใช้ Mock Data ไปก่อน
                setTimeout(() => {
                    setRowData(MOCK_DATA);
                    setLoading(false);
                }, 500);

            } catch (err) {
                console.error(err);
                message.error("ไม่สามารถโหลดข้อมูลรายการแจ้งซ่อมได้");
            } finally {
                // setLoading(false); // ย้ายไปใน setTimeout
            }
        };

        fetchData();
    }, [message]);

    const formatDate = (date) => date ? dayjs(date).format('DD/MM/YYYY HH:mm:ss') : '-';
    const isPrintOrRegister = (status) => ['120', '121', '122'].includes(String(status));

    const columnDefs = useMemo(() => [
        { headerName: '#', valueGetter: "node.rowIndex + 1", width: 60, cellClass: "text-center" },
        {
            headerName: 'Action', field: 'asset_action', width: 100, pinned: 'left',
            cellClass: "flex items-center justify-center p-2",
            cellRenderer: (params) => {
                const action = params.value || '';
                let color = 'default';
                let text = (action || '').toUpperCase();

                if (action === 'สร้าง') { color = 'green'; text = 'สร้าง'; }
                else if (action === 'พิมพ์') { color = 'blue'; text = 'พิมพ์'; }
                else if (action === 'ยกเลิก') { color = 'red'; text = 'ยกเลิก'; }

                return <Tag color={color} className="w-full text-center m-0">{text}</Tag>;
            }
        },
        {
            headerName: 'สถานะทรัพย์สิน', field: 'is_status', width: 150,
            sortable: true,
            filter: true,
            filterValueGetter: (params) => params.data.is_status_name,
            cellClass: "flex items-center justify-center p-2",
            cellRenderer: (params) => {
                const name = params.data.is_status_name || params.value;
                const colorClass = params.data.is_status_color || 'bg-gray-100 text-gray-600 border-gray-200';
                return (
                    <div className={`w-full px-2 py-0.5 rounded border text-xs text-center font-medium ${colorClass}`}>
                        {name}
                    </div>
                );
            }
        },
        {
            headerName: 'พิมพ์ครั้งที่', field: 'print_status', width: 100,
            cellClass: "text-center",
            cellRenderer: (params) => (
                <span className="font-medium text-blue-600">{params.value}</span>
            )
        },
        {
            headerName: 'วันที่พิมพ์สติ๊กเกอร์',
            width: 180,
            sort: 'desc',
            cellRenderer: (params) => {
                const status = String(params.data.is_status);
                let dateToShow = null;
                if (status === '120') dateToShow = params.data.created_at;
                else if (status === '121' || status === '122') dateToShow = params.data.updated_at;
                else return <span className="text-gray-500">-</span>;

                return (
                    <div className="flex items-center gap-2">
                        <ClockCircleOutlined className="text-blue-500" />
                        {formatDate(dateToShow)}
                    </div>
                );
            }
        },
        {
            headerName: 'ผู้พิมพ์สติ๊กเกอร์',
            width: 160,
            cellRenderer: (params) => {
                const status = String(params.data.is_status);
                let nameToShow = null;
                if (status === '120') nameToShow = params.data.booking_created_by;
                else if (status === '121' || status === '122') nameToShow = params.data.updated_by;
                else return <span className="text-gray-500">-</span>;

                return (
                    <div className="flex items-center gap-2">
                        <UserOutlined className="text-blue-500" />
                        {nameToShow || 'System'}
                    </div>
                );
            }
        },
        {
            headerName: 'สถานะใช้งาน', field: 'asset_status', width: 150,
            sortable: true,
            filter: true,
            filterValueGetter: (params) => params.data.asset_status_name,
            cellClass: "flex items-center justify-center p-2",
            cellRenderer: (params) => {
                const name = params.data.asset_status_name || params.value;
                const colorClass = params.data.asset_status_color || 'bg-gray-100 text-gray-600 border-gray-200';
                return (
                    <div className={`w-full px-2 py-0.5 rounded border text-xs text-center font-medium ${colorClass}`}>
                        {name}
                    </div>
                );
            }
        },
        { headerName: 'เลขที่เอกสาร', field: 'refID', width: 150 },
        { headerName: 'ต้นทาง', field: 'asset_origin', width: 150 },
        { headerName: 'ปลายทาง', field: 'asset_destination', width: 150 },
        {
            headerName: 'ผู้ทำรายการ',
            field: 'booking_created_by',
            width: 160,
            cellRenderer: (params) => {
                if (isPrintOrRegister(params.data.is_status)) return <span className="text-gray-500">-</span>;
                return (
                    <div className="flex items-center gap-2">
                        <UserOutlined className="text-blue-500" />
                        {params.value || '-'}
                    </div>
                );
            }
        },
        {
            headerName: 'วันที่ทำรายการ',
            field: 'create_date',
            width: 140,
            cellRenderer: (params) => {
                if (isPrintOrRegister(params.data.is_status)) return <span className="text-gray-500">-</span>;
                return (
                    <div className="flex items-center gap-2">
                        <CalendarOutlined className="text-blue-500" />
                        {params.value ? dayjs(params.value).format('DD/MM/YYYY') : '-'}
                    </div>
                );
            }
        },
        { headerName: 'หมายเหตุ', field: 'asset_remark', width: 180 },
        { headerName: 'สถานที่', field: 'asset_location', width: 180 },
        { headerName: 'ผู้ครอบครอง', field: 'asset_holder', width: 180 },
    ], []);

    const filteredData = useMemo(() => {
        if (!searchTerm) return rowData;
        const lower = searchTerm.toLowerCase();
        return rowData.filter(r =>
            String(r.asset_action || '').toLowerCase().includes(lower) ||
            String(r.updated_by || '').toLowerCase().includes(lower) ||
            String(r.booking_created_by || '').toLowerCase().includes(lower) ||
            String(r.refID || '').toLowerCase().includes(lower)
        );
    }, [rowData, searchTerm]);

    return (
        <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200">
            {/* Search Bar Section */}
            <div className="p-3 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <Input
                    prefix={<SearchOutlined className="text-gray-400" />}
                    placeholder="ค้นหา Action, ผู้ทำรายการ, เลขที่..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    allowClear
                    className="w-full md:w-72"
                />
            </div>

            {/* DataTable Section */}
            <div className="flex-1 overflow-hidden relative">
                <DataTable
                    rowData={filteredData}
                    columnDefs={columnDefs}
                    loading={loading}
                    rowClass="cursor-pointer hover:bg-gray-50"
                />
            </div>
        </div>
    );
}

export default RepairRequestLog;