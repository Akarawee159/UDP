import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Form, Input, Button, Select, Row, Col, Card, Image, Typography,
    App, Grid, Space, Descriptions, Divider
} from 'antd';
import {
    ArrowLeftOutlined, CloseOutlined, ReloadOutlined,
    InboxOutlined, QrcodeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from "../../../../api"; // path ของ axios instance คุณ
import DataTable from '../../../../components/aggrid/DataTable';

const { Title, Text } = Typography;

function SystemOutList() {
    const navigate = useNavigate();
    const { message, modal } = App.useApp();
    const [form] = Form.useForm();

    // State
    const [scannedList, setScannedList] = useState([]); // ข้อมูลตาราง (Status 16)
    const [lastScanned, setLastScanned] = useState(null); // ข้อมูลตัวล่าสุดที่สแกน (แสดงข้างบน)
    const [zones, setZones] = useState([]); // Dropdown data
    const [loading, setLoading] = useState(false);

    // Ag-Grid Ref
    const gridApiRef = useRef(null);
    const [selectedIds, setSelectedIds] = useState([]);

    // --- 1. โหลดข้อมูลเริ่มต้น ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [resList, resZone] = await Promise.all([
                api.get('/smartpackage/systemout/list'),
                api.get('/smartpackage/systemout/dropdowns')
            ]);
            setScannedList(resList.data.data || []);
            setZones(resZone.data.zones || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- 2. Socket Listener (Real-time) ---
    useEffect(() => {
        const handleSocketUpdate = (event) => {
            // เมื่อมีการ Scan หรือ Return จากเครื่องอื่น หรือเครื่องนี้
            // ให้โหลดข้อมูลตารางใหม่ทันที
            console.log("Socket Update Received:", event.detail);
            fetchData();

            // ถ้า action เป็น scan และเราเป็นคนสแกน (หรืออยากให้เด้งล่าสุดเหมือนกัน)
            if (event.detail?.action === 'scan' && event.detail?.data) {
                // อัปเดตตัวโชว์ข้างบน (Optional: เช็คว่าเป็นเครื่องเราไหม หรือจะโชว์หมด)
                setLastScanned(event.detail.data);
                message.success('สแกนสำเร็จ: ' + event.detail.data.asset_code);
            }
        };

        window.addEventListener('hrms:systemout-update', handleSocketUpdate);
        return () => window.removeEventListener('hrms:systemout-update', handleSocketUpdate);
    }, [fetchData, message]);

    // --- 3. QR Code Scanner Logic ---
    useEffect(() => {
        let buffer = '';
        let timeout = null;

        const handleKeyDown = (e) => {
            // ถ้าเผลอกด Enter ก็ให้ทำงานตามปกติ
            if (e.key === 'Enter') {
                if (buffer.trim().length > 0) handleScanProcess(buffer.trim());
                buffer = '';
                clearTimeout(timeout);
                return;
            }

            // เก็บค่าปุ่ม (กรองปุ่มพิเศษออก)
            if (e.key.length === 1) {
                buffer += e.key;
            }

            // Reset Timeout ทุกครั้งที่กดปุ่ม
            clearTimeout(timeout);

            // 🟢 แก้ไขตรงนี้: ถ้าหยุดพิมพ์เกิน 300ms ให้ตรวจสอบว่ามีข้อมูลไหม ถ้ามีให้ส่งเลย
            timeout = setTimeout(() => {
                if (buffer.length > 10) { // ถ้า buffer ยาวกว่า 10 ตัวอักษร น่าจะเป็น QR Code
                    console.log("Auto submitting buffer:", buffer);
                    handleScanProcess(buffer);
                }
                buffer = '';
            }, 300); // ขยายเวลาเป็น 300ms เผื่อเครื่องคอมช้า
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // ฟังก์ชันแปลงปุ่มที่กดผิดจากแป้นไทย ให้กลับเป็นอังกฤษ
    const fixThaiInput = (str) => {
        // ถ้ามี | อยู่แล้ว แสดงว่าถูกต้อง ไม่ต้องแก้
        if (str.includes('|')) return str;

        // Map แป้นไทย (Kedmanee) -> อังกฤษ
        const map = {
            'ๅ': '1', '/': '2', '-': '3', 'ภ': '4', 'ถ': '5', 'ุ': '6', 'ึ': '7', 'ค': '8', 'ต': '9', 'จ': '0',
            'ข': '-',  // ขีดกลาง
            'ฅ': '|',  // Pipe (Shift + \)
            '%': '|'   // บางที Scanner ส่ง Shift+5 แทน (กรณีแปลกๆ) แต่หลักๆ คือ ฅ
        };

        return str.split('').map(char => map[char] || char).join('');
    };

    const handleScanProcess = async (qrString) => {
        try {
            // ✅ แก้ไข: แปลงค่าก่อนใช้งาน
            const fixedQr = fixThaiInput(qrString);

            console.log("Original:", qrString, "Fixed:", fixedQr); // ดู Log เพื่อ debug

            // เรียก API Scan ส่งค่าที่แก้แล้วไป
            const res = await api.post('/smartpackage/systemout/scan', { qrString: fixedQr });

            if (res.data.success) {
                setLastScanned(res.data.data);
                // อาจจะเพิ่มเสียง Beep ยืนยันความถูกต้องตรงนี้
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            message.error(`Scan Error: ${msg}`);
        }
    };

    // --- 4. ปุ่มคืนคลัง ---
    const handleReturnToStock = async () => {
        if (selectedIds.length === 0) {
            message.warning('กรุณาเลือกรายการที่จะคืนคลัง');
            return;
        }
        try {
            // ส่งไป Backend (Backend ต้องรับ ids เป็น array ของ asset_code)
            await api.post('/smartpackage/systemout/return', { ids: selectedIds });
            message.success('คืนคลังเรียบร้อย');
            setSelectedIds([]);
            gridApiRef.current?.deselectAll();
        } catch (err) {
            message.error('เกิดข้อผิดพลาดในการคืนคลัง');
        }
    };

    // --- 5. Column Definition ---
    // Helper สร้าง URL รูป
    const getImgUrl = (filename, type = 'material') => {
        if (!filename) return null;
        const baseUrl = api.defaults.baseURL.replace('/api', ''); // ตัด /api ออกเพื่อเข้าถึง static files
        const folder = type === 'drawing' ? 'img/material/drawing' : 'img/material';
        return `${baseUrl}/${folder}/${filename}`;
    };

    const columnDefs = useMemo(() => [
        {
            headerName: '',
            checkboxSelection: true,
            headerCheckboxSelection: true,
            width: 50,
            pinned: 'left'
        },
        {
            headerName: 'ลำดับ',
            valueGetter: "node.rowIndex + 1",
            width: 70,
            pinned: 'left'
        },
        { headerName: 'QR CODE (Label)', field: 'label_register', width: 220 },
        { headerName: 'Lot', field: 'asset_lot', width: 120 },
        {
            headerName: 'สถานะ',
            field: 'status_name',
            width: 150,
            cellRenderer: (params) => {
                const colorClass = params.data.status_class || 'bg-gray-100 text-gray-800 border-gray-200';
                // แปลง Tailwind class string เป็น style object อย่างง่าย หรือใช้ className ใน span
                // แต่ AgGrid cellRenderer return JSX ได้
                return (
                    <span className={`px-2 py-1 rounded border text-xs font-bold ${colorClass}`}>
                        {params.value}
                    </span>
                );
            }
        },
        {
            headerName: 'รูปภาพ',
            field: 'asset_img',
            width: 100,
            cellRenderer: (params) => params.value ? (
                <Image
                    src={getImgUrl(params.value)}
                    height={30}
                    preview={{ mask: <InboxOutlined /> }}
                />
            ) : '-'
        },
        { headerName: 'รหัสทรัพย์สิน', field: 'asset_code', width: 150 },
        { headerName: 'ชื่อทรัพย์สิน', field: 'asset_detail', flex: 1, minWidth: 200 },
        { headerName: 'ประเภท', field: 'asset_type', width: 120 },
        { headerName: 'ผู้ผลิต', field: 'asset_supplier_name', width: 150 },
        { headerName: 'รายละเอียด', field: 'asset_remark', width: 200 },
    ], []);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            {/* Header Sticky */}
            <div className="bg-white px-6 py-2 border-b border-gray-300 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} shape="circle" />
                    <div>
                        <Title level={4} style={{ margin: 0 }} className="flex items-center gap-2">
                            <span className="bg-green-600 w-2 h-6 rounded-r-md block"></span>
                            ทำรายการจ่ายออก (System Out)
                        </Title>
                    </div>
                </div>
                <Button danger icon={<CloseOutlined />} onClick={() => navigate(-1)}>ปิด</Button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">

                {/* PART 1: รายละเอียดจากการสแกนล่าสุด */}
                <Card size="small" className="shadow-sm border-blue-200" title={<span><QrcodeOutlined /> ข้อมูลจากการสแกนล่าสุด</span>}>
                    {lastScanned ? (
                        <Row gutter={[16, 16]}>
                            <Col xs={24} md={4} className="text-center">
                                <Image
                                    src={getImgUrl(lastScanned.asset_img)}
                                    height={150}
                                    className="object-contain border rounded p-1"
                                    fallback="https://via.placeholder.com/150?text=No+Image"
                                />
                            </Col>
                            <Col xs={24} md={12}>
                                <Descriptions column={2} size="small" bordered>
                                    <Descriptions.Item label="รหัสทรัพย์สิน">{lastScanned.asset_code}</Descriptions.Item>
                                    <Descriptions.Item label="ประเภท">{lastScanned.asset_type}</Descriptions.Item>
                                    <Descriptions.Item label="ชื่อทรัพย์สิน" span={2} labelStyle={{ fontWeight: 'bold', color: 'blue' }}>
                                        {lastScanned.asset_detail}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="รายละเอียด" span={2}>{lastScanned.asset_remark || '-'}</Descriptions.Item>
                                    <Descriptions.Item label="ขนาด (กxยxส)">
                                        {`${lastScanned.asset_width || 0} x ${lastScanned.asset_length || 0} x ${lastScanned.asset_height || 0} ${lastScanned.asset_width_unit || ''}`}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="น้ำหนัก / ความจุ">
                                        {`${lastScanned.asset_weight || 0} ${lastScanned.asset_weight_unit || ''} / ${lastScanned.asset_capacity || 0} ${lastScanned.asset_capacity_unit || ''}`}
                                    </Descriptions.Item>
                                </Descriptions>
                            </Col>
                            <Col xs={24} md={8}>
                                <Text strong>แบบ Drawing:</Text>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {[1, 2, 3, 4, 5, 6].map(i => {
                                        const dwg = lastScanned[`asset_dmg_00${i}`];
                                        if (!dwg) return null;
                                        return (
                                            <Image
                                                key={i}
                                                src={getImgUrl(dwg, 'drawing')}
                                                width={60} height={60}
                                                className="border rounded object-cover"
                                            />
                                        )
                                    })}
                                </div>
                            </Col>
                        </Row>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            <QrcodeOutlined style={{ fontSize: 48 }} />
                            <p>กรุณาสแกน QR Code เพื่อเริ่มรายการ</p>
                        </div>
                    )}
                </Card>

                {/* PART 2: Split View */}
                <Row gutter={16}>
                    {/* LEFT 30%: Form ข้อมูลจ่ายออก */}
                    <Col xs={24} md={7} lg={7}>
                        <Card title="ข้อมูลจ่ายออก" className="h-full shadow-sm" size="small">
                            <Form layout="vertical" form={form} initialValues={{ objective: 'wait_issue' }}>
                                <Form.Item label="เลขที่เอกสารใบเบิก (Ref ID)" name="docNo">
                                    <Input placeholder="ระบุเลขที่เอกสาร" />
                                </Form.Item>
                                <Form.Item label="วัตถุประสงค์" name="objective">
                                    <Select>
                                        <Select.Option value="wait_issue">รอจ่ายออก</Select.Option>
                                        <Select.Option value="issue">จ่ายใช้งาน</Select.Option>
                                        <Select.Option value="sell">จำหน่าย</Select.Option>
                                    </Select>
                                </Form.Item>
                                <Form.Item label="ต้นทาง" name="origin">
                                    <Select placeholder="เลือกต้นทาง" showSearch optionFilterProp="children">
                                        {zones.map(z => <Select.Option key={z.name} value={z.name}>{z.name}</Select.Option>)}
                                    </Select>
                                </Form.Item>
                                <Form.Item label="ปลายทาง" name="destination">
                                    <Select placeholder="เลือกปลายทาง" showSearch optionFilterProp="children">
                                        {zones.map(z => <Select.Option key={z.name} value={z.name}>{z.name}</Select.Option>)}
                                    </Select>
                                </Form.Item>
                                <Button type="primary" block icon={<SaveOutlined />}>บันทึกข้อมูลจ่ายออก</Button>
                            </Form>
                        </Card>
                    </Col>

                    {/* RIGHT 70%: DataTable */}
                    <Col xs={24} md={17} lg={17}>
                        <div className="bg-white p-4 rounded-lg shadow-sm h-full flex flex-col">
                            <div className="flex justify-between items-center mb-2">
                                <Title level={5} style={{ margin: 0 }}>รายการจ่ายออก ({scannedList.length})</Title>
                                <Space>
                                    <Button
                                        danger
                                        type="primary"
                                        icon={<ReloadOutlined />}
                                        onClick={handleReturnToStock}
                                        disabled={selectedIds.length === 0}
                                    >
                                        คืนคลัง
                                    </Button>
                                </Space>
                            </div>

                            <div className="flex-1" style={{ minHeight: 400 }}>
                                <DataTable
                                    rowData={scannedList}
                                    columnDefs={columnDefs}
                                    loading={loading}

                                    // ✅ เพิ่มใหม่: บอก Ag-Grid ว่า Unique Key ของแถวคือ 'asset_code' 
                                    // (ถ้าไม่ใส่ Ag-Grid จะหา 'id' ไม่เจอแล้วจะทำงานรวน)
                                    getRowId={(params) => params.data.asset_code}

                                    onGridReady={(params) => {
                                        gridApiRef.current = params.api;
                                    }}

                                    // ✅ แก้ไข: ตอนติ๊กเลือก ให้ดึงค่า asset_code แทน id
                                    onSelectionChanged={(params) => {
                                        const selected = params.api.getSelectedRows();
                                        // เปลี่ยน r.id -> r.asset_code
                                        setSelectedIds(selected.map(r => r.asset_code));
                                    }}

                                    rowSelection={{
                                        mode: 'multiRow',
                                        checkboxes: true,
                                        headerCheckbox: true
                                    }}
                                />
                            </div>
                        </div>
                    </Col>
                </Row>

            </div>
        </div>
    );
}

// Icon Save ต้อง import เพิ่ม
import { SaveOutlined } from '@ant-design/icons';

export default SystemOutList;