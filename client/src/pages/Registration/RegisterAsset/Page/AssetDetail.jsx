import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Input, Button, Card, Typography, App, Grid
} from 'antd';
import {
    SearchOutlined, PrinterOutlined,
    QrcodeOutlined, ArrowLeftOutlined, CloseOutlined,
    StopOutlined, ExclamationCircleOutlined, HistoryOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import api from "../../../../api";
import DraggableTable from '../../../../components/antdtable/DraggableTable';
import { getSocket } from '../../../../socketClient';

import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';

const { Title, Text } = Typography;

function AssetDetail() {
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

    const { partCode, partName } = location.state || {};
    const { message, modal } = App.useApp();

    const [tableData, setTableData] = useState([]);
    const [allData, setAllData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isPrinting, setIsPrinting] = useState(false);
    const [isCanceling, setIsCanceling] = useState(false);

    const [selectedRows, setSelectedRows] = useState([]);
    const [printList, setPrintList] = useState([]);
    const printRef = useRef();

    const handleViewLog = (assetCode) => {
        navigate('/registration/register-asset/log', {
            state: { asset_code: assetCode }
        });
    };

    useEffect(() => {
        const fetchAndFilter = async () => {
            setLoading(true);
            try {
                const res = await api.get('/registration/registerasset');
                let rows = res?.data?.data || [];

                rows = rows.filter(r => String(r.is_status) !== '99');
                setAllData(rows);

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

    useEffect(() => {
        const s = getSocket();
        if (!s) return;

        const onUpsert = (incomingRow) => {
            setTableData(prev => {
                const idx = prev.findIndex(r => r.asset_code === incomingRow.asset_code);
                if (idx === -1) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx], ...incomingRow };
                return next;
            });

            setAllData(prev => {
                const idx = prev.findIndex(r => r.asset_code === incomingRow.asset_code);
                if (idx === -1) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx], ...incomingRow };
                return next;
            });
        };

        const onDelete = ({ asset_code }) => {
            setTableData(prev => prev.filter(r => r.asset_code !== asset_code));
            setAllData(prev => prev.filter(r => r.asset_code !== asset_code));
        };

        s.on('registerasset:upsert', onUpsert);
        s.on('registerasset:delete', onDelete);

        return () => {
            s.off('registerasset:upsert', onUpsert);
            s.off('registerasset:delete', onDelete);
        };
    }, []);

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

    const handleIndividualPrint = async (row) => {
        setIsPrinting(true);
        try {
            const res = await api.patch(`/registration/registerasset/print/${row.asset_code}`);

            if (res.data?.success) {
                const { print_status, is_status, is_status_name, is_status_color } = res.data;

                setTableData(prev => prev.map(item =>
                    item.asset_code === row.asset_code
                        ? { ...item, print_status, is_status, is_status_name, is_status_color }
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

                    const res = await api.patch('/registration/registerasset/cancel', {
                        assetCodes: assetCodes
                    });

                    if (res.data?.success) {
                        message.success(res.data.message || 'ยกเลิกรายการสำเร็จ');
                        setSelectedRows([]);
                    }
                } catch (err) {
                    console.error(err);
                    if (err.response && err.response.status === 400 && err.response.data?.code === 'INVALID_STATUS') {
                        const { invalidItem } = err.response.data;
                        setTimeout(() => {
                            modal.warning({
                                title: 'ไม่สามารถยกเลิกรายการได้',
                                icon: <StopOutlined className="text-orange-500" />,
                                content: (
                                    <div className="flex flex-col gap-2 mt-2">
                                        <Text>พบรายการที่มีสถานะไม่ถูกต้อง:</Text>
                                        <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                                            <div className="flex justify-between items-center mb-1">
                                                <Text type="secondary" className="text-xs">รหัสบรรจุภัณฑ์</Text>
                                                <Text strong>{invalidItem.asset_code}</Text>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <Text type="secondary" className="text-xs">สถานะปัจจุบัน</Text>
                                                <span className={`px-2 py-0.5 rounded text-xs border font-medium ${invalidItem.status_color}`}>
                                                    {invalidItem.status_name}
                                                </span>
                                            </div>
                                        </div>
                                        <Text type="secondary" className="text-xs text-center mt-2">
                                            *ต้องมีสถานะ "คงคลัง" เท่านั้นจึงจะยกเลิกได้
                                        </Text>
                                    </div>
                                ),
                                okText: 'รับทราบ',
                                okButtonProps: { type: 'primary' },
                                maskClosable: true,
                            });
                        }, 300);
                    } else {
                        message.error(err?.response?.data?.message || "เกิดข้อผิดพลาดในการยกเลิกรายการ");
                    }
                } finally {
                    setIsCanceling(false);
                }
            }
        });
    };

    // --- OPTIMIZATION: รวบยอดการคำนวณ Filters ทั้งหมดให้อยู่ในลูปเดียว ---
    const filterOptions = useMemo(() => {
        const lists = {
            print_status: new Set(), asset_status: new Set(), is_status: new Set(),
            partCode: new Set(), asset_model: new Set(), asset_code: new Set(),
            asset_unitname: new Set(), asset_lot: new Set(), current_address: new Set(),
            asset_date: new Set(), asset_width: new Set(), asset_length: new Set(),
            asset_height: new Set(), asset_detail: new Set(), asset_type: new Set(),
            doc_no: new Set(), asset_responsible_department: new Set(), asset_usedfor: new Set(),
            asset_color: new Set(), asset_supplier_name: new Set(), asset_brand: new Set(),
            asset_source: new Set(), asset_feature: new Set(), asset_holder: new Set()
        };

        // วนข้อมูลแค่รอบเดียวเพื่อดึงค่าที่ไม่ซ้ำกัน
        tableData.forEach(r => {
            if (r.print_status != null) lists.print_status.add(r.print_status);
            if (r.asset_status_name || r.asset_status) lists.asset_status.add(r.asset_status_name || r.asset_status);
            if (r.is_status_name || r.is_status) lists.is_status.add(r.is_status_name || r.is_status);
            if (r.partCode) lists.partCode.add(r.partCode);
            if (r.asset_model) lists.asset_model.add(r.asset_model);
            if (r.asset_code) lists.asset_code.add(r.asset_code);
            if (r.asset_unitname) lists.asset_unitname.add(r.asset_unitname);
            if (r.asset_lot) lists.asset_lot.add(r.asset_lot);
            if (r.current_address) lists.current_address.add(r.current_address);
            if (r.asset_date) lists.asset_date.add(dayjs(r.asset_date).format('DD/MM/YYYY'));
            if (r.asset_width != null) lists.asset_width.add(`${Number(r.asset_width).toFixed(2)} ${r.asset_width_unit || ''}`.trim());
            if (r.asset_length != null) lists.asset_length.add(`${Number(r.asset_length).toFixed(2)} ${r.asset_length_unit || ''}`.trim());
            if (r.asset_height != null) lists.asset_height.add(`${Number(r.asset_height).toFixed(2)} ${r.asset_height_unit || ''}`.trim());
            if (r.asset_detail) lists.asset_detail.add(r.asset_detail);
            if (r.asset_type) lists.asset_type.add(r.asset_type);
            if (r.doc_no) lists.doc_no.add(r.doc_no);
            if (r.asset_responsible_department) lists.asset_responsible_department.add(r.asset_responsible_department);
            if (r.asset_usedfor) lists.asset_usedfor.add(r.asset_usedfor);
            if (r.asset_color) lists.asset_color.add(r.asset_color);
            if (r.asset_supplier_name) lists.asset_supplier_name.add(r.asset_supplier_name);
            if (r.asset_brand) lists.asset_brand.add(r.asset_brand);
            if (r.asset_source) lists.asset_source.add(r.asset_source);
            if (r.asset_feature) lists.asset_feature.add(r.asset_feature);
            if (r.asset_holder) lists.asset_holder.add(r.asset_holder);
        });

        const toFilterFormat = (set) => Array.from(set).filter(Boolean).map(v => ({ text: String(v), value: v }));

        return {
            print_status: Array.from(lists.print_status).map(v => {
                const val = parseInt(v) || 0;
                let text = `ปริ้นครั้งที่ ${val}`;
                if (val === 0) text = 'ยังไม่ปริ้น';
                else if (val === 1) text = 'ปริ้นแล้ว';
                return { text, value: v };
            }),
            asset_status: toFilterFormat(lists.asset_status),
            is_status: toFilterFormat(lists.is_status),
            partCode: toFilterFormat(lists.partCode),
            asset_model: toFilterFormat(lists.asset_model),
            asset_code: toFilterFormat(lists.asset_code),
            asset_unitname: toFilterFormat(lists.asset_unitname),
            asset_lot: toFilterFormat(lists.asset_lot),
            current_address: toFilterFormat(lists.current_address),
            asset_date: toFilterFormat(lists.asset_date),
            asset_width: toFilterFormat(lists.asset_width),
            asset_length: toFilterFormat(lists.asset_length),
            asset_height: toFilterFormat(lists.asset_height),
            asset_detail: toFilterFormat(lists.asset_detail),
            asset_type: toFilterFormat(lists.asset_type),
            doc_no: toFilterFormat(lists.doc_no),
            asset_responsible_department: toFilterFormat(lists.asset_responsible_department),
            asset_usedfor: toFilterFormat(lists.asset_usedfor),
            asset_color: toFilterFormat(lists.asset_color),
            asset_supplier_name: toFilterFormat(lists.asset_supplier_name),
            asset_brand: toFilterFormat(lists.asset_brand),
            asset_source: toFilterFormat(lists.asset_source),
            asset_feature: toFilterFormat(lists.asset_feature),
            asset_holder: toFilterFormat(lists.asset_holder)
        };
    }, [tableData]);

    const columns = useMemo(() => [
        {
            title: 'ลำดับ',
            key: 'seq',
            width: 60,
            fixed: 'left',
            align: 'center',
            dragDisabled: true,
            render: (_, __, index) => index + 1
        },
        {
            title: 'ประวัติ',
            key: 'history',
            width: 80,
            fixed: 'left',
            align: 'center',
            render: (_, record) => (
                <Button
                    type="text"
                    icon={<HistoryOutlined />}
                    className="text-gray-500 hover:text-blue-600 flex items-center justify-center mx-auto"
                    title="ดูประวัติการแก้ไข"
                    onClick={() => handleViewLog(record.asset_code)}
                />
            )
        },
        {
            title: 'สติ๊กเกอร์',
            dataIndex: 'label_register',
            key: 'label_register',
            width: 120,
            fixed: 'left',
            render: (text, record) => (
                <Button
                    type="dashed"
                    size="small"
                    loading={isPrinting}
                    disabled={isPrinting || isCanceling}
                    icon={!isPrinting && <div className="flex items-center gap-1"><QrcodeOutlined /><PrinterOutlined /></div>}
                    className="flex items-center justify-center w-full text-blue-600 border-blue-200 hover:border-blue-500 hover:text-blue-500 bg-blue-50"
                    onClick={() => handleIndividualPrint(record)}
                >
                    {isPrinting ? 'รอ...' : 'พิมพ์'}
                </Button>
            )
        },
        {
            title: 'สถานะปริ้น',
            dataIndex: 'print_status',
            key: 'print_status',
            width: 160,
            sorter: (a, b) => (Number(a.print_status) || 0) - (Number(b.print_status) || 0),
            filters: filterOptions.print_status, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.print_status === value,
            render: (value) => {
                const val = parseInt(value) || 0;
                if (val === 0) return <span className="text-orange-500 font-medium">ยังไม่ปริ้น</span>;
                if (val === 1) return <span className="text-green-600 font-bold">ปริ้นแล้ว</span>;
                return <span className="text-blue-600 font-bold">ปริ้นครั้งที่ {val}</span>;
            }
        },
        {
            title: 'สถานะใช้งาน',
            dataIndex: 'asset_status',
            key: 'asset_status',
            width: 180,
            sorter: (a, b) => String(a.asset_status_name || a.asset_status || '').localeCompare(String(b.asset_status_name || b.asset_status || '')),
            filters: filterOptions.asset_status, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => (record.asset_status_name || record.asset_status) === value,
            render: (value, record) => {
                const name = record.asset_status_name || value;
                const colorClass = record.asset_status_color || 'bg-gray-100 text-gray-600 border-gray-200';
                return <div className={`px-2 py-0.5 rounded border text-xs text-center font-medium ${colorClass}`}>{name}</div>;
            }
        },
        {
            title: 'สถานะบรรจุภัณฑ์',
            dataIndex: 'is_status',
            key: 'is_status',
            width: 180,
            sorter: (a, b) => String(a.is_status_name || a.is_status || '').localeCompare(String(b.is_status_name || b.is_status || '')),
            filters: filterOptions.is_status, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => (record.is_status_name || record.is_status) === value,
            render: (value, record) => {
                const name = record.is_status_name || value;
                const colorClass = record.is_status_color || 'bg-gray-100 text-gray-600 border-gray-200';
                return <div className={`px-2 py-0.5 rounded border text-xs text-center font-medium ${colorClass}`}>{name}</div>;
            }
        },
        {
            title: 'รหัส',
            dataIndex: 'partCode',
            key: 'partCode',
            width: 120,
            sorter: (a, b) => String(a.partCode || '').localeCompare(String(b.partCode || '')),
            filters: filterOptions.partCode, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.partCode === value,
        },
        {
            title: 'โมเดล',
            dataIndex: 'asset_model',
            key: 'asset_model',
            width: 120,
            sorter: (a, b) => String(a.asset_model || '').localeCompare(String(b.asset_model || '')),
            filters: filterOptions.asset_model, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.asset_model === value,
        },
        {
            title: 'ทะเบียนบรรจุภัณฑ์',
            dataIndex: 'asset_code',
            key: 'asset_code',
            width: 300,
            sorter: (a, b) => String(a.asset_code || '').localeCompare(String(b.asset_code || '')),
            filters: filterOptions.asset_code, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.asset_code === value,
        },
        {
            title: 'หน่วยนับ',
            dataIndex: 'asset_unitname',
            key: 'asset_unitname',
            width: 150,
            sorter: (a, b) => String(a.asset_unitname || '').localeCompare(String(b.asset_unitname || '')),
            filters: filterOptions.asset_unitname, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.asset_unitname === value,
        },
        {
            title: 'หมายเลขล็อต',
            dataIndex: 'asset_lot',
            key: 'asset_lot',
            width: 180,
            sorter: (a, b) => String(a.asset_lot || '').localeCompare(String(b.asset_lot || '')),
            filters: filterOptions.asset_lot, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.asset_lot === value,
        },
        {
            title: 'ปัจจุบันอยู่ที่',
            dataIndex: 'current_address',
            key: 'current_address',
            width: 150,
            sorter: (a, b) => String(a.current_address || '').localeCompare(String(b.current_address || '')),
            filters: filterOptions.current_address, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.current_address === value,
        },
        {
            title: 'วันที่ซื้อ',
            dataIndex: 'asset_date',
            key: 'asset_date',
            width: 180,
            sorter: (a, b) => dayjs(a.asset_date || 0).valueOf() - dayjs(b.asset_date || 0).valueOf(),
            filters: filterOptions.asset_date, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => (record.asset_date ? dayjs(record.asset_date).format('DD/MM/YYYY') : null) === value,
            render: (value) => value ? dayjs(value).format('DD/MM/YYYY') : '-'
        },
        {
            title: 'ความกว้าง',
            dataIndex: 'asset_width',
            key: 'asset_width',
            width: 160,
            sorter: (a, b) => (Number(a.asset_width) || 0) - (Number(b.asset_width) || 0),
            filters: filterOptions.asset_width, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
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
            sorter: (a, b) => (Number(a.asset_length) || 0) - (Number(b.asset_length) || 0),
            filters: filterOptions.asset_length, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
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
            sorter: (a, b) => (Number(a.asset_height) || 0) - (Number(b.asset_height) || 0),
            filters: filterOptions.asset_height, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
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
        {
            title: 'ชื่อ',
            dataIndex: 'asset_detail',
            key: 'asset_detail',
            width: 200,
            sorter: (a, b) => String(a.asset_detail || '').localeCompare(String(b.asset_detail || '')),
            filters: filterOptions.asset_detail, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.asset_detail === value,
        },
        {
            title: 'ประเภท',
            dataIndex: 'asset_type',
            key: 'asset_type',
            width: 180,
            sorter: (a, b) => String(a.asset_type || '').localeCompare(String(b.asset_type || '')),
            filters: filterOptions.asset_type, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.asset_type === value,
        },
        {
            title: 'เลขที่เอกสาร',
            dataIndex: 'doc_no',
            key: 'doc_no',
            width: 180,
            sorter: (a, b) => String(a.doc_no || '').localeCompare(String(b.doc_no || '')),
            filters: filterOptions.doc_no, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.doc_no === value,
        },
        {
            title: 'ฝ่ายที่รับผิดชอบ',
            dataIndex: 'asset_responsible_department',
            key: 'asset_responsible_department',
            width: 180,
            sorter: (a, b) => String(a.asset_responsible_department || '').localeCompare(String(b.asset_responsible_department || '')),
            filters: filterOptions.asset_responsible_department, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.asset_responsible_department === value,
        },
        {
            title: 'ใช้สำหรับ',
            dataIndex: 'asset_usedfor',
            key: 'asset_usedfor',
            width: 150,
            sorter: (a, b) => String(a.asset_usedfor || '').localeCompare(String(b.asset_usedfor || '')),
            filters: filterOptions.asset_usedfor, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.asset_usedfor === value,
        },
        {
            title: 'สี',
            dataIndex: 'asset_color',
            key: 'asset_color',
            width: 150,
            sorter: (a, b) => String(a.asset_color || '').localeCompare(String(b.asset_color || '')),
            filters: filterOptions.asset_color, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.asset_color === value,
        },
        {
            title: 'ผู้จำหน่าย',
            dataIndex: 'asset_supplier_name',
            key: 'asset_supplier_name',
            width: 150,
            sorter: (a, b) => String(a.asset_supplier_name || '').localeCompare(String(b.asset_supplier_name || '')),
            filters: filterOptions.asset_supplier_name, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.asset_supplier_name === value,
        },
        {
            title: 'แบรนด์',
            dataIndex: 'asset_brand',
            key: 'asset_brand',
            width: 150,
            sorter: (a, b) => String(a.asset_brand || '').localeCompare(String(b.asset_brand || '')),
            filters: filterOptions.asset_brand, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.asset_brand === value,
        },
        {
            title: 'แหล่งที่มา',
            dataIndex: 'asset_source',
            key: 'asset_source',
            width: 150,
            sorter: (a, b) => String(a.asset_source || '').localeCompare(String(b.asset_source || '')),
            filters: filterOptions.asset_source, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.asset_source === value,
        },
        {
            title: 'คุณสมบัติ',
            dataIndex: 'asset_feature',
            key: 'asset_feature',
            width: 150,
            sorter: (a, b) => String(a.asset_feature || '').localeCompare(String(b.asset_feature || '')),
            filters: filterOptions.asset_feature, // ใช้ข้อมูลที่เตรียมไว้แล้ว
            filterSearch: true,
            onFilter: (value, record) => record.asset_feature === value,
        },
    ], [isPrinting, isCanceling, filterOptions]); // เปลี่ยนมาขึ้นอยู่กับ filterOptions แทน tableData

    // --- OPTIMIZATION: ลดการใช้ toLowerCase ในลูปของ filter Search ---
    const filteredRows = useMemo(() => {
        if (!searchTerm) return tableData;
        const lower = searchTerm.toLowerCase();
        return tableData.filter(r =>
            (r.asset_code && r.asset_code.toLowerCase().includes(lower)) ||
            (r.asset_detail && r.asset_detail.toLowerCase().includes(lower)) ||
            (r.asset_lot && r.asset_lot.toLowerCase().includes(lower)) ||
            (r.partCode && r.partCode.toLowerCase().includes(lower))
        );
    }, [tableData, searchTerm]);

    // --- OPTIMIZATION: Memoize selectedRowKeys ป้องกันการ map ใหม่ทุกรอบ ---
    const selectedRowKeysMemo = useMemo(() => selectedRows.map(row => row.asset_code), [selectedRows]);

    const rowSelection = {
        selectedRowKeys: selectedRowKeysMemo,
        onChange: (selectedRowKeys, selectedRowsData) => {
            setSelectedRows(selectedRowsData);
        },
        columnWidth: 50,
        fixed: 'left'
    };

    return (
        <div style={containerStyle} className="bg-slate-50 relative">
            <div className="bg-white px-6 py-2 border-b rounded-md border-gray-300 flex items-center justify-between sticky top-0 z-20 shadow-sm backdrop-blur-sm bg-white/90">
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
                            รายการบรรจุภัณฑ์: {partCode || 'ทั้งหมด'}
                        </Title>
                        <Text className="text-slate-500 text-xs ml-4">
                            {partName || 'แสดงรายการบรรจุภัณฑ์แยกตามรหัส Part Code'}
                        </Text>
                    </div>
                </div>
                <Button type="text" danger icon={<CloseOutlined />} onClick={() => navigate(-1)} className="hover:bg-red-50 rounded-full">ปิด</Button>
            </div>

            <div className="p-2 flex-1 overflow-hidden flex flex-col">
                <Card
                    className="shadow-sm border-gray-200 rounded-md h-full flex flex-col"
                    styles={{ body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
                >
                    <div className="px-5 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-t-xl flex-none">
                        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 flex-wrap">
                            <Input
                                prefix={<SearchOutlined className="text-gray-400" />}
                                placeholder="ค้นหา รหัสบรรจุภัณฑ์, รายละเอียด..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                allowClear
                                variant="borderless"
                                className="w-64 bg-transparent"
                            />
                            <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>

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

                    <div className="w-full h-[400px] md:h-[500px] lg:h-[600px] flex flex-col p-3 flex-1 overflow-hidden">
                        <DraggableTable
                            dataSource={filteredRows}
                            columns={columns}
                            rowKey="asset_code"
                            rowSelection={rowSelection}
                            loading={loading}
                            scroll={{ x: 'max-content', y: '100%' }}
                            pagination={{
                                defaultPageSize: 100,
                                showSizeChanger: true,
                                pageSizeOptions: ['50', '100', '200']
                            }}
                        />
                    </div>
                </Card>
            </div>

            {/* Hidden Print Component */}
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    {printList.map((item, index) => (
                        <div key={index} style={{
                            width: '3cm', height: '3cm', padding: '0.1cm', boxSizing: 'border-box',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid #ddd', overflow: 'hidden', pageBreakAfter: 'always',
                            fontFamily: 'sans-serif', gap: '4px'
                        }}>
                            <div>
                                <QRCodeSVG value={item.label_register} size={90} level={"M"} />
                            </div>
                            <div style={{ textAlign: 'center', overflow: 'hidden' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '5px' }}>
                                    {item.asset_code}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default AssetDetail;