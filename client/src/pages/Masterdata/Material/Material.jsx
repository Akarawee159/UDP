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

function Material() {
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

    // ✅ Fetch API
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/masterdata/material');
            setRows(res?.data?.data || []);
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลวัสดุไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ✅ Socket
    useEffect(() => {
        const s = getSocket();
        if (!s) return;

        const onUpsert = (row) => {
            setRows((prev) => {
                const idx = prev.findIndex((r) => r.material_id === row.material_id);
                if (idx === -1) {
                    return [...prev, row].sort((a, b) => a.material_id - b.material_id);
                }
                const next = prev.slice();
                next[idx] = row;
                return next;
            });
        };

        const onDelete = ({ material_id }) => {
            setRows((prev) => prev.filter((r) => r.material_id !== material_id));
        };

        s.on('material:upsert', onUpsert);
        s.on('material:delete', onDelete);

        return () => {
            s.off('material:upsert', onUpsert);
            s.off('material:delete', onDelete);
        };
    }, []);

    // Actions
    const handleCreate = () => { setCurrentRecord(null); setModalFormOpen(true); };
    const handleUpdate = (record) => { setCurrentRecord(record); setModalFormOpen(true); };

    // ✅ เปิด Modal ลบ (โดยไม่ปิด ModalForm เพื่อให้ซ้อนกัน)
    const openDeleteModal = (record) => { setCurrentRecord(record); setOpenDelete(true); };

    const handleFormSuccess = () => {
        fetchData();
    };

    const handleDeleteSuccess = () => {
        setOpenDelete(false);
        setModalFormOpen(false); // ปิดฟอร์มด้วยเมื่อลบเสร็จ
        fetchData();
    };

    // ✅ Columns: ลบคอลัมน์จัดการออก
    // ✅ Columns: แสดงข้อมูลครบทุก Field
    const columnDefs = useMemo(() => [
        {
            headerName: 'ลำดับ',
            width: 140,
            valueGetter: "node.rowIndex + 1",
            cellClass: "text-center",
            pinned: 'left'
        },
        {
            headerName: 'รูปภาพ',
            field: 'material_image',
            width: 140,
            cellClass: "flex items-center justify-center py-1",
            cellRenderer: (params) => {
                // ถ้าไม่มีรูป หรือรูปเป็นค่าว่าง ให้แสดง No Img
                if (!params.value) {
                    return <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 border border-gray-200">No Img</div>;
                }
                // ใช้ Path ที่ชี้ไปหา Server (ต้องตรงกับที่ตั้งใน server.js)
                const url = `${import.meta.env.VITE_API_PATH.replace('/api', '')}/img/material/${params.value}`;
                return (
                    <img
                        src={url}
                        alt="img"
                        className="w-10 h-10 object-cover rounded border border-gray-200 cursor-pointer hover:scale-150 transition-transform"
                        onError={(e) => { e.target.style.display = 'none'; }} // ซ่อนถ้าโหลดไม่ได้
                    />
                );
            }
        },
        {
            headerName: 'รหัสกล่อง',
            field: 'material_code',
            width: 140,
            filter: true,
            cellClass: "font-mono font-bold text-blue-700 cursor-pointer",
            pinned: 'left'
        },
        { headerName: 'ชื่อวัสดุ', field: 'material_name', minWidth: 180, filter: true },
        { headerName: 'ประเภท', field: 'material_type', width: 140 },
        { headerName: 'ผู้ผลิต', field: 'supplier_name', width: 140 },
        { headerName: 'แบรนด์', field: 'material_brand', width: 140 },
        { headerName: 'สี', field: 'material_color', width: 140 },
        { headerName: 'รุ่น', field: 'material_model', width: 140 },
        { headerName: 'คุณสมบัติ', field: 'material_feature', width: 140 },
        { headerName: 'สกุลเงิน', field: 'currency', width: 140, cellClass: "text-center" },
        { headerName: 'จน./หน่วยหลัก', field: 'quantity_mainunit', width: 160, valueFormatter: p => p.value ? Number(p.value).toLocaleString() : '0', cellClass: "text-right" },
        { headerName: 'หน่วยหลัก', field: 'mainunit_name', width: 140 },
        { headerName: 'จน./หน่วยย่อย', field: 'quantity_subunit', width: 160, valueFormatter: p => p.value ? Number(p.value).toLocaleString() : '0', cellClass: "text-right" },
        { headerName: 'หน่วยย่อย', field: 'subunit_name', width: 140 },
        { headerName: 'ปริมาณสั่งซื้อขั้นต่ำ', field: 'minimum_order', width: 200, cellClass: "text-right" },
        { headerName: 'ปริมาณต่ำสุด', field: 'minstock', width: 160, cellClass: "text-right text-orange-600" },
        { headerName: 'ปริมาณสูงสุด', field: 'maxstock', width: 160, cellClass: "text-right text-green-600" },
        {
            headerName: 'สถานะ',
            field: 'is_status',
            width: 140,
            cellClass: "text-center",
            cellRenderer: (params) => {
                // 1 = เปิดการใช้งาน, 2 = ปิดการใช้งาน
                // ✅ แก้ไข: แปลงเป็น Number ก่อนเปรียบเทียบ เพื่อรองรับทั้ง "1" และ 1
                const isActive = Number(params.value) === 1;

                return (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${isActive
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                        {isActive ? 'เปิดการใช้งาน' : 'ปิดการใช้งาน'}
                    </span>
                );
            }
        }
    ], []);

    // Logic กรองข้อมูล
    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const term = searchTerm.toLowerCase();
        return rows.filter(
            (row) =>
                String(row.material_code || '').toLowerCase().includes(term) ||
                String(row.material_type || '').toLowerCase().includes(term)
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
                            placeholder="ค้นหารหัส, ชื่อวัสดุ..."
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
                            เพิ่มรายการใหม่
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
                    onSuccess={handleFormSuccess}
                    // ✅ ส่งฟังก์ชัน onDelete ไปให้ ModalForm
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

export default Material;