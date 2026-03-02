import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Input, Button, ConfigProvider, Space, Typography, App, Tooltip } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import DraggableTable from '../../../../components/antdtable/DraggableTable';
import api from "../../../../api";
import { getSocket } from '../../../../socketClient';

// ✅ 1. นำเข้า Modal จัดการข้อมูลจาก Settings/Department ตามที่ต้องการ
import ModalForm from "../../../Settings/Department/Modal/ModalForm";
import ModalDelete from "../../../Settings/Department/Modal/ModalDelete";

const { Text } = Typography;

function ModalDepartment({ open, onClose, onSelect }) {
    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [page, setPage] = useState({ current: 1, pageSize: 50 });

    const [modalFormOpen, setModalFormOpen] = useState(false);
    const [currentRecord, setCurrentRecord] = useState(null);
    const [openDelete, setOpenDelete] = useState(false);

    useEffect(() => {
        if (open) {
            fetchData();
            setSearchTerm('');
        }
    }, [open]);

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

        // ✅ เปลี่ยน Socket Event เป็น department
        s.on('department:upsert', onUpsert);
        s.on('department:delete', onDelete);

        return () => {
            s.off('department:upsert', onUpsert);
            s.off('department:delete', onDelete);
        };
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // ✅ 2. เปลี่ยน API เป็น department เหมือนหน้า Department.jsx
            const res = await api.get('/settings/department');
            const data = res?.data?.data || [];
            setRows(data);
        } catch (err) {
            console.error(err);
            message.error('ไม่สามารถดึงข้อมูลแผนกได้');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setCurrentRecord(null);
        setModalFormOpen(true);
    };

    const handleUpdate = (record) => {
        setCurrentRecord(record);
        setModalFormOpen(true);
    };

    const handleDeleteClick = (record) => {
        setCurrentRecord(record);
        setOpenDelete(true);
    };

    const handleFormSuccess = () => {
        fetchData();
    };

    const handleDeleteSuccess = () => {
        setOpenDelete(false);
        setModalFormOpen(false);
        fetchData();
    };

    // ✅ 3. คอลัมน์แสดงผลให้เหมือนหน้า Department.jsx ทุกประการ
    const columns = useMemo(() => [
        {
            title: 'ลำดับ',
            key: 'index',
            width: 80,
            align: 'center',
            dragDisabled: true,
            render: (_val, _record, index) => <span className="text-gray-400 font-medium">{(page.current - 1) * page.pageSize + index + 1}</span>
        },
        {
            title: 'รหัสแผนก',
            dataIndex: 'G_CODE',
            key: 'G_CODE',
            width: 150,
            sorter: (a, b) => String(a.G_CODE || '').localeCompare(String(b.G_CODE || '')),
            render: (val) => <span className="font-mono font-bold text-blue-700">{val}</span>
        },
        {
            title: 'ชื่อแผนก',
            dataIndex: 'G_NAME',
            key: 'G_NAME',
            width: 250,
            sorter: (a, b) => String(a.G_NAME || '').localeCompare(String(b.G_NAME || '')),
        },
        {
            title: 'อยู่ภายใต้สาขา',
            dataIndex: 'branch_name',
            key: 'branch_name',
            width: 300,
            sorter: (a, b) => String(a.branch_name || '').localeCompare(String(b.branch_name || '')),
            render: (val) => val || '-'
        },
        {
            title: 'รหัสสาขา',
            dataIndex: 'branch_code',
            key: 'branch_code',
            width: 150,
            sorter: (a, b) => String(a.branch_code || '').localeCompare(String(b.branch_code || '')),
            render: (val) => val || '-'
        },
        {
            title: 'จัดการ',
            key: 'action',
            width: 100,
            align: 'center',
            render: (_, record) => (
                <Space onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="แก้ไข">
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined className="text-orange-500" />}
                            onClick={() => handleUpdate(record)}
                        />
                    </Tooltip>
                    <Tooltip title="ลบ">
                        <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined className="text-red-500" />}
                            onClick={() => handleDeleteClick(record)}
                        />
                    </Tooltip>
                </Space>
            )
        }
    ], [page, rows]);

    // ✅ 4. อัปเดตเงื่อนไขการค้นหาให้ตรงกับฟิลด์ข้อมูลแผนก
    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const term = searchTerm.toLowerCase();
        return rows.filter(
            (row) =>
                String(row.G_CODE || '').toLowerCase().includes(term) ||
                String(row.G_NAME || '').toLowerCase().includes(term) ||
                String(row.branch_name || '').toLowerCase().includes(term) ||
                String(row.branch_code || '').toLowerCase().includes(term)
        );
    }, [rows, searchTerm]);

    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#2563eb',
                    fontFamily: "'Prompt', 'Inter', sans-serif"
                },
                components: {
                    Table: { cellPaddingBlock: 8, cellFontSize: 13 },
                    Modal: { borderRadius: 0 }
                }
            }}
        >
            <Modal
                open={open}
                title={
                    <div className="flex items-center gap-2 text-slate-700">
                        <SearchOutlined />
                        <span className="text-lg font-bold">จัดการและเลือกแผนกที่รับผิดชอบ</span>
                    </div>
                }
                onCancel={onClose}
                footer={null}
                width="100%"
                centered={false}
                style={{ top: 0, margin: 0, maxWidth: '100vw', padding: 0 }}
                destroyOnHidden={true}
                styles={{
                    body: {
                        padding: 0,
                        height: 'calc(100vh - 55px)',
                        overflow: 'hidden'
                    }
                }}
            >
                <DraggableTable
                    columns={columns}
                    dataSource={filteredRows}
                    rowKey="G_ID"
                    loading={loading}
                    scroll={{ x: 'max-content', y: 'max-content' }}
                    pagination={{
                        current: page.current,
                        pageSize: page.pageSize,
                        showSizeChanger: true,
                        pageSizeOptions: [10, 20, 50, 100],
                        showTotal: (t, r) => <span className="text-gray-400 text-xs">แสดง {r[0]}-{r[1]} จาก {t} รายการ</span>,
                        onChange: (p, s) => setPage({ current: p, pageSize: s }),
                        className: "px-4 pb-4"
                    }}
                    onRow={(record) => ({
                        onClick: () => {
                            if (onSelect) {
                                // ⭐️ คืนค่า record ของแผนกที่ถูกเลือกกลับไปให้ AssetList.jsx
                                onSelect(record);
                                onClose();
                            }
                        },
                        style: { cursor: 'pointer' }
                    })}
                    renderToolbar={(ColumnVisibilityPopover) => (
                        <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-white p-2 rounded-md shadow-sm border border-gray-100 w-full md:w-auto">
                                <Input
                                    prefix={<SearchOutlined className="text-gray-400" />}
                                    placeholder="ค้นหารหัส, ชื่อแผนก..."
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
                                        className="bg-blue-600 hover:bg-blue-500 border-none h-9 rounded-md px-4 font-medium shadow-md w-full sm:w-auto"
                                    >
                                        เพิ่มแผนกใหม่
                                    </Button>
                                    {ColumnVisibilityPopover}
                                </div>
                            </div>
                        </div>
                    )}
                />

                {/* ใช้งาน Modal จาก Settings/Department */}
                <ModalForm
                    open={modalFormOpen}
                    record={currentRecord}
                    onClose={() => { setModalFormOpen(false); setCurrentRecord(null); }}
                    onSuccess={handleFormSuccess}
                    onDelete={() => handleDeleteClick(currentRecord)}
                />

                <ModalDelete
                    open={openDelete}
                    record={currentRecord}
                    onClose={() => { setOpenDelete(false); }}
                    onSuccess={handleDeleteSuccess}
                />
            </Modal>
        </ConfigProvider>
    );
}

export default ModalDepartment;