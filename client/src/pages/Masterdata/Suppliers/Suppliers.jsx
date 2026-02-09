import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Grid } from 'antd';
import {
    PlusOutlined,
    SearchOutlined
} from '@ant-design/icons';
import api from "../../../api";
import ModalForm from "./Modal/ModalForm";
import ModalDelete from "./Modal/ModalDelete";
import { getSocket } from '../../../socketClient';
import DataTable from '../../../components/aggrid/DataTable';

function Suppliers() {
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

    // ====== Fetching & Socket Logic ======
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/masterdata/supplier');
            setRows(res?.data?.data || []);
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลไม่สำเร็จ');
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

        s.on('supplier:upsert', onUpsert);
        s.on('supplier:delete', onDelete);

        return () => {
            s.off('supplier:upsert', onUpsert);
            s.off('supplier:delete', onDelete);
        };
    }, []);

    // ====== Actions ======
    const handleCreate = () => { setCurrentRecord(null); setModalFormOpen(true); };

    // คลิกแถวเพื่อแก้ไข
    const handleUpdate = (record) => { setCurrentRecord(record); setModalFormOpen(true); };

    // เปิด Modal ลบ (เรียกจากปุ่มใน ModalForm หรือที่อื่น)
    const openDeleteModal = (record) => {
        // ไม่ต้อง setModalFormOpen(false) เพื่อให้ Modal ลบ ซ้อนทับ Modal แก้ไข
        setCurrentRecord(record);
        setOpenDelete(true);
    };

    // Callback เมื่อลบสำเร็จ
    const handleDeleteSuccess = () => {
        setOpenDelete(false);
        setModalFormOpen(false); // ปิดหน้าฟอร์มด้วย เพราะข้อมูลถูกลบไปแล้ว
        fetchData();
    };

    // Callback เมื่อบันทึก/แก้ไขสำเร็จ
    const handleFormSuccess = () => {
        // setModalFormOpen(false); // ปิดใน ModalForm แล้ว
        fetchData();
    };

    // ====== Columns ======
    const columnDefs = useMemo(() => [
        {
            headerName: 'ลำดับ',
            width: 100,
            maxWidth: 100,
            valueGetter: "node.rowIndex + 1",
            cellClass: "text-center flex items-center justify-center cursor-pointer",
            sortable: false,
            filter: false,
            pinned: 'left',
            lockVisible: true,
            suppressMovable: true,
            headerComponent: undefined,
            headerComponentParams: { align: 'center' }
        },
        {
            headerName: 'รหัสบริษัท',
            field: 'supplier_code',
            width: 120,
            filter: true,
            cellClass: "cursor-pointer text-blue-600 font-semibold",
            headerComponentParams: { align: 'center' }
        },
        {
            headerName: 'ชื่อบริษัท',
            field: 'supplier_name',
            minWidth: 400,
            flex: 1,
            filter: true,
            cellClass: "cursor-pointer",
            headerComponentParams: { align: 'center' }
        },
        {
            headerName: 'เลขผู้เสียภาษี',
            field: 'tax_id',
            width: 200,
            valueFormatter: (p) => p.value || '-',
            filter: true,
            cellClass: "cursor-pointer",
            headerComponentParams: { align: 'center' }
        },
        {
            headerName: 'ที่อยู่',
            field: 'supplier_address',
            width: 700,
            valueFormatter: (p) => p.value || '-',
            filter: true,
            cellClass: "cursor-pointer",
            headerComponentParams: { align: 'center' }
        },
        {
            headerName: 'เบอร์โทรบริษัท',
            field: 'supplier_phone',
            width: 140,
            valueFormatter: (p) => p.value || '-',
            filter: true,
            cellClass: "cursor-pointer",
            headerComponentParams: { align: 'center' }
        },
        {
            headerName: 'เบอร์โทร',
            field: 'contact_phone',
            width: 140,
            valueFormatter: (p) => p.value || '-',
            filter: true,
            cellClass: "cursor-pointer",
            headerComponentParams: { align: 'center' }
        },
        {
            headerName: 'ผู้ชื่อติดต่อ',
            field: 'contact_name',
            width: 140,
            valueFormatter: (p) => p.value || '-',
            filter: true,
            cellClass: "cursor-pointer",
            headerComponentParams: { align: 'center' }
        },
        {
            headerName: 'หมายเหตุ',
            field: 'remark',
            width: 140,
            valueFormatter: (p) => p.value || '-',
            filter: true,
            cellClass: "cursor-pointer",
            headerComponentParams: { align: 'center' }
        }
    ], []);

    // Filter Logic
    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const term = searchTerm.toLowerCase().trim();
        return rows.filter((row) =>
            String(row.supplier_code || '').toLowerCase().includes(term) ||
            String(row.supplier_name || '').toLowerCase().includes(term) ||
            String(row.tax_id || '').toLowerCase().includes(term)
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
                <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none">
                    <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-200">
                        <Input
                            prefix={<SearchOutlined className="text-gray-400" />}
                            placeholder="ค้นหารหัส, ชื่อบริษัท..."
                            allowClear
                            variant="borderless"
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
                            เพิ่มข้อมูลใหม่
                        </Button>
                    </div>
                </div>

                {/* Table Content */}
                <div className="w-full flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
                    <DataTable
                        rowData={filteredRows}
                        columnDefs={columnDefs}
                        loading={loading}
                        onRowClicked={(params) => handleUpdate(params.data)}
                        rowClass="cursor-pointer hover:bg-blue-50 transition-colors"
                    />
                </div>

                {/* Modals */}
                <ModalForm
                    open={modalFormOpen}
                    record={currentRecord}
                    onClose={() => { setModalFormOpen(false); setCurrentRecord(null); }}
                    onSuccess={handleFormSuccess}
                    // ✅ ส่งฟังก์ชันเพื่อเปิด ModalDelete โดยไม่ต้องปิด ModalForm
                    onDelete={() => openDeleteModal(currentRecord)}
                />

                <ModalDelete
                    open={openDelete}
                    record={currentRecord}
                    onClose={() => { setOpenDelete(false); }}
                    onSuccess={handleDeleteSuccess}
                />
            </div>
        </ConfigProvider>
    );
}

export default Suppliers;