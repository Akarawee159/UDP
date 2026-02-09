import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Input, App, Grid, Button, ConfigProvider } from 'antd';
import { SearchOutlined, ClockCircleOutlined, UserOutlined, CalendarOutlined, ToolOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from "../../../../api";
import DataTable from '../../../../components/aggrid/DataTable';
import { getSocket } from '../../../../socketClient';

function RepairRequestLog() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const { message, modal } = App.useApp();

    const [loading, setLoading] = useState(false);
    const [rowData, setRowData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRows, setSelectedRows] = useState([]);

    // 1. ดึงข้อมูลจาก API (tb_asset_lists where asset_status = 104)
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/smartpackage/systemrepair/repair-list');
            setRowData(res.data.data || []);
        } catch (err) {
            console.error(err);
            message.error("ไม่สามารถโหลดข้อมูลรายการแจ้งซ่อมได้");
        } finally {
            setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 5. Socket Real-time Update
    useEffect(() => {
        const s = getSocket();
        if (!s) return;

        const onUpdate = (event) => {
            const payload = event.detail;
            // ถ้ามีการ finalize (ส่งซ่อม 104) หรือ repair_received (รับเข้า 100) ให้รีเฟรช
            if (payload?.action === 'output_confirmed' || payload?.action === 'repair_received') {
                fetchData();
            }
        };

        window.addEventListener('hrms:systemrepair-update', onUpdate);
        return () => window.removeEventListener('hrms:systemrepair-update', onUpdate);
    }, [fetchData]);

    // 3. ฟังก์ชันรับเข้าคลัง (Update 100, 105)
    const handleReceiveToStock = () => {
        if (selectedRows.length === 0) {
            message.warning("กรุณาเลือกรายการที่ต้องการรับเข้าคลัง");
            return;
        }

        modal.confirm({
            title: 'ยืนยันการรับเข้าคลัง',
            content: `คุณต้องการรับทรัพย์สินจำนวน ${selectedRows.length} รายการ กลับเข้าคลัง (สถานะปกติ) ใช่หรือไม่?`,
            okText: 'ยืนยัน',
            cancelText: 'ยกเลิก',
            okButtonProps: { className: 'bg-green-600 hover:!bg-green-500' }, // บังคับสีปุ่ม OK ใน Modal
            onOk: async () => {
                try {
                    setLoading(true);
                    const asset_codes = selectedRows.map(r => r.asset_code);
                    await api.post('/smartpackage/systemrepair/receive-repair', { asset_codes });
                    message.success("รับเข้าคลังเรียบร้อย");
                    setSelectedRows([]); // Clear selection
                    fetchData();
                } catch (err) {
                    message.error(err.response?.data?.message || "เกิดข้อผิดพลาด");
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const onSelectionChanged = useCallback((event) => {
        const rows = event.api.getSelectedRows();
        setSelectedRows(rows);
    }, []);

    const columnDefs = useMemo(() => [
        // 2. Checkbox Selection
        {
            checkboxSelection: true,
            headerCheckboxSelection: true,
            headerCheckboxSelectionFilteredOnly: true,
            width: 50,
            pinned: 'left',
            lockVisible: true,
            headerClass: 'header-center-checkbox',
            cellClass: "flex justify-center items-center",
        },
        { headerName: 'ลำดับ', valueGetter: "node.rowIndex + 1", width: 60, cellClass: "text-center" },
        { headerName: 'ล็อตทรัพย์สิน', field: 'asset_lot', width: 200, sortable: true, filter: true },
        { headerName: 'รหัสทรัพย์สิน', field: 'asset_code', width: 200, sortable: true, filter: true },
        { headerName: 'ชื่อทรัพย์สิน', field: 'asset_detail', width: 200, filter: true }, // เพิ่มชื่อให้ดูง่ายขึ้น
        {
            headerName: 'สถานะใช้งาน', field: 'asset_status', width: 160,
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
        {
            headerName: 'ผู้ทำรายการ',
            field: 'scan_by_name', // [แก้ไขจุดที่ 3] เปลี่ยนชื่อ field ให้ตรงกับที่ query มาใหม่
            width: 160,
            cellRenderer: (params) => (
                <div className="flex items-center gap-2">
                    <UserOutlined className="text-blue-500" />
                    {params.value || '-'}
                </div>
            )
        },
        {
            headerName: 'วันที่ทำรายการ',
            field: 'updated_at', // ใช้ updated_at ล่าสุดที่กลายเป็น 104
            width: 160,
            sort: 'desc',
            cellRenderer: (params) => (
                <div className="flex items-center gap-2">
                    <CalendarOutlined className="text-blue-500" />
                    {params.value ? dayjs(params.value).format('DD/MM/YYYY') : '-'}
                </div>
            )
        },
        {
            headerName: 'เวลาทำรายการ',
            field: 'updated_at',
            width: 140,
            cellRenderer: (params) => (
                <div className="flex items-center gap-2">
                    <ClockCircleOutlined className="text-blue-500" />
                    {params.value ? dayjs(params.value).format('HH:mm:ss') : '-'}
                </div>
            )
        },
        { headerName: 'หมายเหตุ', field: 'booking_remark', flex: 1, width: 180 },
    ], []);

    const filteredData = useMemo(() => {
        if (!searchTerm) return rowData;
        const lower = searchTerm.toLowerCase();
        return rowData.filter(r =>
            String(r.asset_code || '').toLowerCase().includes(lower) ||
            String(r.asset_detail || '').toLowerCase().includes(lower) ||
            String(r.refID || '').toLowerCase().includes(lower)
        );
    }, [rowData, searchTerm]);

    return (
        <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200">
            {/* Search Bar Section */}
            <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none p-2">
                <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 flex-1 md:flex-none">
                    <Input
                        prefix={<SearchOutlined className="text-gray-400" />}
                        placeholder="ค้นหา รหัสทรัพย์สิน, เอกสาร..."
                        allowClear
                        variant="borderless"
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-64 bg-transparent"
                    />
                    <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>

                    {/* 4. แก้ปัญหาปุ่มสีเขียว (ใช้ !bg-green-600 เพื่อ Override Theme Global) */}
                    <ConfigProvider theme={{ token: { colorPrimary: '#16a34a' } }}>
                        <Button
                            type="primary"
                            icon={<ToolOutlined />}
                            disabled={selectedRows.length === 0}
                            onClick={handleReceiveToStock}
                            className="bg-green-600 hover:!bg-green-500 border-none h-9 rounded-lg px-4 font-medium shadow-md transition-all"
                        >
                            {/* แสดงจำนวนรายการที่เลือก */}
                            ซ่อมแล้ว ({selectedRows.length})
                        </Button>
                    </ConfigProvider>
                </div>
            </div>

            {/* DataTable Section */}
            <div className="flex-1 overflow-hidden relative">
                <DataTable
                    rowData={filteredData}
                    columnDefs={columnDefs}
                    loading={loading}
                    rowSelection="multiple"
                    onSelectionChanged={onSelectionChanged}
                    rowClass="cursor-pointer hover:bg-gray-50"
                    suppressRowClickSelection={true}
                />
            </div>
        </div>
    );
}

export default RepairRequestLog;