import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Form, Input, Button, Select, Row, Col, Card, Image, Typography,
    App, Space, Descriptions, Modal, Divider, Table, Tag, Tooltip, Grid
} from 'antd';
import {
    ReloadOutlined, SaveOutlined, ExclamationCircleOutlined,
    InfoCircleOutlined, PictureOutlined, FileAddOutlined,
    EditOutlined, CheckCircleOutlined, UnlockOutlined, EyeOutlined, SearchOutlined, QrcodeOutlined, CheckCircleFilled,
    ColumnWidthOutlined, ExpandAltOutlined, VerticalAlignTopOutlined, GoldOutlined, DatabaseOutlined, ApartmentOutlined,
    CopyOutlined, UpOutlined, DownOutlined, LeftOutlined, RightOutlined, PrinterOutlined
} from '@ant-design/icons';
import api from "../../../../api";
import { usePermission } from '../../../../hooks/usePermission';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const generateDraftId = () => {
    return 'D-' + Math.random().toString(36).substr(2, 9).toUpperCase() + Date.now().toString(36).toUpperCase().substr(-5);
};

function SystemInList({ open, onCancel, targetDraftId }) {
    const { message, modal } = App.useApp();
    const [form] = Form.useForm();
    const screens = Grid.useBreakpoint();

    // --- State ---
    const [draftId, setDraftId] = useState(null);
    const [refID, setRefID] = useState(null);
    const [scannedList, setScannedList] = useState([]);
    const [lastScanned, setLastScanned] = useState({});
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasActiveItems, setHasActiveItems] = useState(false);

    // Selection for Return (Using Asset Codes)
    const [selectedIds, setSelectedIds] = useState([]);

    const [expandedKeys, setExpandedKeys] = useState([]);

    // --- UX States (สำหรับการยุบ/ขยาย UI) ---
    const [isAssetCollapsed, setIsAssetCollapsed] = useState(true);
    const [isUsageCollapsed, setIsUsageCollapsed] = useState(false);

    // Status Logic
    const [bookingStatus, setBookingStatus] = useState('130');
    const processingRef = useRef(false);
    const { canUse } = usePermission();

    const getFullImgUrl = (subPath, filename) => {
        if (!filename) return null;
        const baseUrl = api.defaults.baseURL ? api.defaults.baseURL.replace(/\/api\/?$/, '') : '';
        return `${baseUrl}/img/${subPath}/${filename}`;
    };

    // --- 1. Data Grouping Logic ---
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
            const resZone = await api.get('/smartpackage/systemin/dropdowns');
            setZones(resZone.data.zones || []);

            const currentDraftId = targetDraftId || draftId;

            if (currentDraftId) {
                const res = await api.get(`/smartpackage/systemin/detail?draft_id=${currentDraftId}`);
                const { booking, assets } = res.data;

                setDraftId(currentDraftId);
                setScannedList(assets || []);
                setHasActiveItems(hasActiveItems || false);
                setLastScanned({});

                if (booking) {
                    setRefID(booking.refID);
                    setBookingStatus(String(booking.is_status));
                    form.setFieldsValue({
                        draft_id: booking.draft_id,
                        refID: booking.refID,
                        objective: 'ทำรายการรับเข้า',
                        attendees: booking.attendees || (assets || []).length,
                        booking_remark: booking.booking_remark,
                        origin: booking.origin,
                        destination: booking.destination
                    });
                }
            } else {
                const newId = generateDraftId();
                await api.post('/smartpackage/systemin/init-booking', {
                    draft_id: newId,
                    objective: 'ทำรายการรับเข้า'
                });

                setDraftId(newId);
                setRefID(null);
                setScannedList([]);
                setLastScanned({});
                setBookingStatus('130');
                form.resetFields();
                form.setFieldsValue({
                    draft_id: newId,
                    objective: 'ทำรายการรับเข้า',
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
            setIsAssetCollapsed(true);
            setIsUsageCollapsed(false);
            setHasActiveItems(false);
        }
    }, [open, targetDraftId]);

    // ✅ Socket Listener
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
                    message.success('รายการนี้ถูกยืนยันการรับเข้าเรียบร้อยแล้ว');
                    onCancel();
                    return;
                }

                const refreshActions = ['header_update', 'unlocked', 'ref_generated'];

                if (refreshActions.includes(action)) {
                    api.get(`/smartpackage/systemin/detail?draft_id=${draftId}`).then(res => {
                        const { booking, assets } = res.data;

                        if (booking) {
                            setBookingStatus(String(booking.is_status));
                            setRefID(booking.refID);
                            form.setFieldsValue({
                                refID: booking.refID,
                                origin: booking.origin,
                                destination: booking.destination,
                                booking_remark: booking.booking_remark,
                                attendees: (assets || []).length
                            });
                        }
                        setScannedList(assets || []);
                        setHasActiveItems(hasActiveItems || false);
                    });
                }

                if (action === 'scan' || action === 'return') {
                    api.get(`/smartpackage/systemin/list?draft_id=${draftId}`).then(res => {
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
        window.addEventListener('hrms:systemin-update', handleSocketUpdate);
        return () => window.removeEventListener('hrms:systemin-update', handleSocketUpdate);
    }, [open, draftId, message, form, onCancel]);

    // --- Actions ---

    const handleGenerateRef = async () => {
        if (refID) return;
        try {
            const res = await api.post('/smartpackage/systemin/generate-ref', { draft_id: draftId });
            if (res.data.success) {
                const newRef = res.data.data.refID;
                setRefID(newRef);
                form.setFieldsValue({ refID: newRef });
                message.success('สร้างเลขที่รับเข้าเรียบร้อย');
            }
        } catch (err) {
            message.error('สร้างเลขที่รับเข้าไม่สำเร็จ');
        }
    };

    const handleSaveHeader = async () => {
        try {
            const values = await form.validateFields(['origin', 'destination', 'booking_remark']);
            const res = await api.post('/smartpackage/systemin/confirm', {
                draft_id: draftId,
                booking_remark: values.booking_remark,
                origin: values.origin,
                destination: values.destination
            });
            if (res.data.data?.refID) {
                setRefID(res.data.data.refID);
                form.setFieldsValue({ refID: res.data.data.refID });
            }
            setBookingStatus('131');
            message.success('บันทึกข้อมูลเรียบร้อย พร้อมสำหรับการสแกน');
        } catch (err) {
            message.error('กรุณาระบุข้อมูลให้ครบถ้วน');
        }
    };

    const handleEditHeader = async () => {
        try {
            await api.post('/smartpackage/systemin/edit-header', { draft_id: draftId });
            setBookingStatus('136');
            message.success('ปลดล็อคข้อมูลรับเข้าเพื่อแก้ไข');
        } catch (err) {
            message.error('เกิดข้อผิดพลาด');
        }
    };

    const handleFinalize = async () => {
        let values;
        try {
            values = await form.validateFields(['origin', 'destination', 'booking_remark']);
        } catch (error) {
            message.error('กรุณาระบุรับเข้าจาก (ปลายทาง)และต้นทางที่รับให้ครบถ้วน');
            return;
        }

        modal.confirm({
            title: 'ยืนยันการรับเข้า',
            content: 'เมื่อยืนยันแล้วระบบจะบันทึกสถานะการรับเข้า',
            cancelText: 'ยืนยันรับเข้า',
            cancelButtonProps: { type: 'primary', className: 'bg-green-600 hover:!bg-green-500 border-green-600' },
            okText: 'ยกเลิก',
            onCancel: async () => {
                try {
                    await api.post('/smartpackage/systemin/finalize', {
                        draft_id: draftId,
                        origin: values.origin,
                        destination: values.destination,
                        booking_remark: values.booking_remark
                    });
                    setBookingStatus('135');
                    message.success('รับเข้าเรียบร้อย');
                } catch (e) {
                    message.error('Failed: ' + (e.response?.data?.message || e.message));
                    return Promise.reject();
                }
            }
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
                    await api.post('/smartpackage/systemin/unlock', { draft_id: draftId });
                    fetchData();
                    message.success('ปลดล็อคเรียบร้อย');
                } catch (e) {
                    // ปรับให้ดึงข้อความจาก Backend มาแสดง (ถ้าไม่มีให้แสดงค่า Default)
                    message.error(e.response?.data?.message || 'เกิดข้อผิดพลาดในการปลดล็อค');
                    return Promise.reject();
                }
            },
            onOk: () => { }
        });
    }

    const handleCancelBooking = async () => {
        if (scannedList.length > 0) {
            modal.warning({
                title: 'ไม่สามารถยกเลิกรับเข้าได้',
                content: 'กรุณา "ยกเลิกรับเข้า" รายการสินค้าทั้งหมดในตะกร้าก่อนทำการยกเลิกรับเข้า',
                okText: 'รับทราบ'
            });
            return;
        }
        modal.confirm({
            title: 'ยืนยันการยกเลิกรับเข้า',
            content: 'ต้องการยกเลิกรับเข้านี้ใช่หรือไม่? (สถานะจะถูกเปลี่ยนเป็นยกเลิก)',
            cancelText: 'ยืนยัน',
            cancelButtonProps: { type: 'primary', danger: true },
            okText: 'ปิด',
            okButtonProps: { type: 'default' },
            onCancel: async () => {
                try {
                    await api.post('/smartpackage/systemin/cancel', { draft_id: draftId });
                    message.success('ยกเลิกรับเข้าเรียบร้อย');
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

        modal.confirm({
            title: 'ยืนยันการยกเลิกรับเข้า',
            content: `คุณต้องการยกเลิกรับเข้ารายการที่เลือกจำนวน ${selectedIds.length} รายการใช่หรือไม่?`,
            // สลับให้ปุ่ม "ยืนยัน" มาอยู่ซ้าย (ตำแหน่ง Cancel) และเป็นสีแดง
            cancelText: 'ยืนยัน',
            cancelButtonProps: { type: 'primary', danger: true },
            // สลับให้ปุ่ม "ปิด" ไปอยู่ขวา (ตำแหน่ง OK)
            okText: 'ปิด',
            okButtonProps: { type: 'default' },
            onCancel: async () => {
                try {
                    await api.post('/smartpackage/systemin/return', {
                        ids: selectedIds,
                        draft_id: draftId
                    });
                    message.success('ยกเลิกรับเข้าเรียบร้อย');
                    setSelectedIds([]);
                } catch (err) {
                    message.error('เกิดข้อผิดพลาดในการยกเลิกรับเข้า');
                }
            },
            onOk: () => {
                // ถ้ากดปิด ไม่ต้องทำอะไร ให้ Modal หายไปเฉยๆ
            }
        });
    };

    const handlePrintPDF = async () => {
        if (selectedIds.length === 0) return message.warning('กรุณาเลือกรายการที่ต้องการพิมพ์');

        try {
            message.loading({ content: 'กำลังสร้างเอกสาร PDF...', key: 'print_pdf' });

            const response = await api.post('/smartpackage/systemin/print-pdf', {
                ids: selectedIds,
                draft_id: draftId
            }, {
                responseType: 'blob' // 📌 จำเป็นมากสำหรับการรับไฟล์ PDF
            });

            // สร้าง URL และเปิด PDF ในแท็บใหม่
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            window.open(url, '_blank');

            message.success({ content: 'สร้างเอกสารสำเร็จ', key: 'print_pdf' });
        } catch (err) {
            console.error(err);
            message.error({ content: 'เกิดข้อผิดพลาดในการสร้างเอกสาร', key: 'print_pdf' });
        }
    };

    const handleModalClose = async () => {
        if (bookingStatus === '134') {
            let values;
            try {
                values = await form.validateFields(['origin', 'destination', 'booking_remark']);
            } catch (error) {
                message.error('กรุณาระบุรับเข้าจาก (ปลายทาง)และต้นทางที่รับให้ครบถ้วน ก่อนทำการปิดหน้าต่าง');
                return;
            }

            try {
                await api.post('/smartpackage/systemin/finalize', {
                    draft_id: draftId,
                    origin: values.origin,
                    destination: values.destination,
                    booking_remark: values.booking_remark
                });

                setBookingStatus('132');
                message.success('บันทึกและรับเข้าเรียบร้อย');
                onCancel();
            } catch (e) {
                message.error('Failed: ' + (e.response?.data?.message || e.message));
            }
            return;
        }

        onCancel();
    };

    const handleScanProcess = async (qrString) => {
        if (!draftId) return;
        if (processingRef.current) return;
        processingRef.current = true;

        if (bookingStatus === '135') {
            modal.warning({
                title: 'ไม่สามารถทำรายการได้',
                content: 'นี้รับเข้าเรียบร้อยแล้ว ไม่สามารถสแกนเพิ่มหรือแก้ไขได้',
                okText: 'รับทราบ',
                onOk: () => processingRef.current = false
            });
            return;
        }
        if (bookingStatus === '136') {
            modal.warning({
                title: 'ไม่สามารถทำรายการได้',
                content: 'ตะกร้าถูกล็อค กรุณากด "บันทึกข้อมูล" ทางซ้ายมือก่อนทำการสแกน',
                okText: 'รับทราบ',
                onOk: () => processingRef.current = false
            });
            return;
        }
        if (bookingStatus === '130') {
            modal.warning({
                title: 'แจ้งเตือน',
                content: 'กรุณาระบุ รับเข้าจาก (ปลายทาง)-ต้นทางที่รับ และกดปุ่ม "บันทึกข้อมูล" ก่อนทำการสแกน',
                okText: 'รับทราบ',
                onOk: () => processingRef.current = false
            });
            return;
        }

        try {
            const fixedQr = fixThaiInput(qrString);
            const res = await api.post('/smartpackage/systemin/scan', {
                qrString: fixedQr,
                draft_id: draftId,
                refID: refID
            });

            if (res.data.success) {
                setLastScanned(res.data.data);
                processingRef.current = false;

                // ถ้ายุบหน้าต่างบรรจุภัณฑ์อยู่ ให้กางออกอัตโนมัติเพื่อให้เห็นว่าสแกนอะไรได้
                // if (isAssetCollapsed) setIsAssetCollapsed(false);

            } else {
                const { code, data, message: msg } = res.data;
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
        if (!/[ก-๛]/.test(str)) {
            return str;
        }

        const map = {
            'ๅ': '1', '/': '2', '-': '3', 'ภ': '4', 'ถ': '5', 'ุ': '6', 'ึ': '7', 'ค': '8', 'ต': '9', 'จ': '0', 'ข': '-', 'ช': '=',
            'ๆ': 'q', 'ไ': 'w', 'ำ': 'e', 'พ': 'r', 'ะ': 't', 'ั': 'y', 'ี': 'u', 'ร': 'i', 'น': 'o', 'ย': 'p', 'บ': '[', 'ล': ']', 'ฃ': '\\',
            'ฟ': 'a', 'ห': 's', 'ก': 'd', 'ด': 'f', 'เ': 'g', '้': 'h', '่': 'j', 'า': 'k', 'ส': 'l', 'ว': ';', 'ง': '\'',
            'ผ': 'z', 'ป': 'x', 'แ': 'c', 'อ': 'v', 'ิ': 'b', 'ื': 'n', 'ท': 'm', 'ม': ',', 'ใ': '.', 'ฝ': '/',
            '+': '!', '๑': '@', '๒': '#', '๓': '$', '๔': '%', 'ู': '^', '฿': '&', '๕': '*', '๖': '(', '๗': ')', '๘': '_', '๙': '+',
            '๐': 'Q', '"': 'W', 'ฎ': 'E', 'ฑ': 'R', 'ธ': 'T', 'ํ': 'Y', '๊': 'U', 'ณ': 'I', 'ฯ': 'O', 'ญ': 'P', 'ฐ': '{', ',': '}', 'ฅ': '|',
            'ฤ': 'A', 'ฆ': 'S', 'ฏ': 'D', 'โ': 'F', 'ฌ': 'G', '็': 'H', '๋': 'J', 'ษ': 'K', 'ศ': 'L', 'ซ': ':', '.': '"',
            '(': 'Z', ')': 'X', 'ฉ': 'C', 'ฮ': 'V', 'ฺ': 'B', '์': 'N', '?': 'M', 'ฒ': '<', 'ฬ': '>', 'ฦ': '?'
        };

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
    }, [open, draftId, refID, bookingStatus, isAssetCollapsed]);

    // ปิด Form (Header) ถ้าสถานะเป็น 131 หรือ 135
    const isEditingDisabled = bookingStatus === '131' || bookingStatus === '135';
    // ปิดตาราง (Cart) ห้ามติ๊กคืนของ ถ้าเป็น 130, 136 หรือ 135
    const isCartDisabled = bookingStatus === '130' || bookingStatus === '136' || bookingStatus === '135';
    const hasScannedItems = scannedList.length > 0;

    // ล็อคฟิลด์ตาม Logic ของ SystemInList 100%
    const isOriginDisabled = isEditingDisabled || (bookingStatus === '136' && hasScannedItems);
    const isDestinationDisabled = isEditingDisabled;

    const showSaveCancel = refID && bookingStatus !== '132' && bookingStatus !== '134' && !hasScannedItems;
    const showConfirm = (bookingStatus === '131' || bookingStatus === '134') && hasScannedItems;
    const showCancelButton = bookingStatus !== '132' && !hasScannedItems;
    const isFinalized = bookingStatus === '132' || bookingStatus === '135';

    // --- 2. Table Column Definitions ---

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
            title: '',
            key: 'action',
            width: 20,
            align: 'center',
            render: (_, record) => (
                <Tooltip title="คลิกเพื่อดูรายละเอียด">
                    <Button
                        type="text"
                        icon={<EyeOutlined className="text-blue-500 text-lg" />}
                        onClick={(e) => {
                            e.stopPropagation();
                            setLastScanned(record.firstItem);
                            if (isAssetCollapsed) setIsAssetCollapsed(false);
                        }}
                    />
                </Tooltip>
            )
        },
        {
            title: 'รหัส',
            dataIndex: 'partCode',
            key: 'partCode',
            width: screens.lg ? 300 : 150,
            ...getColumnSearchProps('partCode')
        },
        {
            title: 'ชื่อทรัพย์สิน',
            dataIndex: 'asset_detail',
            key: 'asset_detail',
            width: 120,
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

    const childColumns = [
        {
            title: 'รหัสบรรจุภัณฑ์',
            dataIndex: 'asset_code',
            key: 'asset_code',
            width: screens.lg ? 300 : 100,
            ...getColumnSearchProps('asset_code'),
            render: (text) => (
                <div className="whitespace-normal break-all min-w-[150px] sm:min-w-[auto] sm:break-words">
                    {text}
                </div>
            )
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
            width: 130,
            render: (val) => val ? dayjs(val).format('DD/MM/YYYY') : '-'
        },
        {
            title: 'เวลา',
            dataIndex: 'scan_at',
            key: 'time',
            width: 90,
            render: (val) => val ? dayjs(val).format('HH:mm') : '-'
        },
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
                scroll={{ x: 'max-content' }}
                rowSelection={{
                    selectedRowKeys: selectedIds,
                    onChange: (selectedKeys) => setSelectedIds(selectedKeys),
                    getCheckboxProps: (record) => ({
                        disabled: bookingStatus === '132' || bookingStatus === '135',
                    }),
                }}
            />
        );
    };

    const customExpandIcon = ({ expanded, onExpand, record }) => {
        return (
            <span
                className={`ant-table-row-expand-icon ${expanded ? 'ant-table-row-expand-icon-expanded' : 'ant-table-row-expand-icon-collapsed'
                    }`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                    onExpand(record, e);
                }}
                onMouseDown={(e) => e.preventDefault()}
            />
        );
    };

    return (
        <Modal
            title={<Title level={4} className="m-0 text-base sm:text-lg lg:text-xl">{targetDraftId ? 'แก้ไขรายการรับเข้า' : 'สร้างรายการรับเข้า (System In)'}</Title>}
            open={open}
            onCancel={handleModalClose}
            width="100%"
            style={{ top: 0, padding: 0, margin: 0, maxWidth: '100vw' }}
            styles={{
                content: { borderRadius: 0, height: '100vh', display: 'flex', flexDirection: 'column' },
                body: { flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '12px 16px', backgroundColor: '#f8fafc', gap: '16px' }
            }}
            footer={null}
            destroyOnHidden
            maskClosable={false}
            keyboard={false}
        >
            {/* --- TOP SECTION: ข้อมูลทรัพย์สิน (ยุบขึ้นบน) --- */}
            <div className="flex-shrink-0 transition-all duration-300 w-full bg-white shadow-sm border border-gray-100 rounded-md overflow-hidden">
                <div
                    className="flex justify-between items-center px-4 py-2 bg-white border-b border-gray-100 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setIsAssetCollapsed(!isAssetCollapsed)}
                >
                    <div className="flex items-center gap-2 text-slate-700">
                        <InfoCircleOutlined className="text-blue-500" />
                        <span className="font-semibold text-sm sm:text-base">ข้อมูลรายละเอียดบรรจุภัณฑ์ล่าสุด</span>
                    </div>
                    <Button
                        type="text"
                        size="small"
                        className="text-gray-500 pointer-events-none"
                        icon={isAssetCollapsed ? <DownOutlined /> : <UpOutlined />}
                    />
                </div>

                <div className={`${isAssetCollapsed ? 'hidden' : 'block'}`}>
                    {!lastScanned?.asset_code ? (
                        <div className="flex flex-col items-center justify-center py-8 sm:py-12 bg-slate-50/50">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                <QrcodeOutlined className="text-3xl sm:text-4xl text-blue-500" />
                            </div>
                            <Title level={4} type="secondary" className="m-0 text-center text-sm sm:text-base">รอรับข้อมูล</Title>
                            <Text type="secondary" className="text-xs sm:text-sm text-center">กรุณาสแกน QR Code หรือเลือกรายการจากตาราง</Text>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 px-4 sm:px-6 py-3 sm:py-4 shadow-sm">
                                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl pointer-events-none"></div>
                                <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-blue-400 opacity-20 rounded-full blur-lg pointer-events-none"></div>

                                <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center z-10 gap-3 sm:gap-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-inner">
                                            <PictureOutlined className="text-white text-lg sm:text-xl" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-white font-bold text-base sm:text-lg leading-tight tracking-wide shadow-black drop-shadow-sm">
                                                {lastScanned.asset_detail || 'รายละเอียดทรัพย์สิน'}
                                            </span>
                                            <span className="text-blue-100 text-[10px] sm:text-xs font-light tracking-wider opacity-90">
                                                {lastScanned.asset_type || 'Asset Information Details'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-auto">
                                        <Tooltip title="คลิกเพื่อคัดลอกรหัส">
                                            <div
                                                className="group flex items-center gap-2 bg-white text-blue-700 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-blue-200 shadow-md cursor-pointer hover:bg-blue-50 transition-all active:scale-95"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(lastScanned.partCode);
                                                    message.success('คัดลอกรหัสเรียบร้อย');
                                                }}
                                            >
                                                <span className="font-mono font-bold text-sm sm:text-base tracking-wide select-all">
                                                    {lastScanned.partCode}
                                                </span>
                                                <div className="h-4 w-px bg-blue-200 mx-1"></div>
                                                <CopyOutlined className="text-blue-400 group-hover:text-blue-600 transition-colors text-sm sm:text-base" />
                                            </div>
                                        </Tooltip>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 sm:p-6 bg-white">
                                <Row gutter={[16, 24]}>
                                    <Col xs={24} sm={10} md={8} lg={6} xl={5}>
                                        <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden border border-gray-100 shadow-inner flex items-center justify-center relative group">
                                            {lastScanned.asset_img ? (
                                                <Image
                                                    src={getFullImgUrl('material', lastScanned.asset_img)}
                                                    className="object-cover w-full h-full"
                                                    style={{ height: '100%', width: '100%' }}
                                                    preview={{ mask: <div className="text-white text-xs sm:text-sm"><EyeOutlined /> ดูภาพขยาย</div> }}
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center text-gray-300">
                                                    <PictureOutlined style={{ fontSize: 40 }} className="sm:text-5xl" />
                                                    <span className="text-xs mt-2">ไม่มีรูปภาพ</span>
                                                </div>
                                            )}
                                        </div>
                                    </Col>

                                    <Col xs={24} sm={14} md={16} lg={10} xl={11}>
                                        <div className="flex flex-col h-full justify-start gap-3 sm:gap-4">
                                            <div>
                                                <Text type="secondary" className="text-[10px] sm:text-xs uppercase tracking-wider">ชื่อทรัพย์สิน</Text>
                                                <Title level={4} className="m-0 text-gray-800 text-lg sm:text-xl">
                                                    {lastScanned.asset_detail || '-'}
                                                </Title>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                                <div className="bg-slate-50 p-2 sm:p-3 rounded-lg border border-slate-100">
                                                    <Text type="secondary" className="text-[10px] sm:text-xs block">ประเภท</Text>
                                                    <span className="font-medium text-slate-700 text-sm sm:text-base">{lastScanned.asset_type || '-'}</span>
                                                </div>
                                                <div className="bg-slate-50 p-2 sm:p-3 rounded-lg border border-slate-100">
                                                    <Text type="secondary" className="text-[10px] sm:text-xs block">Part Code</Text>
                                                    <span className="font-medium text-slate-700 text-sm sm:text-base">{lastScanned.partCode || '-'}</span>
                                                </div>
                                            </div>

                                            <div>
                                                <Text type="secondary" className="text-[10px] sm:text-xs block mb-1">รายละเอียดเพิ่มเติม</Text>
                                                <div className="bg-white p-2 sm:p-3 rounded-lg border border-gray-200 text-gray-600 text-xs sm:text-sm min-h-[60px] sm:min-h-[80px]">
                                                    {lastScanned.asset_remark || <span className="text-gray-300 italic">ไม่ระบุรายละเอียด</span>}
                                                </div>
                                            </div>
                                            <div className="mt-2 pt-3 sm:pt-4 border-t border-gray-100">
                                                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                                                    <FileAddOutlined className="text-blue-500" />
                                                    <Text strong className="text-gray-600 text-xs sm:text-sm">ส่วนประกอบชิ้นส่วน (Drawings)</Text>
                                                </div>

                                                <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                                    {[1, 2, 3, 4, 5, 6].map(num => {
                                                        const imgName = lastScanned?.[`asset_dmg_00${num}`];
                                                        if (!imgName) return null;

                                                        return (
                                                            <div key={num} className="w-16 h-16 sm:w-20 sm:h-20 border border-gray-200 rounded-lg bg-white flex-shrink-0 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative">
                                                                <Image
                                                                    src={getFullImgUrl('material/drawing', imgName)}
                                                                    className="w-full h-full object-contain p-1"
                                                                    preview={{ mask: <EyeOutlined className="text-sm" /> }}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                    {![1, 2, 3, 4, 5, 6].some(n => lastScanned?.[`asset_dmg_00${n}`]) && (
                                                        <div className="w-full text-center py-3 sm:py-4 bg-gray-50 rounded border border-dashed border-gray-300 text-gray-500 text-[10px] sm:text-xs">
                                                            ไม่พบข้อมูล Drawing
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Col>

                                    <Col xs={24} md={24} lg={8} xl={8}>
                                        <div className="bg-white rounded-xl border border-gray-200 h-full shadow-sm overflow-hidden flex flex-col">
                                            <div className="bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-100 flex items-center gap-2">
                                                <ApartmentOutlined className="text-blue-500" />
                                                <span className="font-semibold text-gray-700 text-xs sm:text-sm">ข้อมูลจำเพาะ (Spec)</span>
                                            </div>

                                            <div className="p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 h-full justify-center">
                                                <div>
                                                    <Text type="secondary" className="text-xs sm:text-[14px] text-gray-700 uppercase tracking-wide mb-2 block pl-1">
                                                        ขนาด (Dimensions)
                                                    </Text>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 flex flex-col items-center justify-center">
                                                            <ColumnWidthOutlined className="text-blue-400 text-xs mb-1" />
                                                            <span className="text-[10px] sm:text-[14px] text-gray-700">กว้าง</span>
                                                            <div className="font-bold text-gray-700 text-xs sm:text-base text-center">
                                                                {lastScanned.asset_width || '-'} <span className="text-[10px] sm:text-[14px] font-normal text-gray-700">{lastScanned.asset_width_unit}</span>
                                                            </div>
                                                        </div>
                                                        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 flex flex-col items-center justify-center">
                                                            <ExpandAltOutlined className="text-blue-400 text-xs mb-1" />
                                                            <span className="text-[10px] sm:text-[14px] text-gray-700">ยาว</span>
                                                            <div className="font-bold text-gray-700 text-xs sm:text-base text-center">
                                                                {lastScanned.asset_length || '-'} <span className="text-[10px] sm:text-[14px] font-normal text-gray-700">{lastScanned.asset_length_unit}</span>
                                                            </div>
                                                        </div>
                                                        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 flex flex-col items-center justify-center">
                                                            <VerticalAlignTopOutlined className="text-blue-400 text-xs mb-1" />
                                                            <span className="text-[10px] sm:text-[14px] text-gray-700">สูง</span>
                                                            <div className="font-bold text-gray-700 text-xs sm:text-base text-center">
                                                                {lastScanned.asset_height || '-'} <span className="text-[10px] sm:text-[14px] font-normal text-gray-700">{lastScanned.asset_height_unit}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="h-px bg-gray-100 w-full"></div>

                                                <div>
                                                    <Text type="secondary" className="text-xs sm:text-[14px] text-gray-700 uppercase tracking-wide mb-2 block pl-1">
                                                        คุณสมบัติ (Properties)
                                                    </Text>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2 sm:gap-3">
                                                        <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm transition-all">
                                                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 flex-shrink-0">
                                                                <GoldOutlined className="text-xs sm:text-base" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] sm:text-[14px] text-gray-700">น้ำหนัก</span>
                                                                <span className="font-bold text-gray-700 text-sm sm:text-base leading-none">
                                                                    {lastScanned.asset_weight || '-'} <span className="text-[10px] sm:text-xs font-normal text-gray-700">{lastScanned.asset_weight_unit}</span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm transition-all">
                                                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-500 flex-shrink-0">
                                                                <DatabaseOutlined className="text-xs sm:text-base" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] sm:text-[14px] text-gray-700">ความจุ</span>
                                                                <span className="font-bold text-gray-700 text-sm sm:text-base leading-none">
                                                                    {lastScanned.asset_capacity || '-'} <span className="text-[10px] sm:text-xs font-normal text-gray-700">{lastScanned.asset_capacity_unit}</span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- BOTTOM SECTION: ข้อมูลรับเข้า (ซ้าย) & ตะกร้า (ขวา) --- */}
            <div className="flex flex-col lg:flex-row gap-4 w-full">

                {/* 1. LEFT PANEL: ข้อมูลรับเข้า (ย่อ/ขยายได้) */}
                <div className={`transition-all duration-300 ease-in-out flex flex-col bg-white shadow-sm border border-gray-100 rounded-md flex-shrink-0
                    ${isUsageCollapsed
                        ? 'h-[40px] lg:w-[48px] overflow-hidden'
                        : 'h-auto w-full lg:w-[320px] xl:w-[380px]'
                    }`}
                >
                    <div
                        className="flex justify-between items-center px-3 py-2 bg-white border-b border-gray-100 cursor-pointer hover:bg-slate-50 transition-colors flex-shrink-0 h-[40px]"
                        onClick={() => setIsUsageCollapsed(!isUsageCollapsed)}
                    >
                        <div className={`flex items-center gap-2 text-slate-700 ${isUsageCollapsed ? 'lg:hidden' : ''}`}>
                            <EditOutlined className="text-blue-500" />
                            <span className="font-semibold text-sm sm:text-base whitespace-nowrap">ข้อมูลรับเข้า</span>
                        </div>
                        <Button
                            type="text"
                            size="small"
                            className={`text-gray-500 pointer-events-none p-0 flex items-center justify-center ${isUsageCollapsed ? 'mx-auto' : ''}`}
                            icon={isUsageCollapsed
                                ? <RightOutlined className="rotate-90 lg:rotate-0" />
                                : <LeftOutlined className="rotate-90 lg:rotate-0" />
                            }
                        />
                    </div>

                    <div className={`${isUsageCollapsed ? 'hidden' : 'block'} p-3 sm:p-4`}>
                        <Form layout="vertical" form={form}>
                            <Form.Item label={<span className="text-xs sm:text-sm">รับเข้าจาก (ปลายทาง)</span>} name="origin" rules={[{ required: true }]}>
                                <Select
                                    showSearch
                                    optionFilterProp="label"
                                    filterOption={(input, option) =>
                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    options={zones.map(s => ({
                                        label: `${s.code} - ${s.name}`,
                                        value: s.code
                                    }))}
                                    placeholder="ค้นหารหัส หรือชื่อผู้จัดจำหน่าย"
                                    disabled={isOriginDisabled}
                                />
                            </Form.Item>

                            <Form.Item label={<span className="text-xs sm:text-sm">ต้นทางที่รับ</span>} name="destination" rules={[{ required: true }]}>
                                <Select
                                    showSearch
                                    optionFilterProp="label"
                                    filterOption={(input, option) =>
                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    options={zones.map(s => ({
                                        label: `${s.code} - ${s.name}`,
                                        value: s.code
                                    }))}
                                    placeholder="ค้นหารหัส หรือชื่อผู้จัดจำหน่าย"
                                    disabled={isDestinationDisabled}
                                />
                            </Form.Item>

                            <Form.Item label={<span className="text-xs sm:text-sm">หมายเหตุ</span>} name="booking_remark">
                                <Input.TextArea rows={2} disabled={isDestinationDisabled} />
                            </Form.Item>

                            <Row gutter={[8, 8]} style={{ marginTop: 16 }}>
                                {(bookingStatus === '130' || bookingStatus === '136') && (
                                    <>
                                        <Col xs={24} sm={14} lg={24} xl={14}>
                                            <Button type="primary" block icon={<SaveOutlined />} onClick={handleSaveHeader} size="large" className="rounded-md text-sm sm:text-base">
                                                บันทึกข้อมูล
                                            </Button>
                                        </Col>
                                        <Col xs={24} sm={10} lg={24} xl={10}>
                                            <Button danger block onClick={handleCancelBooking} size="large" className="rounded-md text-sm sm:text-base">
                                                ยกเลิกรับเข้า
                                            </Button>
                                        </Col>
                                    </>
                                )}

                                {bookingStatus === '131' && (
                                    <>
                                        <Col xs={24} sm={12} lg={24} xl={12}>
                                            <Button type="primary" block icon={<CheckCircleOutlined />} onClick={handleFinalize} size="large" className="!bg-green-600 hover:!bg-green-500 rounded-md px-0 text-xs sm:text-sm" disabled={scannedList.length === 0}>
                                                ยืนยันการรับเข้า
                                            </Button>
                                        </Col>
                                        <Col xs={24} sm={12} lg={24} xl={12}>
                                            <Button type="default" block icon={<EditOutlined />} onClick={handleEditHeader} size="large" className="border-blue-500 text-blue-500 rounded-md px-0 text-xs sm:text-sm">
                                                แก้ไขข้อมูล
                                            </Button>
                                        </Col>
                                        <Col span={24}>
                                            <Button danger block onClick={handleCancelBooking} size="large" className="rounded-md text-sm sm:text-base mt-1">
                                                ยกเลิกรับเข้า
                                            </Button>
                                        </Col>
                                    </>
                                )}

                                {/* กรณีสถานะ 135 (รับเข้าสมบูรณ์) */}
                                {bookingStatus === '135' && canUse('system-out:unlock') && (
                                    <Col span={24}>
                                        {!hasActiveItems ? (    // ✅ ถ้าไม่มีข้อมูลสถานะ 108 ให้ขึ้นตัวแดง
                                            <div className="text-red-500 text-center font-medium mt-2 text-sm sm:text-base">
                                                ไม่สามารถแก้ไขได้ เนื่องไม่พบรายการ
                                            </div>
                                        ) : (
                                            <Button type="default" block icon={<UnlockOutlined />} onClick={handleUnlock} size="large" className="border-orange-500 text-orange-500 hover:!text-orange-600 hover:!border-orange-600 rounded-md text-sm sm:text-base">
                                                ปลดล็อคเพื่อแก้ไข
                                            </Button>
                                        )}
                                    </Col>
                                )}

                                {bookingStatus === '134' && (
                                    <Col span={24}>
                                        <Button type="primary" block icon={<CheckCircleOutlined />} onClick={handleFinalize} size="large" className="bg-green-600 hover:bg-green-500 rounded-md text-sm sm:text-base">
                                            แก้ไขแล้ว/ยืนยันรับเข้า
                                        </Button>
                                    </Col>
                                )}
                            </Row>

                            <Divider className="my-3 sm:my-4" />

                            <Form.Item name="draft_id" hidden><Input /></Form.Item>
                            <Form.Item name="refID" hidden><Input /></Form.Item>
                            <Form.Item name="objective" hidden><Input /></Form.Item>
                            <Form.Item name="attendees" hidden><Input /></Form.Item>
                        </Form>
                    </div>
                </div>

                {/* 2. RIGHT PANEL: รายการในตะกร้า (Table) */}
                <div className="flex-1 bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-2 gap-2 sm:gap-0 flex-shrink-0">
                        <Title level={5} className="m-0 text-base sm:text-lg">รายการในตะกร้า ({scannedList.length})</Title>
                        <Space>
                            {/* แสดงเฉพาะจอ lg ขึ้นไป */}
                            {screens.lg && (
                                <Button
                                    type="primary"
                                    className="bg-blue-600 hover:bg-blue-500"
                                    icon={<PrinterOutlined />}
                                    onClick={handlePrintPDF}
                                    disabled={selectedIds.length === 0}
                                >
                                    พิมพ์ใบรับเข้า ({selectedIds.length})
                                </Button>
                            )}

                            {!isFinalized && bookingStatus !== '134' && (
                                <Button
                                    danger
                                    icon={<ReloadOutlined />}
                                    onClick={handleReturnToStock}
                                    disabled={selectedIds.length === 0}
                                    className="w-full sm:w-auto text-xs sm:text-sm"
                                >
                                    ยกเลิกรับเข้า ({selectedIds.length})
                                </Button>
                            )}
                        </Space>
                    </div>

                    <div className="flex-1 flex flex-col w-full">
                        {bookingStatus === '134' && !hasScannedItems ? (
                            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-4 sm:p-8 text-center h-full">
                                <div className="text-orange-500 mb-3 sm:mb-4">
                                    <ExclamationCircleOutlined className="text-4xl sm:text-5xl" />
                                </div>
                                <Title level={5} className="text-gray-700 text-sm sm:text-base">
                                    รายการรับเข้าปัจจุบัน
                                </Title>
                                <Text type="secondary" className="text-xs sm:text-sm">
                                    ไม่พบรายการสินค้าในสถานะกำลังแก้ไข
                                    <br />
                                    (ระบบกำลังตรวจสอบรายการจาก RefID: {refID})
                                </Text>
                                <div className="mt-3 sm:mt-4">
                                    <Tag color="orange" className="text-xs sm:text-sm">Status: Unlocked (134)</Tag>
                                </div>
                                <div className="mt-4 sm:mt-6 text-[10px] sm:text-xs text-gray-400">
                                    * หากปิดหน้าต่างนี้ ระบบจะปรับสถานะเป็น "รับเข้า" โดยอัตโนมัติ
                                </div>
                            </div>
                        ) : !hasScannedItems ? (
                            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-4 sm:p-8 h-full">
                                <div className="flex flex-col gap-4 sm:gap-6 w-full max-w-sm">
                                    <div className={`flex flex-col sm:flex-row items-center p-3 sm:p-4 rounded-xl border-2 transition-all ${bookingStatus !== '130' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 shadow-sm'} text-center sm:text-left`}>
                                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center sm:mr-4 mb-2 sm:mb-0 ${bookingStatus !== '130' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                            {bookingStatus !== '130' ? <CheckCircleOutlined className="text-lg sm:text-2xl" /> : <InfoCircleOutlined className="text-lg sm:text-2xl" />}
                                        </div>
                                        <div>
                                            <Text strong className={`text-sm sm:text-base ${bookingStatus !== '130' ? 'text-green-700' : 'text-gray-600'}`}>
                                                {bookingStatus !== '130' ? 'บันทึกข้อมูลและสร้างเลขที่รับเข้าแล้ว' : 'กรุณาระบุสถานที่และกดบันทึกข้อมูล'}
                                            </Text>
                                            <br className="hidden sm:block" />
                                            <Text type="secondary" className="text-xs sm:text-sm">
                                                {bookingStatus !== '130' ? `เลขที่: ${refID}` : 'ระบบจะสร้างเลขที่รับเข้าอัตโนมัติ'}
                                            </Text>
                                        </div>
                                    </div>

                                    {bookingStatus !== '130' && refID && (
                                        <div className="mt-2 sm:mt-6 bg-white border border-green-100 shadow-sm rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 relative overflow-hidden text-center sm:text-left">
                                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-green-50 rounded-full blur-xl hidden sm:block"></div>
                                            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                                                <QrcodeOutlined className="text-xl sm:text-2xl" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-center sm:justify-start gap-2">
                                                    <h4 className="text-sm sm:text-base font-bold text-gray-700 m-0">ระบบพร้อมสแกน</h4>
                                                    <span className="flex h-2 w-2 relative">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                    </span>
                                                </div>
                                                <p className="text-gray-400 text-xs sm:text-sm m-0">สามารถยิงบาร์โค้ดได้เลย</p>
                                            </div>
                                            <div className="hidden sm:block">
                                                <CheckCircleFilled className="text-green-500/20 text-3xl sm:text-4xl" />
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
                                // ก่อนแก้: scroll={{ x: 'max-content', y: 600 }}
                                scroll={{ x: 'max-content' }} // เอา y: 600 ออกเพื่อให้ตารางขยายความสูงได้เต็มที่
                            />
                        )}
                    </div>
                </div>
            </div>
        </Modal >
    );
}

export default SystemInList;