import React, { useState, useEffect, useMemo } from 'react';
import {
    Input, Button, Card, Typography, App, Grid, Tag
} from 'antd';
import {
    SearchOutlined, ArrowLeftOutlined, CloseOutlined,
    ClockCircleOutlined, UserOutlined, CalendarOutlined
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
        padding: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    }), [isMd]);

    const navigate = useNavigate();
    const location = useLocation();
    const { message } = App.useApp();

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

    const formatDate = (date) => date ? dayjs(date).format('DD/MM/YYYY HH:mm:ss') : '-';

    // Helper: ตรวจสอบว่าเป็นกลุ่ม Print/Register หรือไม่ (120, 121, 122)
    const isPrintOrRegister = (status) => ['120', '121', '122'].includes(String(status));

    const columnDefs = useMemo(() => [
        { headerName: '#', valueGetter: "node.rowIndex + 1", width: 80, cellClass: "text-center" },
        {
            headerName: 'Action', field: 'asset_action', width: 120, pinned: 'left',
            cellClass: "flex items-center justify-center p-2",
            cellRenderer: (params) => {
                const action = params.value || '';
                let color = 'default';
                let text = action.toUpperCase();

                if (action === 'สร้าง') { color = 'green'; text = 'สร้าง'; }
                else if (action === 'พิมพ์') { color = 'blue'; text = 'พิมพ์'; }
                else if (action === 'ยกเลิก') { color = 'red'; text = 'ยกเลิก'; }

                return <Tag color={color} className="w-full text-center m-0">{text}</Tag>;
            }
        },
        {
            headerName: 'สถานะทรัพย์สิน', field: 'is_status', width: 180,
            sortable: true,
            filter: true,
            filterValueGetter: (params) => params.data.is_status_name,
            cellClass: "flex items-center justify-center p-2",
            cellRenderer: (params) => {
                const name = params.data.is_status_name || params.value;
                const colorClass = params.data.is_status_color || 'bg-gray-100 text-gray-600 border-gray-200';
                return (
                    <div className={`w-full px-2 py-0.5 rounded border text-xs text-center font-medium ${colorClass}`}>
                        {name}
                    </div>
                );
            }
        },
        {
            headerName: 'พิมพ์ครั้งที่', field: 'print_status', width: 120,
            cellClass: "text-center",
            cellRenderer: (params) => (
                <span className="font-medium text-blue-600">{params.value}</span>
            )
        },
        {
            headerName: 'วันที่พิมพ์สติ๊กเกอร์',
            width: 200,
            sort: 'desc',
            cellRenderer: (params) => {
                const status = String(params.data.is_status);
                let dateToShow = null;

                if (status === '120') {
                    // สถานะ 120: ใช้ created_at
                    dateToShow = params.data.created_at;
                } else if (status === '121' || status === '122') {
                    // สถานะ 121, 122: ใช้ updated_at
                    dateToShow = params.data.updated_at;
                } else {
                    // สถานะอื่น: ไม่แสดง
                    return <span className="text-gray-500">-</span>;
                }

                return (
                    <div className="flex items-center gap-2">
                        <ClockCircleOutlined className="text-blue-500" />
                        {formatDate(dateToShow)}
                    </div>
                );
            }
        },
        {
            headerName: 'ผู้พิมพ์สติ๊กเกอร์',
            width: 200,
            cellRenderer: (params) => {
                const status = String(params.data.is_status);
                let nameToShow = null;

                if (status === '120') {
                    // สถานะ 120: ผู้สร้าง (booking_created_by)
                    nameToShow = params.data.booking_created_by;
                } else if (status === '121' || status === '122') {
                    // สถานะ 121, 122: ผู้แก้ไข (updated_by)
                    nameToShow = params.data.updated_by;
                } else {
                    // สถานะอื่น: ไม่แสดง
                    return <span className="text-gray-500">-</span>;
                }

                return (
                    <div className="flex items-center gap-2">
                        <UserOutlined className="text-blue-500" />
                        {nameToShow || 'System'}
                    </div>
                );
            }
        },
        {
            headerName: 'สถานะใช้งาน', field: 'asset_status', width: 180,
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
        {
            headerName: 'เลขที่เอกสาร',
            field: 'refID',
            width: 180,
            cellRenderer: (params) => params.value || '-'
        },
        {
            headerName: 'ต้นทาง',
            field: 'asset_origin',
            width: 180,
            cellRenderer: (params) => params.value || '-'
        },
        {
            headerName: 'ปลายทาง',
            field: 'asset_destination',
            width: 180,
            cellRenderer: (params) => params.value || '-'
        },
        {
            // === Logic 3: ผู้ทำรายการ (ซ่อนถ้าเป็น 120,121,122) ===
            headerName: 'ผู้ทำรายการ',
            field: 'booking_created_by',
            width: 200,
            cellRenderer: (params) => {
                if (isPrintOrRegister(params.data.is_status)) {
                    return <span className="text-gray-500">-</span>;
                }
                return (
                    <div className="flex items-center gap-2">
                        <UserOutlined className="text-blue-500" />
                        {params.value || '-'}
                    </div>
                );
            }
        },
        {
            // === Logic 4: วันที่ทำรายการ (ซ่อนถ้าเป็น 120,121,122) ===
            headerName: 'วันที่ทำรายการ',
            field: 'create_date',
            width: 160,
            sort: 'desc',
            cellRenderer: (params) => {
                if (isPrintOrRegister(params.data.is_status)) {
                    return <span className="text-gray-500">-</span>;
                }
                return (
                    <div className="flex items-center gap-2">
                        <CalendarOutlined className="text-blue-500" />
                        {params.value ? dayjs(params.value).format('DD/MM/YYYY') : '-'}
                    </div>
                );
            }
        },
        {
            // === Logic 5: เวลาทำรายการ (ซ่อนถ้าเป็น 120,121,122) ===
            headerName: 'เวลาทำรายการ',
            field: 'create_time',
            width: 140,
            cellRenderer: (params) => {
                if (isPrintOrRegister(params.data.is_status)) {
                    return <span className="text-gray-500">-</span>;
                }
                return (
                    <div className="flex items-center gap-2">
                        <ClockCircleOutlined className="text-blue-500" />
                        {params.value || '-'}
                    </div>
                );
            }
        },
        { headerName: 'หมายเหตุ', field: 'asset_remark', width: 200 },
        { headerName: 'สถานที่', field: 'asset_location', width: 200 },
        { headerName: 'ผู้ครอบครอง', field: 'asset_holder', width: 200 },
    ], []);

    const filteredData = useMemo(() => {
        if (!searchTerm) return rowData;
        const lower = searchTerm.toLowerCase();
        return rowData.filter(r =>
            String(r.asset_action).toLowerCase().includes(lower) ||
            String(r.updated_by).toLowerCase().includes(lower) ||
            String(r.booking_created_by).toLowerCase().includes(lower)
        );
    }, [rowData, searchTerm]);

    return (
        <div style={containerStyle} className="bg-slate-50 relative">
            {/* --- Header --- */}
            <div className="bg-white px-6 py-2 border-b rounded-md border-gray-300 flex items-center justify-between sticky top-0 z-20 shadow-sm backdrop-blur-sm bg-white/90">
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
            <div className="p-2 flex-1 overflow-hidden flex flex-col">
                <Card
                    className="shadow-sm border-gray-200 rounded-md h-full flex flex-col"
                    styles={{
                        body: {
                            padding: 0,
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }
                    }}
                >
                    <div className="px-5 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-t-xl flex-none">
                        <Input
                            prefix={<SearchOutlined className="text-gray-400" />}
                            placeholder="ค้นหา Action, ผู้ทำรายการ..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            allowClear
                            className="w-64"
                        />
                    </div>

                    <div style={{ height: 'calc(100vh - 180px)' }} className="w-full flex-1 overflow-hidden">
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