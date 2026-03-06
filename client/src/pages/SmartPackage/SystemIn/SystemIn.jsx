import { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Grid, Tag, Popconfirm, DatePicker } from 'antd';
import { SearchOutlined, CaretRightOutlined, CheckCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import api from "../../../api";
import { getSocket } from '../../../socketClient';
import SystemInList from './Page/SystemInList';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import thTH from 'antd/locale/th_TH';

// ✅ นำเข้า DraggableTable
import DraggableTable from '../../../components/antdtable/DraggableTable';

dayjs.locale('th');

function SystemIn() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const { message } = App.useApp();

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedDate, setSelectedDate] = useState(dayjs());

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDraftId, setSelectedDraftId] = useState(null);

    // ✅ State สำหรับ Pagination และความสูงของตาราง
    const [page, setPage] = useState({ current: 1, pageSize: 10 });
    const [tableY, setTableY] = useState(600);

    // ✅ คำนวณความสูงตารางอัตโนมัติ
    useEffect(() => {
        const onResize = () => setTableY(Math.max(400, window.innerHeight - 300));
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const dateStr = selectedDate ? selectedDate.format('YYYY-MM-DD') : '';
            const res = await api.get('/smartpackage/systemin', {
                params: { date: dateStr }
            });
            setRows(res?.data?.data || []);
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลรายการรับเข้าไม่สำเร็จ');
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

        window.addEventListener('hrms:systemin-update', onUpdate);
        return () => window.removeEventListener('hrms:systemin-update', onUpdate);
    }, [fetchData]);

    const handleCreate = () => {
        const storedUser = localStorage.getItem('user');
        const currentUser = storedUser ? JSON.parse(storedUser) : null;
        let foundDraft = null;

        if (currentUser && currentUser.employee_id) {
            foundDraft = rows.find(r =>
                String(r.created_by) === String(currentUser.employee_id) &&
                String(r.is_status) === '130' &&
                (!r.refID || r.refID === '')
            );
        }

        if (foundDraft) {
            // ✅ ปรับรูปแบบ message.info ให้เป็นแบบ Object และใส่ key เข้าไป
            message.info({
                content: 'ระบบพบ! คุณสร้างรายการแบบร่างไว้ จึงเปิดรายการล่าสุดให้คุณ',
                key: 'draft_found_msg' // <-- กำหนด key แบบนี้
            });
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
            await api.post('/smartpackage/systemin/confirm-output', { draft_id });
            message.success('ยืนยันการรับเข้าสำเร็จ');
            fetchData();
        } catch (err) {
            console.error(err);
            message.error('ไม่สามารถยืนยันรายการได้');
        } finally {
            setLoading(false);
        }
    };

    // ====== Columns (Ant Design Format) ======
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
            title: 'การดำเนินการ',
            key: 'action',
            width: 140,
            align: 'center',
            dragDisabled: true,
            render: (_, record) => {
                // ✅ แสดงไอคอนเมื่อสถานะเป็น 135 ตามเงื่อนไขข้อ 9
                if (String(record.is_status) === '135' || record.is_status_name === 'รับเข้าเรียบร้อย') {
                    return (
                        <div onClick={(e) => e.stopPropagation()}>
                            <CheckCircleOutlined className="text-green-600 text-2xl" />
                        </div>
                    );
                }
                return <span className="text-gray-300">-</span>;
            }
        },
        // {
        //     title: 'เลขที่เอกสาร',
        //     dataIndex: 'refID',
        //     key: 'refID',
        //     width: 180,
        //     sorter: (a, b) => String(a.refID || '').localeCompare(String(b.refID || '')),
        //     filters: [...new Set(rows.map(r => r.refID).filter(Boolean))].map(v => ({ text: v, value: v })),
        //     filterSearch: true,
        //     onFilter: (value, record) => record.refID === value,
        //     render: (val) => <span className="font-bold text-blue-600">{val}</span>
        // },
        {
            title: 'สถานะ',
            dataIndex: 'is_status_name',
            key: 'is_status_name',
            width: 150,
            align: 'center',
            sorter: (a, b) => String(a.is_status_name || '').localeCompare(String(b.is_status_name || '')),
            filters: [...new Set(rows.map(r => r.is_status_name).filter(Boolean))].map(v => ({ text: v, value: v })),
            onFilter: (value, record) => record.is_status_name === value,
            render: (val, record) => (
                <div className={`w-full text-center py-1 rounded-md text-xs border ${record.is_status_color || 'bg-gray-100'}`}>
                    {val || '-'}
                </div>
            )
        },
        {
            title: 'รับเข้าจาก (ปลายทาง)',
            dataIndex: 'origin',
            key: 'origin',
            width: 160,
            align: 'center',
            sorter: (a, b) => String(a.origin || '').localeCompare(String(b.origin || '')),
            render: (val) => <span className="text-gray-600">{val || '-'}</span>
        },
        {
            title: 'ต้นทางที่รับ',
            dataIndex: 'destination',
            key: 'destination',
            width: 160,
            align: 'center',
            sorter: (a, b) => String(a.destination || '').localeCompare(String(b.destination || '')),
            render: (val) => <span className="text-gray-600">{val || '-'}</span>
        },
        {
            title: 'จำนวน',
            dataIndex: 'attendees',
            key: 'attendees',
            width: 100,
            align: 'center',
            sorter: (a, b) => Number(a.attendees || 0) - Number(b.attendees || 0),
            render: (val) => (
                <Tag color="blue" className="w-full text-center text-sm m-0 border-0 rounded-md">
                    {val || 0}
                </Tag>
            )
        },
        {
            title: 'ผู้ทำรายการ',
            dataIndex: 'created_by_name',
            key: 'created_by_name',
            width: 180,
            sorter: (a, b) => String(a.created_by_name || '').localeCompare(String(b.created_by_name || '')),
            filters: [...new Set(rows.map(r => r.created_by_name).filter(Boolean))].map(v => ({ text: v, value: v })),
            filterSearch: true,
            onFilter: (value, record) => record.created_by_name === value,
        },
        {
            title: 'วันที่',
            dataIndex: 'create_date',
            key: 'create_date',
            width: 140,
            align: 'center',
            sorter: (a, b) => new Date(a.create_date || 0) - new Date(b.create_date || 0),
            render: (val) => val ? new Date(val).toLocaleDateString('th-TH') : '-'
        },
        {
            title: 'เวลา',
            dataIndex: 'create_time',
            key: 'create_time',
            width: 100,
            align: 'center',
            sorter: (a, b) => String(a.create_time || '').localeCompare(String(b.create_time || '')),
            render: (val) => val || '-'
        },
        {
            title: 'หมายเหตุ',
            dataIndex: 'booking_remark',
            key: 'booking_remark',
            width: 250,
            ellipsis: true,
            sorter: (a, b) => String(a.booking_remark || '').localeCompare(String(b.booking_remark || '')),
        },
    ], [page, rows]);

    return (
        <ConfigProvider
            locale={thTH}
            theme={{
                token: {
                    colorPrimary: '#1677ff', // สีตรงวันที่ และ ปุ่ม "แสดง/ซ่อนคอลัมน์"
                    borderRadius: 2,
                    fontFamily: 'Inter, "Sarabun", sans-serif',
                }
            }}
        >
            <div className={`h-screen flex flex-col bg-gray-50 ${isMd ? 'p-4' : 'p-2'}`}>

                {/* ✅ เรียกใช้ DraggableTable */}
                <DraggableTable
                    columns={baseColumns}
                    dataSource={filteredRows}
                    rowKey="draft_id" // ใช้ draft_id เป็น Key
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

                    // ✅ คลิกแถวเพื่อเปิด Modal
                    onRow={(record) => ({
                        onClick: () => handleRowClick(record),
                        className: "cursor-pointer"
                    })}

                    // ✅ Toolbar
                    renderToolbar={(ColumnVisibility) => (
                        <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-white p-2 rounded-md shadow-sm border border-gray-100 w-full md:w-auto">
                                <Input
                                    prefix={<SearchOutlined className="text-gray-400" />}
                                    placeholder="ค้นหา เลขที่เอกสาร..."
                                    allowClear
                                    variant="borderless"
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full sm:w-64 bg-transparent"
                                />
                                <div className="w-full h-px bg-gray-100 sm:w-px sm:h-6 sm:mx-1 hidden sm:block"></div>

                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Button
                                        type="primary"
                                        icon={<CaretRightOutlined />}
                                        onClick={handleCreate}
                                        className="bg-blue-600 hover:!bg-blue-500 border-none h-9 rounded-md px-4 font-medium shadow-md w-full sm:w-auto"
                                    >
                                        สร้างรายการรับเข้า
                                    </Button>

                                    <div className="flex items-center gap-2 px-2 h-9 border border-gray-200 rounded-md bg-white">
                                        <span className="text-gray-500 text-sm hidden lg:inline">วันที่:</span>
                                        <DatePicker
                                            value={selectedDate}
                                            onChange={(date) => setSelectedDate(date)}
                                            format="DD/MM/YYYY"
                                            allowClear={false}
                                            variant="borderless"
                                            className="w-32 cursor-pointer"
                                            suffixIcon={<CalendarOutlined className="text-blue-600" />}
                                        />
                                    </div>

                                    {/* ปุ่มซ่อน/แสดงคอลัมน์ */}
                                    {ColumnVisibility}
                                </div>
                            </div>
                        </div>
                    )}
                />

                <SystemInList
                    open={isModalOpen}
                    onCancel={handleModalClose}
                    targetDraftId={selectedDraftId}
                />
            </div>
        </ConfigProvider>
    );
}

export default SystemIn;