import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { App, Button, Input, DatePicker, ConfigProvider, Grid } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import api from "../../../api";
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import thTH from 'antd/locale/th_TH';
import * as XLSX from 'xlsx';
// นำเข้า DraggableTable
import DraggableTable from '../../../components/antdtable/DraggableTable';

const { RangePicker } = DatePicker;
dayjs.locale('th');

// --- Helper Functions สำหรับแปลงข้อมูลเป็น Text เพื่อใช้ในการ Search และ Filter ---
const getFormattedScanAt = (val) => {
    if (!val) return '-';
    return dayjs(val).format('DD/MM/YYYY HH:mm น.');
};

const getCurrentAddressText = (record) => {
    return record.current_address || record.asset_destination || '-';
};

const getOverdueStatusText = (record) => {
    if (!record.scan_at) {
        if (record.asset_status == 147) return 'แจ้งซ่อมแล้ว';
        return '-';
    }
    const scanDate = dayjs(record.scan_at);
    const diffDays = dayjs().diff(scanDate, 'day');

    if (record.asset_status == 147) return `แจ้งซ่อมแล้ว (${diffDays} วัน)`;
    if (diffDays > 7 && record.asset_status != 100) return `เลยกำหนดส่งคืน (${diffDays} วัน)`;
    if (record.asset_status == 100) return 'คงคลัง';
    return `ใช้งานแล้ว (${diffDays} วัน)`;
};

const getNonMovingStatusText = (record) => {
    if (!record.updated_at) return '-';
    const updatedDate = dayjs(record.updated_at);
    const now = dayjs();
    const diffMonth = now.diff(updatedDate, 'month');
    const dateAfterMonths = updatedDate.add(diffMonth, 'month');
    const remainDays = now.diff(dateAfterMonths, 'day');
    return `ไม่เคลื่อนไหว ${diffMonth} เดือน (${remainDays} วัน)`;
};
// -----------------------------------------------------------------------

function BoxStatus() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const { message } = App.useApp();

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState(null);

    const [page, setPage] = useState({ current: 1, pageSize: 50 });
    const [tableY, setTableY] = useState(600);

    useEffect(() => {
        const onResize = () => setTableY(Math.max(400, window.innerHeight - 250));
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const startDate = dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : '';
            const endDate = dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : '';

            const res = await api.get('/report/boxstatus', {
                params: { startDate, endDate }
            });
            setData(res.data?.data || []);
        } catch (err) {
            console.error(err);
            message.error('ไม่สามารถดึงข้อมูลรายงานสถานะกล่องได้');
        } finally {
            setLoading(false);
        }
    }, [message, dateRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ✅ ฟังก์ชันค้นหาข้อมูลด้วยช่องค้นหา (เพิ่มฟิลด์ตามที่ต้องการแล้ว)
    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        const term = searchTerm.toLowerCase();
        return data.filter(r =>
            (r.asset_code || '').toLowerCase().includes(term) ||
            (r.asset_destination || '').toLowerCase().includes(term) ||
            (r.asset_origin || '').toLowerCase().includes(term) ||
            (r.doc_no || '').toLowerCase().includes(term) ||
            (r.asset_status_name || '').toLowerCase().includes(term) ||
            (r.scan_by_name || '').toLowerCase().includes(term) ||
            getCurrentAddressText(r).toLowerCase().includes(term) ||     // ค้นหาปัจจุบันอยู่ที่
            getFormattedScanAt(r.scan_at).toLowerCase().includes(term) ||  // ค้นหาวันที่ใช้งานล่าสุด
            getNonMovingStatusText(r).toLowerCase().includes(term) ||      // ค้นหาสถานะไม่เคลื่อนไหว
            getOverdueStatusText(r).toLowerCase().includes(term)           // ค้นหาสถานะการส่งคืน (แถมให้เผื่อใช้งานครับ)
        );
    }, [data, searchTerm]);

    const handleExportExcel = () => {
        if (filteredData.length === 0) {
            message.warning('ไม่มีข้อมูลสำหรับ Export');
            return;
        }

        // 1. Map ข้อมูลให้อยู่ในรูปแบบที่ต้องการพร้อมชื่อ Column ภาษาไทย
        const exportPayload = filteredData.map((record, index) => ({
            'ลำดับ': index + 1,
            'รหัสทรัพย์สิน': record.asset_code || '-',
            'สถานะทรัพย์สิน': record.asset_status_name || '-',
            'ปัจจุบันอยู่ที่': getCurrentAddressText(record),
            'ต้นทางที่ใช้งาน': record.asset_origin || '-',
            'ปลายทางที่ใช้งาน': record.asset_destination || '-',
            'วันที่ดำเนินการ': getFormattedScanAt(record.scan_at),
            'สถานะการส่งคืน': getOverdueStatusText(record),
            'สถานะไม่เคลื่อนไหว': getNonMovingStatusText(record),
            'ความกว้าง': record.asset_width ? `${parseFloat(record.asset_width).toFixed(2)} ${record.asset_width_unit || ''}`.trim() : '-',
            'ความยาว': record.asset_length ? `${parseFloat(record.asset_length).toFixed(2)} ${record.asset_length_unit || ''}`.trim() : '-',
            'ความสูง': record.asset_height ? `${parseFloat(record.asset_height).toFixed(2)} ${record.asset_height_unit || ''}`.trim() : '-',
            // 'สถานะ': record.is_status_name || record.is_status || '-',
            'รหัส': record.partCode || '-',
            'หมายเลขล็อต': record.asset_lot || '-',
            'ชื่อ': record.asset_detail || '-',
            'ประเภท': record.asset_type || '-',
            'เลขที่เอกสาร': record.doc_no || '-',
            'ใช้สำหรับ': record.asset_usedfor || '-',
            'แบรนด์': record.asset_brand || '-',
            'คุณสมบัติ': record.asset_feature || '-'
        }));

        // 2. สร้าง Worksheet และ Workbook
        const worksheet = XLSX.utils.json_to_sheet(exportPayload);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Box Status");

        // 3. สั่งโหลดไฟล์
        XLSX.writeFile(workbook, `BoxStatus_Report_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`);
    };

    // ✅ รูปแบบ Columns ของ DraggableTable พร้อม Filters ในทุกคอลัมน์
    const baseColumns = useMemo(() => [
        {
            title: 'ลำดับ',
            key: 'index',
            width: 70,
            align: 'center',
            dragDisabled: true,
            render: (_val, _record, index) => <span className="text-gray-400 font-medium">{(page.current - 1) * page.pageSize + index + 1}</span>
        },
        {
            title: 'รหัสทรัพย์สิน',
            dataIndex: 'asset_code',
            key: 'asset_code',
            width: 260,
            filters: [...new Set(data.map(r => r.asset_code).filter(Boolean))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => record.asset_code === value,
            render: (val) => <span className="font-bold text-blue-600">{val || '-'}</span>
        },
        {
            title: 'สถานะทรัพย์สิน',
            dataIndex: 'asset_status_name',
            key: 'asset_status_name',
            width: 180,
            align: 'center',
            filters: [...new Set(data.map(r => r.asset_status_name).filter(Boolean))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => record.asset_status_name === value,
            render: (val, record) => (
                <div className={`w-full text-center py-1 rounded-md text-xs border ${record.asset_status_color || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                    {val || '-'}
                </div>
            )
        },
        {
            title: 'ต้นทางที่ใช้งาน',
            dataIndex: 'asset_origin',
            key: 'asset_origin',
            width: 170,
            filters: [...new Set(data.map(r => r.asset_origin || '-'))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => (record.asset_origin || '-') === value,
            render: (val) => <span className="text-gray-600">{val || '-'}</span>
        },
        {
            title: 'ปลายทางที่ใช้งาน',
            dataIndex: 'asset_destination',
            key: 'asset_destination',
            width: 170,
            filters: [...new Set(data.map(r => r.asset_destination || '-'))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => (record.asset_destination || '-') === value,
            render: (val) => <span className="text-gray-600">{val || '-'}</span>
        },
        {
            title: 'ปัจจุบันอยู่ที่',
            key: 'current_address',
            width: 160,
            filters: [...new Set(data.map(r => getCurrentAddressText(r)))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => getCurrentAddressText(record) === value,
            render: (_, record) => <span className="text-gray-700">{getCurrentAddressText(record)}</span>
        },
        {
            title: 'วันที่ดำเนินการ',
            key: 'scan_at',
            width: 180,
            align: 'center',
            filters: [...new Set(data.map(r => getFormattedScanAt(r.scan_at)))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => getFormattedScanAt(record.scan_at) === value,
            render: (_, record) => getFormattedScanAt(record.scan_at)
        },
        {
            title: 'ผู้ดำเนินการ',
            dataIndex: 'scan_by_name',
            key: 'scan_by_name',
            width: 180,
            filters: [...new Set(data.map(r => r.scan_by_name || '-'))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => (record.scan_by_name || '-') === value,
            render: (val) => <span className="text-gray-700">{val || '-'}</span>
        },
        {
            title: 'สถานะการส่งคืน',
            key: 'overdue_status',
            width: 180,
            align: 'left',
            filters: [...new Set(data.map(r => getOverdueStatusText(r)))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => getOverdueStatusText(record) === value,
            render: (_, record) => {
                const text = getOverdueStatusText(record);
                if (text === '-') return '-';
                if (text.includes('แจ้งซ่อมแล้ว')) return <span className="text-orange-500 font-bold">{text}</span>;
                if (text.includes('เลยกำหนดส่งคืน')) return <span className="text-red-500 font-bold">{text}</span>;
                if (text === 'คงคลัง') return <span className="text-gray-500">{text}</span>;
                return <span className="text-green-500 font-bold">{text}</span>;
            }
        },
        {
            title: 'สถานะไม่เคลื่อนไหว',
            key: 'non_moving_status',
            width: 220,
            filters: [...new Set(data.map(r => getNonMovingStatusText(r)))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => getNonMovingStatusText(record) === value,
            render: (_, record) => {
                const text = getNonMovingStatusText(record);
                if (text === '-') return '-';

                const updatedDate = dayjs(record.updated_at);
                const diffMonth = dayjs().diff(updatedDate, 'month');

                let textClass = "text-gray-500";
                if (diffMonth === 1) textClass = "font-bold text-blue-600";
                else if (diffMonth === 2) textClass = "font-bold text-purple-600";
                else if (diffMonth >= 3) textClass = "font-bold text-orange-500";

                return <span className={textClass}>{text}</span>;
            }
        },
        {
            title: 'ความกว้าง',
            dataIndex: 'asset_width',
            key: 'asset_width',
            width: 160,
            filters: Array.from(
                new Set(
                    data.filter(r => r.asset_width !== null && r.asset_width !== undefined)
                        .map(r => `${Number(r.asset_width).toFixed(2)} ${r.asset_width_unit || ''}`.trim())
                )
            ).map(text => ({ text: text, value: text })),
            onFilter: (value, record) => {
                if (record.asset_width === null || record.asset_width === undefined) return false;
                const recordValue = `${Number(record.asset_width).toFixed(2)} ${record.asset_width_unit || ''}`.trim();
                return recordValue === value;
            },
            render: (_, record) => {
                const val = parseFloat(record?.asset_width) || 0;
                const unit = record?.asset_width_unit || '';
                return `${val.toFixed(2)} ${unit}`.trim();
            }
        },
        {
            title: 'ความยาว',
            dataIndex: 'asset_length',
            key: 'asset_length',
            width: 160,
            filters: Array.from(
                new Set(
                    data.filter(r => r.asset_length !== null && r.asset_length !== undefined)
                        .map(r => `${Number(r.asset_length).toFixed(2)} ${r.asset_length_unit || ''}`.trim())
                )
            ).map(text => ({ text: text, value: text })),
            onFilter: (value, record) => {
                if (record.asset_length === null || record.asset_length === undefined) return false;
                const recordValue = `${Number(record.asset_length).toFixed(2)} ${record.asset_length_unit || ''}`.trim();
                return recordValue === value;
            },
            render: (_, record) => {
                const val = parseFloat(record?.asset_length) || 0;
                const unit = record?.asset_length_unit || '';
                return `${val.toFixed(2)} ${unit}`.trim();
            }
        },
        {
            title: 'ความสูง',
            dataIndex: 'asset_height',
            key: 'asset_height',
            width: 160,
            filters: Array.from(
                new Set(
                    data.filter(r => r.asset_height !== null && r.asset_height !== undefined)
                        .map(r => `${Number(r.asset_height).toFixed(2)} ${r.asset_height_unit || ''}`.trim())
                )
            ).map(text => ({ text: text, value: text })),
            onFilter: (value, record) => {
                if (record.asset_height === null || record.asset_height === undefined) return false;
                const recordValue = `${Number(record.asset_height).toFixed(2)} ${record.asset_height_unit || ''}`.trim();
                return recordValue === value;
            },
            render: (_, record) => {
                const val = parseFloat(record?.asset_height) || 0;
                const unit = record?.asset_height_unit || '';
                return `${val.toFixed(2)} ${unit}`.trim();
            }
        },
        // {
        //     title: 'สถานะ',
        //     dataIndex: 'is_status',
        //     key: 'is_status',
        //     width: 160,
        //     filters: [...new Set(data.map(r => r.is_status_name || r.is_status).filter(Boolean))].map(v => ({ text: v, value: v })),
        //     onFilter: (value, record) => (record.is_status_name || record.is_status) === value,
        //     render: (value, record) => {
        //         const name = record.is_status_name || value;
        //         const colorClass = record.is_status_color || 'bg-gray-100 text-gray-600 border-gray-200';
        //         return <div className={`px-2 py-0.5 rounded border text-xs text-center font-medium ${colorClass}`}>{name || '-'}</div>;
        //     }
        // },
        {
            title: 'รหัส',
            dataIndex: 'partCode',
            key: 'partCode',
            width: 120,
            filters: [...new Set(data.map(r => r.partCode).filter(Boolean))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => record.partCode === value,
            render: (val) => val || '-'
        },
        {
            title: 'หมายเลขล็อต',
            dataIndex: 'asset_lot',
            key: 'asset_lot',
            width: 180,
            filters: [...new Set(data.map(r => r.asset_lot).filter(Boolean))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => record.asset_lot === value,
            render: (val) => val || '-'
        },
        {
            title: 'ชื่อ',
            dataIndex: 'asset_detail',
            key: 'asset_detail',
            width: 200,
            filters: [...new Set(data.map(r => r.asset_detail).filter(Boolean))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => record.asset_detail === value,
            render: (val) => val || '-'
        },
        {
            title: 'ประเภท',
            dataIndex: 'asset_type',
            key: 'asset_type',
            width: 180,
            filters: [...new Set(data.map(r => r.asset_type).filter(Boolean))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => record.asset_type === value,
            render: (val) => val || '-'
        },
        {
            title: 'เลขที่เอกสาร',
            dataIndex: 'doc_no',
            key: 'doc_no',
            width: 180,
            filters: [...new Set(data.map(r => r.doc_no).filter(Boolean))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => record.doc_no === value,
            render: (val) => val || '-'
        },
        {
            title: 'ใช้สำหรับ',
            dataIndex: 'asset_usedfor',
            key: 'asset_usedfor',
            width: 150,
            filters: [...new Set(data.map(r => r.asset_usedfor).filter(Boolean))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => record.asset_usedfor === value,
            render: (val) => val || '-'
        },
        {
            title: 'แบรนด์',
            dataIndex: 'asset_brand',
            key: 'asset_brand',
            width: 150,
            filters: [...new Set(data.map(r => r.asset_brand).filter(Boolean))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => record.asset_brand === value,
            render: (val) => val || '-'
        },
        {
            title: 'คุณสมบัติ',
            dataIndex: 'asset_feature',
            key: 'asset_feature',
            width: 150,
            filters: [...new Set(data.map(r => r.asset_feature).filter(Boolean))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => record.asset_feature === value,
            render: (val) => val || '-'
        }
    ], [page, data]); // ปิด Array ตรงนี้

    return (
        <ConfigProvider
            locale={thTH}
            theme={{
                token: {
                    colorPrimary: '#f54a00',
                    borderRadius: 2,
                    fontFamily: 'Inter, "Sarabun", sans-serif',
                }
            }}
        >
            <div className={`h-screen flex flex-col bg-gray-50 ${isMd ? 'p-4' : 'p-2'}`}>
                <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-1.5 h-6 bg-orange-600 rounded-full"></div>
                    <h2 className="text-lg font-semibold text-gray-800 m-0">รายงานสถานะกล่อง</h2>
                </div>

                <div className="bg-white p-2 rounded-md shadow-sm flex-1 flex flex-col overflow-hidden">
                    <DraggableTable
                        columns={baseColumns}
                        dataSource={filteredData}
                        rowKey="asset_code"
                        loading={loading}
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
                        renderToolbar={(ColumnVisibility) => (
                            <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none">
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-white p-2 rounded-md shadow-sm border border-gray-100 w-full md:w-auto">

                                    <Input
                                        prefix={<SearchOutlined className="text-gray-400" />}
                                        placeholder="ค้นหา รหัสกล่อง, สถานที่..."
                                        allowClear
                                        variant="borderless"
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full sm:w-64 bg-transparent"
                                    />

                                    <div className="w-full h-px bg-gray-100 sm:w-px sm:h-6 sm:mx-1 hidden sm:block"></div>

                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="flex items-center gap-2 px-2 h-9 border border-gray-200 rounded-md bg-white">
                                            <span className="text-gray-500 text-sm hidden lg:inline">วันที่สแกน:</span>
                                            <RangePicker
                                                value={dateRange}
                                                onChange={(dates) => setDateRange(dates)}
                                                format="DD/MM/YYYY"
                                                variant="borderless"
                                                className="w-64 cursor-pointer"
                                                allowClear={true}
                                            />
                                        </div>

                                        <Button
                                            icon={<ReloadOutlined />}
                                            onClick={fetchData}
                                            loading={loading}
                                            className="h-9 border-gray-200 text-gray-600 hover:text-orange-600 hover:border-orange-600"
                                        />
                                        <Button
                                            type="primary"
                                            icon={<DownloadOutlined />}
                                            onClick={handleExportExcel}
                                            className="h-9 bg-green-600 hover:bg-green-500"
                                        >
                                            นำออกเอ็กเซลล์
                                        </Button>

                                        {ColumnVisibility}
                                    </div>
                                </div>
                            </div>
                        )}
                    />
                </div>
            </div>
        </ConfigProvider>
    );
}

export default BoxStatus;