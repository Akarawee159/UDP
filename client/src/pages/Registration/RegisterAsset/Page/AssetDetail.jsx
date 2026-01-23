import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Input, Button, Card, Typography, App, Grid, Modal
} from 'antd';
import {
    SearchOutlined, PrinterOutlined,
    QrcodeOutlined, ArrowLeftOutlined, CloseOutlined,
    StopOutlined, ExclamationCircleOutlined, HistoryOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import api from "../../../../api";
import DataTable from '../../../../components/aggrid/DataTable';

// Import สำหรับการพิมพ์
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';

const { Title, Text } = Typography;

function AssetDetail() {
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

    // รับ partCode ที่ส่งมาจากหน้า RegisterAsset
    const { partCode, partName } = location.state || {};

    // ใช้ App.useApp() เพื่อเรียก message และ modal
    const { message, modal } = App.useApp();

    // State
    const [tableData, setTableData] = useState([]); // ข้อมูลในตาราง (Filtered)
    const [allData, setAllData] = useState([]);     // ข้อมูลดิบทั้งหมด
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isPrinting, setIsPrinting] = useState(false);
    const [isCanceling, setIsCanceling] = useState(false); // State สำหรับ loading ปุ่มยกเลิก

    // State สำหรับ Selection และ Printing
    const [selectedRows, setSelectedRows] = useState([]);
    const [printList, setPrintList] = useState([]);
    const printRef = useRef();

    // ฟังก์ชันไปหน้า Log
    const handleViewLog = (assetCode) => {
        // แก้ไข Path ให้มีขีด (-) ตรง register-asset เพื่อให้ตรงกับ App.jsx
        navigate('/registration/register-asset/log', {
            state: { asset_code: assetCode }
        });
    };

    // --- Fetch Data ---
    useEffect(() => {
        const fetchAndFilter = async () => {
            setLoading(true);
            try {
                const res = await api.get('/registration/registerasset');
                let rows = res?.data?.data || [];

                // Filter เบื้องต้น: ไม่เอา is_status 99 (เผื่อ API ส่งมา)
                rows = rows.filter(r => String(r.is_status) !== '99');

                setAllData(rows);

                // Filter ตาม partCode ถ้ามี
                if (partCode) {
                    const filtered = rows.filter(r => r.partCode === partCode);
                    setTableData(filtered);
                } else {
                    setTableData(rows);
                }
            } catch (err) {
                console.error(err);
                message.error("ไม่สามารถโหลดข้อมูลได้");
            } finally {
                setLoading(false);
            }
        };

        fetchAndFilter();
    }, [partCode, message]);

    // --- Print Logic ---
    const handlePrintProcess = useReactToPrint({
        contentRef: printRef,
        onAfterPrint: () => {
            setPrintList([]);
            setIsPrinting(false);
        },
        onPrintError: () => {
            setIsPrinting(false);
        }
    });

    // 1. ฟังก์ชันพิมพ์รายตัว
    const handleIndividualPrint = async (row) => {
        setIsPrinting(true);
        try {
            const res = await api.patch(`/registration/registerasset/print/${row.asset_code}`);

            if (res.data?.success) {
                const { print_status, is_status, is_status_name, is_status_color } = res.data;

                // อัปเดต state tableData
                setTableData(prev => prev.map(item =>
                    item.asset_code === row.asset_code
                        ? {
                            ...item,
                            print_status,
                            is_status,
                            is_status_name,
                            is_status_color
                        }
                        : item
                ));

                setPrintList([row]);
                setTimeout(() => handlePrintProcess(), 100);
            } else {
                setIsPrinting(false);
            }
        } catch (err) {
            console.error(err);
            message.error("ไม่สามารถอัปเดตสถานะการพิมพ์ได้");
            setIsPrinting(false);
        }
    };

    // 2. ฟังก์ชันพิมพ์หลายรายการ
    const handleBulkPrint = async () => {
        if (selectedRows.length === 0) {
            message.warning("กรุณาเลือกรายการที่ต้องการพิมพ์");
            return;
        }

        setIsPrinting(true);
        try {
            const updatePromises = selectedRows.map(row =>
                api.patch(`/registration/registerasset/print/${row.asset_code}`)
            );

            const responses = await Promise.all(updatePromises);
            const updatesMap = {};
            responses.forEach((res, index) => {
                if (res.data?.success) {
                    const assetCode = selectedRows[index].asset_code;
                    updatesMap[assetCode] = res.data;
                }
            });

            // Update หน้าจอ Frontend Realtime
            setTableData(prev => prev.map(item => {
                if (updatesMap[item.asset_code]) {
                    const newData = updatesMap[item.asset_code];
                    return {
                        ...item,
                        print_status: newData.print_status,
                        is_status: newData.is_status,
                        is_status_name: newData.is_status_name,
                        is_status_color: newData.is_status_color
                    };
                }
                return item;
            }));

            setPrintList(selectedRows);
            setTimeout(() => handlePrintProcess(), 100);

        } catch (err) {
            console.error(err);
            message.error("เกิดข้อผิดพลาดในการเตรียมพิมพ์หมู่");
            setIsPrinting(false);
        }
    };

    // 3. ฟังก์ชันยกเลิกรายการ (Cancel Bulk) [NEW]
    // 3. ฟังก์ชันยกเลิกรายการ (Cancel Bulk)
    const handleCancelBulk = () => {
        if (selectedRows.length === 0) {
            message.warning("กรุณาเลือกรายการที่ต้องการยกเลิก");
            return;
        }

        modal.confirm({
            title: 'ยืนยันการยกเลิกรายการ',
            icon: <ExclamationCircleOutlined className="text-red-500" />,
            content: (
                <div>
                    <p>คุณต้องการยกเลิกรายการที่เลือกจำนวน <b>{selectedRows.length}</b> รายการใช่หรือไม่?</p>
                    <p className="text-gray-500 text-xs mt-1">*รายการที่ถูกยกเลิกจะไม่แสดงในหน้านี้อีก</p>
                </div>
            ),
            okText: 'ยืนยันการยกเลิก',
            okType: 'danger',
            cancelText: 'ปิด',
            // [Modified] ใช้ footer เพื่อสลับตำแหน่งปุ่ม (แสดง OkBtn ก่อน CancelBtn)
            footer: (_, { OkBtn, CancelBtn }) => (
                <>
                    <OkBtn />
                    <CancelBtn />
                </>
            ),
            onOk: async () => {
                setIsCanceling(true);
                try {
                    const assetCodes = selectedRows.map(r => r.asset_code);

                    // เรียก API Cancel
                    const res = await api.patch('/registration/registerasset/cancel', {
                        assetCodes: assetCodes
                    });

                    if (res.data?.success) {
                        message.success(res.data.message || 'ยกเลิกรายการสำเร็จ');

                        // อัปเดต Table
                        setTableData(prev => prev.filter(item => !assetCodes.includes(item.asset_code)));
                        setAllData(prev => prev.filter(item => !assetCodes.includes(item.asset_code)));

                        // เคลียร์ Selection
                        setSelectedRows([]);
                    }
                } catch (err) {
                    console.error(err);
                    message.error(err?.response?.data?.message || "เกิดข้อผิดพลาดในการยกเลิกรายการ");
                } finally {
                    setIsCanceling(false);
                }
            }
        });
    };

    // --- Column Definitions ---
    // --- Column Definitions ---
    const columnDefs = useMemo(() => [
        {
            headerName: 'ลำดับ',
            valueGetter: "node.rowIndex + 1",
            width: 60,
            pinned: 'left',
            cellClass: "flex justify-center items-center",
            headerClass: "text-center justify-center",
        },
        {
            headerName: 'ประวัติ',
            width: 80,
            pinned: 'left',
            // --- เพิ่ม 2 บรรทัดนี้เพื่อจัดกึ่งกลางทั้ง Header และ Cell ---
            cellClass: 'flex justify-center items-center',
            headerClass: 'text-center justify-center',
            // ---------------------------------------------------
            cellRenderer: (params) => (
                <Button
                    type="text"
                    icon={<HistoryOutlined />}
                    // เพิ่ม flex items-center justify-center เพื่อความชัวร์ในการจัด icon ในปุ่ม
                    className="text-gray-500 hover:text-blue-600 flex items-center justify-center"
                    title="ดูประวัติการแก้ไข"
                    onClick={() => handleViewLog(params.data.asset_code)}
                />
            )
        },
        {
            headerName: '',
            checkboxSelection: true,
            headerCheckboxSelection: true,
            width: 50,
            pinned: 'left',
            lockVisible: true
        },
        {
            headerName: 'สติ๊กเกอร์', field: 'label_register', width: 120, pinned: 'left',
            cellRenderer: (params) => (
                <Button
                    type="dashed"
                    size="small"
                    loading={isPrinting}
                    disabled={isPrinting || isCanceling}
                    icon={!isPrinting && <div className="flex items-center gap-1"><QrcodeOutlined /><PrinterOutlined /></div>}
                    className="flex items-center justify-center w-full text-blue-600 border-blue-200 hover:border-blue-500 hover:text-blue-500 bg-blue-50"
                    onClick={() => handleIndividualPrint(params.data)}
                >
                    {isPrinting ? 'รอ...' : 'พิมพ์'}
                </Button>
            )
        },
        {
            headerName: 'สถานะปริ้น', field: 'print_status', width: 120,
            cellRenderer: (params) => {
                const val = parseInt(params.value) || 0;
                if (val === 0) return <span className="text-orange-500 font-medium">ยังไม่ปริ้น</span>;
                if (val === 1) return <span className="text-green-600 font-bold">ปริ้นแล้ว</span>;
                return <span className="text-blue-600 font-bold">ปริ้นครั้งที่ {val}</span>;
            }
        },
        {
            // --- เพิ่ม sortable และ filter ---
            headerName: 'สถานะใช้งาน', field: 'asset_status', width: 150,
            sortable: true,
            filter: true,
            cellRenderer: (params) => {
                const name = params.data.asset_status_name || params.value;
                const colorClass = params.data.asset_status_color || 'bg-gray-100 text-gray-600 border-gray-200';
                return (
                    <div className={`px-2 py-0.5 rounded border text-xs text-center font-medium ${colorClass}`}>
                        {name}
                    </div>
                );
            }
        },
        {
            // --- เพิ่ม sortable และ filter ---
            headerName: 'สถานะทรัพย์สิน', field: 'is_status', width: 150,
            sortable: true,
            filter: true,
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
        { headerName: 'รหัสทรัพย์สิน', field: 'asset_code', width: 180 },

        // --- เพิ่ม sortable และ filter ---
        { headerName: 'Lot No', field: 'asset_lot', width: 150, sortable: true, filter: true },

        { headerName: 'รายละเอียดทรัพย์สิน', field: 'asset_detail', width: 200 },
        { headerName: 'ประเภททรัพย์สิน', field: 'asset_type', width: 180 },
        { headerName: 'ที่อยู่ทรัพย์สิน', field: 'asset_location', width: 150 },
        { headerName: 'Part Code', field: 'partCode', width: 150 },
        { headerName: 'Part Name', field: 'partName', width: 150 },
        { headerName: 'Label Code', field: 'label_register', width: 400 },
        { headerName: 'เลขที่เอกสาร', field: 'doc_no', width: 150 },
        { headerName: 'วันที่ขึ้นทะเบียน', field: 'asset_date', width: 150, valueFormatter: (params) => params.value ? dayjs(params.value).format('DD/MM/YYYY') : '-' },
        { headerName: 'ผู้ครอบครอง', field: 'asset_holder', width: 150 },
    ], [isPrinting, isCanceling]);

    const filteredRows = useMemo(() => {
        if (!searchTerm) return tableData;
        const lower = searchTerm.toLowerCase();
        return tableData.filter(r =>
            String(r.asset_code || '').toLowerCase().includes(lower) ||
            String(r.asset_detail || '').toLowerCase().includes(lower) ||
            String(r.asset_lot || '').toLowerCase().includes(lower)
        );
    }, [tableData, searchTerm]);

    return (
        <div style={containerStyle} className="bg-slate-50 relative">

            {/* --- Header Bar (Sticky Top) --- */}
            <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 z-20 shadow-sm backdrop-blur-md bg-white/90">
                <div className="flex items-center gap-4">
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate(-1)}
                        shape="circle"
                        className="border-gray-200 text-slate-500 hover:text-blue-600 hover:border-blue-600"
                    />
                    <div>
                        <Title level={4} style={{ margin: 0 }} className="text-slate-800 flex items-center gap-2">
                            <span className="bg-blue-600 w-2 h-6 rounded-r-md block"></span>
                            รายการทรัพย์สิน: {partCode || 'ทั้งหมด'}
                        </Title>
                        <Text className="text-slate-500 text-xs ml-4">
                            {partName || 'แสดงรายการทรัพย์สินแยกตามรหัส Part Code'}
                        </Text>
                    </div>
                </div>
                <Button
                    type="text"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => navigate(-1)}
                    className="hover:bg-red-50 rounded-full"
                >
                    ปิดหน้าต่าง
                </Button>
            </div>

            {/* --- Main Content --- */}
            <div className="p-4 space-y-4">
                <Card className="shadow-sm border-gray-200 rounded-xl" styles={{ body: { padding: 0 } }}>
                    <div className="px-5 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-t-xl">
                        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 flex-wrap">
                            <Input
                                prefix={<SearchOutlined className="text-gray-400" />}
                                placeholder="ค้นหา รหัสทรัพย์สิน, รายละเอียด..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                allowClear
                                variant="borderless"
                                className="w-64 bg-transparent"
                            />
                            <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>

                            {/* ปุ่มพิมพ์สติ๊กเกอร์ (Bulk Print) */}
                            <Button
                                type="primary"
                                icon={<PrinterOutlined />}
                                onClick={handleBulkPrint}
                                loading={isPrinting}
                                disabled={isPrinting || isCanceling || selectedRows.length === 0}
                                className="bg-emerald-600 hover:bg-emerald-500 border-none h-9 rounded-lg px-4 font-medium shadow-md"
                            >
                                พิมพ์สติ๊กเกอร์ ({selectedRows.length})
                            </Button>

                            {/* [NEW] ปุ่มยกเลิกรายการ (Cancel Bulk) */}
                            <Button
                                danger
                                icon={<StopOutlined />}
                                onClick={handleCancelBulk}
                                loading={isCanceling}
                                disabled={isPrinting || isCanceling || selectedRows.length === 0}
                                className="h-9 rounded-lg px-4 font-medium shadow-md border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300"
                            >
                                ยกเลิกรายการที่เลือก ({selectedRows.length})
                            </Button>
                        </div>
                    </div>

                    <div style={{ height: 'calc(100vh - 160px)' }} className="w-full">
                        <DataTable
                            rowData={filteredRows}
                            columnDefs={columnDefs}
                            loading={loading}
                            rowSelection="multiple"
                            suppressRowClickSelection={true}
                            onSelectionChanged={(params) => {
                                setSelectedRows(params.api.getSelectedRows());
                            }}
                        />
                    </div>
                </Card>
            </div>

            {/* --- Hidden Print Component --- */}
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    {printList.map((item, index) => (
                        <div key={index} style={{
                            width: '5.5cm',
                            height: '3.5cm',
                            padding: '0.2cm',
                            boxSizing: 'border-box',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            border: '1px solid #ddd',
                            overflow: 'hidden',
                            pageBreakAfter: 'always',
                            fontFamily: 'sans-serif'
                        }}>
                            <div style={{ flex: 1, overflow: 'hidden', fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '10px' }}>รหัสทรัพย์สิน : {item.asset_code}</div>
                                <div>Lot No: {item.asset_lot}</div>
                            </div>
                            <div style={{ marginLeft: '5px' }}>
                                <QRCodeSVG
                                    value={item.label_register}
                                    size={80}
                                    level={"M"}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default AssetDetail;