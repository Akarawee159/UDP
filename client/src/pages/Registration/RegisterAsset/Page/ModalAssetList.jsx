import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Input, Button, ConfigProvider, Space, Typography, App, Tooltip } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import DraggableTable from '../../../../components/antdtable/DraggableTable'; // ตรวจสอบ path
import api from "../../../../api"; // ตรวจสอบ path
import { getSocket } from '../../../../socketClient'; // ตรวจสอบ path

// นำเข้า Modal สำหรับจัดการข้อมูล (ตรวจสอบ path ให้ตรงกับที่อยู่ไฟล์จริง)
// สมมติว่า ModalAssetList อยู่ในระดับเดียวกับ Material หรือเข้าถึงได้
import ModalForm from "../../../Masterdata/Material/Modal/ModalForm";
import ModalDelete from "../../../Masterdata/Material/Modal/ModalDelete";

const { Text } = Typography;

function ModalAssetList({ open, onClose, onSelect }) {
    // ใช้ App.useApp เพื่อเรียกใช้ message, modal dialog (ถ้ามี App หุ้มที่ root)
    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // State สำหรับ Pagination
    const [page, setPage] = useState({ current: 1, pageSize: 50 });

    // State สำหรับ Modal จัดการข้อมูล (Add/Edit/Delete)
    const [modalFormOpen, setModalFormOpen] = useState(false);
    const [currentRecord, setCurrentRecord] = useState(null);
    const [openDelete, setOpenDelete] = useState(false);

    // 1. ดึงข้อมูลเมื่อเปิด Modal
    useEffect(() => {
        if (open) {
            fetchData();
            setSearchTerm('');
        }
    }, [open]);

    // 2. เชื่อมต่อ Socket (Real-time updates)
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

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await api.get('/masterdata/material');
            // เรียงลำดับตาม ID หรือเงื่อนไขที่ต้องการ
            const data = res?.data?.data || [];
            setRows(data);
        } catch (err) {
            console.error(err);
            message.error('ไม่สามารถดึงข้อมูลได้');
        } finally {
            setLoading(false);
        }
    };

    // --- Actions ---
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
        fetchData(); // หรือรอ Socket update ก็ได้
    };

    const handleDeleteSuccess = () => {
        setOpenDelete(false);
        setModalFormOpen(false);
        fetchData();
    };

    // 3. กำหนด Columns (นำมาจาก Material และเพิ่มปุ่ม Action)
    const columns = useMemo(() => [
        {
            title: 'ลำดับ',
            key: 'index',
            width: 80,
            align: 'center',
            dragDisabled: true, // ล็อคไม่ให้ลาก
            render: (_val, _record, index) => <span className="text-gray-400 font-medium">{(page.current - 1) * page.pageSize + index + 1}</span>
        },
        // {
        //     title: 'สถานะ',
        //     dataIndex: 'status_name',
        //     key: 'status_name',
        //     width: 140,
        //     align: 'center',
        //     sorter: (a, b) => String(a.status_name || '').localeCompare(String(b.status_name || '')),
        //     filters: [...new Set(rows.map(r => r.status_name).filter(Boolean))].map(v => ({ text: v, value: v })),
        //     filterSearch: true,
        //     onFilter: (value, record) => record.status_name === value,
        //     render: (val, record) => {
        //         const statusName = val || 'ไม่ระบุ';
        //         const statusClass = record.status_class || 'bg-gray-100 text-gray-500 border-gray-200';
        //         return (
        //             <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusClass}`}>
        //                 {statusName}
        //             </span>
        //         );
        //     }
        // },
        // {
        //     title: 'รูปภาพ',
        //     dataIndex: 'material_image',
        //     key: 'material_image',
        //     width: 100,
        //     align: 'center',
        //     render: (val) => {
        //         if (!val) {
        //             return <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 border border-gray-200 mx-auto">No Img</div>;
        //         }
        //         const url = `${import.meta.env.VITE_API_PATH?.replace('/api', '') || ''}/img/material/${val}`;
        //         return (
        //             <img
        //                 src={url}
        //                 alt="img"
        //                 className="w-10 h-10 object-cover rounded border border-gray-200 cursor-pointer hover:scale-[2] transition-transform mx-auto z-10 relative"
        //                 onError={(e) => { e.target.style.display = 'none'; }}
        //             />
        //         );
        //     }
        // },
        {
            title: 'รหัส',
            dataIndex: 'material_code',
            key: 'material_code',
            width: 150,
            sorter: (a, b) => String(a.material_code || '').localeCompare(String(b.material_code || '')),
            filters: [...new Set(rows.map(r => r.material_code).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.material_code === value,
            render: (val) => <span className="font-mono font-bold text-blue-700">{val}</span>
        },
        {
            title: 'โมเดล',
            dataIndex: 'material_model',
            key: 'material_model',
            width: 150,
            sorter: (a, b) => String(a.material_model || '').localeCompare(String(b.material_model || '')),
            filters: [...new Set(rows.map(r => r.material_model).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.material_model === value,
        },
        {
            title: 'หน่วยนับ',
            dataIndex: 'material_unitname',
            key: 'material_unitname',
            width: 150,
            sorter: (a, b) => String(a.material_type || '').localeCompare(String(b.material_type || '')),
            filters: [...new Set(rows.map(r => r.material_type).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.material_type === value,
        },
        {
            title: 'ความกว้าง',
            dataIndex: 'material_width',
            key: 'material_width',
            width: 150,
            sorter: (a, b) => (Number(a.material_width) || 0) - (Number(b.material_width) || 0),

            // ✅ แปลงค่าเป็นทศนิยม 2 ตำแหน่งก่อนนำมาต่อกับหน่วยใน Filter
            filters: Array.from(
                new Set(
                    rows.filter(r => r.material_width !== null && r.material_width !== undefined)
                        .map(r => `${Number(r.material_width).toFixed(2)} ${r.material_width_unit || ''}`.trim())
                )
            ).map(text => ({ text: text, value: text })),
            filterSearch: true,

            // ✅ เวลา Filter ก็แปลงค่าใน record ให้เป็น 2 ตำแหน่งก่อนเทียบด้วย
            onFilter: (value, record) => {
                if (record.material_width === null || record.material_width === undefined) return false;
                const recordValue = `${Number(record.material_width).toFixed(2)} ${record.material_width_unit || ''}`.trim();
                return recordValue === value;
            },

            // ✅ แสดงผลในหน้าตารางเป็นทศนิยม 2 ตำแหน่ง
            render: (val, record) => (
                <span className="font-mono font-bold text-blue-700">
                    {val !== null && val !== undefined ? Number(val).toFixed(2) : '-'} {record.material_width_unit || ''}
                </span>
            )
        },
        {
            title: 'ความยาว',
            dataIndex: 'material_length',
            key: 'material_length',
            width: 150,
            sorter: (a, b) => (Number(a.material_length) || 0) - (Number(b.material_length) || 0),

            // ✅ แปลงค่าเป็นทศนิยม 2 ตำแหน่งก่อนนำมาต่อกับหน่วยใน Filter
            filters: Array.from(
                new Set(
                    rows.filter(r => r.material_length !== null && r.material_length !== undefined)
                        .map(r => `${Number(r.material_length).toFixed(2)} ${r.material_length_unit || ''}`.trim())
                )
            ).map(text => ({ text: text, value: text })),
            filterSearch: true,

            // ✅ เวลา Filter ก็แปลงค่าใน record ให้เป็น 2 ตำแหน่งก่อนเทียบด้วย
            onFilter: (value, record) => {
                if (record.material_length === null || record.material_length === undefined) return false;
                const recordValue = `${Number(record.material_length).toFixed(2)} ${record.material_length_unit || ''}`.trim();
                return recordValue === value;
            },

            // ✅ แสดงผลในหน้าตารางเป็นทศนิยม 2 ตำแหน่ง
            render: (val, record) => (
                <span className="font-mono font-bold text-blue-700">
                    {val !== null && val !== undefined ? Number(val).toFixed(2) : '-'} {record.material_length_unit || ''}
                </span>
            )
        },
        {
            title: 'ความสูง',
            dataIndex: 'material_height',
            key: 'material_height',
            width: 150,
            sorter: (a, b) => (Number(a.material_height) || 0) - (Number(b.material_height) || 0),

            // ✅ แปลงค่าเป็นทศนิยม 2 ตำแหน่งก่อนนำมาต่อกับหน่วยใน Filter
            filters: Array.from(
                new Set(
                    rows.filter(r => r.material_height !== null && r.material_height !== undefined)
                        .map(r => `${Number(r.material_height).toFixed(2)} ${r.material_height_unit || ''}`.trim())
                )
            ).map(text => ({ text: text, value: text })),
            filterSearch: true,

            // ✅ เวลา Filter ก็แปลงค่าใน record ให้เป็น 2 ตำแหน่งก่อนเทียบด้วย
            onFilter: (value, record) => {
                if (record.material_height === null || record.material_height === undefined) return false;
                const recordValue = `${Number(record.material_height).toFixed(2)} ${record.material_height_unit || ''}`.trim();
                return recordValue === value;
            },

            // ✅ แสดงผลในหน้าตารางเป็นทศนิยม 2 ตำแหน่ง
            render: (val, record) => (
                <span className="font-mono font-bold text-blue-700">
                    {val !== null && val !== undefined ? Number(val).toFixed(2) : '-'} {record.material_height_unit || ''}
                </span>
            )
        },
        {
            title: 'ชื่อ',
            dataIndex: 'material_name',
            key: 'material_name',
            width: 250,
            sorter: (a, b) => String(a.material_name || '').localeCompare(String(b.material_name || '')),
            filters: [...new Set(rows.map(r => r.material_name).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.material_name === value,
        },
        {
            title: 'ประเภท',
            dataIndex: 'material_type',
            key: 'material_type',
            width: 150,
            sorter: (a, b) => String(a.material_type || '').localeCompare(String(b.material_type || '')),
            filters: [...new Set(rows.map(r => r.material_type).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.material_type === value,
        },
        {
            title: 'สี',
            dataIndex: 'material_color',
            key: 'material_color',
            width: 140,
            sorter: (a, b) => String(a.material_color || '').localeCompare(String(b.material_color || '')),
            filters: [...new Set(rows.map(r => r.material_color).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.material_color === value,
        },
        {
            title: 'คุณสมบัติ',
            dataIndex: 'material_feature',
            key: 'material_feature',
            width: 200,
            sorter: (a, b) => String(a.material_feature || '').localeCompare(String(b.material_feature || '')),
            filters: [...new Set(rows.map(r => r.material_feature).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.material_feature === value,
        },
        {
            title: 'รายละเอียด',
            dataIndex: 'material_remark',
            key: 'material_remark',
            width: 250,
            ellipsis: true,
            sorter: (a, b) => String(a.material_remark || '').localeCompare(String(b.material_remark || '')),
            filters: [...new Set(rows.map(r => r.material_remark).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.material_remark === value,
        },
        // ✅ เพิ่ม Column Action สำหรับ Edit/Delete
        {
            title: 'จัดการ',
            key: 'action',
            width: 100,
            align: 'center',
            render: (_, record) => (
                <Space onClick={(e) => e.stopPropagation()}>
                    {/* e.stopPropagation() สำคัญมาก เพื่อไม่ให้ไป trigger การ select row */}
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

    // Filter Logic
    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const term = searchTerm.toLowerCase();
        return rows.filter(
            (row) =>
                String(row.material_code || '').toLowerCase().includes(term) ||
                String(row.material_name || '').toLowerCase().includes(term) ||
                String(row.material_type || '').toLowerCase().includes(term) ||
                String(row.material_color || '').toLowerCase().includes(term) ||
                String(row.material_model || '').toLowerCase().includes(term) ||
                String(row.material_feature || '').toLowerCase().includes(term) ||
                String(row.material_remark || '').toLowerCase().includes(term)
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
                    Table: {
                        cellPaddingBlock: 8,
                        cellFontSize: 13,
                    },
                    Modal: {
                        borderRadius: 0
                    }
                }
            }}
        >
            <Modal
                open={open}
                title={
                    <div className="flex items-center gap-2 text-slate-700">
                        <SearchOutlined />
                        <span className="text-lg font-bold">จัดการและเลือกบรรจุภัณฑ์</span>
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
                        height: 'calc(100vh - 55px)', // ความสูงจอ - ความสูง Header ของ Modal
                        overflow: 'hidden'
                    }
                }}
            >
                <DraggableTable
                    columns={columns}
                    dataSource={filteredRows}
                    rowKey="material_id"
                    loading={loading}
                    scroll={{ x: 'max-content', y: 'max-content' }}

                    // Pagination
                    pagination={{
                        current: page.current,
                        pageSize: page.pageSize,
                        showSizeChanger: true,
                        pageSizeOptions: [10, 20, 50, 100],
                        showTotal: (t, r) => <span className="text-gray-400 text-xs">แสดง {r[0]}-{r[1]} จาก {t} รายการ</span>,
                        onChange: (p, s) => setPage({ current: p, pageSize: s }),
                        className: "px-4 pb-4"
                    }}

                    // Row Selection Logic
                    onRow={(record) => ({
                        onClick: () => {
                            // ถ้าคลิกที่แถว (ไม่ใช่ปุ่ม Edit/Delete) ให้ทำการ Select และปิด Modal
                            if (onSelect) {
                                onSelect(record);
                                onClose();
                            }
                        },
                        style: { cursor: 'pointer' }
                    })}

                    // Toolbar
                    renderToolbar={(ColumnVisibilityPopover) => (
                        <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-white p-2 rounded-md shadow-sm border border-gray-100 w-full md:w-auto">
                                <Input
                                    prefix={<SearchOutlined className="text-gray-400" />}
                                    placeholder="ค้นหา..."
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
                                        เพิ่มรายการใหม่
                                    </Button>

                                    {/* นำปุ่มซ่อน/แสดงคอลัมน์มาแสดงตรงนี้ */}
                                    {ColumnVisibilityPopover}
                                </div>
                            </div>
                        </div>
                    )}
                />

                {/* --- Modals สำหรับการจัดการ (Insert/Edit/Delete) --- */}
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

export default ModalAssetList;