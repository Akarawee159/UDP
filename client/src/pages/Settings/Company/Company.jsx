import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Tooltip, Grid, Space } from 'antd';
import {
    PlusOutlined,
    DeleteOutlined,
    EditOutlined,
    SettingFilled,
    SearchOutlined
} from '@ant-design/icons';
import api from "../../../api";
import ModalForm from "./Modal/ModalForm";
import ModalDelete from "./Modal/ModalDelete";
import { getSocket } from '../../../socketClient';
import DataTable from '../../../components/aggrid/DataTable';

function Company() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;

    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };

    // ✅ Logic Style เดิม
    const containerStyle = useMemo(() => ({
        margin: isMd ? '-8px' : '0',
        padding: isMd ? '16px' : '12px',
        height: '100vh', // ปรับเป็น height fixed เพื่อให้ AG Grid scroll ได้
        display: 'flex',
        flexDirection: 'column',
    }), [isMd]);

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [modalFormOpen, setModalFormOpen] = useState(false);
    const [currentRecord, setCurrentRecord] = useState(null);
    const [openDelete, setOpenDelete] = useState(false);

    // ====== Fetching & Socket Logic (เหมือนเดิม) ======
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/company');
            setRows(res?.data?.data || []);
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลสถานที่อบรมไม่สำเร็จ');
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

        const onUpsert = (row) => {
            setRows((prev) => {
                const idx = prev.findIndex((r) => r.id === row.id);
                if (idx === -1) {
                    return [...prev, row].sort((a, b) => a.id - b.id);
                }
                const next = prev.slice();
                next[idx] = row;
                return next;
            });
        };

        const onDelete = ({ id }) => {
            setRows((prev) => prev.filter((r) => r.id !== id));
        };

        s.on('company:upsert', onUpsert);
        s.on('company:delete', onDelete);

        return () => {
            s.off('company:upsert', onUpsert);
            s.off('company:delete', onDelete);
        };
    }, []);

    // ====== Actions ======
    const handleCreate = () => { setCurrentRecord(null); setModalFormOpen(true); };
    const handleUpdate = (record) => { setCurrentRecord(record); setModalFormOpen(true); };
    const openDeleteModal = (record) => { setCurrentRecord(record); setOpenDelete(true); };
    const refreshAfterSuccess = () => fetchData();


    // ====== AG Grid Definitions (แปลงจาก Antd Table) ======

    // 1. Renderer สำหรับปุ่มจัดการ
    const ActionRenderer = (params) => {
        const record = params.data;
        if (!record) return null;

        return (
            <Space size="small" className='h-full flex items-center justify-center w-full'>
                <Tooltip title="แก้ไขข้อมูล">
                    <Button
                        type="text"
                        shape="circle"
                        size='small'
                        icon={<EditOutlined className="text-blue-700" />}
                        className="hover:bg-blue-50 flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); handleUpdate(record); }}
                    />
                </Tooltip>
                <Tooltip title="ลบข้อมูล">
                    <Button
                        type="text"
                        shape="circle"
                        size='small'
                        danger
                        icon={<DeleteOutlined />}
                        className="hover:bg-red-50 flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); openDeleteModal(record); }}
                    />
                </Tooltip>
            </Space>
        );
    };

    // 2. กำหนด Columns
    const columnDefs = useMemo(() => [
        {
            headerName: 'ลำดับ',
            width: 100,
            maxWidth: 100,
            valueGetter: "node.rowIndex + 1",
            cellClass: "text-center flex items-center justify-center",
            sortable: false,
            filter: false,
            pinned: 'left',
            lockVisible: true,
            suppressMovable: true,
            headerComponent: undefined
        },
        {
            headerName: 'รหัสบริษัท',
            field: 'company_code',
            width: 80,
            filter: true,
            filterParams: { buttons: ['reset'] }
        },
        {
            headerName: 'เลขผู้เสียภาษี',
            field: 'tax_no',
            width: 100,
            valueFormatter: (p) => p.value || '-',
            filter: true,
            filterParams: { buttons: ['reset'] }
        },
        {
            headerName: 'ชื่อบริษัท',
            field: 'company_name_th',
            minWidth: 100,
            flex: 1,
            filter: true,
            filterParams: { buttons: ['reset'] }
        },
        {
            headerName: 'ที่อยู่',
            field: 'address_th',
            width: 260,
            valueFormatter: (p) => p.value || '-',
            filter: true,
            filterParams: { buttons: ['reset'] }
        },
        {
            headerName: 'เบอร์โทร',
            field: 'phone',
            width: 120,
            valueFormatter: (p) => p.value || '-',
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
            suppressMovable: true,
            headerComponent: undefined
        }
    ], []);

    // Logic กรองข้อมูล (Client-side search)
    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const term = searchTerm.toLowerCase().trim();
        return rows.filter((row) =>
            String(row.company_code || '').toLowerCase().includes(term) ||
            String(row.company_name_th || '').toLowerCase().includes(term) ||
            String(row.tax_no || '').toLowerCase().includes(term)
        );
    }, [rows, searchTerm]);


    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#2563eb',
                    borderRadius: 8,
                    fontFamily: 'Inter, "Sarabun", sans-serif',
                },
                components: {
                    Button: { primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)' }
                }
            }}
        >
            <div style={containerStyle} className="bg-gray-50">

                {/* Header Section */}
                <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-none">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            ข้อมูลบริษัท
                        </h1>
                        <p className="text-slate-700 text-sm mt-1 pl-1">
                            จัดการโครงสร้างบริษัท
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
                        <Input
                            prefix={<SearchOutlined className="text-gray-400" />}
                            placeholder="ค้นหารหัส, ชื่อบริษัท..."
                            allowClear
                            bordered={false}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-64 bg-transparent"
                        />
                        <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleCreate}
                            className="bg-blue-600 hover:bg-blue-500 border-none h-9 rounded-lg px-4 font-medium shadow-md"
                        >
                            เพิ่มข้อมูล
                        </Button>
                    </div>
                </div>

                {/* ✅ Table Content (ใช้ DataTable ที่สร้างใหม่) */}
                <div className="w-full flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
                    <DataTable
                        rowData={filteredRows}
                        columnDefs={columnDefs}
                        loading={loading}
                    />
                </div>

                {/* Modals */}
                <ModalForm
                    open={modalFormOpen}
                    record={currentRecord}
                    onClose={() => { setModalFormOpen(false); setCurrentRecord(null); }}
                    onSuccess={refreshAfterSuccess}
                />

                <ModalDelete
                    open={openDelete}
                    record={currentRecord}
                    onClose={() => { setOpenDelete(false); setCurrentRecord(null); }}
                    onSuccess={refreshAfterSuccess}
                />
            </div>
        </ConfigProvider>
    );
}

export default Company;