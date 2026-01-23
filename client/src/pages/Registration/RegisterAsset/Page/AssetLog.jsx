import React, { useState, useEffect, useMemo } from 'react';
import {
    Input, Button, Card, Typography, App, Grid, Tag
} from 'antd';
import {
    SearchOutlined, ArrowLeftOutlined, CloseOutlined,
    ClockCircleOutlined, UserOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import api from "../../../../api";
import DataTable from '../../../../components/aggrid/DataTable';

const { Title, Text } = Typography;

function AssetLog() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;

    const containerStyle = useMemo(() => ({
        margin: isMd ? '-8px' : '0',
        padding: isMd ? '16px' : '12px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
    }), [isMd]);

    const navigate = useNavigate();
    const location = useLocation();
    const { message } = App.useApp();

    // รับ asset_code จากหน้าก่อนหน้า
    const { asset_code } = location.state || {};

    const [loading, setLoading] = useState(false);
    const [rowData, setRowData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!asset_code) {
            message.error("ไม่พบรหัสทรัพย์สิน");
            navigate(-1);
            return;
        }

        const fetchHistory = async () => {
            setLoading(true);
            try {
                // เรียก API ที่เราสร้างไว้
                const res = await api.get(`/registration/registerasset/history/${asset_code}`);
                if (res.data?.success) {
                    setRowData(res.data.data);
                }
            } catch (err) {
                console.error(err);
                message.error("ไม่สามารถโหลดประวัติได้");
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [asset_code, navigate, message]);

    // Format วันที่
    const formatDate = (date) => date ? dayjs(date).format('DD/MM/YYYY HH:mm:ss') : '-';

    // Column Definitions สำหรับตาราง Log
    const columnDefs = useMemo(() => [
        { headerName: '#', valueGetter: "node.rowIndex + 1", width: 100, cellClass: "text-center" },
        {
            headerName: 'Action', field: 'asset_action', width: 120, pinned: 'left',
            cellRenderer: (params) => {
                const action = params.value || '';
                let color = 'default';
                let text = action.toUpperCase();

                if (action === 'first-time') { color = 'green'; text = 'CREATE'; }
                else if (action === 'print') { color = 'blue'; text = 'PRINT'; }
                else if (action === 'cancel') { color = 'red'; text = 'CANCEL'; }

                return <Tag color={color}>{text}</Tag>;
            }
        },
        {
            headerName: 'วันที่ทำรายการ', field: 'updated_at', width: 200, sort: 'desc',
            cellRenderer: (params) => (
                <div className="flex items-center gap-2">
                    <ClockCircleOutlined className="text-gray-400" />
                    {formatDate(params.value)}
                </div>
            )
        },
        {
            headerName: 'ผู้ทำรายการ', field: 'updated_by', width: 200,
            cellRenderer: (params) => (
                <div className="flex items-center gap-2">
                    <UserOutlined className="text-gray-400" />
                    {params.value || 'System'}
                </div>
            )
        },
        {
            headerName: 'พิมพ์ครั้งที่', field: 'print_status', width: 140,
            cellClass: "text-center",
            cellRenderer: (params) => (
                <span className="font-medium text-blue-600">{params.value}</span>
            )
        },
        // --- แก้ไขส่วน asset_status (สถานะใช้งาน) ---
        {
            headerName: 'สถานะใช้งาน', field: 'asset_status', width: 200,
            cellRenderer: (params) => {
                // ดึงชื่อและสีจากที่ backend join มาให้
                const name = params.data.asset_status_name || params.value;
                // ถ้าไม่มีสี ให้ใช้สีเทาเป็น default
                const colorClass = params.data.asset_status_color || 'bg-gray-100 text-gray-600 border-gray-200';

                return (
                    <div className={`px-2 py-0.5 rounded border text-xs text-center font-medium ${colorClass}`}>
                        {name}
                    </div>
                );
            }
        },
        // --- แก้ไขส่วน is_status (สถานะทรัพย์สิน) ---
        {
            headerName: 'สถานะทรัพย์สิน', field: 'is_status', width: 200,
            cellRenderer: (params) => {
                const name = params.data.is_status_name || params.value;
                const colorClass = params.data.is_status_color || 'bg-gray-100 text-gray-600 border-gray-200';

                return (
                    <div className={`px-2 py-0.5 rounded border text-xs text-center font-medium ${colorClass}`}>
                        {name}
                    </div>
                );
            }
        },
        { headerName: 'หมายเหตุ', field: 'asset_remark', flex: 1, width: 200 },
        { headerName: 'สถานที่', field: 'asset_location', width: 200 },
        { headerName: 'ผู้ครอบครอง', field: 'asset_holder', width: 200 },
    ], []);

    const filteredData = useMemo(() => {
        if (!searchTerm) return rowData;
        const lower = searchTerm.toLowerCase();
        return rowData.filter(r =>
            String(r.asset_action).toLowerCase().includes(lower) ||
            String(r.updated_by).toLowerCase().includes(lower)
        );
    }, [rowData, searchTerm]);

    return (
        <div style={containerStyle} className="bg-slate-50 relative">
            {/* --- Header --- */}
            <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate(-1)}
                        shape="circle"
                        className="border-gray-200 text-slate-500 hover:text-blue-600"
                    />
                    <div>
                        <Title level={4} style={{ margin: 0 }} className="text-slate-800 flex items-center gap-2">
                            <span className="bg-orange-500 w-2 h-6 rounded-r-md block"></span>
                            ประวัติทรัพย์สิน: {asset_code}
                        </Title>
                        <Text className="text-slate-500 text-xs ml-4">
                            แสดงประวัติการเปลี่ยนแปลง (Log) ทั้งหมดของทรัพย์สินนี้
                        </Text>
                    </div>
                </div>
                <Button
                    type="text"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => navigate(-1)}
                >
                    ปิด
                </Button>
            </div>

            {/* --- Content --- */}
            <div className="p-4">
                <Card className="shadow-sm border-gray-200 rounded-xl" styles={{ body: { padding: 0 } }}>
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-4 bg-white rounded-t-xl">
                        <Input
                            prefix={<SearchOutlined className="text-gray-400" />}
                            placeholder="ค้นหา Action, ผู้ทำรายการ..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            allowClear
                            className="w-64"
                        />
                    </div>

                    <div style={{ height: 'calc(100vh - 180px)' }} className="w-full">
                        <DataTable
                            rowData={filteredData}
                            columnDefs={columnDefs}
                            loading={loading}
                        />
                    </div>
                </Card>
            </div>
        </div>
    );
}

export default AssetLog;