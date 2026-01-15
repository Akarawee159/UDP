// src/pages/Masterdata/PackagingSize/PackagingSize.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Tooltip, Grid, Space } from 'antd';
import {
    PlusOutlined,
    DeleteOutlined,
    EditOutlined,
    SearchOutlined
} from '@ant-design/icons';
import api from "../../../api";
import ModalForm from "./Modal/ModalForm";
import ModalDelete from "./Modal/ModalDelete";
import { getSocket } from '../../../socketClient';
import DataTable from '../../../components/aggrid/DataTable';

function PackagingSize() {
    // ... Hooks เดิม ...
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
            const res = await api.get('/settings/packaging');
            setRows(res?.data?.data || []);
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลขนาดบรรจุภัณฑ์ไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Socket Setup (เหมือนเดิม)
    useEffect(() => {
        const s = getSocket();
        if (!s) return;
        const onUpsert = (row) => {
            setRows((prev) => {
                const idx = prev.findIndex((r) => r.G_ID === row.G_ID);
                if (idx === -1) return [...prev, row].sort((a, b) => a.G_ID - b.G_ID);
                const next = prev.slice();
                next[idx] = row;
                return next;
            });
        };
        const onDelete = ({ G_ID }) => {
            setRows((prev) => prev.filter((r) => r.G_ID !== G_ID));
        };
        s.on('packaging:upsert', onUpsert);
        s.on('packaging:delete', onDelete);
        return () => {
            s.off('packaging:upsert', onUpsert);
            s.off('packaging:delete', onDelete);
        };
    }, []);

    const handleCreate = () => { setCurrentRecord(null); setModalFormOpen(true); };
    const handleUpdate = (record) => { setCurrentRecord(record); setModalFormOpen(true); };
    const openDeleteModal = (record) => { setCurrentRecord(record); setOpenDelete(true); };
    const refreshAfterSuccess = () => fetchData();

    const ActionRenderer = (params) => {
        const record = params.data;
        if (!record) return null;
        return (
            <Space size="small" className='h-full flex items-center justify-center w-full'>
                <Tooltip title="แก้ไขข้อมูล">
                    <Button type="text" shape="circle" size='small' icon={<EditOutlined className="text-blue-700" />} className="hover:bg-blue-50 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); handleUpdate(record); }} />
                </Tooltip>
                <Tooltip title="ลบข้อมูล">
                    <Button type="text" shape="circle" size='small' danger icon={<DeleteOutlined />} className="hover:bg-red-50 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); openDeleteModal(record); }} />
                </Tooltip>
            </Space>
        );
    };

    // Helper render ค่า + หน่วย
    const valUnit = (val, unit) => {
        if (val === null || val === undefined || val === '') return '-';

        // แปลงเป็นตัวเลข และบังคับทศนิยม 2 ตำแหน่ง
        const num = Number(val);
        const formattedNum = num.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        return `${formattedNum} ${unit || ''}`;
    };

    // ✅ ปรับปรุง Column Defs
    const columnDefs = useMemo(() => [
        {
            headerName: 'ลำดับ',
            width: 70,
            maxWidth: 70,
            valueGetter: "node.rowIndex + 1",
            cellClass: "text-center flex items-center justify-center",
            pinned: 'left',
            lockVisible: true,
            suppressMovable: true
        },
        {
            headerName: 'รหัส',
            field: 'G_CODE',
            width: 120,
            filter: true,
            cellClass: "font-mono font-semibold text-blue-700",
            pinned: 'left',
        },
        {
            headerName: 'ชื่อขนาดบรรจุภัณฑ์',
            field: 'G_NAME',
            width: 180,
            filter: true,
        },
        // Group: ขนาด (Dimensions)
        {
            headerName: 'ขนาด (กว้าง x ยาว x สูง)',
            children: [
                { headerName: 'กว้าง', width: 100, valueGetter: p => valUnit(p.data.G_WIDTH, p.data.G_WIDTH_UNIT) },
                { headerName: 'ยาว', width: 100, valueGetter: p => valUnit(p.data.G_LENGTH, p.data.G_LENGTH_UNIT) },
                { headerName: 'สูง', width: 100, valueGetter: p => valUnit(p.data.G_HEIGHT, p.data.G_HEIGHT_UNIT) },
            ]
        },
        // Group: ความจุและน้ำหนัก
        {
            headerName: 'สเปคอื่นๆ',
            children: [
                { headerName: 'ความจุ', width: 110, valueGetter: p => valUnit(p.data.G_CAPACITY, p.data.G_CAPACITY_UNIT) },
                { headerName: 'น้ำหนัก', width: 110, valueGetter: p => valUnit(p.data.G_WEIGHT, p.data.G_WEIGHT_UNIT) },
            ]
        },
        {
            headerName: 'จัดการ',
            width: 90,
            cellRenderer: ActionRenderer,
            pinned: 'right',
            lockVisible: true,
            cellClass: "flex items-center justify-center",
            suppressMovable: true
        }
    ], []);

    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const term = searchTerm.toLowerCase();
        return rows.filter(
            (row) =>
                String(row.G_CODE || '').toLowerCase().includes(term) ||
                String(row.G_NAME || '').toLowerCase().includes(term)
        );
    }, [rows, searchTerm]);

    return (
        <ConfigProvider
            theme={{
                token: { colorPrimary: '#2563eb', borderRadius: 8, fontFamily: 'Inter, "Sarabun", sans-serif' },
            }}
        >
            <div style={containerStyle} className="bg-gray-50">
                <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-none">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">ข้อมูลขนาดบรรจุภัณฑ์</h1>
                        <p className="text-slate-700 text-sm mt-1 pl-1">จัดการข้อมูลขนาดบรรจุภัณฑ์และสเปคสินค้า</p>
                    </div>
                    <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
                        <Input prefix={<SearchOutlined className="text-gray-400" />} placeholder="ค้นหา..." allowClear bordered={false} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-64 bg-transparent" />
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} className="bg-blue-600 hover:bg-blue-500 border-none h-9 rounded-lg px-4 font-medium shadow-md">เพิ่มข้อมูล</Button>
                    </div>
                </div>

                <div className="w-full flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
                    <DataTable rowData={filteredRows} columnDefs={columnDefs} loading={loading} />
                </div>

                <ModalForm open={modalFormOpen} record={currentRecord} onClose={() => { setModalFormOpen(false); setCurrentRecord(null); }} onSuccess={refreshAfterSuccess} />
                <ModalDelete open={openDelete} record={currentRecord} onClose={() => { setOpenDelete(false); setCurrentRecord(null); }} onSuccess={refreshAfterSuccess} />
            </div>
        </ConfigProvider>
    );
}

export default PackagingSize;