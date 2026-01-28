import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Form, Input, Button, Select, Row, Col, Card, Image, Typography,
    App, Space, Descriptions, Modal, Divider, Table, Tag, Tooltip
} from 'antd';
import {
    ReloadOutlined, SaveOutlined, ExclamationCircleOutlined,
    InfoCircleOutlined, PictureOutlined, FileAddOutlined,
    CloseOutlined, CheckCircleOutlined, UnlockOutlined, EyeOutlined, SearchOutlined
} from '@ant-design/icons';
import api from "../../../../api";
// Removed Ag-Grid DataTable import
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const generateDraftId = () => {
    return 'D-' + Math.random().toString(36).substr(2, 9).toUpperCase() + Date.now().toString(36).toUpperCase().substr(-5);
};

function SystemOutList({ open, onCancel, targetDraftId }) {
    const { message, modal } = App.useApp();
    const [form] = Form.useForm();

    // --- State ---
    const [draftId, setDraftId] = useState(null);
    const [refID, setRefID] = useState(null);
    const [scannedList, setScannedList] = useState([]);
    const [lastScanned, setLastScanned] = useState({});
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(false);

    // Selection for Return (Using Asset Codes)
    const [selectedIds, setSelectedIds] = useState([]);

    // Status Logic
    const [bookingStatus, setBookingStatus] = useState('16');
    const processingRef = useRef(false);

    const getFullImgUrl = (subPath, filename) => {
        if (!filename) return null;
        const baseUrl = api.defaults.baseURL ? api.defaults.baseURL.replace(/\/api\/?$/, '') : '';
        return `${baseUrl}/img/${subPath}/${filename}`;
    };

    // --- 1. Data Grouping Logic ---
    const groupedData = useMemo(() => {
        const groups = {};
        scannedList.forEach(item => {
            // Group by partCode (Default to 'Unknown' if missing)
            const key = item.partCode || 'NO_PART_CODE';
            if (!groups[key]) {
                groups[key] = {
                    key: key, // Unique key for Parent Row
                    partCode: key,
                    asset_detail: item.asset_detail,
                    asset_type: item.asset_type,
                    asset_img: item.asset_img, // Keep one image for preview
                    // Keep reference to the first item for "View Detail"
                    firstItem: item,
                    count: 0,
                    childrenList: []
                };
            }
            groups[key].count += 1;
            groups[key].childrenList.push(item);
        });
        return Object.values(groups);
    }, [scannedList]);

    const fetchData = useCallback(async () => {
        if (!open) return;
        setLoading(true);
        try {
            const resZone = await api.get('/smartpackage/systemout/dropdowns');
            setZones(resZone.data.zones || []);

            const currentDraftId = targetDraftId || draftId;

            if (currentDraftId) {
                const res = await api.get(`/smartpackage/systemout/detail?draft_id=${currentDraftId}`);
                const { booking, assets } = res.data;

                setDraftId(currentDraftId);
                setScannedList(assets || []);

                setLastScanned({});

                if (booking) {
                    setRefID(booking.refID);
                    setBookingStatus(String(booking.is_status));
                    form.setFieldsValue({
                        draft_id: booking.draft_id,
                        refID: booking.refID,
                        objective: 'ทำรายการจ่ายออก',
                        attendees: booking.attendees || (assets || []).length,
                        booking_remark: booking.booking_remark,
                        origin: booking.origin,
                        destination: booking.destination
                    });
                }
            } else {
                const newId = generateDraftId();
                await api.post('/smartpackage/systemout/init-booking', { draft_id: newId });

                setDraftId(newId);
                setRefID(null);
                setScannedList([]);
                setLastScanned({});
                setBookingStatus('16');
                form.resetFields();
                form.setFieldsValue({
                    draft_id: newId,
                    objective: 'ทำรายการจ่ายออก',
                    attendees: 0
                });
            }
        } catch (err) {
            console.error(err);
            message.error("Error loading data");
        } finally {
            setLoading(false);
        }
    }, [open, targetDraftId, form, message]);

    useEffect(() => {
        if (open) {
            if (targetDraftId || !draftId) {
                fetchData();
            }
        } else {
            setDraftId(null);
            setScannedList([]);
            setLastScanned({});
            setSelectedIds([]); // Clear selection
        }
    }, [open, targetDraftId]);


    // ✅ Socket Listener
    useEffect(() => {
        const handleSocketUpdate = (event) => {
            if (!open || !draftId) return;
            const { action, draft_id: incomingDraftId, data } = event.detail || {};

            if (incomingDraftId === draftId) {
                if (action === 'header_update' || action === 'finalized' || action === 'unlocked' || action === 'cancel') {
                    api.get(`/smartpackage/systemout/detail?draft_id=${draftId}`).then(res => {
                        const { booking } = res.data;
                        if (booking) setBookingStatus(String(booking.is_status));
                    });
                }

                if (action === 'scan' || action === 'return') {
                    api.get(`/smartpackage/systemout/list?draft_id=${draftId}`).then(res => {
                        setScannedList(res.data.data || []);
                        form.setFieldValue('attendees', (res.data.data || []).length);
                    });

                    if (action === 'scan' && data) {
                        setLastScanned(data);
                        message.success('สแกนสำเร็จ: ' + data.asset_code);
                    }
                }
            }
        };
        window.addEventListener('hrms:systemout-update', handleSocketUpdate);
        return () => window.removeEventListener('hrms:systemout-update', handleSocketUpdate);
    }, [open, draftId, message, form]);


    // --- Actions ---

    const handleGenerateRef = async () => {
        if (refID) return;
        try {
            const res = await api.post('/smartpackage/systemout/generate-ref', { draft_id: draftId });
            if (res.data.success) {
                const newRef = res.data.data.refID;
                setRefID(newRef);
                form.setFieldsValue({ refID: newRef });
                message.success('สร้างเลขที่ใบเบิกเรียบร้อย');
            }
        } catch (err) {
            message.error('สร้างเลขที่ใบเบิกไม่สำเร็จ');
        }
    };

    const handleSaveHeader = async () => {
        try {
            const values = await form.validateFields(['origin', 'destination', 'booking_remark']);
            await api.post('/smartpackage/systemout/confirm', {
                draft_id: draftId,
                booking_remark: values.booking_remark,
                origin: values.origin,
                destination: values.destination
            });
            setBookingStatus('17');
            message.success('บันทึกข้อมูลเรียบร้อย พร้อมสำหรับการสแกน');
        } catch (err) {
            message.error('กรุณาระบุข้อมูลให้ครบถ้วน');
        }
    };

    const handleFinalize = async () => {
        modal.confirm({
            title: 'ยืนยันการจ่ายออก',
            content: 'เมื่อยืนยันแล้วจะไม่สามารถแก้ไขหรือสแกนเพิ่มได้',
            cancelText: 'ยืนยันจ่ายออก',
            cancelButtonProps: { type: 'primary', className: 'bg-green-600 hover:bg-green-500 border-green-600' },
            okText: 'ยกเลิก',
            okButtonProps: { type: 'default', className: 'text-gray-500 border-gray-300 hover:text-gray-700' },
            maskClosable: false,
            keyboard: false,
            onCancel: async () => {
                try {
                    await api.post('/smartpackage/systemout/finalize', { draft_id: draftId });
                    setBookingStatus('18');
                    message.success('จ่ายออกเรียบร้อย');
                } catch (e) {
                    message.error('Failed');
                    return Promise.reject();
                }
            },
            onOk: () => { }
        });
    };

    const handleUnlock = async () => {
        modal.confirm({
            title: 'ยืนยันปลดล็อค',
            content: 'ต้องการปลดล็อคเพื่อแก้ไขข้อมูลใช่หรือไม่?',
            icon: <ExclamationCircleOutlined className="text-orange-500" />,
            cancelText: 'ปลดล็อค',
            cancelButtonProps: { type: 'primary', className: 'bg-blue-500 hover:bg-blue-400 border-blue-500' },
            okText: 'ยกเลิก',
            okButtonProps: { type: 'default', className: 'text-gray-500 border-gray-300' },
            maskClosable: false,
            keyboard: false,
            onCancel: async () => {
                try {
                    await api.post('/smartpackage/systemout/unlock', { draft_id: draftId });
                    setBookingStatus('17');
                    message.success('ปลดล็อคเรียบร้อย');
                } catch (e) {
                    message.error('Failed');
                    return Promise.reject();
                }
            },
            onOk: () => { }
        });
    }

    const handleCancelBooking = async () => {
        if (scannedList.length > 0) {
            modal.warning({
                title: 'ไม่สามารถยกเลิกใบเบิกได้',
                content: 'กรุณา "ยกเลิกจ่ายออก" (คืนคลัง) รายการสินค้าทั้งหมดในตะกร้าก่อนทำการยกเลิกใบเบิก',
                okText: 'รับทราบ'
            });
            return;
        }
        modal.confirm({
            title: 'ยืนยันการยกเลิกใบเบิก',
            content: 'ต้องการยกเลิกใบเบิกนี้ใช่หรือไม่? (สถานะจะถูกเปลี่ยนเป็นยกเลิก)',
            cancelText: 'ยืนยัน',
            cancelButtonProps: { type: 'primary', danger: true },
            okText: 'ปิด',
            okButtonProps: { type: 'default' },
            onCancel: async () => {
                try {
                    await api.post('/smartpackage/systemout/cancel', { draft_id: draftId });
                    message.success('ยกเลิกใบเบิกเรียบร้อย');
                    onCancel();
                } catch (err) {
                    message.error(err.response?.data?.message || 'ยกเลิกไม่สำเร็จ');
                }
            },
            onOk: () => { },
        });
    };

    const handleReturnToStock = async () => {
        if (selectedIds.length === 0) return message.warning('กรุณาเลือกรายการ');
        try {
            await api.post('/smartpackage/systemout/return', {
                ids: selectedIds,
                draft_id: draftId
            });
            message.success('ยกเลิกจ่ายออกเรียบร้อย');
            setSelectedIds([]);
        } catch (err) { message.error('Error'); }
    };

    const handleScanProcess = async (qrString) => {
        if (!draftId) return;
        if (processingRef.current) return;
        processingRef.current = true;

        if (bookingStatus === '18') {
            modal.warning({ title: 'แจ้งเตือน', content: 'รายการนี้ถูกจ่ายออกแล้ว ไม่สามารถสแกนเพิ่มเติมได้', okText: 'รับทราบ', onOk: () => processingRef.current = false });
            return;
        }
        if (!refID) {
            modal.warning({ title: 'แจ้งเตือน', content: 'กรุณาสร้างเลขที่ใบเบิกก่อนทำการสแกน', okText: 'รับทราบ', onOk: () => processingRef.current = false });
            return;
        }
        if (bookingStatus === '16') {
            modal.warning({
                title: 'แจ้งเตือน',
                content: 'กรุณาระบุ ต้นทาง-ปลายทาง และกดปุ่ม "บันทึกข้อมูล" ก่อนทำการสแกน',
                okText: 'รับทราบ',
                onOk: () => processingRef.current = false
            });
            return;
        }

        try {
            const fixedQr = fixThaiInput(qrString);
            const res = await api.post('/smartpackage/systemout/scan', {
                qrString: fixedQr,
                draft_id: draftId,
                refID: refID
            });

            if (res.data.success) {
                setLastScanned(res.data.data);
                processingRef.current = false;
            } else {
                const { code, data, message: msg } = res.data;

                if (code === 'ALREADY_SCANNED') {
                    modal.confirm({
                        title: 'ยืนยันการยกเลิกจ่ายออก',
                        icon: <ExclamationCircleOutlined />,
                        content: `ต้องการยกเลิกจ่ายออก ${data.asset_code} ใช่หรือไม่?`,
                        cancelText: 'ยกเลิกจ่ายออก',
                        cancelButtonProps: { danger: true, type: 'primary' },
                        okText: 'ปิด',
                        okButtonProps: { type: 'default' },
                        onCancel: async () => {
                            try {
                                await api.post('/smartpackage/systemout/return-single', {
                                    asset_code: data.asset_code,
                                    draft_id: draftId
                                });
                                message.success('ยกเลิกจ่ายออกเรียบร้อย');
                            } catch (e) { message.error('Failed'); }
                            processingRef.current = false;
                        },
                        onOk: () => { processingRef.current = false; },
                        afterClose: () => { processingRef.current = false; }
                    });
                } else if (code === 'INVALID_STATUS') {
                    modal.error({
                        title: 'แจ้งเตือน',
                        content: (
                            <div className="flex flex-col gap-3 mt-2">
                                <div className="text-gray-700">
                                    ไม่สามารถสแกนเพื่อจ่ายออกได้ เนื่องจากพบว่า
                                    <div className="font-bold text-black text-lg mt-1">
                                        {data.asset_code}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded border border-gray-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-500 text-sm">สถานะปัจจุบัน:</span>
                                        <span className={`px-2 py-0.5 rounded text-sm border font-medium ${data.asset_status_color || 'bg-gray-200 text-gray-600 border-gray-300'}`}>
                                            {data.asset_status_name || 'ไม่ระบุสถานะ'}
                                        </span>
                                    </div>
                                    {data.refID && (
                                        <div className="text-red-600 text-sm font-semibold">
                                            * อยู่ในใบเบิกเลขที่: {data.refID}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ),
                        okText: 'รับทราบ',
                        okButtonProps: { type: 'primary' },
                        onOk: () => { processingRef.current = false; },
                        afterClose: () => { processingRef.current = false; }
                    });
                } else {
                    message.error(msg);
                    processingRef.current = false;
                }
            }
        } catch (err) {
            message.error(`Scan Error: ${err.message}`);
            processingRef.current = false;
        }
    };

    const fixThaiInput = (str) => {
        if (str.includes('|')) return str;
        const map = { 'ๅ': '1', '/': '2', '-': '3', 'ภ': '4', 'ถ': '5', 'ุ': '6', 'ึ': '7', 'ค': '8', 'ต': '9', 'จ': '0', 'ข': '-', 'ฅ': '|', '%': '|' };
        return str.split('').map(char => map[char] || char).join('');
    };

    useEffect(() => {
        if (!open) return;
        let buffer = '';
        let timeout = null;
        const handleKeyDown = (e) => {
            const openModals = document.querySelectorAll('.ant-modal-wrap:not([style*="display: none"])');
            if (openModals.length > 1 || processingRef.current) {
                return;
            }

            if (e.key === 'Enter') {
                if (buffer.trim().length > 0) handleScanProcess(buffer.trim());
                buffer = '';
                clearTimeout(timeout);
                return;
            }
            if (e.key.length === 1) buffer += e.key;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (buffer.length > 10) handleScanProcess(buffer);
                buffer = '';
            }, 300);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, draftId, refID, bookingStatus]);

    const isEditingDisabled = !refID || bookingStatus === '18';
    const hasScannedItems = scannedList.length > 0;
    const showSaveCancel = refID && bookingStatus !== '18' && !hasScannedItems;
    const showConfirm = bookingStatus === '17' && hasScannedItems;
    const showCancelButton = bookingStatus !== '18' && !hasScannedItems;

    // --- 2. Table Column Definitions ---

    // ฟังก์ชันสำหรับสร้างกล่องค้นหาในตาราง
    const getColumnSearchProps = (dataIndex) => ({
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
            <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
                <Input
                    placeholder={`ค้นหา ${dataIndex}`}
                    value={selectedKeys[0]}
                    onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                    onPressEnter={() => confirm()}
                    style={{ marginBottom: 8, display: 'block' }}
                />
                <Space>
                    <Button
                        type="primary"
                        onClick={() => confirm()}
                        icon={<SearchOutlined />}
                        size="small"
                        style={{ width: 90 }}
                    >
                        ค้นหา
                    </Button>
                    <Button
                        onClick={() => {
                            clearFilters && clearFilters();
                            confirm();
                        }}
                        size="small"
                        style={{ width: 90 }}
                    >
                        ล้างค่า
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered) => (
            <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
        ),
        onFilter: (value, record) =>
            record[dataIndex]
                ? record[dataIndex].toString().toLowerCase().includes(value.toLowerCase())
                : '',
    });

    // Parent Columns (Grouped by PartCode)
    const parentColumns = [
        {
            title: 'ดูรายละเอียด',
            key: 'action',
            width: 120,
            align: 'center',
            render: (_, record) => (
                <Tooltip title="คลิกเพื่อดูรายละเอียด">
                    <Button
                        type="text"
                        icon={<EyeOutlined className="text-blue-500 text-lg" />}
                        onClick={(e) => {
                            e.stopPropagation();
                            // Update the detail card with the representative item of this group
                            setLastScanned(record.firstItem);
                        }}
                    />
                </Tooltip>
            )
        },
        { title: 'ลำดับ', key: 'index', width: 60, align: 'center', render: (_, __, index) => index + 1 },
        { title: 'รหัสทรัพย์สิน', dataIndex: 'partCode', key: 'partCode', width: 150, ...getColumnSearchProps('partCode') },
        {
            title: 'ชื่อทรัพย์สิน',
            dataIndex: 'asset_detail',
            key: 'asset_detail',
            ...getColumnSearchProps('asset_detail')
        },
        { title: 'ประเภท', dataIndex: 'asset_type', key: 'asset_type', width: 120 },
        {
            title: 'จำนวน',
            dataIndex: 'count',
            key: 'count',
            width: 100,
            align: 'center',
            render: (count) => <Tag color="blue" className="text-sm px-2">{count}</Tag>
        },
    ];

    // Child Columns (Individual Scanned Items)
    const childColumns = [
        { title: 'ลำดับ', key: 'index', width: 60, align: 'center', render: (_, __, index) => index + 1 },
        { title: 'รหัสทรัพย์สิน', dataIndex: 'asset_code', key: 'asset_code', ...getColumnSearchProps('asset_code') },
        {
            title: 'ชื่อทรัพย์สิน',
            dataIndex: 'asset_detail',
            key: 'asset_detail',
            ...getColumnSearchProps('asset_detail')
        },
        {
            title: 'สถานะ',
            key: 'status',
            width: 120,
            render: (_, record) => (
                <span className={`px-2 py-1 rounded text-xs border ${record.status_class}`}>
                    {record.status_name}
                </span>
            )
        },
        {
            title: 'วันที่สแกน',
            dataIndex: 'scan_at',
            key: 'scan_at',
            width: 110,
            render: (val) => val ? dayjs(val).format('DD/MM/YYYY') : '-'
        },
        {
            title: 'เวลา',
            dataIndex: 'scan_at',
            key: 'time',
            width: 90,
            render: (val) => val ? dayjs(val).subtract(7, 'hour').format('HH:mm') : '-'
        },
        { title: 'ผู้ทำรายการ', dataIndex: 'scan_by_name', key: 'scan_by_name' }
    ];

    // Child Table Renderer
    const expandedRowRender = (record) => {
        return (
            <Table
                columns={childColumns}
                dataSource={record.childrenList}
                pagination={false}
                rowKey="asset_code"
                size="small"
                bordered
                rowSelection={{
                    selectedRowKeys: selectedIds,
                    onChange: (selectedKeys) => setSelectedIds(selectedKeys),
                    getCheckboxProps: (record) => ({
                        disabled: bookingStatus === '18', // Disable selection if finalized
                    }),
                }}
            />
        );
    };

    // ✅ 1. เพิ่มฟังก์ชันสำหรับสร้างปุ่ม Expand ที่ไม่มีการ Focus
    const customExpandIcon = ({ expanded, onExpand, record }) => {
        return (
            <span
                className={`ant-table-row-expand-icon ${expanded ? 'ant-table-row-expand-icon-expanded' : 'ant-table-row-expand-icon-collapsed'
                    }`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                    onExpand(record, e);
                }}
                // 🔥 จุดสำคัญ: ป้องกันไม่ให้ปุ่มได้รับ Focus เมื่อคลิก
                onMouseDown={(e) => e.preventDefault()}
            />
        );
    };

    return (
        <Modal
            title={<Title level={4} style={{ margin: 0 }}>{targetDraftId ? 'แก้ไขรายการจ่ายออก' : 'สร้างรายการจ่ายออก (System Out)'}</Title>}
            open={open}
            onCancel={onCancel}
            width="95%"
            style={{ top: 20 }}
            footer={null}
            destroyOnClose
            maskClosable={false}
            keyboard={false}
        >
            <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-lg" style={{ minHeight: '80vh' }}>
                <Card
                    className="shadow-sm border-blue-200 bg-blue-50/30"
                    title={<Space><InfoCircleOutlined className="text-blue-600" /> รายละเอียดทรัพย์สิน ({lastScanned?.asset_code || 'กรุณาสแกนหรือเลือกรายการ'})</Space>}
                    size="small"
                >
                    <Row gutter={[16, 16]}>
                        <Col xs={24} md={4} className="flex justify-center items-start">
                            {lastScanned?.asset_img ? (
                                <Image
                                    src={getFullImgUrl('material', lastScanned.asset_img)}
                                    className="rounded-lg border object-cover"
                                    style={{ maxHeight: 200, width: '100%' }}
                                />
                            ) : (
                                <div className="w-full h-40 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                                    <PictureOutlined style={{ fontSize: 40 }} />
                                </div>
                            )}
                        </Col>
                        <Col xs={24} md={10}>
                            <Descriptions column={1} size="small" bordered className="bg-white">
                                <Descriptions.Item label="รหัสทรัพย์สิน">{lastScanned?.asset_code || '-'}</Descriptions.Item>
                                <Descriptions.Item label="ชื่อทรัพย์สิน">{lastScanned?.asset_detail || '-'}</Descriptions.Item>
                                <Descriptions.Item label="ประเภท">{lastScanned?.asset_type || '-'}</Descriptions.Item>
                                <Descriptions.Item label="รายละเอียด">{lastScanned?.asset_remark || '-'}</Descriptions.Item>
                            </Descriptions>
                        </Col>
                        <Col xs={24} md={10}>
                            <Descriptions column={2} size="small" bordered className="bg-white">
                                <Descriptions.Item label="กว้าง">{lastScanned?.asset_width}</Descriptions.Item>
                                <Descriptions.Item label="ยาว">{lastScanned?.asset_length}</Descriptions.Item>
                                <Descriptions.Item label="สูง">{lastScanned?.asset_height}</Descriptions.Item>
                                <Descriptions.Item label="ความจุ">{lastScanned?.asset_capacity}</Descriptions.Item>
                                <Descriptions.Item span={2} label="น้ำหนัก">{lastScanned?.asset_weight}</Descriptions.Item>
                            </Descriptions>
                        </Col>
                        <Col span={24}>
                            <div className="bg-white p-3 rounded border border-gray-100">
                                <Text strong className="mb-2 block text-gray-500 text-xs">ส่วนประกอบชิ้นส่วน (Drawings)</Text>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {[1, 2, 3, 4, 5, 6].map(num => {
                                        const imgName = lastScanned?.[`asset_dmg_00${num}`];
                                        return (
                                            <div key={num} className="w-24 h-24 border border-gray-200 rounded bg-gray-50 flex-shrink-0 flex items-center justify-center overflow-hidden bg-white">
                                                {imgName ? (
                                                    <Image
                                                        src={getFullImgUrl('material/drawing', imgName)}
                                                        className="w-full h-full object-contain"
                                                    />
                                                ) : (
                                                    <Text type="secondary" className="text-xs text-gray-300">No Img</Text>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Card>

                <Row gutter={16} className="flex-1">
                    <Col xs={24} md={7}>
                        <Card title="ข้อมูลจ่ายออก" className="h-full shadow-sm" size="small">
                            <Form layout="vertical" form={form}>

                                <Form.Item label="DRAFT-ID" style={{ marginBottom: 0 }}>
                                    <div className="bg-gray-100 border border-gray-300 rounded px-3 py-1 text-gray-500 select-none cursor-not-allowed">
                                        System Auto Generated (Running)
                                    </div>
                                </Form.Item>
                                <Form.Item name="draft_id" hidden><Input /></Form.Item>
                                <div className="mb-4"></div>

                                <Form.Item label="เลขที่ใบเบิก" name="refID">
                                    <Input
                                        placeholder="กดปุ่มเพื่อสร้าง"
                                        readOnly
                                        className={refID ? "bg-green-50 text-green-700 font-bold" : ""}
                                        addonAfter={
                                            <Button
                                                type="primary"
                                                size="small"
                                                onClick={handleGenerateRef}
                                                disabled={!!refID}
                                                icon={<FileAddOutlined />}
                                            >
                                                สร้างเลขที่ใบเบิก
                                            </Button>
                                        }
                                    />
                                </Form.Item>

                                <Form.Item label="วัตถุประสงค์" name="objective"><Input readOnly className="bg-gray-100" /></Form.Item>
                                <Form.Item label="จำนวน (รายการ)" name="attendees">
                                    <Input readOnly className="text-center font-bold text-blue-600" disabled={isEditingDisabled} />
                                </Form.Item>
                                <Form.Item label="หมายเหตุ" name="booking_remark">
                                    <Input.TextArea rows={2} disabled={isEditingDisabled} />
                                </Form.Item>
                                <Divider />
                                <Form.Item label="ต้นทาง" name="origin" rules={[{ required: true }]}>
                                    <Select options={zones.map(z => ({ label: z.name, value: z.name }))} placeholder="เลือกต้นทาง" disabled={isEditingDisabled} />
                                </Form.Item>
                                <Form.Item label="ปลายทาง" name="destination" rules={[{ required: true }]}>
                                    <Select options={zones.map(z => ({ label: z.name, value: z.name }))} placeholder="เลือกปลายทาง" disabled={isEditingDisabled} />
                                </Form.Item>

                                <Row gutter={8} style={{ marginTop: 16 }}>
                                    {showSaveCancel && (
                                        <Col span={12}>
                                            <Button type="primary" block icon={<SaveOutlined />} onClick={handleSaveHeader} size="large">
                                                บันทึกข้อมูล
                                            </Button>
                                        </Col>
                                    )}

                                    {showCancelButton && (
                                        <Col span={showSaveCancel ? 12 : 24}>
                                            <Button type="default" danger block icon={<CloseOutlined />} onClick={handleCancelBooking} size="large">
                                                ยกเลิกใบเบิก
                                            </Button>
                                        </Col>
                                    )}

                                    {showConfirm && (
                                        <Col span={24} className="mt-2">
                                            <Button type="primary" block icon={<CheckCircleOutlined />} onClick={handleFinalize} size="large" className="bg-green-600 hover:bg-green-500">
                                                จ่ายออก (Confirm)
                                            </Button>
                                        </Col>
                                    )}

                                    {bookingStatus === '18' && (
                                        <Col span={24}>
                                            <Button type="default" block icon={<UnlockOutlined />} onClick={handleUnlock} size="large" className="border-orange-500 text-orange-500 hover:text-orange-600 hover:border-orange-600">
                                                ปลดล็อคเพื่อแก้ไข
                                            </Button>
                                        </Col>
                                    )}
                                </Row>
                            </Form>
                        </Card>
                    </Col>

                    {/* ✅ New Table Implementation */}
                    <Col xs={24} md={17}>
                        <div className="bg-white p-4 rounded-lg shadow-sm h-full flex flex-col">
                            <div className="flex justify-between items-center mb-2">
                                <Title level={5} style={{ margin: 0 }}>รายการในตะกร้า ({scannedList.length})</Title>
                                <Button
                                    danger
                                    icon={<ReloadOutlined />}
                                    onClick={handleReturnToStock}
                                    disabled={selectedIds.length === 0 || bookingStatus === '18'}
                                >
                                    ยกเลิกจ่ายออก ({selectedIds.length})
                                </Button>
                            </div>
                            <div className="flex-1 overflow-auto">
                                <Table
                                    columns={parentColumns}
                                    dataSource={groupedData}
                                    expandable={{
                                        expandedRowRender,
                                        expandIcon: customExpandIcon
                                    }}
                                    rowKey="key"
                                    loading={loading}
                                    pagination={false}
                                    bordered
                                    size="middle"
                                    scroll={{ y: 400 }}
                                />
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>
        </Modal>
    );
}
export default SystemOutList;