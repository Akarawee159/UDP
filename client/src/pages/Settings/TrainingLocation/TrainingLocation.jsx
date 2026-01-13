import React, { useEffect, useMemo, useState, useCallback } from 'react';
// ✅ 1. เพิ่ม Grid ใน import
import { Table, App, Button, Input, ConfigProvider, Tooltip, Grid } from 'antd';
import {
    PlusOutlined,
    DeleteOutlined,
    EditOutlined,
    MoreOutlined,
    SearchOutlined
} from '@ant-design/icons';
import api from "../../../api";

import ModalForm from "./Modal/ModalForm";
import ModalDelete from "./Modal/ModalDelete";

import { getSocket } from '../../../socketClient';

function TrainingLocation() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;

    // ✅ Logic Style เดิม
    const containerStyle = useMemo(() => ({
        margin: isMd ? '-8px' : '0',
        padding: isMd ? '16px' : '12px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
    }), [isMd]);

    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [modalFormOpen, setModalFormOpen] = useState(false);
    const [currentRecord, setCurrentRecord] = useState(null);
    const [openDelete, setOpenDelete] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/training-location');
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

        s.on('training-location:upsert', onUpsert);
        s.on('training-location:delete', onDelete);

        return () => {
            s.off('training-location:upsert', onUpsert);
            s.off('training-location:delete', onDelete);
        };
    }, []);

    // ====== Actions ======

    const handleCreate = () => {
        setCurrentRecord(null);
        setModalFormOpen(true);
    };

    const handleUpdate = (record) => {
        setCurrentRecord(record);
        setModalFormOpen(true);
    };

    const openDeleteModal = (record) => {
        setCurrentRecord(record);
        setOpenDelete(true);
    };

    const refreshAfterSuccess = () => fetchData();

    // ====== Columns ======
    const columns = [
        {
            title: 'ลำดับ',
            key: 'index',
            width: 70,
            align: 'center',
            render: (_val, _row, index) => <span className="text-gray-500 font-medium">{index + 1}</span>,
        },
        {
            title: 'รหัสสถานที่อบรม',
            dataIndex: 'G_CODE',
            key: 'G_CODE',
            // เปลี่ยนสี Badge เป็นสีน้ำเงิน
            render: (text) => (
                <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                    {text}
                </span>
            ),
        },
        {
            title: 'ชื่อสถานที่อบรม (ไทย)',
            dataIndex: 'G_NAME',
            key: 'G_NAME',
            render: (text) => <span className="text-gray-700 font-medium">{text}</span>,
        },
        {
            title: 'ชื่อสถานที่อบรม (อังกฤษ)',
            dataIndex: 'G_NAME_EN',
            key: 'G_NAME_EN',
            render: (text) => <span className="text-gray-500">{text || '-'}</span>,
        },
        {
            title: 'การจัดการ',
            key: 'actions',
            align: 'center',
            width: 150,
            render: (_val, record) => (
                <div className="flex justify-center gap-2">
                    <Tooltip title="แก้ไขข้อมูล">
                        <Button
                            type="text"
                            shape="circle"
                            icon={<EditOutlined />}
                            className="text-amber-500 hover:bg-amber-50 hover:text-amber-600"
                            onClick={() => handleUpdate(record)}
                        />
                    </Tooltip>
                    <Tooltip title="ลบข้อมูล">
                        <Button
                            type="text"
                            shape="circle"
                            danger
                            icon={<DeleteOutlined />}
                            className="hover:bg-red-50"
                            onClick={() => openDeleteModal(record)}
                        />
                    </Tooltip>
                </div>
            ),
        },
    ];

    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const term = searchTerm.toLowerCase();
        return rows.filter(
            (row) =>
                row.G_CODE?.toLowerCase().includes(term) ||
                row.G_NAME?.toLowerCase().includes(term) ||
                row.G_NAME_EN?.toLowerCase().includes(term)
        );
    }, [rows, searchTerm]);

    return (
        <ConfigProvider
            theme={{
                token: {
                    // เปลี่ยน Primary Color เป็น Blue 600
                    colorPrimary: '#2563eb',
                    borderRadius: 8,
                    fontFamily: 'Inter, "Sarabun", sans-serif',
                },
                components: {
                    Table: {
                        // เปลี่ยนธีม Table เป็นสีฟ้า/น้ำเงิน
                        headerBg: '#eff6ff', // Blue 50
                        headerColor: '#1e40af', // Blue 800
                        rowHoverBg: '#eff6ff',
                        borderColor: '#eff6ff',
                    },
                    Button: {
                        // เปลี่ยนเงาปุ่มเป็นสีน้ำเงิน
                        primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)',
                    }
                }
            }}
        >
            {/* ✅ 2. ใช้ containerStyle และลบ class ที่ซ้ำซ้อน */}
            <div style={containerStyle} className="bg-gray-50">

                {/* Header Section */}
                {/* ✅ 3. เปลี่ยนเป็น w-full */}
                <div className="w-full mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        {/* เปลี่ยน Text เป็นสีน้ำเงิน */}
                        <h1 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
                            <MoreOutlined className="text-blue-600" />
                            ข้อมูลสถานที่อบรม
                        </h1>
                        <p className="text-blue-600/80 text-sm mt-1 pl-9">
                            จัดการโครงสร้างสถานที่อบรมและหน่วยงานภายในองค์กร
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
                        <Input
                            prefix={<SearchOutlined className="text-gray-400" />}
                            placeholder="ค้นหารหัส, ชื่อสถานที่อบรม..."
                            allowClear
                            bordered={false}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-64 bg-transparent"
                        />
                        {/* เปลี่ยนปุ่มเป็นสีน้ำเงิน */}
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

                {/* Table Content */}
                {/* ✅ 4. เปลี่ยนเป็น w-full และเพิ่ม flex-1 */}
                <div className="w-full flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <Table
                        size="middle"
                        rowKey="G_ID"
                        loading={loading}
                        columns={columns}
                        dataSource={filteredRows}
                        scroll={{ x: 'max-content', y: 600 }}
                        pagination={{
                            defaultPageSize: 20,
                            showSizeChanger: true,
                            pageSizeOptions: [10, 20, 50, 100],
                            className: 'p-4',
                            showTotal: (total, range) => <span className="text-gray-400 text-sm">แสดง {range[0]}-{range[1]} จาก {total} รายการ</span>
                        }}
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

export default TrainingLocation;