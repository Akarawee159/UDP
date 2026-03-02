import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Grid } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import api from "../../../api";
import ModalForm from "./Modal/ModalForm";
import ModalDelete from "./Modal/ModalDelete";
import { getSocket } from '../../../socketClient';

// ✅ นำเข้า DraggableTable
import DraggableTable from '../../../components/antdtable/DraggableTable';

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

    // ✅ State สำหรับ Pagination และความสูงของตาราง
    const [page, setPage] = useState({ current: 1, pageSize: 10 });
    const [tableY, setTableY] = useState(600);

    const [modalFormOpen, setModalFormOpen] = useState(false);
    const [currentRecord, setCurrentRecord] = useState(null);
    const [openDelete, setOpenDelete] = useState(false);

    // ✅ คำนวณความสูงตารางอัตโนมัติ
    useEffect(() => {
        const onResize = () => setTableY(Math.max(400, window.innerHeight - 300));
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

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

        const onUpsert = (payload) => {
            const { oldCode, ...row } = payload;
            setRows((prev) => {
                const searchKey = oldCode || row.supplier_code;
                const idx = prev.findIndex((r) => r.supplier_code === searchKey);
                if (idx === -1) {
                    return [...prev, row].sort((a, b) => a.supplier_code.localeCompare(b.supplier_code));
                }
                const next = prev.slice();
                next[idx] = row;
                return next;
            });
        };

        const onDelete = ({ supplier_code }) => {
            setRows((prev) => prev.filter((r) => r.supplier_code !== supplier_code));
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

    const handleUpdate = (record) => { setCurrentRecord(record); setModalFormOpen(true); };

    const openDeleteModal = (record) => {
        setCurrentRecord(record);
        setOpenDelete(true);
    };

    const handleDeleteSuccess = () => {
        setOpenDelete(false);
        setModalFormOpen(false);
        fetchData();
    };

    const handleFormSuccess = () => {
        fetchData();
    };

    // ====== Columns (Ant Design Format) ======
    const baseColumns = useMemo(() => [
        {
            title: 'ลำดับ',
            key: 'index',
            width: 80,
            align: 'center',
            dragDisabled: true,
            render: (_val, _record, index) => <span className="text-gray-400 font-medium">{(page.current - 1) * page.pageSize + index + 1}</span>
        },
        {
            title: 'รหัสย่อ',
            dataIndex: 'supplier_code',
            key: 'supplier_code',
            width: 140,
            sorter: (a, b) => String(a.supplier_code || '').localeCompare(String(b.supplier_code || '')),
            filters: [...new Set(rows.map(r => r.supplier_code).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.supplier_code === value,
            render: (val) => <span className="text-blue-600 font-semibold">{val}</span>
        },
        {
            title: 'รหัสลูกค้า',
            dataIndex: 'supplier_code2',
            key: 'supplier_code2',
            width: 140,
            sorter: (a, b) => String(a.supplier_code2 || '').localeCompare(String(b.supplier_code2 || '')),
            filters: [...new Set(rows.map(r => r.supplier_code2).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.supplier_code2 === value,
            render: (val) => <span className="text-purple-600 font-medium">{val}</span>
        },
        {
            title: 'ชื่อบริษัท',
            dataIndex: 'supplier_name',
            key: 'supplier_name',
            width: 400,
            sorter: (a, b) => String(a.supplier_name || '').localeCompare(String(b.supplier_name || '')),
            filters: [...new Set(rows.map(r => r.supplier_name).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.supplier_name === value,
        },
        {
            title: 'เลขผู้เสียภาษี',
            dataIndex: 'tax_id',
            key: 'tax_id',
            width: 180,
            sorter: (a, b) => String(a.tax_id || '').localeCompare(String(b.tax_id || '')),
            filters: [...new Set(rows.map(r => r.tax_id).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.tax_id === value,
            render: (val) => val || '-'
        },
        {
            title: 'ที่อยู่',
            dataIndex: 'supplier_address',
            key: 'supplier_address',
            width: 400,
            ellipsis: true,
            sorter: (a, b) => String(a.supplier_address || '').localeCompare(String(b.supplier_address || '')),
            filters: [...new Set(rows.map(r => r.supplier_address).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.supplier_address === value,
            render: (val) => val || '-'
        },
        {
            title: 'เบอร์โทรบริษัท',
            dataIndex: 'supplier_phone',
            key: 'supplier_phone',
            width: 180,
            sorter: (a, b) => String(a.supplier_phone || '').localeCompare(String(b.supplier_phone || '')),
            filters: [...new Set(rows.map(r => r.supplier_phone).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.supplier_phone === value,
            render: (val) => val || '-'
        },
        {
            title: 'ชื่อผู้ติดต่อ',
            dataIndex: 'contact_name',
            key: 'contact_name',
            width: 150,
            sorter: (a, b) => String(a.contact_name || '').localeCompare(String(b.contact_name || '')),
            filters: [...new Set(rows.map(r => r.contact_name).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.contact_name === value,
            render: (val) => val || '-'
        },
        {
            title: 'เบอร์โทร',
            dataIndex: 'contact_phone',
            key: 'contact_phone',
            width: 150,
            sorter: (a, b) => String(a.contact_phone || '').localeCompare(String(b.contact_phone || '')),
            filters: [...new Set(rows.map(r => r.contact_phone).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.contact_phone === value,
            render: (val) => val || '-'
        },
        {
            title: 'หมายเหตุ',
            dataIndex: 'remark',
            key: 'remark',
            width: 200,
            ellipsis: true,
            sorter: (a, b) => String(a.remark || '').localeCompare(String(b.remark || '')),
            filters: [...new Set(rows.map(r => r.remark).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.remark === value,
            render: (val) => val || '-'
        }
    ], [page, rows]);

    // Logic กรองข้อมูล
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
                    borderRadius: 2, // ✅ ปรับเป็น 6px (เท่ากับ rounded-md)
                    fontFamily: 'Inter, "Sarabun", sans-serif',
                },
                components: {
                    Button: {
                        primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)',
                    }
                }
            }}
        >
            <div style={containerStyle} className="bg-gray-50 flex flex-col h-full overflow-hidden">

                {/* ✅ เรียกใช้ DraggableTable */}
                <DraggableTable
                    columns={baseColumns}
                    dataSource={filteredRows}
                    rowKey="supplier_code" // ใช้ supplier_code เป็น Key
                    loading={loading}
                    scroll={{ x: 'max-content', y: tableY }}

                    pagination={{
                        current: page.current,
                        pageSize: page.pageSize,
                        showSizeChanger: true,
                        pageSizeOptions: [10, 20, 50, 100],
                        showTotal: (t, r) => <span className="text-gray-400 text-xs">แสดง {r[0]}-{r[1]} จาก {t} รายการ</span>,
                        className: 'px-4 pb-4 mt-4'
                    }}
                    onChange={(pg) => setPage({ current: pg.current, pageSize: pg.pageSize })}

                    // ✅ คลิกแถวเพื่อแก้ไข
                    onRow={(record) => ({
                        onClick: () => handleUpdate(record),
                        className: "cursor-pointer"
                    })}

                    // ✅ Toolbar: ใช้ rounded-md
                    renderToolbar={(ColumnVisibility) => (
                        <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-white p-2 rounded-md shadow-sm border border-gray-100 w-full md:w-auto">
                                <Input
                                    prefix={<SearchOutlined className="text-gray-400" />}
                                    placeholder="ค้นหารหัส, ชื่อบริษัท..."
                                    allowClear
                                    variant="borderless"
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full sm:w-64 bg-transparent"
                                />
                                <div className="w-full h-px bg-gray-100 sm:w-px sm:h-6 sm:mx-1 hidden sm:block"></div>

                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={handleCreate}
                                        className="bg-blue-600 hover:bg-blue-500 border-none h-9 rounded-md px-4 font-medium w-full sm:w-auto shadow-md"
                                    >
                                        เพิ่มข้อมูลใหม่
                                    </Button>

                                    {/* ปุ่มซ่อน/แสดงคอลัมน์ */}
                                    {ColumnVisibility}
                                </div>
                            </div>
                        </div>
                    )}
                />

                {/* Modals */}
                <ModalForm
                    open={modalFormOpen}
                    record={currentRecord}
                    onClose={() => { setModalFormOpen(false); setCurrentRecord(null); }}
                    onSuccess={handleFormSuccess}
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