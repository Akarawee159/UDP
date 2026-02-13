import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Form, Input, Button, Row, Col, Card, Image, Typography,
    App, Space, Modal, Divider, Table, Tag, Tooltip
} from 'antd';
import {
    ReloadOutlined, SaveOutlined, ExclamationCircleOutlined,
    InfoCircleOutlined, PictureOutlined, FileAddOutlined,
    CloseOutlined, CheckCircleOutlined, EyeOutlined, SearchOutlined, QrcodeOutlined, CheckCircleFilled,
    ColumnWidthOutlined, ExpandAltOutlined, VerticalAlignTopOutlined, GoldOutlined, DatabaseOutlined,
    CopyOutlined
} from '@ant-design/icons';
import api from "../../../../api";
import { usePermission } from '../../../../hooks/usePermission';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const generateDraftId = () => {
    return 'D-' + Math.random().toString(36).substr(2, 9).toUpperCase() + Date.now().toString(36).toUpperCase().substr(-5);
};

function SystemRepairList({ open, onCancel, targetDraftId }) {
    const { message, modal } = App.useApp();
    const [form] = Form.useForm();

    // --- State ---
    const [draftId, setDraftId] = useState(null);
    const [refID, setRefID] = useState(null);
    const [scannedList, setScannedList] = useState([]);
    const [lastScanned, setLastScanned] = useState({});
    // const [zones, setZones] = useState([]); // [REMOVED] ไม่ใช้แล้ว
    const [loading, setLoading] = useState(false);

    const [selectedIds, setSelectedIds] = useState([]);
    const [expandedKeys, setExpandedKeys] = useState([]);

    const [bookingStatus, setBookingStatus] = useState('150');
    const processingRef = useRef(false);
    const { canUse } = usePermission();

    const getFullImgUrl = (subPath, filename) => {
        if (!filename) return null;
        const baseUrl = api.defaults.baseURL ? api.defaults.baseURL.replace(/\/api\/?$/, '') : '';
        return `${baseUrl}/img/${subPath}/${filename}`;
    };

    const groupedData = useMemo(() => {
        const groups = {};
        scannedList.forEach(item => {
            const key = item.partCode || 'NO_PART_CODE';
            if (!groups[key]) {
                groups[key] = {
                    key: key,
                    partCode: key,
                    asset_detail: item.asset_detail,
                    asset_type: item.asset_type,
                    asset_img: item.asset_img,
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

    useEffect(() => {
        if (groupedData.length > 0) {
            const allKeys = groupedData.map(group => group.key);
            setExpandedKeys(allKeys);
        } else {
            setExpandedKeys([]);
        }
    }, [groupedData]);

    const fetchData = useCallback(async () => {
        if (!open) return;
        setLoading(true);
        try {
            // const resZone = await api.get('/smartpackage/systemrepair/dropdowns'); // [REMOVED]
            // setZones(resZone.data.zones || []);

            const currentDraftId = targetDraftId || draftId;

            if (currentDraftId) {
                const res = await api.get(`/smartpackage/systemrepair/detail?draft_id=${currentDraftId}`);
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
                        objective: 'ทำรายการเบิกขอซ่อม',
                        attendees: booking.attendees || (assets || []).length,
                        booking_remark: booking.booking_remark,
                        // origin: booking.origin, // [REMOVED]
                        // destination: booking.destination // [REMOVED]
                    });
                }
            } else {
                const newId = generateDraftId();
                await api.post('/smartpackage/systemrepair/init-booking', {
                    draft_id: newId,
                    objective: 'ทำรายการเบิกขอซ่อม'
                });

                setDraftId(newId);
                setRefID(null);
                setScannedList([]);
                setLastScanned({});
                setBookingStatus('150');
                form.resetFields();
                form.setFieldsValue({
                    draft_id: newId,
                    objective: 'ทำรายการเบิกขอซ่อม',
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
            setSelectedIds([]);
        }
    }, [open, targetDraftId]);

    useEffect(() => {
        const handleSocketUpdate = (event) => {
            if (!open || !draftId) return;
            const { action, draft_id: incomingDraftId, data } = event.detail || {};

            if (incomingDraftId === draftId) {
                if (action === 'cancel') {
                    message.warning('รายการนี้ถูกยกเลิกโดยผู้ใช้อื่น');
                    onCancel();
                    return;
                }

                if (action === 'finalized' || action === 'output_confirmed') {
                    message.success('รายการนี้ถูกยืนยันการจ่ายออกเรียบร้อยแล้ว');
                    onCancel();
                    return;
                }

                const refreshActions = ['header_update', 'unlocked', 'ref_generated'];

                if (refreshActions.includes(action)) {
                    api.get(`/smartpackage/systemrepair/detail?draft_id=${draftId}`).then(res => {
                        const { booking, assets } = res.data;
                        if (booking) {
                            setBookingStatus(String(booking.is_status));
                            setRefID(booking.refID);
                            form.setFieldsValue({
                                refID: booking.refID,
                                // origin: booking.origin, // [REMOVED]
                                // destination: booking.destination, // [REMOVED]
                                booking_remark: booking.booking_remark,
                                attendees: (assets || []).length
                            });
                        }
                        setScannedList(assets || []);
                    });
                }

                if (action === 'scan' || action === 'return') {
                    api.get(`/smartpackage/systemrepair/list?draft_id=${draftId}`).then(res => {
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
        window.addEventListener('hrms:systemrepair-update', handleSocketUpdate);
        return () => window.removeEventListener('hrms:systemrepair-update', handleSocketUpdate);
    }, [open, draftId, message, form, onCancel]);

    // --- Actions ---

    const handleGenerateRef = async () => {
        if (refID) return;
        try {
            const res = await api.post('/smartpackage/systemrepair/generate-ref', { draft_id: draftId });
            if (res.data.success) {
                const newRef = res.data.data.refID;
                setRefID(newRef);
                form.setFieldsValue({ refID: newRef });
                message.success('สร้างเลขที่ใบเบิกขอซ่อมเรียบร้อย');
            }
        } catch (err) {
            message.error('สร้างเลขที่ใบเบิกขอซ่อมไม่สำเร็จ');
        }
    };

    const handleSaveHeader = async () => {
        try {
            // [MODIFIED] ไม่ validate origin, destination แล้ว
            const values = await form.validateFields(['booking_remark']);
            await api.post('/smartpackage/systemrepair/confirm', {
                draft_id: draftId,
                booking_remark: values.booking_remark,
                // origin: values.origin, // [REMOVED]
                // destination: values.destination // [REMOVED]
            });
            setBookingStatus('151');
            message.success('บันทึกข้อมูลเรียบร้อย พร้อมสำหรับการสแกน');
        } catch (err) {
            message.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    };

    const handleFinalize = async () => {
        // [MODIFIED] ไม่ validate origin, destination
        let values;
        try {
            values = await form.validateFields(['booking_remark']);
        } catch (error) {
            message.error('ตรวจสอบข้อมูลให้ครบถ้วน');
            return;
        }

        modal.confirm({
            title: 'ยืนยันการเบิกขอซ่อม',
            content: 'เมื่อยืนยันแล้วจะไม่สามารถแก้ไขหรือสแกนเพิ่มได้',
            cancelText: 'ยืนยันเบิกขอซ่อม',
            cancelButtonProps: { type: 'primary', className: 'bg-orange-600 hover:bg-orange-500 border-orange-600' },
            okText: 'ยกเลิก',
            okButtonProps: { type: 'default', className: 'text-gray-500 border-gray-300 hover:text-gray-700' },
            maskClosable: false,
            keyboard: false,
            onCancel: async () => {
                try {
                    await api.post('/smartpackage/systemrepair/finalize', {
                        draft_id: draftId,
                        // origin: values.origin, // [REMOVED]
                        // destination: values.destination, // [REMOVED]
                        booking_remark: values.booking_remark
                    });
                    setBookingStatus('152');
                    message.success('เบิกขอซ่อมเรียบร้อย');
                } catch (e) {
                    message.error('Failed: ' + (e.response?.data?.message || e.message));
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
            cancelButtonProps: { type: 'primary', className: 'bg-orange-500 hover:bg-orange-400 border-orange-500' },
            okText: 'ยกเลิก',
            okButtonProps: { type: 'default', className: 'text-gray-500 border-gray-300' },
            maskClosable: false,
            keyboard: false,
            onCancel: async () => {
                try {
                    await api.post('/smartpackage/systemrepair/unlock', { draft_id: draftId });
                    fetchData();
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
                content: 'กรุณา "ยกเลิกเบิกขอซ่อม" (คืนคลัง) รายการสินค้าทั้งหมดในตะกร้าก่อนทำการยกเลิกใบเบิก',
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
                    await api.post('/smartpackage/systemrepair/cancel', { draft_id: draftId });
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
            await api.post('/smartpackage/systemrepair/return', {
                ids: selectedIds,
                draft_id: draftId
            });
            message.success('ยกเลิกเบิกขอซ่อมเรียบร้อย');
            setSelectedIds([]);
        } catch (err) { message.error('Error'); }
    };

    const handleModalClose = async () => {
        if (bookingStatus === '154') {
            // [MODIFIED] ตัดการ check origin/destination ออก
            let values;
            try {
                values = await form.validateFields(['booking_remark']);
            } catch (error) {
                message.error('กรุณาตรวจสอบข้อมูล');
                return;
            }

            modal.confirm({
                title: 'ยืนยันการเบิกขอซ่อม',
                content: 'เมื่อยืนยันแล้วจะไม่สามารถแก้ไขหรือสแกนเพิ่มได้ (ระบบจะบันทึกและปิดหน้าต่าง)',
                cancelText: 'ยืนยันเบิกขอซ่อม',
                cancelButtonProps: { type: 'primary', className: 'bg-orange-600 hover:bg-orange-500 border-orange-600' },
                okText: 'ยกเลิก',
                okButtonProps: { type: 'default', className: 'text-gray-500 border-gray-300 hover:text-gray-700' },
                maskClosable: false,
                keyboard: false,
                onCancel: async () => {
                    try {
                        await api.post('/smartpackage/systemrepair/finalize', {
                            draft_id: draftId,
                            // origin: values.origin, // [REMOVED]
                            // destination: values.destination, // [REMOVED]
                            booking_remark: values.booking_remark
                        });
                        setBookingStatus('152');
                        message.success('เบิกขอซ่อมเรียบร้อย');
                        onCancel();
                    } catch (e) {
                        message.error('Failed: ' + (e.response?.data?.message || e.message));
                        return Promise.reject();
                    }
                },
                onOk: () => { }
            });
            return;
        }
        onCancel();
    };

    const handleScanProcess = async (qrString) => {
        if (!draftId) return;
        if (processingRef.current) return;
        processingRef.current = true;

        if (bookingStatus === '155') {
            modal.warning({
                title: 'ไม่สามารถทำรายการได้',
                content: 'ใบเบิกนี้ยืนยันการเบิกขอซ่อมเรียบร้อยแล้ว ไม่สามารถสแกนเพิ่มหรือแก้ไขได้',
                okText: 'รับทราบ',
                onOk: () => processingRef.current = false
            });
            return;
        }
        if (bookingStatus === '152') {
            modal.warning({ title: 'แจ้งเตือน', content: 'รายการนี้ถูกเบิกขอซ่อมแล้ว ไม่สามารถสแกนเพิ่มเติมได้', okText: 'รับทราบ', onOk: () => processingRef.current = false });
            return;
        }
        if (!refID) {
            modal.warning({ title: 'แจ้งเตือน', content: 'กรุณาสร้างเลขที่ใบเบิกขอซ่อมก่อนทำการสแกน', okText: 'รับทราบ', onOk: () => processingRef.current = false });
            return;
        }
        // [MODIFIED] เปลี่ยนข้อความแจ้งเตือน เพราะไม่ต้องระบุ origin/destination แล้ว
        if (bookingStatus === '150') {
            modal.warning({
                title: 'แจ้งเตือน',
                content: 'กรุณากดปุ่ม "บันทึกข้อมูล" ก่อนทำการสแกน',
                okText: 'รับทราบ',
                onOk: () => processingRef.current = false
            });
            return;
        }

        try {
            const fixedQr = fixThaiInput(qrString);
            const res = await api.post('/smartpackage/systemrepair/scan', {
                qrString: fixedQr,
                draft_id: draftId,
                refID: refID
            });

            if (res.data.success) {
                setLastScanned(res.data.data);
                processingRef.current = false;
            } else {
                const { code, data, message: msg } = res.data;

                // if (code === 'ALREADY_SCANNED') {
                //     modal.confirm({
                //         title: 'ยืนยันการยกเลิกเบิกขอซ่อม',
                //         icon: <ExclamationCircleOutlined />,
                //         content: `ต้องการยกเลิกเบิกขอซ่อม ${data.asset_code} ใช่หรือไม่?`,
                //         cancelText: 'ยกเลิกเบิกขอซ่อม',
                //         cancelButtonProps: { danger: true, type: 'primary' },
                //         okText: 'ปิด',
                //         okButtonProps: { type: 'default' },
                //         onCancel: async () => {
                //             try {
                //                 await api.post('/smartpackage/systemrepair/return-single', {
                //                     asset_code: data.asset_code,
                //                     draft_id: draftId
                //                 });
                //                 message.success('ยกเลิกเบิกขอซ่อมเรียบร้อย');
                //             } catch (e) { message.error('Failed'); }
                //             processingRef.current = false;
                //         },
                //         onOk: () => { processingRef.current = false; },
                //         afterClose: () => { processingRef.current = false; }
                //     });
                // } else 

                // if (code === 'INVALID_STATUS') {
                //     modal.error({
                //         title: 'แจ้งเตือน',
                //         content: `ไม่สามารถสแกนได้ เนื่องจากสินค้านี้ถูกเบิกขอซ่อมไปแล้ว`,
                //         okText: 'รับทราบ',
                //         onOk: () => { processingRef.current = false; },
                //         afterClose: () => { processingRef.current = false; }
                //     });
                // } else if (code === 'INVALID_STATUS_103') {
                //     // [NEW] Case สำหรับเช็คสถานะ 103 และแสดงผลแบบ Dynamic
                //     modal.warning({
                //         title: 'แจ้งเตือน: สถานะไม่ถูกต้อง',
                //         content: (
                //             <div className="flex flex-col gap-2">
                //                 <span className="text-gray-700">สินค้าต้องมีสถานะ <b>"รอแจ้งซ่อม (103)"</b> เท่านั้น</span>
                //                 <div className="bg-red-50 p-2 rounded border border-red-200 mt-1">
                //                     <div className="flex justify-between">
                //                         <span className="text-gray-500">รหัสทรัพย์สิน:</span>
                //                         <span className="font-bold">{data.asset_code}</span>
                //                     </div>
                //                     <div className="flex justify-between mt-1 items-center">
                //                         <span className="text-gray-500">สถานะปัจจุบัน:</span>
                //                         {/* ใช้ dynamic color class จาก backend */}
                //                         <span className={`px-2 py-0.5 rounded text-xs border ${data.asset_status_color || 'bg-gray-200 text-gray-700 border-gray-300'}`}>
                //                             {data.asset_status_name || data.asset_status}
                //                         </span>
                //                     </div>
                //                 </div>
                //             </div>
                //         ),
                //         okText: 'รับทราบ',
                //         okButtonProps: { type: 'primary', danger: true },
                //         onOk: () => { processingRef.current = false; },
                //         afterClose: () => { processingRef.current = false; }
                //     });

                // } else 
                {
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

    const isEditingDisabled = !refID || bookingStatus === '152' || bookingStatus === '155';
    const hasScannedItems = scannedList.length > 0;
    const showSaveCancel = refID && bookingStatus !== '152' && bookingStatus !== '154' && !hasScannedItems;
    const showConfirm = (bookingStatus === '151' || bookingStatus === '154') && hasScannedItems;
    const showCancelButton = bookingStatus !== '152' && !hasScannedItems;
    const isFinalized = bookingStatus === '152' || bookingStatus === '155';

    // ... (Table Columns code remains same) ...
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
                        icon={<EyeOutlined className="text-orange-500 text-lg" />}
                        onClick={(e) => {
                            e.stopPropagation();
                            setLastScanned(record.firstItem);
                        }}
                    />
                </Tooltip>
            )
        },
        { title: 'ลำดับ', key: 'index', width: 60, align: 'center', render: (_, __, index) => index + 1 },
        { title: 'รหัสทรัพย์สิน', dataIndex: 'partCode', key: 'partCode', width: 150, ...getColumnSearchProps('partCode') },
        { title: 'ชื่อทรัพย์สิน', dataIndex: 'asset_detail', key: 'asset_detail', width: 120, ...getColumnSearchProps('asset_detail') },
        { title: 'ประเภท', dataIndex: 'asset_type', key: 'asset_type', width: 120 },
        {
            title: 'จำนวน',
            dataIndex: 'count',
            key: 'count',
            width: 100,
            align: 'center',
            render: (count) => <Tag color="orange" className="text-sm px-2">{count}</Tag>
        },
    ];

    const childColumns = [
        { title: 'ลำดับ', key: 'index', width: 60, align: 'center', render: (_, __, index) => index + 1 },
        { title: 'รหัสทรัพย์สิน', dataIndex: 'asset_code', key: 'asset_code', ...getColumnSearchProps('asset_code') },
        { title: 'ชื่อทรัพย์สิน', dataIndex: 'asset_detail', key: 'asset_detail', ...getColumnSearchProps('asset_detail') },
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
        { title: 'วันที่สแกน', dataIndex: 'scan_at', key: 'scan_at', width: 139, render: (val) => val ? dayjs(val).format('DD/MM/YYYY') : '-' },
        { title: 'เวลา', dataIndex: 'scan_at', key: 'time', width: 90, render: (val) => val ? dayjs(val).format('HH:mm') : '-' },
        { title: 'ผู้ทำรายการ', dataIndex: 'scan_by_name', key: 'scan_by_name' }
    ];

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
                        disabled: bookingStatus === '152' || bookingStatus === '155',
                    }),
                }}
            />
        );
    };

    const customExpandIcon = ({ expanded, onExpand, record }) => {
        return (
            <span
                className={`ant-table-row-expand-icon ${expanded ? 'ant-table-row-expand-icon-expanded' : 'ant-table-row-expand-icon-collapsed'}`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { onExpand(record, e); }}
                onMouseDown={(e) => e.preventDefault()}
            />
        );
    };

    return (
        <Modal
            title={<Title level={4} style={{ margin: 0 }}>{targetDraftId ? 'แก้ไขรายการเบิกขอซ่อม' : 'สร้างรายการเบิกขอซ่อม (System Out)'}</Title>}
            open={open}
            onCancel={handleModalClose}
            width="95%"
            style={{ top: 20 }}
            footer={null}
            destroyOnClose
            maskClosable={false}
            keyboard={false}
        >
            <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-lg" style={{ minHeight: '80vh' }}>
                <Card className="shadow-md border-0 bg-white overflow-hidden" bodyStyle={{ padding: 0 }}>
                    {!lastScanned?.asset_code ? (
                        <div className="flex flex-col items-center justify-center py-12 bg-slate-50/50">
                            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                <QrcodeOutlined className="text-4xl text-orange-500" />
                            </div>
                            <Title level={4} type="secondary" style={{ margin: 0 }}>รอรับข้อมูล</Title>
                            <Text type="secondary">กรุณาสแกน QR Code หรือเลือกรายการจากตาราง</Text>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {/* ... (Asset Details View - Unchanged from original) ... */}
                            <div className="relative overflow-hidden bg-gradient-to-r from-orange-700 via-orange-600 to-orange-500 px-6 py-4 shadow-sm">
                                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl pointer-events-none"></div>
                                <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-orange-400 opacity-20 rounded-full blur-lg pointer-events-none"></div>

                                <div className="relative flex justify-between items-center z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-inner">
                                            <InfoCircleOutlined className="text-white text-xl" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-white font-bold text-lg leading-tight tracking-wide shadow-black drop-shadow-sm">รายละเอียดทรัพย์สิน</span>
                                            <span className="text-orange-100 text-xs font-light tracking-wider opacity-90">Asset Information Details</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Tooltip title="คลิกเพื่อคัดลอกรหัส">
                                            <div
                                                className="group flex items-center gap-2 bg-white text-orange-700 px-3 py-1.5 rounded-lg border border-orange-200 shadow-md cursor-pointer hover:bg-orange-50 transition-all active:scale-95"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(lastScanned.partCode);
                                                    message.success('คัดลอกรหัสเรียบร้อย');
                                                }}
                                            >
                                                <span className="font-mono font-bold text-base tracking-wide select-all">{lastScanned.partCode}</span>
                                                <div className="h-4 w-px bg-orange-200 mx-1"></div>
                                                <CopyOutlined className="text-orange-400 group-hover:text-orange-600 transition-colors" />
                                            </div>
                                        </Tooltip>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6">
                                <Row gutter={[24, 24]}>
                                    <Col xs={24} md={6}>
                                        <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden border border-gray-100 shadow-inner flex items-center justify-center relative group">
                                            {lastScanned.asset_img ? (
                                                <Image
                                                    src={getFullImgUrl('material', lastScanned.asset_img)}
                                                    className="object-cover w-full h-full"
                                                    style={{ height: '100%', width: '100%' }}
                                                    preview={{ mask: <div className="text-white"><EyeOutlined /> ดูภาพขยาย</div> }}
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center text-gray-300">
                                                    <PictureOutlined style={{ fontSize: 48 }} />
                                                    <span className="text-xs mt-2">ไม่มีรูปภาพ</span>
                                                </div>
                                            )}
                                        </div>
                                    </Col>

                                    <Col xs={24} md={10}>
                                        <div className="flex flex-col h-full justify-start gap-4">
                                            <div>
                                                <Text type="secondary" className="text-xs uppercase tracking-wider">ชื่อทรัพย์สิน</Text>
                                                <Title level={4} style={{ margin: 0, color: '#1f2937' }}>{lastScanned.asset_detail || '-'}</Title>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                    <Text type="secondary" className="text-xs block">ประเภท</Text>
                                                    <span className="font-medium text-slate-700">{lastScanned.asset_type || '-'}</span>
                                                </div>
                                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                    <Text type="secondary" className="text-xs block">Part Code</Text>
                                                    <span className="font-medium text-slate-700">{lastScanned.partCode || '-'}</span>
                                                </div>
                                            </div>
                                            {/* ... Drawings ... */}
                                        </div>
                                    </Col>
                                    {/* ... Spec Info ... */}
                                </Row>
                            </div>
                        </div>
                    )}
                </Card>

                <Row gutter={16} className="flex-1">
                    <Col xs={24} md={7}>
                        <Card title="ข้อมูลเบิกขอซ่อม" className="h-full shadow-sm" size="small">
                            <Form layout="vertical" form={form}>
                                <Form.Item label="" style={{ marginBottom: 0 }}>
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
                                        className={refID ? "bg-orange-50 text-orange-700 font-bold" : ""}
                                        addonAfter={
                                            <Button
                                                type="primary"
                                                size="small"
                                                onClick={handleGenerateRef}
                                                disabled={!!refID}
                                                icon={<FileAddOutlined />}
                                            >
                                                สร้างเลขที่ใบเบิกขอซ่อม
                                            </Button>
                                        }
                                    />
                                </Form.Item>

                                <Form.Item label="วัตถุประสงค์" name="objective"><Input readOnly className="bg-gray-100" /></Form.Item>
                                <Form.Item label="จำนวน (รายการ)" name="attendees">
                                    <Input readOnly className="text-center font-bold text-orange-600" disabled={isEditingDisabled} />
                                </Form.Item>
                                <Form.Item label="หมายเหตุ" name="booking_remark">
                                    <Input.TextArea rows={2} disabled={isEditingDisabled} />
                                </Form.Item>

                                {/* [REMOVED] origin and destination Selects */}

                                <Row gutter={8} style={{ marginTop: 16 }}>
                                    {showSaveCancel && !isFinalized && (
                                        <Col span={12}>
                                            <Button type="primary" block icon={<SaveOutlined />} onClick={handleSaveHeader} size="large">
                                                บันทึกข้อมูล
                                            </Button>
                                        </Col>
                                    )}

                                    {showCancelButton && !isFinalized && bookingStatus !== '154' && (
                                        <Col span={showSaveCancel ? 12 : 24}>
                                            <Button type="default" danger block icon={<CloseOutlined />} onClick={handleCancelBooking} size="large">
                                                ยกเลิกใบเบิก
                                            </Button>
                                        </Col>
                                    )}

                                    {(showConfirm || (bookingStatus === '154' && hasScannedItems)) && (
                                        <Col span={24} className="mt-2">
                                            <Button
                                                type="primary"
                                                block
                                                icon={<CheckCircleOutlined />}
                                                onClick={handleFinalize}
                                                size="large"
                                                className="bg-orange-600 hover:bg-orange-500"
                                            >
                                                {bookingStatus === '154' ? 'บันทึกการแก้ไข (เบิกขอซ่อม)' : 'เบิกขอซ่อม (Confirm)'}
                                            </Button>
                                        </Col>
                                    )}
                                </Row>
                            </Form>
                        </Card>
                    </Col>

                    <Col xs={24} md={17}>
                        <div className="bg-white p-4 rounded-lg shadow-sm h-full flex flex-col">
                            <div className="flex justify-between items-center mb-2">
                                <Title level={5} style={{ margin: 0 }}>รายการในตะกร้า ({scannedList.length})</Title>
                                {!isFinalized && (
                                    <Button
                                        danger
                                        icon={<ReloadOutlined />}
                                        onClick={handleReturnToStock}
                                        disabled={selectedIds.length === 0}
                                    >
                                        ยกเลิกเบิกขอซ่อม ({selectedIds.length})
                                    </Button>
                                )}
                            </div>
                            <div className="flex-1 overflow-auto flex flex-col">
                                {bookingStatus === '154' && !hasScannedItems ? (
                                    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
                                        <div className="text-orange-500 mb-4"><ExclamationCircleOutlined style={{ fontSize: 48 }} /></div>
                                        <Title level={5} className="text-gray-700">รายการเบิกปัจจุบัน</Title>
                                        <Text type="secondary">ไม่พบรายการสินค้าในสถานะกำลังแก้ไข</Text>
                                    </div>
                                ) : !hasScannedItems ? (
                                    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-8">
                                        <div className="flex flex-col gap-6 w-full max-w-sm">

                                            <div className={`flex items-center p-4 rounded-xl border-2 transition-all ${refID ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100 shadow-sm'}`}>
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${refID ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                    {refID ? <CheckCircleOutlined style={{ fontSize: 24 }} /> : <FileAddOutlined style={{ fontSize: 24 }} />}
                                                </div>
                                                <div>
                                                    <Text strong className={refID ? 'text-orange-700' : 'text-gray-600'}>
                                                        {refID ? 'สร้างเลขที่ใบเบิกขอซ่อมแล้ว' : 'กรุณาสร้างเลขที่ใบเบิกขอซ่อม'}
                                                    </Text>
                                                </div>
                                            </div>

                                            {/* [MODIFIED] เปลี่ยนข้อความเป็นบันทึกข้อมูลเฉยๆ */}
                                            <div className={`flex items-center p-4 rounded-xl border-2 transition-all ${bookingStatus !== '150' ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100 shadow-sm'}`}>
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${bookingStatus !== '150' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                    {bookingStatus !== '150' ? <CheckCircleOutlined style={{ fontSize: 24 }} /> : <InfoCircleOutlined style={{ fontSize: 24 }} />}
                                                </div>
                                                <div>
                                                    <Text strong className={bookingStatus !== '150' ? 'text-orange-700' : 'text-gray-600'}>
                                                        {bookingStatus !== '150' ? 'บันทึกข้อมูลเรียบร้อย' : 'กรุณากดปุ่ม "บันทึกข้อมูล"'}
                                                    </Text>
                                                </div>
                                            </div>

                                            {bookingStatus !== '150' && refID && (
                                                <div className="mt-6 bg-white border border-orange-100 shadow-sm rounded-lg p-4 flex items-center gap-4 relative overflow-hidden">
                                                    <div className="flex-shrink-0 w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center text-orange-600">
                                                        <QrcodeOutlined style={{ fontSize: '24px' }} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-base font-bold text-gray-700 m-0">ระบบพร้อมสแกน</h4>
                                                            <span className="flex h-2 w-2 relative">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                                            </span>
                                                        </div>
                                                        <p className="text-gray-400 text-sm m-0">สามารถยิงบาร์โค้ดได้เลย</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <Table
                                        columns={parentColumns}
                                        dataSource={groupedData}
                                        expandable={{
                                            expandedRowRender,
                                            expandIcon: customExpandIcon,
                                            expandedRowKeys: expandedKeys,
                                            onExpand: (expanded, record) => {
                                                if (expanded) {
                                                    setExpandedKeys(prev => [...prev, record.key]);
                                                } else {
                                                    setExpandedKeys(prev => prev.filter(k => k !== record.key));
                                                }
                                            }
                                        }}
                                        rowKey="key"
                                        loading={loading}
                                        pagination={false}
                                        bordered
                                        size="middle"
                                        scroll={{ y: 600 }}
                                    />
                                )}
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>
        </Modal>
    );
}
export default SystemRepairList;