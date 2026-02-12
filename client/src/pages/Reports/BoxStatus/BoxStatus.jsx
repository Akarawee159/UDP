import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Grid, Card, Typography, Tabs, Select, Input, DatePicker, Button, Form, Row, Col, Space, Tag } from 'antd';
import {
    SearchOutlined,
    ClearOutlined,
    ClockCircleOutlined,
    UserOutlined,
    CalendarOutlined,
    ExclamationCircleOutlined,
    HistoryOutlined,
    DownloadOutlined,
    ArrowLeftOutlined
} from '@ant-design/icons';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import * as XLSX from 'xlsx'; // Import xlsx
import DataTable from '../../../components/aggrid/DataTable';
import api from '../../../api';

// ตั้งค่า Dayjs
dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function BoxStatus() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const [form] = Form.useForm();
    const gridApiRef = useRef(null); // Ref สำหรับเก็บ Grid API

    const [loading, setLoading] = useState(false);
    const [rawData, setRawData] = useState([]);      // ข้อมูล Master ทั้งหมด
    const [displayData, setDisplayData] = useState([]); // ข้อมูลที่แสดงในตาราง (กรองแล้ว หรือเป็น History)
    const [isHistoryMode, setIsHistoryMode] = useState(false); // บอกสถานะว่ากำลังดู History หรือไม่

    const [selectedPartCodePie, setSelectedPartCodePie] = useState('ALL');

    const containerStyle = useMemo(() => ({
        margin: isMd ? '-8px' : '0',
        padding: isMd ? '16px' : '12px',
        minHeight: '100vh',
        backgroundColor: '#f0f2f5'
    }), [isMd]);

    // ---------------------------------------------------------
    // 1. Fetch Master Data (Initial)
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
    // 2. Prepare Options
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
            assetCodes: extractUnique('asset_code'),
            origins: extractUnique('asset_origin'),
            destinations: extractUnique('asset_destination'),
            statuses: extractUnique('asset_status', 'asset_status_name'),
            lots: extractUnique('asset_lot'),
            partCodes: extractUnique('partCode'),
            nonMoves: [
                { value: 1, label: 'ไม่เคลื่อนไหว 1 เดือน' },
                { value: 2, label: 'ไม่เคลื่อนไหว 2 เดือน' },
                { value: 3, label: 'ไม่เคลื่อนไหว 3 เดือน' },
            ]
        };
    }, [rawData]);

    // ---------------------------------------------------------
    // 3. Search Logic
    // ---------------------------------------------------------
    const handleSearch = async (values) => {
        // กรณีเลือก Asset Code เพียง 1 รายการ -> ไปโหลด History
        if (values.asset_code && values.asset_code.length === 1) {
            const selectedCode = values.asset_code[0];
            await loadHistoryData(selectedCode);
            return;
        }

        // กรณีอื่นๆ -> กรองข้อมูลจาก Raw Data (Client-side)
        setIsHistoryMode(false);
        let filtered = [...rawData];

        // Helper filter for multiple selection (array)
        const filterMultiple = (key, selectedValues) => {
            if (selectedValues && selectedValues.length > 0) {
                filtered = filtered.filter(item => selectedValues.includes(item[key]));
            }
        };

        filterMultiple('asset_code', values.asset_code);
        filterMultiple('asset_origin', values.asset_origin);
        filterMultiple('asset_destination', values.asset_destination);
        filterMultiple('asset_status', values.asset_status);
        filterMultiple('asset_lot', values.asset_lot);
        filterMultiple('partCode', values.partCode);

        // Doc No (Partial Match)
        if (values.doc_no) {
            filtered = filtered.filter(item => item.doc_no?.toLowerCase().includes(values.doc_no.toLowerCase()));
        }

        // Date Ranges
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

        // Non-Move Logic
        if (values.non_move && values.non_move.length > 0) {
            filtered = filtered.filter(item => {
                const checkDate = item.last_used || item.create_date || item.created_at;
                if (!checkDate) return false;

                const today = dayjs();
                const usedDate = dayjs(checkDate);
                const diffMonths = today.diff(usedDate, 'month');

                // คำนวณ Level ของ Item นี้ก่อน
                let itemLevel = 0;
                if (diffMonths >= 3) {
                    itemLevel = 3;
                } else if (diffMonths >= 2) {
                    itemLevel = 2;
                } else if (diffMonths >= 1) {
                    itemLevel = 1;
                }

                // ตรวจสอบว่า Level ของ Item นี้ ตรงกับ Level ที่ผู้ใช้เลือกมาหรือไม่
                return values.non_move.includes(itemLevel);
            });
        }

        setDisplayData(filtered);
    };

    const loadHistoryData = async (assetCode) => {
        setLoading(true);
        try {
            const res = await api.get(`/report/boxstatus/history/${assetCode}`);
            if (res.data.success) {
                setDisplayData(res.data.data);
                setIsHistoryMode(true);
            }
        } catch (error) {
            console.error("Error loading history:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        form.resetFields();
        setIsHistoryMode(false);
        setDisplayData(rawData);
    };

    const handleBackToMain = () => {
        // ล้างค่าเฉพาะ asset_code แล้วกลับไปหน้าหลัก
        form.setFieldValue('asset_code', []);
        setIsHistoryMode(false);
        handleSearch(form.getFieldsValue());
    };

    // ---------------------------------------------------------
    // 5. Chart Data Helper (Core Logic)
    // ---------------------------------------------------------
    const getNonMoveLevel = (item) => {
        const checkDate = item.last_used || item.create_date || item.created_at;
        if (!checkDate) return 0;
        const today = dayjs();
        const usedDate = dayjs(checkDate);
        const diffMonths = today.diff(usedDate, 'month');
        if (diffMonths >= 3) return 3;
        if (diffMonths >= 2) return 2;
        if (diffMonths >= 1) return 1;
        return 0;
    };

    // ---------------------------------------------------------
    // 4. Excel Export (แก้ไขแล้ว)
    // ---------------------------------------------------------
    const handleExportExcel = () => {
        if (!gridApiRef.current) return;

        const api = gridApiRef.current;
        const displayedColumns = api.getAllDisplayedColumns(); // เอาเฉพาะที่แสดงในหน้าจอ

        // ดึงข้อมูล Row ที่ผ่านการกรอง/Sort แล้ว
        const rowsToExport = [];
        api.forEachNodeAfterFilterAndSort((node) => {
            rowsToExport.push(node.data);
        });

        if (rowsToExport.length === 0) return;

        // Map ข้อมูลตามคอลัมน์ โดยเขียน Logic ให้ตรงกับที่แสดงผลหน้าจอ
        const excelData = rowsToExport.map((row, index) => {
            const rowData = {};
            displayedColumns.forEach(col => {
                const colDef = col.getColDef();
                const headerName = colDef.headerName;
                const field = colDef.field;

                // 1. Column # (ลำดับ)
                if (headerName === '#') {
                    rowData[headerName] = index + 1;
                    return;
                }

                // 2. Column: เลยกำหนดส่งคืน (Calculated)
                if (headerName === 'เลยกำหนดส่งคืน') {
                    const { refID, scan_at } = row;
                    const today = dayjs();
                    const scanDate = scan_at ? dayjs(scan_at) : null;
                    if (refID && String(refID).startsWith('RF') && scanDate && today.diff(scanDate, 'day') > 7) {
                        rowData[headerName] = 'เลยกำหนด';
                    } else {
                        rowData[headerName] = '-';
                    }
                    return;
                }

                // 3. Column: ไม่เคลื่อนไหว (Calculated)
                if (headerName === 'ไม่เคลื่อนไหว') {
                    const level = getNonMoveLevel(row);
                    if (level > 0) {
                        rowData[headerName] = `ไม่เคลื่อนไหว ${level} เดือน`;
                    } else {
                        rowData[headerName] = '-';
                    }
                    return;
                }

                // 4. Column: สถานะใช้งาน (ใช้ชื่อไทย)
                if (headerName === 'สถานะใช้งาน') {
                    rowData[headerName] = row.asset_status_name || row.asset_status || '-';
                    return;
                }

                // 5. Column: สถานะทรัพย์สิน (ใช้ชื่อไทย)
                if (headerName === 'สถานะทรัพย์สิน') {
                    rowData[headerName] = row.is_status_name || row.is_status || '-';
                    return;
                }

                // 6. Column: ผู้ดำเนินการล่าสุด
                if (headerName === 'ผู้ดำเนินการล่าสุด' || headerName === 'ผู้ทำรายการ') {
                    rowData[headerName] = row.updated_by_name || row.updated_by || '-';
                    return;
                }

                // 7. Column ทั่วไป (ที่มี field)
                if (field) {
                    let value = row[field];
                    // แปลงวันที่
                    if (field === 'updated_at' || field === 'create_date' || field.includes('date')) {
                        value = value ? dayjs(value).format('DD/MM/BBBB') : '-';
                    }
                    // กรณี History Columns (create_time_formatted)
                    if (colDef.colId === 'create_time') {
                        value = row['create_time_formatted'] || '-';
                    }
                    rowData[headerName] = value || '-';
                } else {
                    rowData[headerName] = '-';
                }
            });
            return rowData;
        });

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        const fileName = isHistoryMode ? `History_${dayjs().format('YYYYMMDDHHmmss')}.xlsx` : `BoxStatus_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // Bar Chart Data (Keep Non-Move)
    const barChartData = useMemo(() => {
        if (isHistoryMode) return []; // ไม่แสดงกราฟในโหมดประวัติ
        const groups = {};
        const sourceData = rawData;

        sourceData.forEach(item => {
            const partCode = item.partCode || 'Unknown';
            if (!groups[partCode]) {
                groups[partCode] = {
                    name: `BOX NO ${partCode}`,
                    partCode: partCode,
                    status100: 0,
                    nonMove1: 0, nonMove2: 0, nonMove3: 0,
                    status103: 0, status104: 0,
                    total: 0
                };
            }
            groups[partCode].total += 1;
            const status = String(item.asset_status);
            const level = getNonMoveLevel(item);

            if (status === '100' || !status || status === 'null') {
                if (level === 3) groups[partCode].nonMove3 += 1;
                else if (level === 2) groups[partCode].nonMove2 += 1;
                else if (level === 1) groups[partCode].nonMove1 += 1;
                else groups[partCode].status100 += 1;
            }
            else if (status === '103') groups[partCode].status103 += 1;
            else if (status === '104') groups[partCode].status104 += 1;
            else {
                if (level === 3) groups[partCode].nonMove3 += 1;
                else if (level === 2) groups[partCode].nonMove2 += 1;
                else if (level === 1) groups[partCode].nonMove1 += 1;
                else groups[partCode].status100 += 1;
            }
        });
        return Object.values(groups);
    }, [rawData, isHistoryMode]);

    // Pie Chart Data (REMOVE Non-Move breakdown)
    const { pieChartData, allStats } = useMemo(() => {
        if (isHistoryMode) return { pieChartData: [], allStats: [] };

        let filteredForPie = rawData; // ใช้ rawData เพื่อดูภาพรวม
        if (selectedPartCodePie !== 'ALL') {
            filteredForPie = rawData.filter(item => item.partCode === selectedPartCodePie);
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

            if (isOverdue) {
                statsMap['overdue'].value += 1;
            } else if (status === '100' || !status || status === 'null') {
                statsMap['100'].value += 1; // นับรวมเป็นคงเหลือ
            } else if (statsMap[status]) {
                statsMap[status].value += 1;
            } else {
                statsMap['100'].value += 1; // Default
            }
        });

        const displayOrder = ['count_total', '101', '103', '104', 'overdue', '100'];
        const sortedStatsArray = displayOrder.map(key => statsMap[key]).filter(item => item !== undefined);
        const filteredChartData = Object.values(statsMap).filter(item => !item.isTotal && item.value > 0);

        return { pieChartData: filteredChartData, allStats: sortedStatsArray };
    }, [rawData, selectedPartCodePie, isHistoryMode]);

    // ---------------------------------------------------------
    // 6. Columns Definition (Standard vs History)
    // ---------------------------------------------------------
    const formatDateThai = (date) => date ? dayjs(date).format('DD/MM/BBBB') : '-';
    const safeVal = (val) => (val === null || val === undefined || val === '') ? '-' : val;

    // Standard Columns
    const standardColumnDefs = useMemo(() => [
        { headerName: '#', valueGetter: "node.rowIndex + 1", width: 60, cellClass: "text-center" },
        {
            headerName: 'เลยกำหนดส่งคืน', width: 140, cellClass: "flex items-center justify-center",
            cellRenderer: (params) => {
                const { refID, scan_at } = params.data;
                const today = dayjs();
                const scanDate = scan_at ? dayjs(scan_at) : null;
                if (refID && String(refID).startsWith('RF') && scanDate && today.diff(scanDate, 'day') > 7) {
                    return <span className="text-red-500 font-bold flex items-center gap-1"><ExclamationCircleOutlined /> เลยกำหนด</span>;
                }
                return <span className="text-gray-400">-</span>;
            }
        },
        {
            headerName: 'ไม่เคลื่อนไหว', field: 'last_used', width: 180, cellClass: "flex items-center",
            cellRenderer: (params) => {
                const level = getNonMoveLevel(params.data);
                if (level > 0) return <div className="flex items-center gap-1 text-blue-600 font-medium"><HistoryOutlined /> {`ไม่เคลื่อนไหว ${level} เดือน`}</div>;
                return <span className="text-gray-400">-</span>;
            }
        },
        { headerName: 'รหัสทรัพย์สิน', field: 'asset_code', width: 160, cellRenderer: p => safeVal(p.value) },
        {
            headerName: 'สถานะใช้งาน', field: 'asset_status', width: 180,
            cellRenderer: (p) => <div className={`w-full px-2 py-0.5 rounded border text-xs text-center font-medium ${p.data.asset_status_color || 'bg-gray-100'}`}>{p.data.asset_status_name || p.value || '-'}</div>
        },
        {
            headerName: 'วันที่จ่ายออกล่าสุด', field: 'last_used', width: 160,
            cellRenderer: (p) => <div className="flex items-center gap-2"><ClockCircleOutlined className="text-blue-500" />{formatDateThai(p.data.last_used)}</div>
        },
        {
            headerName: 'ผู้ดำเนินการล่าสุด', field: 'updated_by_name', width: 200,
            cellRenderer: (p) => <div className="flex items-center gap-2"><UserOutlined className="text-blue-500" />{safeVal(p.value)}</div>
        },
        {
            headerName: 'วันที่ทำรายการ', field: 'updated_at', width: 160,
            cellRenderer: (p) => <div className="flex items-center gap-2"><ClockCircleOutlined className="text-blue-500" />{formatDateThai(p.data.updated_at || p.data.created_at)}</div>
        },
        { headerName: 'เลขเอกสารซื้อ', field: 'refID', width: 160, cellRenderer: p => safeVal(p.value) },
        { headerName: 'ต้นทาง', field: 'asset_origin', width: 120, cellRenderer: p => safeVal(p.value) },
        { headerName: 'ปลายทาง', field: 'asset_destination', width: 120, cellRenderer: p => safeVal(p.value) },
        {
            headerName: 'สถานะทรัพย์สิน', field: 'is_status', width: 180,
            cellRenderer: (p) => <div className={`w-full px-2 py-0.5 rounded border text-xs text-center font-medium ${p.data.is_status_color || 'bg-gray-100'}`}>{p.data.is_status_name || p.value || '-'}</div>
        },
        { headerName: 'Lot', field: 'asset_lot', width: 140, cellRenderer: p => safeVal(p.value) },
        {
            headerName: 'วันที่ขึ้นทะเบียน', field: 'create_date', width: 160,
            cellRenderer: (p) => <div className="flex items-center gap-2"><CalendarOutlined className="text-green-500" />{formatDateThai(p.value)}</div>
        },
        { headerName: 'ชื่อสินค้า', field: 'asset_detail', width: 200, cellRenderer: p => safeVal(p.value) },
        { headerName: 'Part Code', field: 'partCode', width: 140, cellRenderer: p => safeVal(p.value) },
        { headerName: 'เลขที่เอกสาร', field: 'doc_no', width: 160, cellRenderer: p => safeVal(p.value) },
    ], []);

    // History Columns (ตาม SQL getHistory)
    const historyColumnDefs = useMemo(() => [
        { headerName: '#', valueGetter: "node.rowIndex + 1", width: 60, cellClass: "text-center" },
        {
            headerName: 'Action', field: 'asset_action', width: 120, pinned: 'left',
            cellClass: "flex items-center justify-center p-2",
            cellRenderer: (params) => {
                const action = params.value || '';
                let color = 'default';
                if (action === 'สร้าง') color = 'green';
                else if (action === 'พิมพ์') color = 'blue';
                else if (action === 'ยกเลิก') color = 'red';
                return <Tag color={color} className="w-full text-center m-0">{action.toUpperCase()}</Tag>;
            }
        },
        {
            headerName: 'รหัสทรัพย์สิน', field: 'asset_code', width: 180
        },
        {
            headerName: 'สถานะใช้งาน', field: 'asset_status', width: 180,
            cellRenderer: (p) => <div className={`w-full px-2 py-0.5 rounded border text-xs text-center font-medium ${p.data.asset_status_color || 'bg-gray-100'}`}>{p.data.asset_status_name || p.value}</div>
        },
        {
            headerName: 'วันที่ทำรายการ', field: 'create_date_formatted', width: 160,
            cellRenderer: (p) => <div className="flex items-center gap-2"><CalendarOutlined className="text-blue-500" />{formatDateThai(p.data.updated_at)}</div>
        },
        {
            headerName: 'เวลา', field: 'create_time', width: 120,
            valueGetter: (p) => p.data.create_time_formatted
        },
        {
            headerName: 'ผู้ทำรายการ', field: 'updated_by', width: 200,
            cellRenderer: (p) => <div className="flex items-center gap-2"><UserOutlined className="text-blue-500" />{p.value || '-'}</div>
        },
        { headerName: 'เลขที่เอกสาร (Ref)', field: 'refID', width: 150 },
        { headerName: 'ต้นทาง', field: 'asset_origin', width: 120 },
        { headerName: 'ปลายทาง', field: 'asset_destination', width: 120 },
        { headerName: 'หมายเหตุ', field: 'asset_remark', width: 200 },
        {
            headerName: 'สถานะทรัพย์สิน', field: 'is_status', width: 180,
            cellRenderer: (p) => <div className={`w-full px-2 py-0.5 rounded border text-xs text-center font-medium ${p.data.is_status_color || 'bg-gray-100'}`}>{p.data.is_status_name || p.value}</div>
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
                        <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            // แสดงจำนวนตัวเลข
                            label={({ name, value }) => `${name} (${value})`}
                            // แสดงเปอร์เซ็นต์
                            // label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={130}
                            dataKey="value"
                        >
                            {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
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
                    <Bar dataKey="nonMove3" name="ไม่เคลื่อนไหว 3 เดือน" fill="#002766" label={{ position: 'top' }} />
                    <Bar dataKey="nonMove2" name="ไม่เคลื่อนไหว 2 เดือน" fill="#096dd9" label={{ position: 'top' }} />
                    <Bar dataKey="nonMove1" name="ไม่เคลื่อนไหว 1 เดือน" fill="#69c0ff" label={{ position: 'top' }} />
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

            {!isHistoryMode && (
                <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: 20 }}>
                    <Tabs defaultActiveKey="1" items={tabItems} type="card" size="large" />
                </Card>
            )}

            <Card title={isHistoryMode ? `ประวัติการแก้ไข: ${form.getFieldValue('asset_code')?.[0]}` : "เงื่อนไขการค้นหา"} bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: 20 }}>
                {!isHistoryMode ? (
                    <Form form={form} onFinish={handleSearch} layout="vertical">
                        <Row gutter={[16, 16]}>
                            <Col xs={24} md={6}>
                                <Form.Item name="non_move" label="NON MOVE ไม่เคลื่อนไหว">
                                    <Select placeholder="เลือกสถานะเคลื่อนไหว" allowClear mode="multiple" maxTagCount="responsive" options={options.nonMoves} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={6}>
                                <Form.Item name="partCode" label="ข้อมูลกล่อง">
                                    <Select placeholder="เลือกข้อมูลกล่อง" allowClear mode="multiple" maxTagCount="responsive" showSearch optionFilterProp="label" options={options.partCodes} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={6}>
                                <Form.Item name="asset_code" label="รหัสทรัพย์สิน (เลือก 1 รายการเพื่อดูประวัติ)">
                                    <Select placeholder="ค้นหารหัสทรัพย์สิน" allowClear mode="multiple" maxTagCount="responsive" showSearch optionFilterProp="label" options={options.assetCodes} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={6}>
                                <Form.Item name="asset_origin" label="ต้นทาง">
                                    <Select placeholder="เลือกต้นทาง" allowClear mode="multiple" maxTagCount="responsive" showSearch optionFilterProp="label" options={options.origins} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={6}>
                                <Form.Item name="asset_destination" label="ปลายทาง">
                                    <Select placeholder="เลือกปลายทาง" allowClear mode="multiple" maxTagCount="responsive" showSearch optionFilterProp="label" options={options.destinations} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={6}>
                                <Form.Item name="asset_status" label="สถานะใช้งาน">
                                    <Select placeholder="เลือกสถานะ" allowClear mode="multiple" maxTagCount="responsive" showSearch optionFilterProp="label" options={options.statuses} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={6}>
                                <Form.Item name="create_date_range" label="วันที่ขึ้นทะเบียน">
                                    <RangePicker style={{ width: '100%' }} format="D MMMM BBBB" placeholder={['วันเริ่มต้น', 'วันสิ้นสุด']} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={6}>
                                <Form.Item name="updated_at_range" label="วันที่ใช้งานล่าสุด">
                                    <RangePicker style={{ width: '100%' }} format="D MMMM BBBB" placeholder={['วันเริ่มต้น', 'วันสิ้นสุด']} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={6}>
                                <Form.Item name="doc_no" label="เลขที่เอกสาร">
                                    <Input placeholder="เลขที่เอกสาร" allowClear />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={6}>
                                <Form.Item name="asset_lot" label="ล๊อตสินค้า">
                                    <Select placeholder="เลือกล๊อต" allowClear mode="multiple" maxTagCount="responsive" showSearch optionFilterProp="label" options={options.lots} />
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
                ) : (
                    <div className="flex justify-between items-center">
                        {/* 🟢 ส่วนแสดงสถานะเพิ่มเติมในโหมดประวัติ */}
                        <div className="flex items-center gap-4">
                            {(() => {
                                const selectedCode = form.getFieldValue('asset_code')?.[0];
                                const asset = rawData.find(item => item.asset_code === selectedCode);
                                if (!asset) return null;

                                const { refID, scan_at } = asset;
                                const today = dayjs();
                                const scanDate = scan_at ? dayjs(scan_at) : null;
                                const isOverdue = refID && String(refID).startsWith('RF') && scanDate && today.diff(scanDate, 'day') > 7;

                                const level = getNonMoveLevel(asset);

                                return (
                                    <>
                                        {isOverdue && (
                                            <Tag color="red" className="text-base py-1 px-3 flex items-center gap-2">
                                                <ExclamationCircleOutlined /> เลยกำหนดส่งคืน
                                            </Tag>
                                        )}
                                        {level > 0 && (
                                            <Tag color="blue" className="text-base py-1 px-3 flex items-center gap-2">
                                                <HistoryOutlined /> {`ไม่เคลื่อนไหว ${level} เดือน`}
                                            </Tag>
                                        )}
                                        {/* ถ้าปกติ */}
                                        {!isOverdue && level === 0 && (
                                            <Tag color="default" className="text-base py-1 px-3">สถานะปกติ</Tag>
                                        )}
                                    </>
                                );
                            })()}
                        </div>

                        <div className="flex justify-end">
                            <Button icon={<ArrowLeftOutlined />} onClick={handleBackToMain}>กลับไปหน้าค้นหา</Button>
                        </div>
                    </div>
                )}
            </Card>

            <Card
                title={isHistoryMode ? "รายละเอียดประวัติ" : "รายละเอียดข้อมูล"}
                bordered={false}
                style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                extra={
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleExportExcel}
                        className="!bg-green-600 hover:!bg-green-500 border-green-600"
                    >
                        นำออกเอ็กเซล
                    </Button>
                }
            >
                <div style={{ height: 600, width: '100%' }}>
                    <DataTable
                        onGridReady={(params) => { gridApiRef.current = params.api; }}
                        rowData={displayData}
                        columnDefs={isHistoryMode ? historyColumnDefs : standardColumnDefs}
                        loading={loading}
                    />
                </div>
            </Card>
        </div>
    );
}

export default BoxStatus;