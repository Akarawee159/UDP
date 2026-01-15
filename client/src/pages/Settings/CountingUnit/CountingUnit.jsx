// src/pages/Masterdata/CountingUnit/CountingUnit.jsx
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

function CountingUnit() {
    // ... Hooks เดิม ...
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };

    // ... Container Style เดิม ...
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

    // ✅ Fetch API: /settings/countingunit
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/settings/countingunit');
            setRows(res?.data?.data || []);
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลหน่วยนับไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ✅ Socket: countingunit:upsert, countingunit:delete
    useEffect(() => {
        const s = getSocket();
        if (!s) return;

        const onUpsert = (row) => {
            setRows((prev) => {
                const idx = prev.findIndex((r) => r.G_ID === row.G_ID);
                if (idx === -1) {
                    return [...prev, row].sort((a, b) => a.G_ID - b.G_ID);
                }
                const next = prev.slice();
                next[idx] = row;
                return next;
            });
        };

        const onDelete = ({ G_ID }) => {
            setRows((prev) => prev.filter((r) => r.G_ID !== G_ID));
        };

        s.on('countingunit:upsert', onUpsert);
        s.on('countingunit:delete', onDelete);

        return () => {
            s.off('countingunit:upsert', onUpsert);
            s.off('countingunit:delete', onDelete);
        };
    }, []);

    // ... Actions เดิม ...
    const handleCreate = () => { setCurrentRecord(null); setModalFormOpen(true); };
    const handleUpdate = (record) => { setCurrentRecord(record); setModalFormOpen(true); };
    const openDeleteModal = (record) => { setCurrentRecord(record); setOpenDelete(true); };
    const refreshAfterSuccess = () => fetchData();

    // ... ActionRenderer เดิม ...
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

    // ✅ Columns: ตัด Department ออก
    const columnDefs = useMemo(() => [
        {
            headerName: 'ลำดับ',
            width: 80,
            maxWidth: 80,
            valueGetter: "node.rowIndex + 1",
            cellClass: "text-center flex items-center justify-center",
            sortable: false,
            filter: false,
            pinned: 'left',
            lockVisible: true,
            suppressMovable: true
        },
        {
            headerName: 'รหัสหน่วยนับ',
            field: 'G_CODE',
            width: 150,
            filter: true,
            cellClass: "font-mono font-semibold text-blue-700",
            filterParams: { buttons: ['reset'] }
        },
        {
            headerName: 'ชื่อหน่วยนับ',
            field: 'G_NAME',
            minWidth: 200,
            flex: 1,
            filter: true,
            filterParams: { buttons: ['reset'] }
        },
        {
            headerName: 'จัดการ',
            width: 100,
            cellRenderer: ActionRenderer,
            sortable: false,
            filter: false,
            lockVisible: true,
            cellClass: "flex items-center justify-center",
            suppressMovable: true
        }
    ], []);

    // Logic กรองข้อมูล
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
                components: { Button: { primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)' } }
            }}
        >
            <div style={containerStyle} className="bg-gray-50">
                <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-none">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">ข้อมูลหน่วยนับ</h1>
                        <p className="text-slate-700 text-sm mt-1 pl-1">จัดการข้อมูลหน่วยนับในระบบ</p>
                    </div>
                    <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
                        <Input prefix={<SearchOutlined className="text-gray-400" />} placeholder="ค้นหารหัส, ชื่อหน่วยนับ..." allowClear bordered={false} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-64 bg-transparent" />
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} className="bg-blue-600 hover:bg-blue-500 border-none h-9 rounded-lg px-4 font-medium shadow-md">เพิ่มหน่วยนับ</Button>
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

export default CountingUnit;