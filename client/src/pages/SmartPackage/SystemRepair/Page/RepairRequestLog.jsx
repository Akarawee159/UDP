import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Input, App, Grid, Button, ConfigProvider, Modal, Form, Checkbox, Divider } from 'antd';
import { SearchOutlined, ClockCircleOutlined, UserOutlined, CalendarOutlined, ToolOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from "../../../../api";
import DataTable from '../../../../components/aggrid/DataTable';
import { getSocket } from '../../../../socketClient';

// ตัวเลือกชิ้นส่วน (สามารถแยกไปไฟล์ config ได้)
const REPAIR_PARTS_OPTIONS = [
    'ชิ้นส่วนที่ 1',
    'ชิ้นส่วนที่ 2',
    'ชิ้นส่วนที่ 3',
    'ชิ้นส่วนที่ 4',
    'ชิ้นส่วนที่ 5',
    'ชิ้นส่วนที่ 6',
];

function RepairRequestLog() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const { message } = App.useApp(); // เอา modal ออกจากตรงนี้ เพราะเราจะใช้ <Modal> component แทน

    const [loading, setLoading] = useState(false);
    const [rowData, setRowData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRows, setSelectedRows] = useState([]);

    // State สำหรับ Modal รับเข้า
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [form] = Form.useForm();

    // 1. ดึงข้อมูลจาก API (tb_asset_lists where asset_status = 104)
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/smartpackage/systemrepair/repair-list');
            setRowData(res.data.data || []);
        } catch (err) {
            console.error(err);
            message.error("ไม่สามารถโหลดข้อมูลรายการแจ้งซ่อมได้");
        } finally {
            setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 5. Socket Real-time Update
    useEffect(() => {
        const s = getSocket();
        if (!s) return;

        const onUpdate = (event) => {
            const payload = event.detail;
            // ถ้ามีการ finalize (ส่งซ่อม 104) หรือ repair_received (รับเข้า 100) ให้รีเฟรช
            if (payload?.action === 'output_confirmed' || payload?.action === 'repair_received') {
                fetchData();
            }
        };

        window.addEventListener('hrms:systemrepair-update', onUpdate);
        return () => window.removeEventListener('hrms:systemrepair-update', onUpdate);
    }, [fetchData]);

    const handleReceiveToStockClick = () => {
        if (selectedRows.length === 0) {
            message.warning("กรุณาเลือกรายการที่ต้องการรับเข้าคลัง");
            return;
        }
        setIsModalOpen(true); // เปิด Modal
    };

    const handleModalOk = async () => {
        try {
            // Validate Form
            const values = await form.validateFields();

            setConfirmLoading(true);
            const asset_codes = selectedRows.map(r => r.asset_code);

            // ส่งข้อมูลไป API (รวม Parts และ Remark)
            await api.post('/smartpackage/systemrepair/receive-repair', {
                asset_codes,
                repair_parts: values.repair_parts, // Array ของชิ้นส่วน
                repair_detail: values.repair_detail // ข้อความ textarea
            });

            message.success("รับเข้าคลังและบันทึกข้อมูลการซ่อมเรียบร้อย");

            // Reset และปิด Modal
            setIsModalOpen(false);
            form.resetFields();
            setSelectedRows([]);
            fetchData();

        } catch (err) {
            // กรณี Validate ไม่ผ่าน หรือ API Error
            if (err.errorFields) return; // Validate Failed
            console.error(err);
            message.error(err.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setConfirmLoading(false);
        }
    };

    const handleModalCancel = () => {
        setIsModalOpen(false);
        form.resetFields();
    };

    const onSelectionChanged = useCallback((event) => {
        const rows = event.api.getSelectedRows();
        setSelectedRows(rows);
    }, []);

    const columnDefs = useMemo(() => [
        // 2. Checkbox Selection
        {
            checkboxSelection: true,
            headerCheckboxSelection: true,
            headerCheckboxSelectionFilteredOnly: true,
            width: 50,
            pinned: 'left',
            lockVisible: true,
            headerClass: 'header-center-checkbox',
            cellClass: "flex justify-center items-center",
        },
        { headerName: 'ลำดับ', valueGetter: "node.rowIndex + 1", width: 60, cellClass: "text-center" },
        { headerName: 'ล็อตทรัพย์สิน', field: 'asset_lot', width: 200, sortable: true, filter: true },
        { headerName: 'รหัสทรัพย์สิน', field: 'asset_code', width: 200, sortable: true, filter: true },
        { headerName: 'ชื่อทรัพย์สิน', field: 'asset_detail', width: 200, filter: true }, // เพิ่มชื่อให้ดูง่ายขึ้น
        {
            headerName: 'สถานะใช้งาน', field: 'asset_status', width: 160,
            sortable: true,
            filter: true,
            filterValueGetter: (params) => params.data.asset_status_name,
            cellClass: "flex items-center justify-center p-2",
            cellRenderer: (params) => {
                const name = params.data.asset_status_name || params.value;
                const colorClass = params.data.asset_status_color || 'bg-gray-100 text-gray-600 border-gray-200';
                return (
                    <div className={`w-full px-2 py-0.5 rounded border text-xs text-center font-medium ${colorClass}`}>
                        {name}
                    </div>
                );
            }
        },
        { headerName: 'เลขที่เอกสาร', field: 'refID', width: 150 },
        {
            headerName: 'ผู้ทำรายการ',
            field: 'scan_by_name', // [แก้ไขจุดที่ 3] เปลี่ยนชื่อ field ให้ตรงกับที่ query มาใหม่
            width: 160,
            cellRenderer: (params) => (
                <div className="flex items-center gap-2">
                    <UserOutlined className="text-blue-500" />
                    {params.value || '-'}
                </div>
            )
        },
        {
            headerName: 'วันที่ทำรายการ',
            field: 'updated_at', // ใช้ updated_at ล่าสุดที่กลายเป็น 104
            width: 160,
            sort: 'desc',
            cellRenderer: (params) => (
                <div className="flex items-center gap-2">
                    <CalendarOutlined className="text-blue-500" />
                    {params.value ? dayjs(params.value).format('DD/MM/YYYY') : '-'}
                </div>
            )
        },
        {
            headerName: 'เวลาทำรายการ',
            field: 'updated_at',
            width: 140,
            cellRenderer: (params) => (
                <div className="flex items-center gap-2">
                    <ClockCircleOutlined className="text-blue-500" />
                    {params.value ? dayjs(params.value).format('HH:mm:ss') : '-'}
                </div>
            )
        },
        { headerName: 'หมายเหตุ', field: 'booking_remark', flex: 1, width: 180 },
    ], []);

    const filteredData = useMemo(() => {
        if (!searchTerm) return rowData;
        const lower = searchTerm.toLowerCase();
        return rowData.filter(r =>
            String(r.asset_code || '').toLowerCase().includes(lower) ||
            String(r.asset_detail || '').toLowerCase().includes(lower) ||
            String(r.refID || '').toLowerCase().includes(lower)
        );
    }, [rowData, searchTerm]);

    return (
        <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200">
            {/* Search Bar Section */}
            <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none p-2">
                {/* ... Input Search เหมือนเดิม ... */}
                <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 flex-1 md:flex-none">
                    <Input
                        prefix={<SearchOutlined className="text-gray-400" />}
                        placeholder="ค้นหา รหัสทรัพย์สิน, เอกสาร..."
                        allowClear
                        variant="borderless"
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-64 bg-transparent"
                    />
                    <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>

                    <ConfigProvider theme={{ token: { colorPrimary: '#16a34a' } }}>
                        <Button
                            type="primary"
                            icon={<ToolOutlined />}
                            disabled={selectedRows.length === 0}
                            onClick={handleReceiveToStockClick} // เปลี่ยน function ตรงนี้
                            className="bg-green-600 hover:!bg-green-500 border-none h-9 rounded-lg px-4 font-medium shadow-md transition-all"
                        >
                            ซ่อมแล้ว ({selectedRows.length})
                        </Button>
                    </ConfigProvider>
                </div>
            </div>

            {/* DataTable Section */}
            <div className="flex-1 overflow-hidden relative">
                <DataTable
                    rowData={filteredData}
                    columnDefs={columnDefs}
                    loading={loading}
                    rowSelection="multiple"
                    onSelectionChanged={onSelectionChanged}
                    rowClass="cursor-pointer hover:bg-gray-50"
                    suppressRowClickSelection={true}
                />
            </div>

            {/* ================= MODAL FORM ================= */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-green-700">
                        <ToolOutlined />
                        <span>บันทึกผลการซ่อมและรับเข้าคลัง</span>
                    </div>
                }
                open={isModalOpen}
                onCancel={handleModalCancel} // ยังต้องมีเพื่อให้กดปุ่ม X หรือคลิกข้างนอกปิดได้

                // ✅ ใช้ footer เพื่อกำหนดลำดับปุ่มเอง (เรียงจากซ้ายไปขวา)
                footer={[
                    <Button
                        key="submit"
                        type="primary"
                        loading={confirmLoading}
                        onClick={handleModalOk}
                        className="bg-green-600 hover:!bg-green-500"
                    >
                        ยืนยันรับเข้า
                    </Button>,
                    <Button
                        key="back"
                        onClick={handleModalCancel}
                    >
                        ยกเลิก
                    </Button>
                ]}
            >
                <div className="mb-4 text-gray-500 text-sm">
                    กำลังทำรายการรับเข้าจำนวน: <span className="font-bold text-black">{selectedRows.length}</span> รายการ
                </div>

                <Form form={form} layout="vertical">
                    <Form.Item
                        name="repair_parts"
                        label="รายการชิ้นส่วนที่ซ่อม/เปลี่ยน (เลือกได้หลายรายการ)"
                    >
                        <Checkbox.Group className="flex flex-col gap-2">
                            {REPAIR_PARTS_OPTIONS.map(opt => (
                                <Checkbox key={opt} value={opt}>{opt}</Checkbox>
                            ))}
                        </Checkbox.Group>
                    </Form.Item>

                    <Divider className="my-2" />

                    <Form.Item
                        name="repair_detail"
                        label="รายละเอียดเพิ่มเติม / หมายเหตุ"
                    >
                        <Input.TextArea
                            rows={3}
                            placeholder="ระบุรายละเอียดการซ่อม หรือหมายเหตุ..."
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

export default RepairRequestLog;