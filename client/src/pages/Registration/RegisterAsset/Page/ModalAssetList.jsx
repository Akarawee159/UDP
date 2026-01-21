// src/pages/Registration/RegisterAsset/Page/ModalAssetList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Input, Button, ConfigProvider } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import DataTable from '../../../../components/aggrid/DataTable';
import api from "../../../../api";

function ModalAssetList({ open, onClose, onSelect }) {
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // ✅ 1. ดึงข้อมูลและกรองเฉพาะ is_status = 1
    useEffect(() => {
        if (open) {
            fetchData();
            setSearchTerm('');
        }
    }, [open]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await api.get('/masterdata/material');
            const allData = res?.data?.data || [];

            // ✅ กรองเฉพาะที่สถานะเป็น 1 (Active/พร้อมใช้งาน)
            // เช็คทั้งแบบ number และ string เพื่อความชัวร์
            const activeData = allData.filter(item =>
                Number(item.is_status) === 1
            );

            setRows(activeData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // ✅ 2. Columns เหมือนหน้า Material.jsx ทุกประการ
    const columnDefs = useMemo(() => [
        {
            headerName: 'ลำดับ',
            width: 120,
            valueGetter: "node.rowIndex + 1",
            cellClass: "text-center",
            pinned: 'left',
            headerComponentParams: { align: 'center' }
        },
        {
            headerName: 'สถานะ',
            field: 'status_name',
            width: 120,
            cellClass: "text-center",
            headerComponentParams: { align: 'center' },
            cellRenderer: (params) => {
                const statusName = params.data.status_name || 'ไม่ระบุ';
                const statusClass = params.data.status_class || 'bg-gray-100 text-gray-500 border-gray-200';
                return (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusClass}`}>
                        {statusName}
                    </span>
                );
            }
        },
        {
            headerName: 'รูปภาพ',
            field: 'material_image',
            width: 140,
            cellClass: "flex items-center justify-center py-1",
            headerComponentParams: { align: 'center' },
            cellRenderer: (params) => {
                if (!params.value) {
                    return <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 border border-gray-200">No Img</div>;
                }
                const url = `${import.meta.env.VITE_API_PATH.replace('/api', '')}/img/material/${params.value}`;
                return (
                    <img
                        src={url}
                        alt="img"
                        className="w-10 h-10 object-cover rounded border border-gray-200"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                );
            }
        },
        {
            headerName: 'รหัสกล่อง',
            field: 'material_code',
            width: 140,
            filter: true,
            cellClass: "font-mono font-bold text-blue-700",
            pinned: 'left',
            headerComponentParams: { align: 'center' }
        },
        { headerName: 'ชื่อวัสดุ', field: 'material_name', minWidth: 180, filter: true, headerComponentParams: { align: 'center' } },
        { headerName: 'ประเภท', field: 'material_type', width: 140, headerComponentParams: { align: 'center' } },
        { headerName: 'ผู้ผลิต', field: 'supplier_name', width: 140, headerComponentParams: { align: 'center' } },
        { headerName: 'แบรนด์', field: 'material_brand', width: 140, headerComponentParams: { align: 'center' } },
        { headerName: 'สี', field: 'material_color', width: 140, headerComponentParams: { align: 'center' } },
        { headerName: 'รุ่น', field: 'material_model', width: 140, headerComponentParams: { align: 'center' } },
        { headerName: 'คุณสมบัติ', field: 'material_feature', width: 140, headerComponentParams: { align: 'center' } },
        { headerName: 'แหล่งที่มา', field: 'material_source', width: 140, headerComponentParams: { align: 'center' } },
        { headerName: 'ใช้สำหรับงาน', field: 'material_usedfor', width: 160, headerComponentParams: { align: 'center' } },
        { headerName: 'สกุลเงิน', field: 'currency', width: 140, cellClass: "text-center", headerComponentParams: { align: 'center' } },
        { headerName: 'จน./หน่วยหลัก', field: 'quantity_mainunit', width: 160, valueFormatter: p => p.value ? Number(p.value).toLocaleString() : '0', cellClass: "text-right", headerComponentParams: { align: 'center' } },
        { headerName: 'หน่วยหลัก', field: 'mainunit_name', width: 140, headerComponentParams: { align: 'center' } },
        { headerName: 'จน./หน่วยย่อย', field: 'quantity_subunit', width: 160, valueFormatter: p => p.value ? Number(p.value).toLocaleString() : '0', cellClass: "text-right", headerComponentParams: { align: 'center' } },
        { headerName: 'หน่วยย่อย', field: 'subunit_name', width: 140, headerComponentParams: { align: 'center' } },
        { headerName: 'ปริมาณสั่งซื้อขั้นต่ำ', field: 'minimum_order', width: 200, cellClass: "text-right", headerComponentParams: { align: 'center' } },
        { headerName: 'ปริมาณต่ำสุด', field: 'minstock', width: 160, cellClass: "text-right text-orange-600", headerComponentParams: { align: 'center' } },
        { headerName: 'ปริมาณสูงสุด', field: 'maxstock', width: 160, cellClass: "text-right text-green-600", headerComponentParams: { align: 'center' } }
    ], []);

    // Filter ค้นหา Client Side
    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const term = searchTerm.toLowerCase();
        return rows.filter(
            (row) =>
                String(row.material_code || '').toLowerCase().includes(term) ||
                String(row.material_name || '').toLowerCase().includes(term) ||
                String(row.material_type || '').toLowerCase().includes(term)
        );
    }, [rows, searchTerm]);

    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#2563eb',
                    fontFamily: "'Prompt', 'Inter', sans-serif"
                }
            }}
        >
            <Modal
                open={open}
                title={
                    <div className="flex items-center justify-between pr-8">
                        <span className="text-lg font-bold text-slate-700">เลือกรายการวัสดุ</span>
                    </div>
                }
                onCancel={onClose}
                footer={null}
                width={1200}
                centered
                destroyOnClose
                styles={{ body: { padding: 0 } }}
            >
                <div className="p-4 bg-gray-50 border-b border-gray-100">
                    <Input
                        prefix={<SearchOutlined className="text-gray-400" />}
                        placeholder="ค้นหารหัส, ชื่อวัสดุ..."
                        allowClear
                        size="large"
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-1/2 bg-white rounded-lg"
                    />
                </div>

                <div className="h-[60vh] w-full overflow-hidden bg-white">
                    <DataTable
                        rowData={filteredRows}
                        columnDefs={columnDefs}
                        loading={loading}
                        // ✅ เมื่อคลิกแถว ส่งข้อมูลกลับไป
                        onRowClicked={(params) => {
                            if (onSelect) {
                                onSelect(params.data);
                                onClose();
                            }
                        }}
                        rowClass="cursor-pointer hover:bg-blue-50 transition-colors"
                    />
                </div>

                <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <Button onClick={onClose}>ยกเลิก</Button>
                </div>
            </Modal>
        </ConfigProvider>
    );
}

export default ModalAssetList;