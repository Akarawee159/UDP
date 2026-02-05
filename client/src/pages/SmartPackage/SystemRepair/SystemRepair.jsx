import { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Grid, Tag, Popconfirm, DatePicker, Tabs } from 'antd';
import { SearchOutlined, CheckCircleOutlined, CalendarOutlined, ToolOutlined } from '@ant-design/icons';
import api from "../../../api";
import { getSocket } from '../../../socketClient';
import DataTable from '../../../components/aggrid/DataTable';
import SystemRepairList from './Page/SystemRepairList';
import RepairRequestLog from './Page/RepairRequestLog';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import thTH from 'antd/locale/th_TH';
dayjs.locale('th');

// ... (RequisitionPane Code - ส่วนนี้เหมือนเดิม ไม่ต้องแก้) ...
const RequisitionPane = () => {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const { message } = App.useApp();

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedDate, setSelectedDate] = useState(dayjs());

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDraftId, setSelectedDraftId] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const dateParam = selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : undefined;
            const res = await api.get('/smartpackage/systemdefective', {
                params: { date: dateParam }
            });
            setRows(res?.data?.data || []);
        } catch (err) {
            console.error(err);
            // message.error('ดึงข้อมูลใบเบิกขอซ่อมไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [message, selectedDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const s = getSocket();
        if (!s) return;

        const onUpdate = (event) => {
            const payload = event.detail;
            const action = payload?.action;
            const acts = ['ref_generated', 'header_update', 'finalized', 'unlocked', 'cancel', 'scan', 'return', 'output_confirmed'];

            if (acts.includes(action)) {
                console.log("Socket Refreshing Data:", action);
                fetchData();
            }
        };

        window.addEventListener('hrms:systemdefective-update', onUpdate);
        return () => window.removeEventListener('hrms:systemdefective-update', onUpdate);
    }, [fetchData]);

    const handleCreate = () => {
        const storedUser = localStorage.getItem('user');
        const currentUser = storedUser ? JSON.parse(storedUser) : null;
        let foundDraft = null;

        if (currentUser && currentUser.employee_id) {
            foundDraft = rows.find(r =>
                String(r.created_by) === String(currentUser.employee_id) &&
                String(r.is_status) === '140' &&
                (!r.refID || r.refID === '')
            );
        }

        if (foundDraft) {
            message.info('ระบบพบ! คุณสร้างรายการแบบร่างไว้ จึงเปิดรายการล่าสุดให้คุณ');
            setSelectedDraftId(foundDraft.draft_id);
        } else {
            setSelectedDraftId(null);
        }
        setIsModalOpen(true);
    };

    const handleRowClick = (record) => {
        setSelectedDraftId(record.draft_id);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedDraftId(null);
        fetchData();
    };

    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const term = searchTerm.toLowerCase();
        return rows.filter(r =>
            (r.refID || '').toLowerCase().includes(term) ||
            (r.booking_remark || '').toLowerCase().includes(term)
        );
    }, [rows, searchTerm]);

    const handleConfirmOutput = async (draft_id) => {
        try {
            setLoading(true);
            await api.post('/smartpackage/systemdefective/confirm-output', { draft_id });
            message.success('ยืนยันการรับเข้าของชำรุดสำเร็จ');
            fetchData();
        } catch (err) {
            console.error(err);
            message.error('ไม่สามารถยืนยันรายการได้');
        } finally {
            setLoading(false);
        }
    };

    const columnDefs = useMemo(() => [
        { headerName: 'ลำดับ', width: 60, valueGetter: "node.rowIndex + 1", cellClass: "flex items-center justify-center py-1" },
        { headerName: 'เลขที่เอกสาร', field: 'refID', width: 180, cellClass: "font-bold text-blue-600" },
        {
            headerName: 'การดำเนินการ',
            width: 180,
            cellClass: "flex items-center justify-center py-1",
            cellRenderer: (params) => {
                if (String(params.data.is_status) === '142') {
                    return (
                        <div onClick={(e) => e.stopPropagation()}>
                            <Popconfirm
                                title="ยืนยันการรับเข้าของชำรุด"
                                description="คุณต้องการยืนยันรายการนี้เป็น 'รับเข้าของชำรุดสำเร็จ' ใช่หรือไม่?"
                                onCancel={(e) => {
                                    e?.stopPropagation();
                                    handleConfirmOutput(params.data.draft_id);
                                }}
                                onConfirm={(e) => e?.stopPropagation()}
                                cancelText="ยืนยัน"
                                cancelButtonProps={{ type: 'primary', className: "bg-teal-600 hover:bg-teal-500" }}
                                okText="ยกเลิก"
                                okButtonProps={{ type: 'default', danger: true }}
                            >
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<CheckCircleOutlined />}
                                    className="bg-teal-600 hover:bg-teal-500"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    ยืนยันรับเข้าของชำรุด
                                </Button>
                            </Popconfirm>
                        </div>
                    );
                }
                if (params.data.is_status_name === 'รับเข้าของชำรุดเรียบร้อย') {
                    return <CheckCircleOutlined className="text-green-700 text-xl" />;
                }
                return null;
            }
        },
        {
            headerName: 'สถานะ',
            field: 'is_status_name',
            width: 150,
            filter: true,
            cellClass: "flex items-center justify-center p-2",
            cellRenderer: p => (
                <div className={`w-full text-center py-1 rounded text-xs border ${p.data.is_status_color || 'bg-gray-100'}`}>
                    {p.value || '-'}
                </div>
            )
        },
        { headerName: 'รับเข้าจากปลายทาง', field: 'origin', width: 160, cellClass: "text-center text-gray-600" },
        { headerName: 'สถานที่รับเข้า', field: 'destination', width: 160, cellClass: "text-center text-gray-600" },
        {
            headerName: 'จำนวน',
            field: 'attendees',
            width: 100,
            cellClass: "flex items-center justify-center p-2",
            cellRenderer: (params) => (
                <Tag color="blue" className="w-full text-center text-sm m-0">
                    {params.value || 0}
                </Tag>
            )
        },
        { headerName: 'ผู้ทำรายการ', field: 'created_by_name', width: 180 },
        {
            headerName: 'วันที่', field: 'create_date', width: 120,
            valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('th-TH') : '-'
        },
        { headerName: 'เวลา', field: 'create_time', width: 100 },
        { headerName: 'หมายเหตุ', field: 'booking_remark', flex: 1, width: 180 },
    ], []);

    return (
        <div className="flex flex-col h-full">
            <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none">
                <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
                    <Input
                        prefix={<SearchOutlined className="text-gray-400" />}
                        placeholder="ค้นหา เลขที่เอกสาร..."
                        allowClear
                        variant="borderless"
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-64 bg-transparent"
                    />
                    <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
                    <Button
                        type="primary"
                        icon={<ToolOutlined />}
                        onClick={handleCreate}
                        className="bg-orange-600 hover:bg-orange-500 border-none h-9 rounded-lg px-4 font-medium shadow-md"
                    >
                        สร้างใบเบิกขอซ่อม
                    </Button>
                    <div className="flex items-center gap-2 px-2">
                        <span className="text-gray-500 text-sm hidden lg:inline">วันที่:</span>
                        <DatePicker
                            value={selectedDate}
                            onChange={(date) => setSelectedDate(date)}
                            format="DD/MM/YYYY"
                            allowClear={false}
                            className="w-40 border-gray-200 hover:border-orange-500 focus:border-orange-500"
                            suffixIcon={<CalendarOutlined className="text-orange-600" />}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
                <DataTable
                    rowData={filteredRows}
                    columnDefs={columnDefs}
                    loading={loading}
                    onCellClicked={(params) => {
                        if (!params.colDef) return;
                        if (params.colDef.headerName === 'การดำเนินการ') return;
                        handleRowClick(params.data);
                    }}
                    rowClass="cursor-pointer hover:bg-blue-50 transition-colors"
                />
            </div>

            <SystemRepairList
                open={isModalOpen}
                onCancel={handleModalClose}
                targetDraftId={selectedDraftId}
            />
        </div>
    );
};

// --- Main Component: SystemRepair with Tabs ---
function SystemRepair() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;

    // 🔥 เพิ่ม Styles ตรงนี้เพื่อบังคับให้ Tab Pane เต็มจอ
    const tabStyles = `
        .full-height-tabs .ant-tabs-content { height: 100%; }
        .full-height-tabs .ant-tabs-tabpane { height: 100%; }
    `;

    const items = [
        {
            key: '1',
            label: <span className="px-2">ใบเบิกขอซ่อม</span>,
            children: <RequisitionPane />,
        },
        {
            key: '2',
            label: <span className="px-2">รายการแจ้งซ่อม</span>,
            children: <RepairRequestLog />,
        },
    ];

    return (
        <ConfigProvider
            locale={thTH}
            theme={{ token: { colorPrimary: '#ff6900', borderRadius: 8 } }}
        >
            <style>{tabStyles}</style> {/* Inject CSS */}
            <div className={`h-screen flex flex-col bg-gray-50 ${isMd ? 'p-4' : 'p-2'}`}>
                <Tabs
                    defaultActiveKey="1"
                    items={items}
                    type="card"
                    // 🔥 เพิ่ม className "full-height-tabs" ที่เราสร้าง CSS ไว้
                    className="flex-1 overflow-hidden full-height-tabs"
                    tabBarStyle={{ marginBottom: 16 }}
                    style={{ height: '100%' }}
                />
            </div>
        </ConfigProvider>
    );
}

export default SystemRepair;