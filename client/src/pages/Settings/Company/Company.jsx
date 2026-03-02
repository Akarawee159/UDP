import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Grid } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import api from "../../../api";
import ModalForm from "./Modal/ModalForm";
import ModalDelete from "./Modal/ModalDelete";
import { getSocket } from '../../../socketClient';

// ✅ เปลี่ยนจากการ Import DataTable มาเป็น DraggableTable
import DraggableTable from '../../../components/antdtable/DraggableTable';

function Company() {
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

    // ✅ เพิ่ม State สำหรับ Pagination และความสูงของตาราง
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
            const res = await api.get('/settings/company');
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

        s.on('company:upsert', onUpsert);
        s.on('company:delete', onDelete);

        return () => {
            s.off('company:upsert', onUpsert);
            s.off('company:delete', onDelete);
        };
    }, []);

    // ====== Actions ======
    const handleCreate = () => { setCurrentRecord(null); setModalFormOpen(true); };

    // คลิกแถวเพื่อแก้ไข
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

    // ====== Columns (เปลี่ยนโครงสร้างเป็นแบบ antd) ======
    const baseColumns = useMemo(() => [
        {
            title: 'ลำดับ',
            key: 'index',
            width: 80,
            align: 'center',
            dragDisabled: true, // ล็อคไม่ให้ลากคอลัมน์นี้
            // คอลัมน์ลำดับไม่จำเป็นต้องมี Sorter/Filter เพราะเป็นแค่ตัวเลขรันตามหน้าจอ
            render: (_val, _record, index) => <span className="text-gray-400 font-medium">{(page.current - 1) * page.pageSize + index + 1}</span>
        },
        {
            title: 'รหัสบริษัท',
            dataIndex: 'company_code',
            key: 'company_code',
            width: 150,
            sorter: (a, b) => String(a.company_code || '').localeCompare(String(b.company_code || '')),
            filters: [...new Set(rows.map(r => r.company_code).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.company_code === value,
            render: (val) => <span className="text-blue-600 font-semibold">{val}</span>
        },
        {
            title: 'ชื่อบริษัท',
            dataIndex: 'company_name_th',
            key: 'company_name_th',
            width: 250,
            sorter: (a, b) => String(a.company_name_th || '').localeCompare(String(b.company_name_th || '')),
            filters: [...new Set(rows.map(r => r.company_name_th).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.company_name_th === value,
        },
        {
            title: 'เลขผู้เสียภาษี',
            dataIndex: 'tax_no',
            key: 'tax_no',
            width: 200,
            sorter: (a, b) => String(a.tax_no || '').localeCompare(String(b.tax_no || '')),
            filters: [...new Set(rows.map(r => r.tax_no).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.tax_no === value,
            render: (val) => val || '-'
        },
        {
            title: 'ที่อยู่',
            dataIndex: 'address_th',
            key: 'address_th',
            width: 400,
            ellipsis: true, // ตัดข้อความถ้าที่อยู่ยาวเกินไป
            sorter: (a, b) => String(a.address_th || '').localeCompare(String(b.address_th || '')),
            filters: [...new Set(rows.map(r => r.address_th).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.address_th === value,
            render: (val) => val || '-'
        },
        {
            title: 'เบอร์โทร',
            dataIndex: 'phone',
            key: 'phone',
            width: 150,
            sorter: (a, b) => String(a.phone || '').localeCompare(String(b.phone || '')),
            filters: [...new Set(rows.map(r => r.phone).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.phone === value,
            render: (val) => val || '-'
        }
    ], [page, rows]); // <--- อย่าลืมเพิ่ม rows ตรงนี้นะครับ

    // Filter Logic
    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const term = searchTerm.toLowerCase().trim();
        return rows.filter((row) =>
            String(row.company_code || '').toLowerCase().includes(term) ||
            String(row.company_name_th || '').toLowerCase().includes(term) ||
            String(row.tax_no || '').toLowerCase().includes(term) ||
            String(row.address_th || '').toLowerCase().includes(term) ||
            String(row.phone || '').toLowerCase().includes(term)
        );
    }, [rows, searchTerm]);


    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#2563eb',
                    borderRadius: 2,
                    fontFamily: 'Inter, "Sarabun", sans-serif',
                },
                components: {
                    Button: { primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)' }
                }
            }}
        >
            <div style={containerStyle} className="bg-gray-50 flex flex-col h-full overflow-hidden">

                {/* ✅ เรียกใช้ DraggableTable พร้อมย้าย Toolbar เข้าไปอยู่ใน renderToolbar */}
                <DraggableTable
                    columns={baseColumns}
                    dataSource={filteredRows}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 'max-content', y: tableY }} // Scroll แนวนอนและแนวตั้ง

                    // ตั้งค่า Pagination
                    pagination={{
                        current: page.current,
                        pageSize: page.pageSize,
                        showSizeChanger: true,
                        pageSizeOptions: [10, 20, 50, 100],
                        showTotal: (t, r) => <span className="text-gray-400 text-xs">แสดง {r[0]}-{r[1]} จาก {t} รายการ</span>,
                        className: 'px-4 pb-4 mt-4'
                    }}
                    onChange={(pg) => setPage({ current: pg.current, pageSize: pg.pageSize })}

                    // ✅ ทำให้เมื่อคลิกที่แถวแล้วเปิดหน้าต่าง Edit เหมือนเดิม
                    onRow={(record) => ({
                        onClick: () => handleUpdate(record),
                        className: "cursor-pointer" // ทำให้เมาส์เปลี่ยนเป็นรูปนิ้วตอนชี้
                    })}

                    // ✅ วาดแถบ Toolbar ด้านบน (ปุ่ม Search, Add, Show/Hide Columns)
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
                                        className="bg-blue-600 hover:bg-blue-500 border-none h-9 rounded-md px-4 font-medium w-full sm:w-auto"
                                    >
                                        เพิ่มข้อมูลใหม่
                                    </Button>

                                    {/* นำปุ่มซ่อน/แสดงคอลัมน์จาก DraggableTable มาแสดงตรงนี้ */}
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

export default Company;