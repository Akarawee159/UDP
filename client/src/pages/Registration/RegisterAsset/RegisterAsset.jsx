// src/pages/Registration/RegisterAsset/RegisterAsset.jsx
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
    const [rows, setRows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalFormOpen, setModalFormOpen] = useState(false);
    const [currentRecord, setCurrentRecord] = useState(null);
    const [openDelete, setOpenDelete] = useState(false);

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
    const handleUpdate = (record) => { setCurrentRecord(record); setModalFormOpen(true); };

    // ✅ เปิด Modal ลบ โดยไม่ปิด ModalAsset เพื่อให้ซ้อนกัน
    const openDeleteModal = (record) => { setCurrentRecord(record); setOpenDelete(true); };

    const refreshAfterSuccess = () => fetchData();
    const handleDeleteSuccess = () => {
        setOpenDelete(false);
        setModalFormOpen(false); // ปิดฟอร์มด้วยเมื่อลบเสร็จ
        fetchData();
    };

    // Helper render ค่า + หน่วย
    const valUnit = (val, unit) => {
        if (val === null || val === undefined || val === '') return '-';
        const num = Number(val);
        const formattedNum = num.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return `${formattedNum} ${unit || ''}`;
    };

    const columnDefs = useMemo(() => [
        {
            headerName: 'ลำดับ',
            width: 120,
            valueGetter: "node.rowIndex + 1",
            cellClass: "text-center flex items-center justify-center cursor-pointer",
            pinned: 'left',
            lockVisible: true,
            suppressMovable: true,
            headerComponentParams: { align: 'center' }
        },
        {
            headerName: 'รหัสสินค้า',
            field: 'asset_code',
            width: 200,
            filter: true,
            cellClass: "font-mono font-semibold text-blue-700 cursor-pointer",
            pinned: 'left',
            headerComponentParams: { align: 'center' }
        },
        {
            headerName: 'ชื่อทรัพย์สิน',
            field: 'asset_detail',
            minWidth: 200,
            flex: 1,
            filter: true,
            cellClass: "cursor-pointer",
            headerComponentParams: { align: 'center' }
        },
        {
            headerName: 'ประเภททรัพย์สิน',
            field: 'asset_type',
            minWidth: 240,
            filter: true,
            cellClass: "cursor-pointer",
            headerComponentParams: { align: 'center' }
        },
        {
            headerName: 'จำนวนแยกตามสถานะ',
            headerClass: 'header-group-center header-group-red',
            children: [
                {
                    headerName: 'ทั้งหมด',
                    width: 100,
                    valueGetter: p => valUnit(p.data.is_status),
                    headerComponentParams: { align: 'center' },
                    filter: false,
                    cellClass: "text-center flex items-center justify-center cursor-pointer cell-blue-bold"
                },
                {
                    headerName: 'เบิกใช้',
                    width: 100,
                    valueGetter: p => valUnit(p.data.is_status),
                    headerComponentParams: { align: 'center' },
                    filter: false,
                    cellClass: "text-center flex items-center justify-center cursor-pointer cell-green-bold"
                },
                {
                    headerName: 'ปกติ',
                    width: 100,
                    valueGetter: p => valUnit(p.data.is_status,),
                    headerComponentParams: { align: 'center' },
                    filter: false,
                    cellClass: "text-center flex items-center justify-center cursor-pointer cell-blue-bold"
                },
                {
                    headerName: 'ชำรุด',
                    width: 100,
                    valueGetter: p => valUnit(p.data.is_status),
                    headerComponentParams: { align: 'center' },
                    filter: false,
                    cellClass: "text-center flex items-center justify-center cursor-pointer cell-orange-bold"
                },
                {
                    headerName: 'รอซ่อม',
                    width: 100,
                    valueGetter: p => valUnit(p.data.is_status),
                    headerComponentParams: { align: 'center' },
                    filter: false,
                    cellClass: "text-center flex items-center justify-center cursor-pointer cell-orange-bold"
                },
                {
                    headerName: 'เสีย',
                    width: 100,
                    valueGetter: p => valUnit(p.data.is_status),
                    headerComponentParams: { align: 'center' },
                    filter: false,
                    cellClass: "text-center flex items-center justify-center cursor-pointer cell-red-bold"
                },
            ]
        },
    ], []);

    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const term = searchTerm.toLowerCase();
        return rows.filter(
            (row) =>
                String(row.asset_code || '').toLowerCase().includes(term) ||
                String(row.asset_detail || '').toLowerCase().includes(term) ||
                String(row.asset_type || '').toLowerCase().includes(term)
        );
    }, [rows, searchTerm]);

    return (
        <ConfigProvider
            theme={{
                token: { colorPrimary: '#2563eb', borderRadius: 8, fontFamily: 'Inter, "Sarabun", sans-serif' },
                components: { Button: { primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)' } }
            }}
        >
            <div style={containerStyle} className="bg-gray-50">

                {/* Header Section: ปรับ Layout ให้ปุ่มอยู่ซ้าย */}
                <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none">
                    <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
                        <Input
                            prefix={<SearchOutlined className="text-gray-400" />}
                            placeholder="ค้นหา..."
                            allowClear
                            bordered={false}
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
                        // ✅ คลิกแถวเพื่อแก้ไข
                        onRowClicked={(params) => handleUpdate(params.data)}
                        rowClass="cursor-pointer hover:bg-blue-50 transition-colors"
                    />
                </div>
            </div>
        </ConfigProvider>
    );
}

export default RegisterAsset;