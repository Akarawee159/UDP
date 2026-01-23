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

function PackagingSize() {
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

    // Socket Setup
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

    // Actions
    const handleCreate = () => { setCurrentRecord(null); setModalFormOpen(true); };
    const handleUpdate = (record) => { setCurrentRecord(record); setModalFormOpen(true); };

    // ✅ เปิด Modal ลบ โดยไม่ปิด ModalForm เพื่อให้ซ้อนกัน
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

    // ✅ Column Defs: ลบคอลัมน์จัดการออก
    const columnDefs = useMemo(() => [
        {
            headerName: 'ลำดับ',
            width: 140,
            valueGetter: "node.rowIndex + 1",
            cellClass: "text-center flex items-center justify-center cursor-pointer",
            pinned: 'left',
            lockVisible: true,
            suppressMovable: true,
            headerComponentParams: { align: 'center' }
        },
        {
            headerName: 'รหัส',
            field: 'G_CODE',
            width: 200,
            filter: true,
            cellClass: "font-mono font-semibold text-blue-700 cursor-pointer",
            pinned: 'left',
            headerComponentParams: { align: 'center' }
        },
        {
            headerName: 'ชื่อขนาดบรรจุภัณฑ์',
            field: 'G_NAME',
            minWidth: 180, // กันไม่ให้หดเล็กเกินไป
            flex: 1,       // สั่งให้ยืดกินพื้นที่ที่เหลือทั้งหมด
            filter: true,
            cellClass: "cursor-pointer",
            headerComponentParams: { align: 'center' }
        },
        // Group ขนาด
        {
            headerName: 'ขนาด (กว้าง x ยาว x สูง)',
            headerClass: 'header-group-center',
            children: [
                {
                    headerName: 'กว้าง',
                    width: 200,
                    valueGetter: p => valUnit(p.data.G_WIDTH, p.data.G_WIDTH_UNIT),
                    headerComponentParams: { align: 'center' },
                    cellClass: "text-center flex items-center justify-center cursor-pointer"
                },
                {
                    headerName: 'ยาว',
                    width: 200,
                    valueGetter: p => valUnit(p.data.G_LENGTH, p.data.G_LENGTH_UNIT),
                    headerComponentParams: { align: 'center' },
                    cellClass: "text-center flex items-center justify-center cursor-pointer"
                },
                {
                    headerName: 'สูง',
                    width: 200,
                    valueGetter: p => valUnit(p.data.G_HEIGHT, p.data.G_HEIGHT_UNIT),
                    headerComponentParams: { align: 'center' },
                    cellClass: "text-center flex items-center justify-center cursor-pointer"
                },
            ]
        },
        // Group สเปคอื่นๆ
        {
            headerName: 'สเปคอื่นๆ',
            headerClass: 'header-group-center',
            children: [
                {
                    headerName: 'ความจุ',
                    width: 200,
                    valueGetter: p => valUnit(p.data.G_CAPACITY, p.data.G_CAPACITY_UNIT),
                    headerComponentParams: { align: 'center' },
                    cellClass: "text-center flex items-center justify-center cursor-pointer"
                },
                {
                    headerName: 'น้ำหนัก',
                    width: 200,
                    valueGetter: p => valUnit(p.data.G_WEIGHT, p.data.G_WEIGHT_UNIT),
                    headerComponentParams: { align: 'center' },
                    cellClass: "text-center flex items-center justify-center cursor-pointer"
                },
            ]
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
                        // ✅ คลิกแถวเพื่อแก้ไข
                        onRowClicked={(params) => handleUpdate(params.data)}
                        rowClass="cursor-pointer hover:bg-blue-50 transition-colors"
                    />
                </div>

                {/* Modals */}
                <ModalForm
                    open={modalFormOpen}
                    record={currentRecord}
                    onClose={() => { setModalFormOpen(false); setCurrentRecord(null); }}
                    onSuccess={refreshAfterSuccess}
                    // ✅ ส่งฟังก์ชัน onDelete
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

export default PackagingSize;