import React, { useState, useEffect, useMemo } from 'react';
// เพิ่ม Input เข้าไปใน import นี้
import { Grid, Card, Typography, Tabs, Select, Input, DatePicker, Button, Form, Row, Col, Space } from 'antd';
import { SearchOutlined, ClearOutlined, ClockCircleOutlined, UserOutlined, CalendarOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import DataTable from '../../../components/aggrid/DataTable';
import api from '../../../api';

// ตั้งค่า Dayjs ให้รองรับปีพุทธศักราช และภาษาไทย
dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function BoxStatus() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const [form] = Form.useForm();

    const [loading, setLoading] = useState(false);
    const [rawData, setRawData] = useState([]);
    const [displayData, setDisplayData] = useState([]);

    const [selectedPartCodePie, setSelectedPartCodePie] = useState('ALL');

    const containerStyle = useMemo(() => ({
        margin: isMd ? '-8px' : '0',
        padding: isMd ? '16px' : '12px',
        minHeight: '100vh',
        backgroundColor: '#f0f2f5'
    }), [isMd]);

    // ---------------------------------------------------------
    // 1. Fetch Data
    // ---------------------------------------------------------
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await api.get('/report/boxstatus');
                if (res.data.success) {
                    setRawData(res.data.data);
                    setDisplayData(res.data.data);
                }
            } catch (error) {
                console.error("Error fetching box status:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // ---------------------------------------------------------
    // 2. Prepare Options (ดึงข้อมูลสำหรับ Dropdown)
    // ---------------------------------------------------------
    const options = useMemo(() => {
        const extractUnique = (key, labelKey = null) => {
            const map = new Map();
            rawData.forEach(item => {
                const value = item[key];
                if (value) {
                    const label = labelKey ? item[labelKey] : value;
                    map.set(value, label);
                }
            });
            return Array.from(map.entries())
                .map(([value, label]) => ({ value, label }))
                .sort((a, b) => a.value.localeCompare(b.value));
        };

        return {
            assetCodes: extractUnique('asset_code'), // เพิ่มตัวเลือกสำหรับรหัสทรัพย์สิน
            origins: extractUnique('asset_origin'),
            destinations: extractUnique('asset_destination'),
            statuses: extractUnique('asset_status', 'asset_status_name'),
            lots: extractUnique('asset_lot'),
            partCodes: extractUnique('partCode')
        };
    }, [rawData]);

    // ---------------------------------------------------------
    // 3. Search Logic
    // ---------------------------------------------------------
    const handleSearch = (values) => {
        let filtered = [...rawData];

        // แก้ไข Asset Code เป็น Exact Match เพราะเลือกจาก Dropdown
        if (values.asset_code) {
            filtered = filtered.filter(item => item.asset_code === values.asset_code);
        }
        if (values.asset_origin) {
            filtered = filtered.filter(item => item.asset_origin === values.asset_origin);
        }
        if (values.asset_destination) {
            filtered = filtered.filter(item => item.asset_destination === values.asset_destination);
        }
        if (values.asset_status) {
            filtered = filtered.filter(item => item.asset_status === values.asset_status);
        }

        if (values.create_date_range && values.create_date_range.length === 2) {
            const [start, end] = values.create_date_range;
            filtered = filtered.filter(item => {
                const date = dayjs(item.create_date);
                return date.isValid() && (date.isSame(start, 'day') || date.isAfter(start, 'day')) && (date.isSame(end, 'day') || date.isBefore(end, 'day'));
            });
        }

        if (values.updated_at_range && values.updated_at_range.length === 2) {
            const [start, end] = values.updated_at_range;
            filtered = filtered.filter(item => {
                const dateToCheck = item.updated_at || item.created_at;
                const date = dayjs(dateToCheck);
                return date.isValid() && (date.isSame(start, 'day') || date.isAfter(start, 'day')) && (date.isSame(end, 'day') || date.isBefore(end, 'day'));
            });
        }

        if (values.doc_no) filtered = filtered.filter(item => item.doc_no?.toLowerCase().includes(values.doc_no.toLowerCase()));
        if (values.asset_lot) filtered = filtered.filter(item => item.asset_lot === values.asset_lot);
        if (values.partCode) filtered = filtered.filter(item => item.partCode === values.partCode);

        setDisplayData(filtered);
    };

    const handleReset = () => {
        form.resetFields();
        setDisplayData(rawData);
    };

    // ---------------------------------------------------------
    // 4. Chart Data
    // ---------------------------------------------------------
    const barChartData = useMemo(() => {
        const groups = {};
        displayData.forEach(item => {
            const partCode = item.partCode || 'Unknown';
            if (!groups[partCode]) {
                groups[partCode] = {
                    name: `BOX NO ${partCode}`,
                    partCode: partCode,
                    status100: 0, status103: 0, status104: 0, total: 0
                };
            }
            const status = String(item.asset_status);
            groups[partCode].total += 1;
            if (status === '100') groups[partCode].status100 += 1;
            else if (status === '103') groups[partCode].status103 += 1;
            else if (status === '104') groups[partCode].status104 += 1;
        });
        return Object.values(groups);
    }, [displayData]);

    const { pieChartData, allStats } = useMemo(() => {
        let filteredForPie = displayData;
        if (selectedPartCodePie !== 'ALL') {
            filteredForPie = displayData.filter(item => item.partCode === selectedPartCodePie);
        }

        let statsMap = {
            '100': { id: '100', name: 'คงเหลือ', value: 0, color: '#1890ff' },
            '101': { id: '101', name: 'จ่ายออก', value: 0, color: '#52c41a' },
            '103': { id: '103', name: 'ชำรุด', value: 0, color: '#faad14' },
            '104': { id: '104', name: 'เบิกซ่อม', value: 0, color: '#fa8c16' },
            'overdue': { id: 'overdue', name: 'เลยกำหนดส่งคืน', value: 0, color: '#f5222d' },
            'count_total': { id: 'count_total', name: 'ทั้งหมด', value: 0, color: '#000000', isTotal: true },
        };

        statsMap['count_total'].value = filteredForPie.length;
        const today = dayjs();

        filteredForPie.forEach(item => {
            const status = String(item.asset_status);
            const refID = item.refID || '';
            const scanDate = item.scan_at ? dayjs(item.scan_at) : null;
            let isOverdue = false;
            if (refID.startsWith('RF') && scanDate && today.diff(scanDate, 'day') > 7) {
                isOverdue = true;
            }

            if (isOverdue) statsMap['overdue'].value += 1;
            else if (statsMap[status]) statsMap[status].value += 1;
        });

        const displayOrder = ['count_total', '101', '103', '104', 'overdue', '100'];
        const sortedStatsArray = displayOrder.map(key => statsMap[key]).filter(item => item !== undefined);
        const filteredChartData = Object.values(statsMap).filter(item => !item.isTotal && item.value > 0);

        return { pieChartData: filteredChartData, allStats: sortedStatsArray };
    }, [displayData, selectedPartCodePie]);

    // ---------------------------------------------------------
    // 5. Columns Definition (AG Grid)
    // ---------------------------------------------------------
    const formatDateThai = (date) => date ? dayjs(date).format('DD/MM/BBBB') : '-';

    // Helper สำหรับแสดงค่าว่างเป็น "-"
    const safeVal = (val) => (val === null || val === undefined || val === '') ? '-' : val;

    const columnDefs = useMemo(() => [
        { headerName: '#', valueGetter: "node.rowIndex + 1", width: 60, cellClass: "text-center" },
        {
            headerName: 'เลยกำหนดส่งคืน',
            width: 150,
            cellClass: "flex items-center justify-center",
            cellRenderer: (params) => {
                const { refID, scan_at } = params.data;
                const today = dayjs();
                const scanDate = scan_at ? dayjs(scan_at) : null;

                // Logic: refID เริ่มต้น RF และ scan_at เกิน 7 วัน
                if (refID && String(refID).startsWith('RF') && scanDate && today.diff(scanDate, 'day') > 7) {
                    return (
                        <span className="text-red-500 font-bold flex items-center gap-1">
                            <ExclamationCircleOutlined /> เลยกำหนด
                        </span>
                    );
                }
                return <span className="text-gray-400">-</span>;
            }
        },
        {
            headerName: 'สถานะใช้งาน',
            field: 'asset_status',
            width: 160,
            filter: true,
            cellClass: "flex items-center",
            cellRenderer: (params) => {
                const { asset_status_color, asset_status_name, asset_status } = params.data;
                const colorClass = asset_status_color || 'bg-gray-100 text-gray-600 border-gray-200';
                return (
                    <div className={`w-full px-2 py-0.5 rounded border text-xs text-center font-medium ${colorClass}`}>
                        {asset_status_name || asset_status || '-'}
                    </div>
                );
            }
        },
        {
            headerName: 'วันที่ใช้งานล่าสุด',
            field: 'updated_at',
            width: 160,
            cellRenderer: (params) => {
                const dateToShow = params.data.updated_at || params.data.created_at;
                return (
                    <div className="flex items-center gap-2">
                        <ClockCircleOutlined className="text-blue-500" />
                        {formatDateThai(dateToShow)}
                    </div>
                );
            }
        },
        {
            headerName: 'ผู้ดำเนินการล่าสุด',
            field: 'updated_by_name',
            width: 180,
            cellRenderer: (params) => (
                <div className="flex items-center gap-2">
                    <UserOutlined className="text-blue-500" />
                    {safeVal(params.value)}
                </div>
            )
        },
        { headerName: 'ต้นทาง', field: 'asset_origin', width: 120, cellRenderer: p => safeVal(p.value) },
        { headerName: 'ปลายทาง', field: 'asset_destination', width: 120, cellRenderer: p => safeVal(p.value) },
        { headerName: 'รหัสทรัพย์สิน', field: 'asset_code', width: 150, cellRenderer: p => safeVal(p.value) },
        {
            headerName: 'วันที่ขึ้นทะเบียน',
            field: 'create_date',
            width: 160,
            cellRenderer: (params) => (
                <div className="flex items-center gap-2">
                    <CalendarOutlined className="text-green-500" />
                    {formatDateThai(params.value)}
                </div>
            )
        },
        { headerName: 'ชื่อสินค้า', field: 'asset_detail', width: 200, cellRenderer: p => safeVal(p.value) },
        { headerName: 'Part Code', field: 'partCode', width: 120, cellRenderer: p => safeVal(p.value) },
        { headerName: 'เลขที่เอกสาร', field: 'doc_no', width: 150, cellRenderer: p => safeVal(p.value) },
        { headerName: 'Lot', field: 'asset_lot', width: 120, cellRenderer: p => safeVal(p.value) },
        {
            headerName: 'สถานะทรัพย์สิน',
            field: 'is_status',
            width: 160,
            filter: true,
            cellClass: "flex items-center",
            cellRenderer: (params) => {
                const { is_status_color, is_status_name, is_status } = params.data;
                const colorClass = is_status_color || 'bg-gray-100 text-gray-600 border-gray-200';
                return (
                    <div className={`w-full px-2 py-0.5 rounded border text-xs text-center font-medium ${colorClass}`}>
                        {is_status_name || is_status || '-'}
                    </div>
                );
            }
        },
    ], []);

    // ---------------------------------------------------------
    // Render
    // ---------------------------------------------------------

    const renderPieChart = () => (
        <div style={{ display: 'flex', flexDirection: isMd ? 'row' : 'column', height: 450 }}>
            <div style={{ width: isMd ? 250 : '100%', padding: '20px', borderRight: isMd ? '1px solid #f0f0f0' : 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Title level={5}>ข้อมูลกล่อง</Title>
                <Select
                    value={selectedPartCodePie}
                    style={{ width: '100%' }}
                    onChange={(value) => setSelectedPartCodePie(value)}
                    options={[{ value: 'ALL', label: 'กล่องทั้งหมด' }, ...options.partCodes.map(pc => ({ value: pc.value, label: `BOX NO ${pc.value}` }))]}
                    showSearch
                    optionFilterProp="label"
                />
            </div>
            <div style={{ flex: 1, height: '100%', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={pieChartData} cx="50%" cy="50%" labelLine={true} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} outerRadius={130} dataKey="value">
                            {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(value, name) => [value, name]} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div style={{ width: isMd ? 250 : '100%', padding: '20px', borderLeft: isMd ? '1px solid #f0f0f0' : 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Title level={5} style={{ marginBottom: 16 }}>ข้อมูลกล่อง ({selectedPartCodePie === 'ALL' ? 'ทั้งหมด' : selectedPartCodePie})</Title>
                {allStats.map((item) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 12, opacity: (item.value === 0 && !item.isTotal) ? 0.4 : 1 }}>
                        <div style={{ width: 12, height: 12, backgroundColor: item.color, marginRight: 10, borderRadius: '2px', border: item.isTotal ? '1px solid #000' : 'none' }} />
                        <Text style={{ flex: 1, fontWeight: item.isTotal ? 'bold' : 'normal' }}>{item.name}</Text>
                        <Text strong style={{ fontSize: item.isTotal ? '16px' : '14px' }}>{item.value}</Text>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderBarChart = () => (
        <div style={{ width: '100%', height: 450 }}>
            <ResponsiveContainer>
                <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="status100" name="คงเหลือ" fill="#1890ff" label={{ position: 'top' }} />
                    <Bar dataKey="status103" name="ชำรุด" fill="#faad14" label={{ position: 'top' }} />
                    <Bar dataKey="status104" name="เบิกซ่อม" fill="#fa8c16" label={{ position: 'top' }} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );

    const tabItems = [
        { key: '1', label: 'Pie Chart', children: renderPieChart() },
        { key: '2', label: 'Bar Chart', children: renderBarChart() },
    ];

    return (
        <div style={containerStyle}>
            <Title level={3} style={{ marginBottom: 20 }}>รายงานสถานะกล่อง</Title>

            <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: 20 }}>
                <Tabs defaultActiveKey="1" items={tabItems} type="card" size="large" />
            </Card>

            <Card title="เงื่อนไขการค้นหา" bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: 20 }}>
                <Form form={form} onFinish={handleSearch} layout="vertical">
                    <Row gutter={[16, 16]}>
                        <Col xs={24} md={6}>
                            <Form.Item name="asset_code" label="รหัสทรัพย์สิน">
                                {/* เปลี่ยนจาก Input เป็น Select เพื่อให้เลือกจากข้อมูลที่มีได้ */}
                                <Select
                                    placeholder="ค้นหารหัสทรัพย์สิน"
                                    allowClear
                                    showSearch
                                    optionFilterProp="label"
                                    options={options.assetCodes}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                            <Form.Item name="asset_origin" label="ต้นทาง">
                                <Select placeholder="เลือกต้นทาง" allowClear showSearch optionFilterProp="label" options={options.origins} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                            <Form.Item name="asset_destination" label="ปลายทาง">
                                <Select placeholder="เลือกปลายทาง" allowClear showSearch optionFilterProp="label" options={options.destinations} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                            <Form.Item name="asset_status" label="สถานะใช้งาน">
                                <Select placeholder="เลือกสถานะ" allowClear showSearch optionFilterProp="label" options={options.statuses} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                            <Form.Item name="create_date_range" label="วันที่ขึ้นทะเบียน">
                                {/* ปรับ Format เป็น D MMMM BBBB เพื่อให้แสดง วัน เดือนเต็ม ปี พ.ศ. */}
                                <RangePicker
                                    style={{ width: '100%' }}
                                    format="D MM BBBB"
                                    placeholder={['วันเริ่มต้น', 'วันสิ้นสุด']}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                            <Form.Item name="updated_at_range" label="วันที่ใช้งานล่าสุด">
                                <RangePicker
                                    style={{ width: '100%' }}
                                    format="D MM BBBB"
                                    placeholder={['วันเริ่มต้น', 'วันสิ้นสุด']}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                            <Form.Item name="doc_no" label="เลขที่เอกสาร">
                                <Input placeholder="เลขที่เอกสาร" allowClear />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                            <Form.Item name="asset_lot" label="ล๊อตสินค้า">
                                <Select placeholder="เลือกล๊อต" allowClear showSearch optionFilterProp="label" options={options.lots} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                            <Form.Item name="partCode" label="Part Code">
                                <Select placeholder="เลือก Part Code" allowClear showSearch optionFilterProp="label" options={options.partCodes} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={24} style={{ textAlign: 'right' }}>
                            <Space>
                                <Button icon={<ClearOutlined />} onClick={handleReset}>ล้างค่า</Button>
                                <Button type="primary" icon={<SearchOutlined />} htmlType="submit">ค้นหา</Button>
                            </Space>
                        </Col>
                    </Row>
                </Form>
            </Card>

            <Card
                title="รายละเอียดข้อมูล"
                bordered={false}
                style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            >
                {/* กำหนด Height ให้ AG Grid */}
                <div style={{ height: 600, width: '100%' }}>
                    <DataTable
                        rowData={displayData}
                        columnDefs={columnDefs}
                        loading={loading}
                    />
                </div>
            </Card>
        </div>
    );
}

export default BoxStatus;