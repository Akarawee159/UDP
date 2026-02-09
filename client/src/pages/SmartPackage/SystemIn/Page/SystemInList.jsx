import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Form, Input, Button, Select, Row, Col, Card, Image, Typography,
    App, Space, Descriptions, Modal, Divider, Table, Tag, Tooltip
} from 'antd';
import {
    ReloadOutlined, SaveOutlined, ExclamationCircleOutlined,
    InfoCircleOutlined, PictureOutlined, FileAddOutlined,
    CloseOutlined, CheckCircleOutlined, UnlockOutlined, EyeOutlined, SearchOutlined, QrcodeOutlined, CheckCircleFilled,
    ColumnWidthOutlined, ExpandAltOutlined, VerticalAlignTopOutlined, GoldOutlined, DatabaseOutlined, ApartmentOutlined,
    CopyOutlined
} from '@ant-design/icons';
import api from "../../../../api";
import { usePermission } from '../../../../hooks/usePermission';
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

    const [expandedKeys, setExpandedKeys] = useState([]);

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

    // เมื่อ groupedData เปลี่ยน (มีของใหม่เข้ามา) ให้กางตารางออกอัตโนมัติ
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

                setLastScanned({});

                if (booking) {
                    setRefID(booking.refID);
                    setBookingStatus(String(booking.is_status));
                    form.setFieldsValue({
                        draft_id: booking.draft_id,
                        refID: booking.refID,
                        objective: 'ทำรายการรับเข้าของดี',
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
                    objective: 'ทำรายการรับเข้าของดี'
                });

                setDraftId(newId);
                setRefID(null);
                setScannedList([]);
                setLastScanned({});
                setBookingStatus('130');
                form.resetFields();
                form.setFieldsValue({
                    draft_id: newId,
                    objective: 'ทำรายการรับเข้าของดี',
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

            // ตรวจสอบว่าเป็น draft_id เดียวกันหรือไม่
            if (incomingDraftId === draftId) {

                // 1. กรณีถูกยกเลิก (Cancel) -> ปิดหน้าต่างทันที
                if (action === 'cancel') {
                    message.warning('รายการนี้ถูกยกเลิกโดยผู้ใช้อื่น');
                    onCancel();
                    return;
                }

                // ✅ 2. [เพิ่มใหม่] กรณี "ยืนยันจ่ายออก" (finalized) หรือ "Confirm Output" -> ปิดหน้าต่างทุกจอ
                if (action === 'finalized' || action === 'output_confirmed') {
                    message.success('รายการนี้ถูกยืนยันการจ่ายออกเรียบร้อยแล้ว');
                    onCancel(); // สั่งปิด Modal ทันที
                    return;     // จบการทำงาน ไม่ต้องไป Refresh Data ต่อ
                }

                // 3. รายการที่ต้อง Refresh ข้อมูล (เอา 'finalized' ออก เพราะไปดักข้างบนแล้ว)
                const refreshActions = [
                    'header_update',
                    'unlocked',
                    'ref_generated'
                ];

                if (refreshActions.includes(action)) {
                    api.get(`/smartpackage/systemin/detail?draft_id=${draftId}`).then(res => {
                        const { booking, assets } = res.data;

                        if (booking) {
                            // อัปเดต State ต่างๆ
                            setBookingStatus(String(booking.is_status));
                            setRefID(booking.refID); // ✅ อัปเดต RefID ใน State

                            // ✅ สำคัญ: อัปเดตค่าใน Form ให้เปลี่ยนตามทันที (Origin, Destination, Remark)
                            form.setFieldsValue({
                                refID: booking.refID,
                                origin: booking.origin,
                                destination: booking.destination,
                                booking_remark: booking.booking_remark,
                                attendees: (assets || []).length
                            });
                        }

                        // อัปเดตรายการสินค้าใหม่ทันที (กรณี Unlock รายการจะกลายเป็นว่าง หรือตามที่มีใน Master)
                        setScannedList(assets || []);
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
                message.success('สร้างเลขที่ใบรับเข้าของดีเรียบร้อย');
            }
        } catch (err) {
            message.error('สร้างเลขที่ใบรับเข้าของดีไม่สำเร็จ');
        }
    };

    const handleSaveHeader = async () => {
        try {
            const values = await form.validateFields(['origin', 'destination', 'booking_remark']);
            await api.post('/smartpackage/systemin/confirm', {
                draft_id: draftId,
                booking_remark: values.booking_remark,
                origin: values.origin,
                destination: values.destination
            });
            setBookingStatus('131');
            message.success('บันทึกข้อมูลเรียบร้อย พร้อมสำหรับการสแกน');
        } catch (err) {
            message.error('กรุณาระบุข้อมูลให้ครบถ้วน');
        }
    };

    const handleFinalize = async () => {
        // 1. ดึงค่าและตรวจสอบความถูกต้องจาก Form ก่อน
        let values;
        try {
            values = await form.validateFields(['origin', 'destination', 'booking_remark']);
        } catch (error) {
            message.error('กรุณาระบุสถานที่รับเข้าของดีและปลายทางให้ครบถ้วน');
            return;
        }

        modal.confirm({
            title: 'ยืนยันการรับเข้าของดี',
            content: 'เมื่อยืนยันแล้วจะไม่สามารถแก้ไขหรือสแกนเพิ่มได้',
            cancelText: 'ยืนยันรับเข้าของดี',
            cancelButtonProps: { type: 'primary', className: 'bg-blue-600 hover:bg-blue-500 border-blue-600' },
            okText: 'ยกเลิก',
            okButtonProps: { type: 'default', className: 'text-gray-500 border-gray-300 hover:text-gray-700' },
            maskClosable: false,
            keyboard: false,
            onCancel: async () => {
                try {
                    // 2. ส่งค่า draft_id พร้อมข้อมูล Header ไปที่ API
                    await api.post('/smartpackage/systemin/finalize', {
                        draft_id: draftId,
                        origin: values.origin,
                        destination: values.destination,
                        booking_remark: values.booking_remark
                    });

                    setBookingStatus('132');
                    message.success('รับเข้าของดีเรียบร้อย');
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
            cancelButtonProps: { type: 'primary', className: 'bg-blue-500 hover:bg-blue-400 border-blue-500' },
            okText: 'ยกเลิก',
            okButtonProps: { type: 'default', className: 'text-gray-500 border-gray-300' },
            maskClosable: false,
            keyboard: false,
            onCancel: async () => {
                try {
                    await api.post('/smartpackage/systemin/unlock', { draft_id: draftId });

                    // ✅ เรียก fetchData() เพื่อรีเฟรชข้อมูลทั้งหมดทันที (Status + Assets)
                    // จะทำให้หน้าจอดึงข้อมูลใหม่ที่ถูกต้องตาม Logic Backend (Status 134 -> Master RefID)
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
                content: 'กรุณา "ยกเลิกรับเข้าของดี" (คืนคลัง) รายการสินค้าทั้งหมดในตะกร้าก่อนทำการยกเลิกใบเบิก',
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
                    await api.post('/smartpackage/systemin/cancel', { draft_id: draftId });
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
            await api.post('/smartpackage/systemin/return', {
                ids: selectedIds,
                draft_id: draftId
            });
            message.success('ยกเลิกรับเข้าของดีเรียบร้อย');
            setSelectedIds([]);
        } catch (err) { message.error('Error'); }
    };

    const handleModalClose = async () => {
        // ✅ กรณี Status 134 (กำลังแก้ไข/Unlocked) ให้บังคับเข้า Flow ยืนยันรับเข้าของดี
        if (bookingStatus === '134') {
            // 1. ดึงค่าและตรวจสอบความถูกต้องจาก Form ก่อน (เหมือน handleFinalize)
            let values;
            try {
                values = await form.validateFields(['origin', 'destination', 'booking_remark']);
            } catch (error) {
                message.error('กรุณาระบุสถานที่รับเข้าของดีและปลายทางให้ครบถ้วน');
                return;
            }

            // 2. แสดง Modal ยืนยัน (ใช้ Logic เดียวกับ handleFinalize)
            modal.confirm({
                title: 'ยืนยันการรับเข้าของดี',
                content: 'เมื่อยืนยันแล้วจะไม่สามารถแก้ไขหรือสแกนเพิ่มได้ (ระบบจะบันทึกและปิดหน้าต่าง)',

                // ⚠️ หมายเหตุ: ตาม Code ของคุณ ปุ่ม 'cancelText' คือปุ่ม Action หลัก (สีเขียว)
                cancelText: 'ยืนยันรับเข้าของดี',
                cancelButtonProps: { type: 'primary', className: 'bg-blue-600 hover:bg-blue-500 border-blue-600' },

                // ปุ่ม 'okText' คือปุ่มยกเลิก (สีเทา)
                okText: 'ยกเลิก',
                okButtonProps: { type: 'default', className: 'text-gray-500 border-gray-300 hover:text-gray-700' },

                maskClosable: false,
                keyboard: false,

                // 🔥 Action หลัก: เมื่อกด "ยืนยันรับเข้าของดี"
                onCancel: async () => {
                    try {
                        // เรียก API Finalize
                        await api.post('/smartpackage/systemin/finalize', {
                            draft_id: draftId,
                            origin: values.origin,
                            destination: values.destination,
                            booking_remark: values.booking_remark
                        });

                        setBookingStatus('132');
                        message.success('รับเข้าของดีเรียบร้อย');

                        // ✅ เมื่อสำเร็จ ให้สั่งปิด Modal หลัก (onCancel ของ SystemOutList)
                        onCancel();
                    } catch (e) {
                        message.error('Failed: ' + (e.response?.data?.message || e.message));
                        // Return Promise.reject เพื่อให้ Modal confirm ไม่ปิดถ้า Error
                        return Promise.reject();
                    }
                },

                // Action รอง: เมื่อกด "ยกเลิก" (ไม่ทำอะไร ให้หน้าต่างเปิดค้างไว้แก้ไขต่อ)
                onOk: () => { }
            });
            return; // หยุดการทำงาน ไม่ให้ปิด Modal หลักทันที
        }

        // กรณีสถานะอื่นๆ (เช่น 132 หรือ 130) ให้ปิดหน้าต่างได้ตามปกติ
        onCancel();
    };

    const handleScanProcess = async (qrString) => {
        if (!draftId) return;
        if (processingRef.current) return;
        processingRef.current = true;

        if (bookingStatus === '135') {
            modal.warning({
                title: 'ไม่สามารถทำรายการได้',
                content: 'ใบเบิกนี้ยืนยันการรับเข้าของดีเรียบร้อยแล้ว ไม่สามารถสแกนเพิ่มหรือแก้ไขได้',
                okText: 'รับทราบ',
                onOk: () => processingRef.current = false
            });
            return;
        }
        if (bookingStatus === '132') {
            modal.warning({ title: 'แจ้งเตือน', content: 'รายการนี้ถูกรับเข้าของดีแล้ว ไม่สามารถสแกนเพิ่มเติมได้', okText: 'รับทราบ', onOk: () => processingRef.current = false });
            return;
        }
        if (!refID) {
            modal.warning({ title: 'แจ้งเตือน', content: 'กรุณาสร้างเลขที่ใบรับเข้าของดีก่อนทำการสแกน', okText: 'รับทราบ', onOk: () => processingRef.current = false });
            return;
        }
        if (bookingStatus === '130') {
            modal.warning({
                title: 'แจ้งเตือน',
                content: 'กรุณาระบุ รับเข้าจากปลายทาง-สถานที่รับเข้า และกดปุ่ม "บันทึกข้อมูล" ก่อนทำการสแกน',
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
            } else {
                const { code, data, message: msg } = res.data;

                if (code === 'ALREADY_SCANNED') {
                    modal.confirm({
                        title: 'ยืนยันการยกเลิกรับเข้าของดี',
                        icon: <ExclamationCircleOutlined />,
                        content: `ต้องการยกเลิกรับเข้าของดี ${data.asset_code} ใช่หรือไม่?`,
                        cancelText: 'ยกเลิกรับเข้าของดี',
                        cancelButtonProps: { danger: true, type: 'primary' },
                        okText: 'ปิด',
                        okButtonProps: { type: 'default' },
                        onCancel: async () => {
                            try {
                                await api.post('/smartpackage/systemin/return-single', {
                                    asset_code: data.asset_code,
                                    draft_id: draftId
                                });
                                message.success('ยกเลิกรับเข้าของดีเรียบร้อย');
                            } catch (e) { message.error('Failed'); }
                            processingRef.current = false;
                        },
                        onOk: () => { processingRef.current = false; },
                        afterClose: () => { processingRef.current = false; }
                    });
                } else if (code === 'INVALID_STATUS') {
                    // (Logic เดิม) สถานะ 102 แต่ผิดตะกร้า
                    modal.error({
                        title: 'แจ้งเตือน',
                        content: `ไม่สามารถสแกนได้ เนื่องจากสินค้านี้ถูกรับเข้าของดีไปแล้ว`,
                        okText: 'รับทราบ',
                        onOk: () => { processingRef.current = false; },
                        afterClose: () => { processingRef.current = false; }
                    });

                } else if (code === 'INVALID_STATUS_101') {
                    // 🚩 Case ใหม่: สถานะไม่ใช่ 101
                    modal.warning({
                        title: 'แจ้งเตือน: สถานะไม่ถูกต้อง',
                        content: (
                            <div className="flex flex-col gap-2">
                                <span className="text-gray-700">สินค้าต้องมีสถานะ <b>"จ่ายออกใช้งาน"</b> เท่านั้น</span>
                                <div className="bg-red-50 p-2 rounded border border-red-200 mt-1">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">รหัสทรัพย์สิน:</span>
                                        <span className="font-bold">{data.asset_code}</span>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-gray-500">สถานะปัจจุบัน:</span>
                                        <span className={`px-2 rounded text-xs border ${data.asset_status_color || 'bg-gray-200'}`}>
                                            {data.asset_status_name || data.asset_status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ),
                        okText: 'รับทราบ',
                        okButtonProps: { type: 'primary', danger: true },
                        onOk: () => { processingRef.current = false; },
                        afterClose: () => { processingRef.current = false; }
                    });

                } else if (code === 'INVALID_ORIGIN') {
                    // 🚩 Case ใหม่: รับเข้าจากปลายทาง ไม่ตรงกับ Asset Destination
                    modal.warning({
                        title: 'แจ้งเตือน: ผิดเงื่อนไขการรับเข้า',
                        content: (
                            <div className="flex flex-col gap-2">
                                <span className="text-gray-700">รับเข้าจากปลายทาง ไม่ตรงกับ ต้นทางของทรัพย์สิน</span>
                                <div className="bg-orange-50 p-3 rounded border border-orange-200 mt-2 text-sm">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="text-gray-500">รับเข้าจากปลายทาง:</div>
                                        <div className="font-bold text-red-600">{data.expected_origin || '-'}</div>

                                        <div className="text-gray-500">ต้นทางของทรัพย์สิน:</div>
                                        <div className="font-bold text-blue-600">{data.actual_destination || '-'}</div>
                                    </div>
                                </div>
                            </div>
                        ),
                        okText: 'รับทราบ',
                        okButtonProps: { type: 'primary', danger: true },
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

    const isEditingDisabled = !refID || bookingStatus === '132' || bookingStatus === '135';
    const hasScannedItems = scannedList.length > 0;
    const showSaveCancel = refID && bookingStatus !== '132' && bookingStatus !== '134' && !hasScannedItems;
    const showConfirm = (bookingStatus === '131' || bookingStatus === '134') && hasScannedItems;
    const showCancelButton = bookingStatus !== '132' && !hasScannedItems;
    const isFinalized = bookingStatus === '132' || bookingStatus === '135';

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
                        disabled: bookingStatus === '132' || bookingStatus === '135',
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
            title={<Title level={4} style={{ margin: 0 }}>{targetDraftId ? 'แก้ไขรายการรับเข้าของดี' : 'สร้างรายการรับเข้าของดี (System Out)'}</Title>}
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
                <Card
                    className="shadow-md border-0 bg-white overflow-hidden"
                    bodyStyle={{ padding: 0 }} // Custom padding เพื่อจัด Layout เอง
                >
                    {!lastScanned?.asset_code ? (
                        // --- UX: Empty State เมื่อยังไม่ได้สแกน ---
                        <div className="flex flex-col items-center justify-center py-12 bg-slate-50/50">
                            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                <QrcodeOutlined className="text-4xl text-blue-500" />
                            </div>
                            <Title level={4} type="secondary" style={{ margin: 0 }}>รอรับข้อมูล</Title>
                            <Text type="secondary">กรุณาสแกน QR Code หรือเลือกรายการจากตาราง</Text>
                        </div>
                    ) : (
                        // --- UX: ข้อมูลทรัพย์สิน ---
                        <div className="flex flex-col">
                            {/* Header Strip: Modern Gradient & Glass Effect */}
                            <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 px-6 py-4 shadow-sm">
                                {/* Decorative Background Elements (ช่วยเพิ่มมิติ) */}
                                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl pointer-events-none"></div>
                                <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-blue-400 opacity-20 rounded-full blur-lg pointer-events-none"></div>

                                <div className="relative flex justify-between items-center z-10">
                                    {/* Left Side: Title & Icon */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-inner">
                                            <InfoCircleOutlined className="text-white text-xl" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-white font-bold text-lg leading-tight tracking-wide shadow-black drop-shadow-sm">
                                                รายละเอียดทรัพย์สิน
                                            </span>
                                            <span className="text-blue-100 text-xs font-light tracking-wider opacity-90">
                                                Asset Information Details
                                            </span>
                                        </div>
                                    </div>

                                    {/* Right Side: Asset Code Badge with Copy Action */}
                                    <div className="flex items-center gap-2">
                                        <Tooltip title="คลิกเพื่อคัดลอกรหัส">
                                            <div
                                                className="group flex items-center gap-2 bg-white text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200 shadow-md cursor-pointer hover:bg-blue-50 transition-all active:scale-95"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(lastScanned.partCode);
                                                    message.success('คัดลอกรหัสเรียบร้อย');
                                                }}
                                            >
                                                <span className="font-mono font-bold text-base tracking-wide select-all">
                                                    {lastScanned.partCode}
                                                </span>
                                                <div className="h-4 w-px bg-blue-200 mx-1"></div>
                                                <CopyOutlined className="text-blue-400 group-hover:text-blue-600 transition-colors" />
                                            </div>
                                        </Tooltip>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6">
                                <Row gutter={[24, 24]}>
                                    {/* 1. รูปภาพหลัก */}
                                    <Col xs={24} md={6}>
                                        <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden border border-gray-100 shadow-inner flex items-center justify-center relative group">
                                            {lastScanned.asset_img ? (
                                                <>
                                                    <Image
                                                        src={getFullImgUrl('material', lastScanned.asset_img)}
                                                        className="object-cover w-full h-full"
                                                        style={{ height: '100%', width: '100%' }}
                                                        preview={{ mask: <div className="text-white"><EyeOutlined /> ดูภาพขยาย</div> }}
                                                    />
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center text-gray-300">
                                                    <PictureOutlined style={{ fontSize: 48 }} />
                                                    <span className="text-xs mt-2">ไม่มีรูปภาพ</span>
                                                </div>
                                            )}
                                        </div>
                                    </Col>

                                    {/* 2. ข้อมูลทั่วไป (Text) */}
                                    <Col xs={24} md={10}>
                                        <div className="flex flex-col h-full justify-start gap-4">
                                            <div>
                                                <Text type="secondary" className="text-xs uppercase tracking-wider">ชื่อทรัพย์สิน</Text>
                                                <Title level={4} style={{ margin: 0, color: '#1f2937' }}>
                                                    {lastScanned.asset_detail || '-'}
                                                </Title>
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

                                            <div>
                                                <Text type="secondary" className="text-xs block mb-1">รายละเอียดเพิ่มเติม</Text>
                                                <div className="bg-white p-3 rounded-lg border border-gray-200 text-gray-600 text-sm min-h-[80px]">
                                                    {lastScanned.asset_remark || <span className="text-gray-300 italic">ไม่ระบุรายละเอียด</span>}
                                                </div>
                                            </div>
                                            {/* 4. Drawings Section */}
                                            <div className="mt-2 pt-4 border-t border-gray-100">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <FileAddOutlined className="text-blue-500" />
                                                    <Text strong className="text-gray-600 text-sm">ส่วนประกอบชิ้นส่วน (Drawings)</Text>
                                                </div>

                                                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                                    {[1, 2, 3, 4, 5, 6].map(num => {
                                                        const imgName = lastScanned?.[`asset_dmg_00${num}`];
                                                        // UX: ถ้าไม่มีรูป ให้ไม่แสดงเลย หรือแสดงจางๆ (ในที่นี้เลือกแสดงจางๆ ให้รู้ว่ามี Slot)
                                                        if (!imgName) return null;

                                                        return (
                                                            <div key={num} className="w-20 h-20 border border-gray-200 rounded-lg bg-white flex-shrink-0 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative">
                                                                <Image
                                                                    src={getFullImgUrl('material/drawing', imgName)}
                                                                    className="w-full h-full object-contain p-1"
                                                                    preview={{ mask: <EyeOutlined /> }}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                    {/* Empty Placeholder for Drawing if none exists */}
                                                    {![1, 2, 3, 4, 5, 6].some(n => lastScanned?.[`asset_dmg_00${n}`]) && (
                                                        <div className="w-full text-center py-4 bg-gray-50 rounded border border-dashed border-gray-300 text-gray-700 text-xs">
                                                            ไม่พบข้อมูล Drawing
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Col>

                                    {/* 3. สเปค (Dimension Grid) */}
                                    <Col xs={24} md={8}>
                                        <div className="bg-white rounded-xl border border-gray-200 h-full shadow-sm overflow-hidden flex flex-col">
                                            {/* Header */}
                                            <div className="bg-slate-50 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                                                <ApartmentOutlined className="text-blue-500" />
                                                <span className="font-semibold text-gray-700 text-sm">ข้อมูลจำเพาะ (Spec)</span>
                                            </div>

                                            <div className="p-4 flex flex-col gap-4 h-full justify-center">

                                                {/* Group 1: Dimensions (กว้าง x ยาว x สูง) */}
                                                <div>
                                                    <Text type="secondary" className="text-[14px] text-gray-700 uppercase tracking-wide mb-2 block pl-1">
                                                        ขนาด (Dimensions)
                                                    </Text>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {/* Width */}
                                                        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 flex flex-col items-center justify-center">
                                                            <ColumnWidthOutlined className="text-blue-400 text-xs mb-1" />
                                                            <span className="text-[14px] text-gray-700">กว้าง</span>
                                                            <div className="font-bold text-gray-700">
                                                                {lastScanned.asset_width || '-'} <span className="text-[14px] font-normal text-gray-700">{lastScanned.asset_width_unit}</span>
                                                            </div>
                                                        </div>
                                                        {/* Length */}
                                                        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 flex flex-col items-center justify-center">
                                                            <ExpandAltOutlined className="text-blue-400 text-xs mb-1" />
                                                            <span className="text-[14px] text-gray-700">ยาว</span>
                                                            <div className="font-bold text-gray-700">
                                                                {lastScanned.asset_length || '-'} <span className="text-[14px] font-normal text-gray-700">{lastScanned.asset_length_unit}</span>
                                                            </div>
                                                        </div>
                                                        {/* Height */}
                                                        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 flex flex-col items-center justify-center">
                                                            <VerticalAlignTopOutlined className="text-blue-400 text-xs mb-1" />
                                                            <span className="text-[14px] text-gray-700">สูง</span>
                                                            <div className="font-bold text-gray-700">
                                                                {lastScanned.asset_height || '-'} <span className="text-[14px] font-normal text-gray-700">{lastScanned.asset_height_unit}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Divider */}
                                                <div className="h-px bg-gray-100 w-full"></div>

                                                {/* Group 2: Properties (น้ำหนัก & ความจุ) */}
                                                <div>
                                                    <Text type="secondary" className="text-[14px] text-gray-700 uppercase tracking-wide mb-2 block pl-1">
                                                        คุณสมบัติ (Properties)
                                                    </Text>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {/* Weight */}
                                                        <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm transition-all">
                                                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-500">
                                                                <GoldOutlined />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[14px] text-gray-700">น้ำหนัก</span>
                                                                <span className="font-bold text-gray-700 text-base leading-none">
                                                                    {lastScanned.asset_weight || '-'} <span className="text-xs font-normal text-gray-700">{lastScanned.asset_weight_unit}</span>
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Capacity */}
                                                        <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm transition-all">
                                                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-500">
                                                                <DatabaseOutlined />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[14px] text-gray-700">ความจุ</span>
                                                                <span className="font-bold text-gray-700 text-base leading-none">
                                                                    {lastScanned.asset_capacity || '-'} <span className="text-xs font-normal text-gray-700">{lastScanned.asset_capacity_unit}</span>
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
                </Card>

                <Row gutter={16} className="flex-1">
                    <Col xs={24} md={7}>
                        <Card title="ข้อมูลรับเข้าของดี" className="h-full shadow-sm" size="small">
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
                                        className={refID ? "bg-blue-50 text-blue-700 font-bold" : ""}
                                        addonAfter={
                                            <Button
                                                type="primary"
                                                size="small"
                                                onClick={handleGenerateRef}
                                                disabled={!!refID}
                                                icon={<FileAddOutlined />}
                                            >
                                                สร้างเลขที่ใบรับเข้าของดี
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
                                {/* รับเข้าจากปลายทาง */}
                                <Form.Item label="รับเข้าจากปลายทาง" name="origin" rules={[{ required: true }]}>
                                    <Select
                                        showSearch // เปิดให้พิมพ์ค้นหาได้
                                        optionFilterProp="label" // ให้ค้นหาจาก label (เราจะรวม code + name ไว้ในนี้)
                                        filterOption={(input, option) =>
                                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                        }
                                        options={zones.map(s => ({
                                            label: `${s.code} - ${s.name}`, // แสดงทั้งรหัสและชื่อ
                                            value: s.code // เก็บค่าเป็นรหัส supplier
                                        }))}
                                        placeholder="ค้นหารหัส หรือชื่อผู้จัดจำหน่าย"
                                        disabled={isEditingDisabled}
                                    />
                                </Form.Item>

                                {/* สถานที่รับเข้า */}
                                <Form.Item label="สถานที่รับเข้า" name="destination" rules={[{ required: true }]}>
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
                                        disabled={isEditingDisabled}
                                    />
                                </Form.Item>

                                <Row gutter={8} style={{ marginTop: 16 }}>
                                    {/* ซ่อนปุ่มบันทึกข้อมูลถ้ารับเข้าของดีแล้ว */}
                                    {showSaveCancel && !isFinalized && (
                                        <Col span={12}>
                                            <Button type="primary" block icon={<SaveOutlined />} onClick={handleSaveHeader} size="large">
                                                บันทึกข้อมูล
                                            </Button>
                                        </Col>
                                    )}

                                    {/* ซ่อนปุ่มยกเลิกใบเบิกถ้ารับเข้าของดีแล้ว */}
                                    {showCancelButton && !isFinalized && bookingStatus !== '134' && (
                                        <Col span={showSaveCancel ? 12 : 24}>
                                            <Button type="default" danger block icon={<CloseOutlined />} onClick={handleCancelBooking} size="large">
                                                ยกเลิกใบเบิก
                                            </Button>
                                        </Col>
                                    )}

                                    {/* สถานะ 134 ให้แสดงปุ่ม Confirm (Finalize) เหมือนเดิม เพื่อบันทึกการแก้ไข */}
                                    {(showConfirm || (bookingStatus === '134' && hasScannedItems)) && (
                                        <Col span={24} className="mt-2">
                                            <Button
                                                type="primary"
                                                block
                                                icon={<CheckCircleOutlined />}
                                                onClick={handleFinalize}
                                                size="large"
                                                className="bg-blue-600 hover:bg-blue-500"
                                            >
                                                {bookingStatus === '134' ? 'บันทึกการแก้ไข (รับเข้าของดี)' : 'รับเข้าของดี (Confirm)'}
                                            </Button>
                                        </Col>
                                    )}

                                    {/* {bookingStatus === '132' && canUse('system-out:unlock') && (
                                        <Col span={24}>
                                            <Button type="default" block icon={<UnlockOutlined />} onClick={handleUnlock} size="large" className="border-orange-500 text-orange-500 hover:text-orange-600 hover:border-orange-600">
                                                ปลดล็อคเพื่อแก้ไข
                                            </Button>
                                        </Col>
                                    )} */}
                                </Row>
                            </Form>
                        </Card>
                    </Col>

                    {/* ✅ New Table Implementation */}
                    <Col xs={24} md={17}>
                        <div className="bg-white p-4 rounded-lg shadow-sm h-full flex flex-col">
                            {/* ส่วนหัวตาราง */}
                            <div className="flex justify-between items-center mb-2">
                                <Title level={5} style={{ margin: 0 }}>รายการในตะกร้า ({scannedList.length})</Title>
                                {/* ล็อคปุ่มยกเลิกรับเข้าของดีถ้าเป็น 135 หรือ 132 */}
                                {!isFinalized && (
                                    <Button
                                        danger
                                        icon={<ReloadOutlined />}
                                        onClick={handleReturnToStock}
                                        disabled={selectedIds.length === 0}
                                    >
                                        ยกเลิกรับเข้าของดี ({selectedIds.length})
                                    </Button>
                                )}
                            </div>
                            <div className="flex-1 overflow-auto flex flex-col">
                                {/* 🚩 ส่วนแสดงเงื่อนไข Lock/Unlock ก่อนเริ่มสแกน */}
                                {bookingStatus === '134' && !hasScannedItems ? (
                                    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
                                        <div className="text-orange-500 mb-4">
                                            <ExclamationCircleOutlined style={{ fontSize: 48 }} />
                                        </div>
                                        <Title level={5} className="text-gray-700">
                                            รายการเบิกปัจจุบัน
                                        </Title>
                                        <Text type="secondary">
                                            ไม่พบรายการสินค้าในสถานะกำลังแก้ไข
                                            <br />
                                            (ระบบกำลังตรวจสอบรายการจาก RefID: {refID})
                                        </Text>
                                        <div className="mt-4">
                                            <Tag color="orange">Status: Unlocked (134)</Tag>
                                        </div>
                                        <div className="mt-6 text-xs text-gray-400">
                                            * หากปิดหน้าต่างนี้ ระบบจะปรับสถานะเป็น "รับเข้าของดี" โดยอัตโนมัติ
                                        </div>
                                    </div>
                                ) : !hasScannedItems ? (
                                    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-8">
                                        <div className="flex flex-col gap-6 w-full max-w-sm">

                                            {/* เงื่อนไขที่ 1: การสร้างเลขที่ใบรับเข้าของดี */}
                                            <div className={`flex items-center p-4 rounded-xl border-2 transition-all ${refID ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 shadow-sm'}`}>
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${refID ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                    {refID ? <CheckCircleOutlined style={{ fontSize: 24 }} /> : <FileAddOutlined style={{ fontSize: 24 }} />}
                                                </div>
                                                <div>
                                                    <Text strong className={refID ? 'text-blue-700' : 'text-gray-600'}>
                                                        {refID ? 'สร้างเลขที่ใบรับเข้าของดีแล้ว' : 'กรุณาสร้างเลขที่ใบรับเข้าของดี'}
                                                    </Text>
                                                    <br />
                                                    <Text type="secondary" size="small">{refID ? `เลขที่: ${refID}` : 'กดปุ่ม "สร้างเลขที่ใบรับเข้าของดี" ฝั่งซ้าย'}</Text>
                                                </div>
                                            </div>

                                            {/* เงื่อนไขที่ 2: การระบุต้นทาง-สถานที่รับเข้า (Status 131) */}
                                            <div className={`flex items-center p-4 rounded-xl border-2 transition-all ${bookingStatus !== '130' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 shadow-sm'}`}>
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${bookingStatus !== '130' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                    {bookingStatus !== '130' ? <CheckCircleOutlined style={{ fontSize: 24 }} /> : <InfoCircleOutlined style={{ fontSize: 24 }} />}
                                                </div>
                                                <div>
                                                    <Text strong className={bookingStatus !== '130' ? 'text-blue-700' : 'text-gray-600'}>
                                                        {bookingStatus !== '130' ? 'ระบุต้นทาง-ปลายทางแล้ว' : 'กรุณาระบุต้นทาง-สถานที่รับเข้า'}
                                                    </Text>
                                                    <br />
                                                    <Text type="secondary" size="small">{bookingStatus !== '130' ? 'พร้อมสำหรับการสแกนทรัพย์สิน' : 'และกดปุ่ม "บันทึกข้อมูล"'}</Text>
                                                </div>
                                            </div>

                                            {/* ข้อความแนะนำด้านล่าง */}
                                            {bookingStatus !== '130' && refID && (
                                                <div className="mt-6 bg-white border border-blue-100 shadow-sm rounded-lg p-4 flex items-center gap-4 relative overflow-hidden">
                                                    {/* Decorative Circle */}
                                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-50 rounded-full blur-xl"></div>

                                                    <div className="flex-shrink-0 w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                                                        <QrcodeOutlined style={{ fontSize: '24px' }} />
                                                    </div>

                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-base font-bold text-gray-700 m-0">ระบบพร้อมสแกน</h4>
                                                            <span className="flex h-2 w-2 relative">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                                            </span>
                                                        </div>
                                                        <p className="text-gray-400 text-sm m-0">สามารถยิงบาร์โค้ดได้เลย</p>
                                                    </div>

                                                    <div className="hidden sm:block">
                                                        <CheckCircleFilled className="text-blue-500/20 text-4xl" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* ✅ เมื่อเริ่มสแกนแล้ว (มีข้อมูล) ให้แสดงตารางตามเดิม */
                                    <Table
                                        columns={parentColumns}
                                        dataSource={groupedData}
                                        expandable={{
                                            expandedRowRender,
                                            expandIcon: customExpandIcon,
                                            // ✅ ปรับแก้ข้อ 2: ควบคุมการ Expand ด้วย State
                                            expandedRowKeys: expandedKeys,
                                            onExpand: (expanded, record) => {
                                                // อนุญาตให้ User หุบเข้า-กางออกเองได้ด้วย
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
export default SystemOutList;