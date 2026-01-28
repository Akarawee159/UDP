import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Form, Input, Button, Select, Row, Col, Card, Image, Typography,
    App, Space, Descriptions, Modal, Divider
} from 'antd';
import {
    ReloadOutlined, SaveOutlined, ExclamationCircleOutlined,
    InfoCircleOutlined, PictureOutlined, FileAddOutlined, CloseOutlined
} from '@ant-design/icons';
import api from "../../../../api";
import DataTable from '../../../../components/aggrid/DataTable';

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
    const [selectedIds, setSelectedIds] = useState([]);
    // ✅ State เช็คว่าบันทึก Header (ต้นทาง/ปลายทาง) หรือยัง
    const [isHeaderSaved, setIsHeaderSaved] = useState(false);

    const gridApiRef = useRef(null);

    const getFullImgUrl = (subPath, filename) => {
        if (!filename) return null;
        const baseUrl = api.defaults.baseURL ? api.defaults.baseURL.replace(/\/api\/?$/, '') : '';
        return `${baseUrl}/img/${subPath}/${filename}`;
    };

    // --- Init Data ---
    const fetchData = useCallback(async () => {
        if (!open) return;
        setLoading(true);
        try {
            const resZone = await api.get('/smartpackage/systemout/dropdowns');
            setZones(resZone.data.zones || []);
            setLastScanned({});
            setIsHeaderSaved(false); // Reset state

            let currentDraftId = targetDraftId;

            if (targetDraftId) {
                const res = await api.get(`/smartpackage/systemout/detail?draft_id=${targetDraftId}`);
                const { booking, assets } = res.data;

                currentDraftId = targetDraftId;
                setScannedList(assets || []);
                setRefID(booking.refID);

                // ถ้ามี RefID และ Origin/Destination แล้ว ถือว่า Saved แล้ว
                if (booking.refID && booking.origin && booking.destination) {
                    setIsHeaderSaved(true);
                }

                form.setFieldsValue({
                    draft_id: booking.draft_id,
                    refID: booking.refID,
                    objective: 'ทำรายการจ่ายออก',
                    attendees: booking.attendees || (assets || []).length,
                    booking_remark: booking.booking_remark,
                    origin: booking.origin,
                    destination: booking.destination
                });
            } else {
                currentDraftId = generateDraftId();
                await api.post('/smartpackage/systemout/init-booking', { draft_id: currentDraftId });

                setRefID(null);
                setScannedList([]);
                form.resetFields();
                form.setFieldsValue({
                    draft_id: currentDraftId,
                    objective: 'ทำรายการจ่ายออก',
                    attendees: 0
                });
            }
            setDraftId(currentDraftId);
        } catch (err) {
            console.error(err);
            message.error("Error loading data");
        } finally {
            setLoading(false);
        }
    }, [open, targetDraftId, form, message]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Socket Listener
    useEffect(() => {
        const handleSocketUpdate = (event) => {
            if (!open || !draftId) return;
            const { action, draft_id: incomingDraftId, data } = event.detail || {};

            api.get(`/smartpackage/systemout/list?draft_id=${draftId}`).then(res => {
                setScannedList(res.data.data || []);
                form.setFieldValue('attendees', (res.data.data || []).length);
            });

            if (action === 'scan' && incomingDraftId === draftId && data) {
                setLastScanned(data);
                message.success('สแกนสำเร็จ: ' + data.asset_code);
            }
        };
        window.addEventListener('hrms:systemout-update', handleSocketUpdate);
        return () => window.removeEventListener('hrms:systemout-update', handleSocketUpdate);
    }, [open, draftId, message, form]);

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

    // --- Save Header / Enable Scan ---
    const handleSaveHeader = async () => {
        try {
            // Validate Origin/Dest
            const values = await form.validateFields(['origin', 'destination', 'booking_remark']);

            await api.post('/smartpackage/systemout/confirm', { // endpoint confirm ใช้ update header
                draft_id: draftId,
                booking_remark: values.booking_remark,
                origin: values.origin,
                destination: values.destination
            });

            setIsHeaderSaved(true); // ✅ เปิดให้สแกนได้
            message.success('บันทึกข้อมูลเรียบร้อย พร้อมสำหรับการสแกน');
            // ไม่ต้องปิด Modal (onCancel) ตาม Requirement
        } catch (err) {
            message.error('กรุณาระบุข้อมูลให้ครบถ้วน');
        }
    };

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

    // --- Scan Logic ---
    const handleScanProcess = async (qrString) => {
        if (!draftId) return;

        // 1. เช็ค RefID
        if (!refID) {
            modal.warning({ title: 'แจ้งเตือน', content: 'กรุณาสร้างเลขที่ใบเบิกก่อนทำการสแกน', okText: 'รับทราบ' });
            return;
        }

        // 2. เช็ค Header Saved (Origin/Dest)
        if (!isHeaderSaved) {
            modal.warning({
                title: 'แจ้งเตือน',
                content: 'กรุณาระบุ ต้นทาง-ปลายทาง และกดปุ่ม "บันทึกข้อมูล/ปิด" ก่อนทำการสแกน',
                okText: 'รับทราบ'
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
            } else {
                const { code, data, message: msg } = res.data;

                // ✅ กรณี 1: ALREADY_SCANNED (จ่ายออกใน RefID นี้แล้ว -> ถามยกเลิก)
                if (code === 'ALREADY_SCANNED') {
                    modal.confirm({
                        title: 'ยืนยันการยกเลิกจ่ายออก',
                        icon: <ExclamationCircleOutlined />,
                        content: `ต้องการยกเลิกจ่ายออก ${data.asset_code} ใช่หรือไม่?`,

                        cancelText: 'ยกเลิกจ่ายออก', // ปุ่มซ้าย (แดง)
                        cancelButtonProps: { danger: true, type: 'primary' },

                        okText: 'ปิด', // ปุ่มขวา (เทา/ขาว)
                        okButtonProps: { type: 'default' },

                        onCancel: async () => { // กดปุ่มซ้าย (Cancel) ให้ทำงาน
                            try {
                                await api.post('/smartpackage/systemout/return-single', { asset_code: data.asset_code });
                                message.success('ยกเลิกจ่ายออกเรียบร้อย');
                            } catch (e) {
                                message.error('ยกเลิกจ่ายออกล้มเหลว');
                            }
                        },
                        onOk: () => { }, // กดปุ่มขวา (OK/ปิด) ปิด Modal เฉยๆ
                    });
                }
                // ✅ กรณี 2: INVALID_STATUS (สถานะไม่พร้อม หรือ ติด RefID อื่น)
                else if (code === 'INVALID_STATUS') {
                    modal.error({
                        title: 'ไม่สามารถสแกนเพื่อจ่ายออกได้',
                        content: (
                            <div>
                                <p>{msg}</p>
                                <p className='mt-2'>สถานะปัจจุบัน:
                                    <span className={`ml-2 px-2 py-1 rounded border ${data?.asset_status_color || 'bg-gray-200 text-gray-700'}`}>
                                        {data?.asset_status_name || 'Unknown'}
                                    </span>
                                </p>
                                {/* แสดง RefID ที่ติดอยู่ ถ้ามีและไม่ตรงกับปัจจุบัน */}
                                {data?.refID && data.refID !== refID && (
                                    <p className="mt-1 text-red-500 text-xs">
                                        * ทรัพย์สินนี้จ่ายออกไปกับเลขที่ใบเบิก: <b>{data.refID}</b>
                                    </p>
                                )}
                            </div>
                        ),
                        okText: 'รับทราบ',
                    });
                } else {
                    message.error(msg);
                }
            }
        } catch (err) {
            message.error(`Scan Error: ${err.message}`);
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
    }, [open, draftId, refID, isHeaderSaved]);

    // Batch Return -> เปลี่ยนเป็น "ยกเลิกจ่ายออก"
    const handleReturnToStock = async () => {
        if (selectedIds.length === 0) return message.warning('กรุณาเลือกรายการ');
        try {
            await api.post('/smartpackage/systemout/return', { ids: selectedIds });
            message.success('ยกเลิกจ่ายออกเรียบร้อย');
            setSelectedIds([]);
            gridApiRef.current?.deselectAll();
        } catch (err) { message.error('Error'); }
    };

    const columnDefs = useMemo(() => [
        {
            checkboxSelection: true,
            headerCheckboxSelection: true,
            headerCheckboxSelectionFilteredOnly: true,
            width: 50,
            pinned: 'left',
            lockVisible: true,
            headerClass: 'header-center-checkbox',
            cellClass: "flex justify-center items-center",
        },
        { headerName: 'ลำดับ', valueGetter: "node.rowIndex + 1", width: 70, pinned: 'left' },
        { headerName: 'QR CODE', field: 'asset_code', width: 150 },
        { headerName: 'ชื่อทรัพย์สิน', field: 'asset_detail', flex: 1 },
        {
            headerName: 'สถานะ', field: 'status_name', width: 120,
            cellRenderer: p => <span className={`px-2 py-1 rounded text-xs border ${p.data.status_class}`}>{p.value}</span>
        },
        { headerName: 'เวลาสแกน', field: 'scan_at', width: 150, valueFormatter: p => p.value ? new Date(p.value).toLocaleString() : '-' },
    ], []);

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

                {/* --- Section 1: Details Card (Updated) --- */}
                <Card
                    className="shadow-sm border-blue-200 bg-blue-50/30"
                    title={<Space><InfoCircleOutlined className="text-blue-600" /> รายละเอียดทรัพย์สิน ({lastScanned?.asset_code || 'กรุณาสแกน'})</Space>}
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
                                <Descriptions.Item label="กว้าง">{lastScanned?.asset_width ? `${lastScanned.asset_width} ${lastScanned.asset_width_unit || ''}` : '-'}</Descriptions.Item>
                                <Descriptions.Item label="ยาว">{lastScanned?.asset_length ? `${lastScanned.asset_length} ${lastScanned.asset_length_unit || ''}` : '-'}</Descriptions.Item>
                                <Descriptions.Item label="สูง">{lastScanned?.asset_height ? `${lastScanned.asset_height} ${lastScanned.asset_height_unit || ''}` : '-'}</Descriptions.Item>
                                <Descriptions.Item label="ความจุ">{lastScanned?.asset_capacity ? `${lastScanned.asset_capacity} ${lastScanned.asset_capacity_unit || ''}` : '-'}</Descriptions.Item>
                                <Descriptions.Item span={2} label="น้ำหนัก">{lastScanned?.asset_weight ? `${lastScanned.asset_weight} ${lastScanned.asset_weight_unit || ''}` : '-'}</Descriptions.Item>
                            </Descriptions>
                        </Col>
                        {/* Drawings 6 Frames (Always Visible) */}
                        <Col span={24}>
                            <div className="bg-white p-3 rounded border border-gray-100">
                                <Text strong className="mb-2 block text-gray-500 text-xs">ส่วนประกอบชิ้นส่วน (Drawings)</Text>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {[1, 2, 3, 4, 5, 6].map(num => {
                                        const imgName = lastScanned?.[`asset_dmg_00${num}`];
                                        return (
                                            <div key={num} className="w-24 h-24 border border-gray-200 rounded bg-gray-50 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                                {imgName ? (
                                                    <Image
                                                        src={getFullImgUrl('material/drawing', imgName)}
                                                        className="w-full h-full object-contain"
                                                    />
                                                ) : (
                                                    <Text type="secondary" className="text-xs">No Img</Text>
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
                                <Form.Item label="DRAFT-ID" name="draft_id"><Input disabled className="bg-gray-100" /></Form.Item>

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
                                <Form.Item label="จำนวน (รายการ)" name="attendees"><Input readOnly className="text-center font-bold text-blue-600" /></Form.Item>
                                <Form.Item label="หมายเหตุ" name="booking_remark"><Input.TextArea rows={2} /></Form.Item>
                                <Divider />
                                <Form.Item label="ต้นทาง" name="origin" rules={[{ required: true, message: 'ระบุต้นทาง' }]}>
                                    <Select options={zones.map(z => ({ label: z.name, value: z.name }))} placeholder="เลือกต้นทาง" />
                                </Form.Item>
                                <Form.Item label="ปลายทาง" name="destination" rules={[{ required: true, message: 'ระบุปลายทาง' }]}>
                                    <Select options={zones.map(z => ({ label: z.name, value: z.name }))} placeholder="เลือกปลายทาง" />
                                </Form.Item>

                                <Row gutter={8} style={{ marginTop: 16 }}>
                                    <Col span={16}>
                                        <Button type="primary" block icon={<SaveOutlined />} onClick={handleSaveHeader} size="large">
                                            บันทึกข้อมูล
                                        </Button>
                                    </Col>
                                    <Col span={8}>
                                        <Button type="default" danger block icon={<CloseOutlined />} onClick={handleCancelBooking} size="large">
                                            ยกเลิกใบเบิก
                                        </Button>
                                    </Col>
                                </Row>
                            </Form>
                        </Card>
                    </Col>
                    <Col xs={24} md={17}>
                        <div className="bg-white p-4 rounded-lg shadow-sm h-full flex flex-col">
                            <div className="flex justify-between items-center mb-2">
                                <Title level={5} style={{ margin: 0 }}>รายการในตะกร้า ({scannedList.length})</Title>
                                <Button danger icon={<ReloadOutlined />} onClick={handleReturnToStock} disabled={selectedIds.length === 0}>
                                    ยกเลิกจ่ายออก
                                </Button>
                            </div>
                            <div className="flex-1" style={{ minHeight: 400 }}>
                                <DataTable
                                    rowData={scannedList}
                                    columnDefs={columnDefs}
                                    loading={loading}
                                    getRowId={(p) => p.data.asset_code}
                                    onSelectionChanged={(p) => setSelectedIds(p.api.getSelectedRows().map(r => r.asset_code))}
                                    onGridReady={(p) => gridApiRef.current = p.api}
                                    onRowClicked={(params) => setLastScanned(params.data)}
                                    rowClass="cursor-pointer hover:bg-blue-50"
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