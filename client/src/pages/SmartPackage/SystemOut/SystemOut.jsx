import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Grid } from 'antd';
import {
    ShoppingCartOutlined,
    SearchOutlined,
    ToolOutlined
} from '@ant-design/icons';
import api from "../../../api";
import { getSocket } from '../../../socketClient';
import DataTable from '../../../components/aggrid/DataTable';
import { useNavigate } from 'react-router-dom';

function SystemOut() {
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
            const res = await api.get('/smartpackage/systemout');
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
    const handleList = () => {
        navigate('/smart-package/system-out/list');
    };
    const handleRepair = () => {
        navigate('/smart-package/system-out/repair');
    };

    // เมื่อคลิกแถว ให้ไปหน้า SystemOutDetail พร้อมส่ง partCode ไปด้วย
    const handleRowClick = (record) => {
        navigate('#', {
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
                    asset_detail: row.partName || row.asset_detail,
                    asset_type: row.asset_type,
                    count_total: 0,
                    count_normal: 0,
                    count_use: 0,
                    count_damaged: 0,
                    count_repair: 0,
                    count_broken: 0
                };
            }

            // 1. นับจำนวนรวมทั้งหมด (Inventory Total)
            groups[key].count_total += 1;

            // 2. แยกสถานะตาม asset_status
            const status = String(row.asset_status);

            // asset_status = 10 (ว่าง/ปกติ) หรือ 11 (เบิกใช้/ปกติ) -> นับเป็น "ปกติ"
            if (status === '10' || status === '11') {
                groups[key].count_normal++;
            }

            // แยกนับ "เบิกใช้" เฉพาะ 11 ด้วย
            if (status === '11') {
                groups[key].count_use++;
            }

            // สถานะอื่นๆ
            if (status === '13') {
                groups[key].count_damaged++;
            } else if (status === '14') {
                groups[key].count_repair++;
            } else if (status === '15') {
                groups[key].count_broken++;
            }
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
            headerName: 'เลขที่ใบเบิกใช้',
            field: 'partCode',
            width: 200,
            filter: true,
            cellClass: "font-mono font-semibold text-blue-700 cursor-pointer",
            pinned: 'left',
        },
        {
            headerName: 'รายละเอียด',
            field: 'asset_detail',
            minWidth: 200,
            flex: 1,
            filter: true,
            cellClass: "cursor-pointer",
        },
        {
            headerName: 'ต้นทาง',
            field: '##',
            width: 150,
            filter: true,
            cellClass: "cursor-pointer text-center",
        },
        {
            headerName: 'ปลายทาง555',
            field: '##',
            width: 150,
            filter: true,
            cellClass: "cursor-pointer text-center",
        },
        {
            headerName: 'วันที่เบิก',
            field: '##',
            width: 150,
            filter: true,
            cellClass: "cursor-pointer text-center",
        },
        {
            headerName: 'จำนวนที่เบิก',
            width: 160,
            field: 'count_total',
            cellRenderer: p => valUnit(p.value),
            cellClass: "text-center font-bold cursor-pointer"
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
                            placeholder="ค้นหา เลขที่ใบเบิกใช้..."
                            allowClear
                            variant="borderless"
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-64 bg-transparent"
                        />
                        <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
                        <ConfigProvider theme={{ token: { colorPrimary: '#008236' } }}>
                            <Button
                                type="primary"
                                icon={<ShoppingCartOutlined />}
                                onClick={handleList}
                                className="border-none h-9 rounded-lg px-4 font-medium shadow-md"
                            >
                                เบิกใช้
                            </Button>
                        </ConfigProvider>
                        <ConfigProvider theme={{ token: { colorPrimary: '#f54a00' } }}>
                            <Button
                                type="primary"
                                icon={<ToolOutlined />}
                                onClick={handleRepair}
                                className="border-none h-9 rounded-lg px-4 font-medium shadow-md"
                            >
                                เบิกซ่อม
                            </Button>
                        </ConfigProvider>
                    </div>
                </div>

                {/* Table Content */}
                <div className="w-full flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
                    <DataTable
                        rowData={filteredRows}
                        columnDefs={columnDefs}
                        loading={loading}
                        onRowClicked={(params) => handleRowClick(params.data)}
                        rowClass="cursor-pointer hover:bg-blue-50 transition-colors"
                    />
                </div>
            </div>
        </ConfigProvider>
    );
}

export default SystemOut;