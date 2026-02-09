import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import * as XLSX from 'xlsx';
import {
    FileExcelOutlined,
    ReloadOutlined,
    AppstoreOutlined,
    TableOutlined,
    PieChartOutlined,
    BarChartOutlined,
    FilterOutlined,
    SearchOutlined
} from '@ant-design/icons';

import api from '../../../api';
import DataTable from '../../../components/aggrid/DataTable';

// --- Configuration ---
const STATUS_CONFIG = {
    100: {
        label: 'คงคลัง',
        color: '#3b82f6',
        bgColor: '#eff6ff',
        borderColor: '#3b82f6',
        icon: '📦'
    },
    101: {
        label: 'จ่ายออกใช้งาน',
        color: '#22c55e',
        bgColor: '#f0fdf4',
        borderColor: '#22c55e',
        icon: '✅'
    },
    103: {
        label: 'ของชำรุด',
        color: '#eab308',
        bgColor: '#fefce8',
        borderColor: '#eab308',
        icon: '⚠️'
    },
    104: {
        label: 'เบิกซ่อม',
        color: '#f97316',
        bgColor: '#fff7ed',
        borderColor: '#f97316',
        icon: '🔧'
    },
    107: {
        label: 'ของเสีย',
        color: '#ef4444',
        bgColor: '#fef2f2',
        borderColor: '#ef4444',
        icon: '❌'
    },
};

function BoxStatus() {
    // --- State ---
    const [rowData, setRowData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState('ALL');
    const [viewMode, setViewMode] = useState('cards'); // 'cards', 'table', 'chart'
    const [searchTerm, setSearchTerm] = useState('');
    const [gridApi, setGridApi] = useState(null);

    // --- Fetch Data ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/report/boxstatus');
            if (res.data?.success) {
                setRowData(res.data.data || []);
            }
        } catch (error) {
            console.error("Error fetching box status:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    // --- Socket Event Listeners ---
    useEffect(() => {
        fetchData();

        const eventsToListen = [
            'hrms:registerasset-upsert',
            'hrms:systemout-update',
            'hrms:systemin-update',
            'hrms:systemdefective-update',
            'hrms:systemrepair-update',
        ];

        const handleRefresh = () => fetchData();
        eventsToListen.forEach(evt => window.addEventListener(evt, handleRefresh));

        return () => {
            eventsToListen.forEach(evt => window.removeEventListener(evt, handleRefresh));
        };
    }, [fetchData]);

    // --- Statistics Calculation ---
    const statistics = useMemo(() => {
        const stats = {
            total: rowData.length,
            byStatus: {}
        };

        Object.keys(STATUS_CONFIG).forEach(key => {
            stats.byStatus[key] = rowData.filter(r => String(r.asset_status) === String(key)).length;
        });

        return stats;
    }, [rowData]);

    // --- Filtered Data ---
    const filteredData = useMemo(() => {
        let data = rowData;

        // Filter by status
        if (selectedStatus !== 'ALL') {
            data = data.filter(r => String(r.asset_status) === String(selectedStatus));
        }

        // Filter by search term
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            data = data.filter(r =>
                r.asset_code?.toLowerCase().includes(search) ||
                r.asset_detail?.toLowerCase().includes(search) ||
                r.asset_brand?.toLowerCase().includes(search) ||
                r.doc_no?.toLowerCase().includes(search)
            );
        }

        return data;
    }, [rowData, selectedStatus, searchTerm]);

    // --- Chart Data ---
    const chartData = useMemo(() => {
        return Object.entries(STATUS_CONFIG).map(([code, config]) => ({
            name: config.label,
            count: statistics.byStatus[code] || 0,
            color: config.color,
            code: code,
            percentage: statistics.total > 0
                ? ((statistics.byStatus[code] || 0) / statistics.total * 100).toFixed(1)
                : 0
        }));
    }, [statistics]);

    // --- Brand Distribution ---
    const brandData = useMemo(() => {
        const brands = {};
        filteredData.forEach(item => {
            const brand = item.asset_brand || 'ไม่ระบุ';
            brands[brand] = (brands[brand] || 0) + 1;
        });
        return Object.entries(brands)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [filteredData]);

    // --- Column Definitions ---
    const columnDefs = useMemo(() => [
        {
            headerName: "รหัสทรัพย์สิน",
            field: "asset_code",
            filter: 'agTextColumnFilter',
            minWidth: 150,
            pinned: 'left'
        },
        {
            headerName: "ชื่อทรัพย์สิน",
            field: "asset_detail",
            filter: 'agTextColumnFilter',
            flex: 1,
            minWidth: 200
        },
        {
            headerName: "สถานะ",
            field: "asset_status",
            minWidth: 140,
            filter: 'agSetColumnFilter',
            cellRenderer: (params) => {
                const status = params.value;
                const config = STATUS_CONFIG[status];
                if (!config) return status;
                return (
                    <div className="flex items-center gap-2">
                        <span>{config.icon}</span>
                        <span
                            className="px-3 py-1 rounded-full text-xs font-semibold"
                            style={{
                                backgroundColor: config.bgColor,
                                color: config.color,
                                border: `1px solid ${config.borderColor}`
                            }}
                        >
                            {config.label}
                        </span>
                    </div>
                );
            }
        },
        {
            headerName: "ยี่ห้อ",
            field: "asset_brand",
            filter: 'agTextColumnFilter',
            width: 120
        },
        {
            headerName: "ประเภท",
            field: "asset_type",
            filter: 'agTextColumnFilter',
            width: 120
        },
        {
            headerName: "เลขที่เอกสาร",
            field: "doc_no",
            filter: 'agTextColumnFilter',
            width: 150
        },
        {
            headerName: "LOT",
            field: "asset_lot",
            width: 100
        },
        {
            headerName: "ใช้งานสำหรับ",
            field: "asset_usedfor",
            filter: 'agTextColumnFilter',
            width: 200
        },
    ], []);

    // --- Export Excel ---
    const handleExportExcel = () => {
        if (!gridApi) return;

        const allColumns = gridApi.getAllDisplayedColumns();
        const headers = allColumns.map(col => col.getColDef().headerName);
        const fieldKeys = allColumns.map(col => col.getColDef().field);

        const exportData = [];
        gridApi.forEachNodeAfterFilterAndSort((node) => {
            const row = {};
            fieldKeys.forEach((key, index) => {
                let val = node.data[key];
                if (key === 'asset_status' && STATUS_CONFIG[val]) {
                    val = STATUS_CONFIG[val].label;
                }
                row[headers[index]] = val;
            });
            exportData.push(row);
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "BoxStatus_Report");
        XLSX.writeFile(wb, `BoxStatus_${selectedStatus}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // --- Custom Tooltip for Charts ---
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                    <p className="font-semibold text-gray-800">{payload[0].name}</p>
                    <p className="text-sm text-gray-600">
                        จำนวน: <span className="font-bold text-blue-600">{payload[0].value}</span> ชิ้น
                    </p>
                    {payload[0].payload.percentage && (
                        <p className="text-xs text-gray-500">
                            ({payload[0].payload.percentage}%)
                        </p>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
            {/* Header */}
            <div className="bg-white shadow-md border-b border-gray-200">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                                <span className="text-3xl">📊</span>
                                รายงานสถานะทรัพย์สิน
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                ภาพรวมและรายละเอียดทรัพย์สิน ทั้งหมด {statistics.total.toLocaleString()} รายการ
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* View Mode Toggle */}
                            <div className="flex bg-gray-100 rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode('cards')}
                                    className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 ${viewMode === 'cards'
                                        ? 'bg-white shadow-sm text-blue-600'
                                        : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                    title="มุมมองการ์ด"
                                >
                                    <AppstoreOutlined />
                                    <span className="text-sm font-medium">การ์ด</span>
                                </button>
                                <button
                                    onClick={() => setViewMode('chart')}
                                    className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 ${viewMode === 'chart'
                                        ? 'bg-white shadow-sm text-blue-600'
                                        : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                    title="มุมมองกราฟ"
                                >
                                    <PieChartOutlined />
                                    <span className="text-sm font-medium">กราฟ</span>
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 ${viewMode === 'table'
                                        ? 'bg-white shadow-sm text-blue-600'
                                        : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                    title="มุมมองตาราง"
                                >
                                    <TableOutlined />
                                    <span className="text-sm font-medium">ตาราง</span>
                                </button>
                            </div>

                            {/* Refresh Button */}
                            <button
                                onClick={fetchData}
                                disabled={loading}
                                className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                title="รีเฟรชข้อมูล"
                            >
                                <ReloadOutlined spin={loading} className="text-lg" />
                            </button>

                            {/* Export Button */}
                            <button
                                onClick={handleExportExcel}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg shadow-sm transition-all hover:shadow-md font-medium"
                            >
                                <FileExcelOutlined />
                                Export Excel
                            </button>
                        </div>
                    </div>

                    {/* Status Filter Pills */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <button
                            onClick={() => setSelectedStatus('ALL')}
                            className={`px-5 py-2.5 rounded-xl font-semibold transition-all ${selectedStatus === 'ALL'
                                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-200'
                                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300 hover:shadow-md'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🏢</span>
                                <span>ทั้งหมด</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${selectedStatus === 'ALL' ? 'bg-white/20' : 'bg-blue-50 text-blue-700'
                                    }`}>
                                    {statistics.total}
                                </span>
                            </div>
                        </button>

                        {Object.entries(STATUS_CONFIG).map(([code, config]) => (
                            <button
                                key={code}
                                onClick={() => setSelectedStatus(code)}
                                className={`px-5 py-2.5 rounded-xl font-semibold transition-all ${selectedStatus === code
                                    ? 'shadow-lg text-white'
                                    : 'bg-white border-2 hover:shadow-md'
                                    }`}
                                style={selectedStatus === code ? {
                                    backgroundColor: config.color,
                                    boxShadow: `0 4px 14px ${config.color}40`
                                } : {
                                    borderColor: config.borderColor + '30',
                                    color: config.color
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{config.icon}</span>
                                    <span>{config.label}</span>
                                    <span
                                        className="px-2 py-0.5 rounded-full text-xs"
                                        style={selectedStatus === code ? {
                                            backgroundColor: 'rgba(255,255,255,0.25)'
                                        } : {
                                            backgroundColor: config.bgColor,
                                            color: config.color
                                        }}
                                    >
                                        {statistics.byStatus[code] || 0}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Search Bar */}
                    <div className="mt-4">
                        <div className="relative max-w-md">
                            <SearchOutlined className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="ค้นหารหัส, ชื่อทรัพย์สิน, ยี่ห้อ, เลขที่เอกสาร..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-6">
                {/* Cards View */}
                {viewMode === 'cards' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredData.map((item, index) => {
                            const config = STATUS_CONFIG[item.asset_status];
                            return (
                                <div
                                    key={index}
                                    className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border-2 border-gray-100 hover:border-blue-200"
                                >
                                    {/* Card Header */}
                                    <div
                                        className="p-4 border-b-4"
                                        style={{
                                            backgroundColor: config?.bgColor || '#f9fafb',
                                            borderBottomColor: config?.color || '#6b7280'
                                        }}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-2xl">{config?.icon || '📦'}</span>
                                            <span
                                                className="px-3 py-1 rounded-full text-xs font-bold"
                                                style={{
                                                    backgroundColor: config?.color || '#6b7280',
                                                    color: 'white'
                                                }}
                                            >
                                                {config?.label || 'ไม่ทราบ'}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm">
                                            {item.asset_code}
                                        </h3>
                                    </div>

                                    {/* Card Body */}
                                    <div className="p-4 space-y-2.5">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">ชื่อทรัพย์สิน</p>
                                            <p className="text-sm font-medium text-gray-800 line-clamp-2">
                                                {item.asset_detail || '-'}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">ยี่ห้อ</p>
                                                <p className="text-sm font-medium text-gray-700">
                                                    {item.asset_brand || '-'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">ประเภท</p>
                                                <p className="text-sm font-medium text-gray-700">
                                                    {item.asset_type || '-'}
                                                </p>
                                            </div>
                                        </div>

                                        {item.doc_no && (
                                            <div className="pt-2">
                                                <p className="text-xs text-gray-500 mb-1">เลขที่เอกสาร</p>
                                                <p className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                    {item.doc_no}
                                                </p>
                                            </div>
                                        )}

                                        {item.asset_lot && (
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">LOT</p>
                                                <p className="text-xs font-mono text-gray-600">
                                                    {item.asset_lot}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {filteredData.length === 0 && (
                            <div className="col-span-full text-center py-20">
                                <div className="text-6xl mb-4">📭</div>
                                <p className="text-gray-500 text-lg">ไม่พบข้อมูลทรัพย์สิน</p>
                                <p className="text-gray-400 text-sm mt-2">ลองเปลี่ยนตัวกรองหรือคำค้นหา</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Chart View */}
                {viewMode === 'chart' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Status Distribution - Bar Chart */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <BarChartOutlined className="text-blue-600" />
                                สถิติตามสถานะ
                            </h3>
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 12 }}
                                        angle={-15}
                                        textAnchor="end"
                                        height={80}
                                    />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={50}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Status Distribution - Pie Chart */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <PieChartOutlined className="text-green-600" />
                                สัดส่วนตามสถานะ
                            </h3>
                            <ResponsiveContainer width="100%" height={350}>
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percentage }) => `${name}: ${percentage}%`}
                                        outerRadius={110}
                                        fill="#8884d8"
                                        dataKey="count"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Brand Distribution */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-2">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <BarChartOutlined className="text-purple-600" />
                                Top 10 ยี่ห้อ {selectedStatus !== 'ALL' && `(${STATUS_CONFIG[selectedStatus]?.label})`}
                            </h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={brandData} layout="horizontal">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis type="number" tick={{ fontSize: 12 }} />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        width={120}
                                        tick={{ fontSize: 12 }}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar
                                        dataKey="count"
                                        fill="#8b5cf6"
                                        radius={[0, 8, 8, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Table View */}
                {viewMode === 'table' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <TableOutlined className="text-blue-600" />
                                รายการทรัพย์สิน
                                <span className="text-sm font-normal text-gray-500">
                                    ({filteredData.length.toLocaleString()} รายการ)
                                </span>
                            </h3>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <DataTable
                                rowData={filteredData}
                                columnDefs={columnDefs}
                                loading={loading}
                                onGridReady={(params) => setGridApi(params.api)}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default BoxStatus;