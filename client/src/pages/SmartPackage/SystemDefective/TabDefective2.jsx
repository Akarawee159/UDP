import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { App, Button, Input, Tag, Modal } from 'antd'; // ✅ นำเข้า Modal
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import api from "../../../api";
import DraggableTable from '../../../components/antdtable/DraggableTable';
import { getSocket } from '../../../socketClient';

function TabDefective2() {
    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // ✅ State สำหรับควบคุม Modal ยืนยันการทำคืน
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    // State สำหรับ Pagination และความสูงของตาราง
    const [page, setPage] = useState({ current: 1, pageSize: 50 });
    const [tableY, setTableY] = useState(600);

    // คำนวณความสูงตารางอัตโนมัติ
    useEffect(() => {
        const onResize = () => setTableY(Math.max(400, window.innerHeight - 300));
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/smartpackage/systemdefective/defective-checkout-items');
            setData(res.data?.data || []);
        } catch (err) {
            message.error('ดึงข้อมูลรายการชำรุดล้มเหลว');
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

        const onUpdate = (event) => {
            const payload = event.detail;
            const action = payload?.action;

            const acts = [
                'checkout_defective',
                'return_defective'
            ];

            if (acts.includes(action)) {
                console.log("Socket Refreshing TabDefective2:", action);
                fetchData();
            }
        };

        window.addEventListener('hrms:systemdefective-update', onUpdate);
        return () => window.removeEventListener('hrms:systemdefective-update', onUpdate);
    }, [fetchData]);

    // ✅ ปรับฟังก์ชันให้รับเฉพาะการทำงาน API และปิด Modal เมื่อเสร็จ
    const handleReceiveStock = async () => {
        if (selectedRowKeys.length === 0) {
            setIsConfirmModalOpen(false);
            return message.warning('กรุณาเลือกรายการที่ต้องการทำคืนชำรุด');
        }
        try {
            setLoading(true);
            await api.post('/smartpackage/systemdefective/return-defective', {
                asset_codes: selectedRowKeys
            });
            message.success('อัปเดตทำคืนชำรุดสำเร็จ');
            setSelectedRowKeys([]);
            setIsConfirmModalOpen(false); // ✅ ปิด Modal
            fetchData();
        } catch (err) {
            message.error('ทำคืนชำรุดล้มเหลว');
        } finally {
            setLoading(false);
        }
    };

    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        const term = searchTerm.toLowerCase();
        return data.filter(r =>
            (r.asset_code || '').toLowerCase().includes(term) ||
            (r.asset_detail || '').toLowerCase().includes(term) ||
            (r.updated_at || '').toLowerCase().includes(term)
        );
    }, [data, searchTerm]);

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
            title: 'รหัสบรรจุภัณฑ์',
            dataIndex: 'asset_code',
            key: 'asset_code',
            width: 200,
            render: (val) => <span className="font-bold text-blue-600">{val}</span>
        },
        {
            title: 'วันที่แจ้งชำรุด',
            dataIndex: 'updated_at',
            key: 'updated_at',
            width: 180,
            align: 'center',
            render: (val) => {
                if (!val) return '-';
                const date = new Date(val);

                const dateStr = date.toLocaleDateString('th-TH', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });

                const timeStr = date.toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });

                return `${dateStr} ${timeStr} น.`;
            }
        },
        {
            title: 'รายละเอียด',
            dataIndex: 'asset_detail',
            key: 'asset_detail',
            width: 300
        },
        {
            title: 'สถานะปัจจุบัน',
            dataIndex: 'asset_status_name',
            key: 'status',
            width: 150,
            align: 'center',
            render: (val) => <Tag color="warning" className="w-full text-center m-0 border-0">{val || 'รอทำคืนชำรุด'}</Tag>
        }
    ], [page]);

    return (
        // ✅ เปลี่ยนคลาสเป็น flex-1 w-full เพื่อดันให้เต็มพื้นที่
        <div className="flex-1 flex flex-col w-full h-full">
            <DraggableTable
                columns={baseColumns}
                dataSource={filteredData}
                rowKey="asset_code"
                loading={loading}
                // ✅ เอา - 60 ออก ใช้ tableY ล้วนๆ เหมือนหน้าหลัก
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

                rowSelection={{
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys)
                }}

                renderToolbar={(ColumnVisibility) => (
                    <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-white p-2 rounded-md shadow-sm border border-gray-100 w-full md:w-auto">

                            <Input
                                prefix={<SearchOutlined className="text-gray-400" />}
                                placeholder="ค้นหา รหัสบรรจุภัณฑ์, RefID..."
                                allowClear
                                variant="borderless"
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-64 bg-transparent"
                            />

                            <div className="w-full h-px bg-gray-100 sm:w-px sm:h-6 sm:mx-1 hidden sm:block"></div>

                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button
                                    type="primary"
                                    icon={<DownloadOutlined />}
                                    className="bg-orange-600 hover:!bg-orange-500 border-none h-9 rounded-md px-4 font-medium shadow-md w-full sm:w-auto"
                                    onClick={() => setIsConfirmModalOpen(true)} // ✅ เปลี่ยนให้ไปเปิด Modal แทน
                                    disabled={selectedRowKeys.length === 0}
                                    loading={loading}
                                >
                                    ทำคืนชำรุด ({selectedRowKeys.length})
                                </Button>

                                {ColumnVisibility}
                            </div>
                        </div>
                    </div>
                )}
            />

            {/* ✅ คอมโพเนนต์ Modal สำหรัยืนยันการทำรายการ */}
            <Modal
                title="ยืนยันการทำคืนชำรุด"
                open={isConfirmModalOpen}
                onCancel={() => setIsConfirmModalOpen(false)}
                // ✅ ใช้ array ใน footer เพื่อจัดเรียงปุ่ม [ ยืนยัน, ปิด ] ตามลำดับจากซ้ายไปขวา
                footer={[
                    <Button
                        key="submit"
                        type="primary"
                        className="bg-orange-600 hover:!bg-orange-500 border-none"
                        loading={loading}
                        onClick={handleReceiveStock}
                    >
                        ยืนยัน
                    </Button>,
                    <Button
                        key="back"
                        onClick={() => setIsConfirmModalOpen(false)}
                        disabled={loading}
                    >
                        ปิด
                    </Button>
                ]}
            >
                <p>คุณต้องการทำคืนชำรุดจำนวน <strong>{selectedRowKeys.length}</strong> รายการ ใช่หรือไม่?</p>
            </Modal>
        </div>
    );
}

export default TabDefective2;