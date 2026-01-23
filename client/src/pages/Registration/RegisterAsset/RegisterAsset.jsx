import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Grid } from 'antd';
import {
    CaretUpOutlined,
    SearchOutlined
} from '@ant-design/icons';
import api from "../../../api";
import { getSocket } from '../../../socketClient';
import DataTable from '../../../components/aggrid/DataTable';
import { useNavigate } from 'react-router-dom';

function RegisterAsset() {
    const navigate = useNavigate();
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };

    const containerStyle = useMemo(() => ({
        margin: isMd ? '-8px' : '0',
        padding: isMd ? '16px' : '12px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
    }), [isMd]);

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]); // ข้อมูลดิบทั้งหมด
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch API
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/registration/registerasset');
            setRows(res?.data?.data || []);
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลทะเบียนทรัพย์สินไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Socket Setup
    useEffect(() => {
        const s = getSocket();
        if (!s) return;
        const onUpsert = (row) => {
            setRows((prev) => {
                const idx = prev.findIndex((r) => r.asset_id === row.asset_id);
                if (idx === -1) return [...prev, row].sort((a, b) => a.asset_id - b.asset_id);
                const next = prev.slice();
                next[idx] = row;
                return next;
            });
        };
        const onDelete = ({ asset_id }) => {
            setRows((prev) => prev.filter((r) => r.asset_id !== asset_id));
        };
        s.on('registerasset:upsert', onUpsert);
        s.on('registerasset:delete', onDelete);
        return () => {
            s.off('registerasset:upsert', onUpsert);
            s.off('registerasset:delete', onDelete);
        };
    }, []);

    // Actions
    const handleCreate = () => {
        navigate('/registration/register-asset/create');
    };

    // เมื่อคลิกแถว ให้ไปหน้า Detail พร้อมส่ง partCode ไปด้วย
    const handleRowClick = (record) => {
        navigate('/registration/register-asset/detail', {
            state: {
                partCode: record.partCode,
                partName: record.asset_detail
            }
        });
    };

    // Helper render ค่า
    const valUnit = (val) => {
        if (!val) return '-';
        return Number(val).toLocaleString();
    };

    // --- Logic Grouping Data by PartCode ---
    const groupedRows = useMemo(() => {
        const groups = {};

        rows.forEach(row => {
            const key = row.partCode || 'UNKNOWN'; // Group ตาม partCode

            if (!groups[key]) {
                groups[key] = {
                    partCode: row.partCode,
                    asset_detail: row.partName || row.asset_detail, // ใช้ชื่อจาก partName หรือ detail ตัวแรก
                    asset_type: row.asset_type,
                    total: 0,
                    // สร้างตัวนับสถานะ (สมมติ mapping คร่าวๆ คุณอาจต้องปรับ condition ตาม G_CODE จริง)
                    count_normal: 0,
                    count_repair: 0,
                    count_broken: 0,
                    count_use: 0
                };
            }

            groups[key].total += 1;

            // ตัวอย่าง Logic นับจำนวนตามสถานะ (ปรับแก้ Code ตาม Database จริง)
            // สมมติ is_status: 20=ปกติ, 30=รอซ่อม, 40=เสีย
            const status = String(row.is_status);
            if (status === '20' || status === '21' || status === '22') groups[key].count_normal++;
            else if (status === '30') groups[key].count_repair++;
            else if (status === '40') groups[key].count_broken++;

            // สมมติ asset_status: 10=ว่าง, 11=เบิกใช้
            const useStatus = String(row.asset_status);
            if (useStatus === '11') groups[key].count_use++;

        });

        return Object.values(groups);
    }, [rows]);

    const filteredRows = useMemo(() => {
        if (!searchTerm) return groupedRows;
        const term = searchTerm.toLowerCase();
        return groupedRows.filter(
            (row) =>
                String(row.partCode || '').toLowerCase().includes(term) ||
                String(row.asset_detail || '').toLowerCase().includes(term) ||
                String(row.asset_type || '').toLowerCase().includes(term)
        );
    }, [groupedRows, searchTerm]);

    const columnDefs = useMemo(() => [
        {
            headerName: 'ลำดับ',
            width: 80,
            valueGetter: "node.rowIndex + 1",
            cellClass: "text-center flex items-center justify-center cursor-pointer",
            pinned: 'left',
            lockVisible: true,
        },
        {
            headerName: 'Part Code', // เปลี่ยนจาก รหัสสินค้า เป็น Part Code
            field: 'partCode',
            width: 200,
            filter: true,
            cellClass: "font-mono font-semibold text-blue-700 cursor-pointer",
            pinned: 'left',
        },
        {
            headerName: 'ชื่อทรัพย์สิน (Part Name)',
            field: 'asset_detail',
            minWidth: 200,
            flex: 1,
            filter: true,
            cellClass: "cursor-pointer",
        },
        {
            headerName: 'ประเภท',
            field: 'asset_type',
            width: 150,
            filter: true,
            cellClass: "cursor-pointer text-center",
        },
        {
            headerName: 'จำนวน (QTY)',
            headerClass: 'header-group-center header-group-red',
            children: [
                {
                    headerName: 'ทั้งหมด',
                    width: 100,
                    field: 'total',
                    cellRenderer: p => valUnit(p.value),
                    cellClass: "text-center font-bold text-blue-600 cursor-pointer"
                },
                // แสดงตัวอย่างคอลัมน์นับสถานะ
                {
                    headerName: 'ปกติ',
                    width: 100,
                    field: 'count_normal',
                    cellRenderer: p => valUnit(p.value),
                    cellClass: "text-center text-green-600 cursor-pointer"
                },
                {
                    headerName: 'เบิกใช้',
                    width: 100,
                    field: 'count_use',
                    cellRenderer: p => valUnit(p.value),
                    cellClass: "text-center text-indigo-600 cursor-pointer"
                },
                {
                    headerName: 'รอซ่อม',
                    width: 100,
                    field: 'count_repair',
                    cellRenderer: p => valUnit(p.value),
                    cellClass: "text-center text-orange-500 cursor-pointer"
                },
                {
                    headerName: 'เสีย',
                    width: 100,
                    field: 'count_broken',
                    cellRenderer: p => valUnit(p.value),
                    cellClass: "text-center text-red-500 cursor-pointer"
                },
            ]
        },
    ], []);

    return (
        <ConfigProvider
            theme={{
                token: { colorPrimary: '#2563eb', borderRadius: 8, fontFamily: 'Inter, "Sarabun", sans-serif' },
                components: { Button: { primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)' } }
            }}
        >
            <div style={containerStyle} className="bg-gray-50">

                {/* Header Section */}
                <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none">
                    <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
                        <Input
                            prefix={<SearchOutlined className="text-gray-400" />}
                            placeholder="ค้นหา Part Code..."
                            allowClear
                            variant="borderless"
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-64 bg-transparent"
                        />
                        <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
                        <Button
                            type="primary"
                            icon={<CaretUpOutlined />}
                            onClick={handleCreate}
                            className="bg-blue-600 hover:bg-blue-500 border-none h-9 rounded-lg px-4 font-medium shadow-md"
                        >
                            ขึ้นทะเบียนทรัพย์สิน
                        </Button>
                    </div>
                </div>

                {/* Table Content */}
                <div className="w-full flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
                    <DataTable
                        rowData={filteredRows}
                        columnDefs={columnDefs}
                        loading={loading}
                        // เมื่อคลิกแถว (ที่ Group แล้ว) ให้ไปหน้า Detail
                        onRowClicked={(params) => handleRowClick(params.data)}
                        rowClass="cursor-pointer hover:bg-blue-50 transition-colors"
                    />
                </div>
            </div>
        </ConfigProvider>
    );
}

export default RegisterAsset;