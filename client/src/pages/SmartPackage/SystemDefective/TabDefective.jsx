import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { App, Button, Input, Tag } from 'antd';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import api from "../../../api";
import DraggableTable from '../../../components/antdtable/DraggableTable';

function TabDefective() {
    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

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
            const res = await api.get('/smartpackage/systemdefective/defective-items');
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

    const handleReceiveStock = async () => {
        if (selectedRowKeys.length === 0) {
            return message.warning('กรุณาเลือกรายการที่ต้องการรับเข้าคลัง');
        }
        try {
            setLoading(true);
            await api.post('/smartpackage/systemdefective/receive-stock', {
                asset_codes: selectedRowKeys
            });
            message.success('อัปเดตรับเข้าคลังสำเร็จ');
            setSelectedRowKeys([]); // เคลียร์ Checkbox
            fetchData(); // รีเฟรชตาราง
        } catch (err) {
            message.error('รับเข้าคลังล้มเหลว');
        } finally {
            setLoading(false);
        }
    };

    // กรองข้อมูลตามช่องค้นหา
    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        const term = searchTerm.toLowerCase();
        return data.filter(r =>
            (r.asset_code || '').toLowerCase().includes(term) ||
            (r.asset_detail || '').toLowerCase().includes(term) ||
            (r.updated_at || '').toLowerCase().includes(term)
        );
    }, [data, searchTerm]);

    // Columns รูปแบบเดียวกับที่ใช้ใน DraggableTable
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
            title: 'รหัสทรัพย์สิน',
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

                // จัดรูปแบบวันที่ เป็น DD/MM/YYYY (พ.ศ.)
                const dateStr = date.toLocaleDateString('th-TH', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });

                // จัดรูปแบบเวลา เป็น HH:mm แบบ 24 ชม.
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
            render: (val) => <Tag color="error" className="w-full text-center m-0 border-0">{val || 'ชำรุด'}</Tag>
        }
    ], [page]);

    return (
        <div className="h-full flex flex-col pt-2">
            <DraggableTable
                columns={baseColumns}
                dataSource={filteredData}
                rowKey="asset_code"
                loading={loading}
                scroll={{ x: 'max-content', y: tableY - 60 }} // เผื่อความสูงของ Tabs

                // ตั้งค่า Pagination ให้เหมือนหน้าหลัก
                pagination={{
                    current: page.current,
                    pageSize: page.pageSize,
                    showSizeChanger: true,
                    pageSizeOptions: [10, 20, 50, 100],
                    showTotal: (t, r) => <span className="text-gray-400 text-xs">แสดง {r[0]}-{r[1]} จาก {t} รายการ</span>,
                    className: 'px-4 pb-4 mt-4'
                }}
                onChange={(pg) => setPage({ current: pg.current, pageSize: pg.pageSize })}

                // เปิดใช้งาน Checkbox ด้านหน้า
                rowSelection={{
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys)
                }}

                // Render Toolbar ให้มี UI ตรงกับหน้า SystemDefective
                renderToolbar={(ColumnVisibility) => (
                    <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-white p-2 rounded-md shadow-sm border border-gray-100 w-full md:w-auto">

                            <Input
                                prefix={<SearchOutlined className="text-gray-400" />}
                                placeholder="ค้นหา รหัสทรัพย์สิน, RefID..."
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
                                    className="bg-green-600 hover:!bg-green-500 border-none h-9 rounded-md px-4 font-medium shadow-md w-full sm:w-auto"
                                    onClick={handleReceiveStock}
                                    disabled={selectedRowKeys.length === 0}
                                    loading={loading}
                                >
                                    รับเข้าคลัง ({selectedRowKeys.length})
                                </Button>

                                {/* ปุ่มซ่อน/แสดงคอลัมน์ */}
                                {ColumnVisibility}
                            </div>
                        </div>
                    </div>
                )}
            />
        </div>
    );
}

export default TabDefective;