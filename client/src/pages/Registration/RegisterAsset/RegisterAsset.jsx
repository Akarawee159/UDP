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
                // FIX: Use 'asset_code' instead of 'asset_id'
                const idx = prev.findIndex((r) => r.asset_code === row.asset_code);

                if (idx === -1) {
                    // New Record
                    return [...prev, row].sort((a, b) => a.asset_code.localeCompare(b.asset_code));
                }

                // Update Existing Record
                // We merge the new data (row) into the old data (prev[idx])
                const next = prev.slice();
                next[idx] = { ...next[idx], ...row };
                return next;
            });
        };

        const onDelete = ({ asset_code }) => {
            // FIX: Use 'asset_code' instead of 'asset_id'
            setRows((prev) => prev.filter((r) => r.asset_code !== asset_code));
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
                    asset_detail: row.partName || row.asset_detail,
                    asset_type: row.asset_type,
                    count_total: 0,
                    count_normal: 0,
                    count_prepare: 0,
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

            // แยกนับ "เบิกใช้" เฉพาะ 16 ด้วย
            if (status === '16') {
                groups[key].count_prepare++;
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
            headerName: 'รหัสทรัพย์สิน',
            field: 'partCode',
            width: 200,
            filter: true,
            cellClass: "font-mono font-semibold text-blue-700 cursor-pointer",
            pinned: 'left',
        },
        {
            headerName: 'ชื่อทรัพย์สิน',
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
                    field: 'count_total',
                    cellRenderer: p => valUnit(p.value),
                    cellClass: "text-center font-bold cursor-pointer"
                },
                {
                    headerName: 'ปกติ', // Status 10 + 11
                    width: 100,
                    field: 'count_normal',
                    cellRenderer: p => valUnit(p.value),
                    cellClass: "text-center cell-blue-bold cursor-pointer"
                },
                {
                    headerName: 'เตรียมเบิก', // Status 16
                    width: 100,
                    field: 'count_prepare',
                    cellRenderer: p => valUnit(p.value),
                    cellClass: "text-center cell-blue-bold cursor-pointer"
                },
                {
                    headerName: 'เบิกใช้', // Status 11
                    width: 100,
                    field: 'count_use',
                    cellRenderer: p => valUnit(p.value),
                    cellClass: "text-center cell-green-bold cursor-pointer"
                },
                {
                    headerName: 'ชำรุด', // Status 13
                    width: 100,
                    field: 'count_damaged',
                    cellRenderer: p => valUnit(p.value),
                    cellClass: "text-center cell-orange-bold cursor-pointer"
                },
                {
                    headerName: 'รอซ่อม', // Status 14
                    width: 100,
                    field: 'count_repair',
                    cellRenderer: p => valUnit(p.value),
                    cellClass: "text-center cell-orange-bold cursor-pointer"
                },
                {
                    headerName: 'เสีย', // Status 15
                    width: 100,
                    field: 'count_broken',
                    cellRenderer: p => valUnit(p.value),
                    cellClass: "text-center cell-red-bold cursor-pointer"
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
                            placeholder="ค้นหา รหัสทรัพย์สิน..."
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
                        onRowClicked={(params) => handleRowClick(params.data)}
                        rowClass="cursor-pointer hover:bg-blue-50 transition-colors"
                    />
                </div>
            </div>
        </ConfigProvider>
    );
}

export default RegisterAsset;