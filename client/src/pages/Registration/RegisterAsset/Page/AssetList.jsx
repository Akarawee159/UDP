// src/pages/Registration/RegisterAsset/Page/AssetList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Form, Input, Button, Select, InputNumber,
    Row, Col, Card, Image, Typography, Divider, App, Grid, Badge
} from 'antd';
import {
    SaveOutlined, DeleteOutlined,
    SearchOutlined, PrinterOutlined,
    QrcodeOutlined, ArrowLeftOutlined, CloseOutlined,
    BarcodeOutlined, FileTextOutlined,
    UserOutlined, NumberOutlined,
    BgColorsOutlined, ExpandAltOutlined, InboxOutlined,
    PictureOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from "../../../../api";
import { ThaiDateInput } from '../../../../components/form/ThaiDateInput';
import DataTable from '../../../../components/aggrid/DataTable';
import ModalAssetList from './ModalAssetList';

// Import สำหรับการพิมพ์
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';

const { Title, Text } = Typography;

function AssetList() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;

    const containerStyle = useMemo(() => ({
        margin: isMd ? '-8px' : '0',
        padding: isMd ? '16px' : '12px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    }), [isMd]);

    const navigate = useNavigate();
    const { message, modal } = App.useApp?.() || { message: { success: console.log, error: console.error }, modal: {} };
    const [form] = Form.useForm();

    // State
    const [tableData, setTableData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [displayedImage, setDisplayedImage] = useState(null);
    const [unitOptions, setUnitOptions] = useState([]);
    const [isModalListOpen, setIsModalListOpen] = useState(false);
    const [lastSavedLot, setLastSavedLot] = useState(null);
    const [isPrinting, setIsPrinting] = useState(false);

    const [employeeOptions, setEmployeeOptions] = useState([]);
    const [supplierOptions, setSupplierOptions] = useState([]);

    // state สำหรับเก็บข้อมูล drawing ชั่วคราวเมื่อเลือก Material
    const [selectedDrawings, setSelectedDrawings] = useState({});

    // State สำหรับล็อกฟอร์ม
    const [isFormLocked, setIsFormLocked] = useState(false);

    // State สำหรับ Selection และ Printing
    const [selectedRows, setSelectedRows] = useState([]);
    const [printList, setPrintList] = useState([]); // เก็บ Array ของข้อมูลที่จะ Print
    const printRef = useRef();

    // --- Print Logic ---
    const handlePrintProcess = useReactToPrint({
        contentRef: printRef,
        onAfterPrint: () => {
            setPrintList([]); // Clear หลังจากพิมพ์เสร็จ
            setIsPrinting(false); // <--- 3. หยุด Loading เมื่อพิมพ์เสร็จ/ยกเลิก
        },
        onPrintError: () => {
            setIsPrinting(false); // <--- 4. หยุด Loading หากมี Error ตอนเรียก Print
        }
    });

    // 1. ฟังก์ชันพิมพ์รายตัว (จากปุ่มในตาราง)
    const handleIndividualPrint = async (row) => {
        setIsPrinting(true);
        try {
            const res = await api.patch(`/registration/registerasset/print/${row.asset_code}`);

            if (res.data?.success) {
                // รับค่าที่ Backend ส่งกลับมา
                const { print_status, is_status, is_status_name, is_status_color } = res.data;

                setTableData(prev => prev.map(item =>
                    item.asset_code === row.asset_code
                        ? {
                            ...item,
                            print_status,           // อัปเดตเลขจำนวนครั้ง
                            is_status,              // อัปเดตรหัสสถานะ (121/122)
                            is_status_name,         // อัปเดตชื่อสถานะ
                            is_status_color         // อัปเดตสี
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

    // 2. ฟังก์ชันพิมพ์หลายรายการ (จากปุ่มด้านบน)
    const handleBulkPrint = async () => {
        if (selectedRows.length === 0) {
            message.warning("กรุณาเลือกรายการที่ต้องการพิมพ์");
            return;
        }

        setIsPrinting(true);
        try {
            // เรียก API (Backend จะเปลี่ยน is_status เป็น 121 หรือ 122 ให้เอง)
            // และ map promise เพื่อรอผลลัพธ์ทั้งหมด
            const updatePromises = selectedRows.map(row =>
                api.patch(`/registration/registerasset/print/${row.asset_code}`)
            );

            // รอให้ Backend ทำงานเสร็จทุกตัว และรับค่าผลลัพธ์กลับมา
            const responses = await Promise.all(updatePromises);

            // สร้าง Map ของข้อมูลใหม่ โดยใช้ asset_code เป็น Key เพื่อให้ค้นหาง่าย
            const updatesMap = {};
            responses.forEach((res, index) => {
                // เช็คว่า API สำเร็จหรือไม่
                if (res.data?.success) {
                    // ใช้ asset_code จาก selectedRows ตัวที่ index ตรงกัน (เพราะ Promise.all คืนค่าตามลำดับ)
                    const assetCode = selectedRows[index].asset_code;
                    updatesMap[assetCode] = res.data; // เก็บข้อมูลใหม่ที่ได้จาก Server (status, color, name)
                }
            });

            // Update หน้าจอ Frontend ด้วยข้อมูลจริงจาก Server (Realtime & Dynamic)
            setTableData(prev => prev.map(item => {
                // ถ้า item นี้มีการอัปเดต (อยู่ใน updatesMap) ให้ใช้ค่าใหม่
                if (updatesMap[item.asset_code]) {
                    const newData = updatesMap[item.asset_code];
                    return {
                        ...item,
                        print_status: newData.print_status,           // จำนวนครั้งที่พิมพ์
                        is_status: newData.is_status,                 // รหัสสถานะ (121/122)
                        is_status_name: newData.is_status_name,       // ชื่อสถานะ (ดึงจาก Master Data)
                        is_status_color: newData.is_status_color      // สีสถานะ (ดึงจาก Master Data)
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

    // --- Fetch Options ---
    useEffect(() => {
        const fetchOptions = async () => {
            try {
                // 1. Fetch Units (Existing)
                const resUnit = await api.get('/masterdata/material/options');
                const dataUnit = resUnit.data?.data || {};
                if (dataUnit.units) {
                    const opts = dataUnit.units.map(u => ({ label: u.name, value: u.name }));
                    setUnitOptions(opts);
                }

                // 2. Fetch Employees & Suppliers (New)
                const resOpts = await api.get('/registration/registerasset/options');
                if (resOpts.data?.success) {
                    const { employees, suppliers } = resOpts.data.data;

                    // Map Employee Options
                    const empOpts = employees.map(e => {
                        const fullName = `${e.titlename_th || ''}${e.firstname_th} ${e.lastname_th}`;
                        const displayLabel = `${e.employee_code} : ${fullName}`;
                        return {
                            label: displayLabel, // สิ่งที่โชว์ใน List และใช้ Search
                            value: fullName      // สิ่งที่บันทึกลง DB (หรือจะใช้ displayLabel ก็ได้ตามต้องการ)
                        };
                    });
                    setEmployeeOptions(empOpts);

                    // Map Supplier Options
                    const supOpts = suppliers.map(s => {
                        const displayLabel = `${s.supplier_code} : ${s.supplier_name}`;
                        return {
                            label: displayLabel,
                            value: s.supplier_name // หรือ displayLabel ตามต้องการ
                        };
                    });
                    setSupplierOptions(supOpts);
                }

            } catch (err) {
                console.error("Error fetching options:", err);
            }
        };
        fetchOptions();
        form.setFieldsValue({ asset_lot: 'Auto Generate' });
    }, [form]);

    // คัดลอก remark จาก Material ไปยัง asset_remark
    const handleMaterialSelect = (material) => {
        form.setFieldsValue({
            asset_code: material.material_code,
            asset_detail: material.material_name,
            asset_type: material.material_type,
            asset_remark: material.material_remark,
            asset_usedfor: material.material_usedfor,
            asset_brand: material.material_brand,
            asset_feature: material.material_feature,
            asset_supplier_name: material.supplier_name,
            asset_width: material.material_width,
            asset_width_unit: material.material_width_unit,
            asset_length: material.material_length,
            asset_length_unit: material.material_length_unit,
            asset_height: material.material_height,
            asset_height_unit: material.material_height_unit,
            asset_capacity: material.material_capacity,
            asset_capacity_unit: material.material_capacity_unit,
            asset_weight: material.material_weight,
            asset_weight_unit: material.material_weight_unit,
        });

        setSelectedDrawings({
            drawing_001: material.drawing_001 || '',
            drawing_002: material.drawing_002 || '',
            drawing_003: material.drawing_003 || '',
            drawing_004: material.drawing_004 || '',
            drawing_005: material.drawing_005 || '',
            drawing_006: material.drawing_006 || '',
        });

        if (material.material_image) {
            const url = `${import.meta.env.VITE_API_PATH.replace('/api', '')}/img/material/${material.material_image}`;
            setDisplayedImage(url);
        } else {
            setDisplayedImage(null);
        }
        message.success(`เลือกรายการ: ${material.material_code} เรียบร้อย`);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const payload = {
                ...values,
                asset_date: values.asset_date ? dayjs(values.asset_date).format('YYYY-MM-DD') : null,
                asset_img: displayedImage ? displayedImage.split('/').pop() : '',
                ...selectedDrawings
            };

            const res = await api.post('/registration/registerasset', payload);

            if (res.data?.success) {
                const newRows = res.data.data;
                const createdLot = res.data.lot;

                // ✅ แก้ไข: ให้แสดงเฉพาะรายการที่สร้างล่าสุดเท่านั้น (Replace ไม่ใช่ Append)
                setTableData(newRows);

                setLastSavedLot(createdLot);
                form.setFieldValue('asset_lot', createdLot);
                setIsFormLocked(true);
                message.success(res.data.message || 'บันทึกข้อมูลสำเร็จ');
            }

        } catch (error) {
            console.error('Save Failed:', error);
            if (error?.errorFields) {
                message.error('กรุณากรอกข้อมูลให้ครบถ้วน');
            } else {
                message.error('เกิดข้อผิดพลาดในการบันทึก: ' + (error?.response?.data?.message || error.message));
            }
        }
    };

    const handleClearAll = () => {
        if (!lastSavedLot) {
            doClearForm();
            return;
        }

        modal.confirm({
            title: `ยืนยันการลบ Lot: ${lastSavedLot}`,
            content: `คุณต้องการลบรายการล่าสุด ใช่หรือไม่?`,

            // --- ส่วนที่แก้ไข: สลับข้อความและสไตล์ ---
            // ให้ปุ่มทางซ้าย (เดิมคือ Cancel) แสดงข้อความ "ยืนยันลบ" และเป็นสีแดง
            cancelText: 'ยืนยันลบ',
            cancelButtonProps: {
                type: 'primary',
                danger: true
            },

            // ให้ปุ่มทางขวา (เดิมคือ OK) แสดงข้อความ "ยกเลิก" และเป็นปุ่มธรรมดา
            okText: 'ยกเลิก',
            okType: 'default',
            okButtonProps: {
                danger: false
            },
            // -------------------------------------

            // ย้าย Logic การลบมาไว้ที่ onCancel แทน (เพราะตอนนี้ปุ่มลบคือปุ่มทางซ้าย)
            onCancel: async () => {
                try {
                    const res = await api.delete(`/registration/registerasset/${lastSavedLot}`);
                    if (res.data?.success) {
                        message.success(`ลบรายการ Lot ${lastSavedLot} เรียบร้อยแล้ว`);
                        setTableData([]);
                        setLastSavedLot(null);
                        doClearForm();
                    }
                } catch (err) {
                    message.error('ไม่สามารถลบข้อมูลได้: ' + (err?.response?.data?.message || err.message));
                    // ต้อง throw error เพื่อให้ Modal รู้ว่า process ไม่สำเร็จ (หยุด loading ถ้ามี)
                    throw err;
                }
            },

            // ปุ่ม OK (ทางขวา) กลายเป็นปุ่มยกเลิก ไม่ต้องทำอะไร (Modal จะปิดเอง)
            onOk: () => { }
        });
    };

    const doClearForm = () => {
        form.resetFields();
        form.setFieldValue('asset_lot', 'Auto Generate');
        setDisplayedImage(null);
        setSelectedDrawings({});
        setIsFormLocked(false);
        message.info('ล้างแบบฟอร์มเรียบร้อย');
    };

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
            checkboxSelection: true,
            headerCheckboxSelection: true, // ต้องเป็น true
            width: 50,
            pinned: 'left',
            lockVisible: true,

            // --- แก้ไขตรงนี้ ---
            // ลบพวก flex justify-center ออก แล้วใส่ชื่อ class เฉพาะลงไป
            headerClass: 'header-center-checkbox',

            cellClass: "flex justify-center items-center",
        },
        {
            headerName: 'Label', field: 'label_register', width: 120, pinned: 'left',
            cellRenderer: (params) => (
                <Button
                    type="dashed"
                    size="small"
                    // เพิ่ม loading ตรงนี้
                    loading={isPrinting}
                    // เพิ่ม disabled เพื่อกันกดซ้ำ
                    disabled={isPrinting}
                    icon={!isPrinting && <div className="flex items-center gap-1"><QrcodeOutlined /><PrinterOutlined /></div>}
                    className="flex items-center justify-center w-full text-blue-600 border-blue-200 hover:border-blue-500 hover:text-blue-500 bg-blue-50"
                    onClick={() => handleIndividualPrint(params.data)}
                >
                    {isPrinting ? 'รอ...' : 'Print'}
                </Button>
            )
        },
        {
            headerName: 'สถานะปริ้น', field: 'print_status', width: 150,
            cellRenderer: (params) => {
                const val = parseInt(params.value) || 0;
                if (val === 0) return <span className="text-orange-500 font-medium">ยังไม่ปริ้น</span>;
                if (val === 1) return <span className="text-green-600 font-bold">ปริ้นแล้ว</span>;
                return <span className="text-blue-600 font-bold">ปริ้นครั้งที่ {val}</span>;
            }
        },
        {
            headerName: 'สถานะใช้งาน', field: 'asset_status', width: 150,
            cellRenderer: (params) => {
                // Dynamic Status: ชื่อจาก asset_status_name, สีจาก asset_status_color (Tailwind class)
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
            headerName: 'สถานะทรัพย์สิน', field: 'is_status', width: 180,
            cellRenderer: (params) => {
                // Dynamic Status
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
        { headerName: 'Lot No', field: 'asset_lot', width: 150 },
        { headerName: 'รายละเอียดทรัพย์สิน', field: 'asset_detail', width: 200 },
        { headerName: 'ประเภททรัพย์สิน', field: 'asset_type', width: 180 },
        { headerName: 'ที่อยู่ทรัพย์สิน', field: 'asset_location', width: 150 },
        { headerName: 'Part Code', field: 'partCode', width: 150 },
        { headerName: 'Part Name', field: 'partName', width: 150 },
        { headerName: 'Label Code', field: 'label_register', width: 150 },
        { headerName: 'เลขที่เอกสาร', field: 'doc_no', width: 150 },
        { headerName: 'วันที่ขึ้นทะเบียน', field: 'asset_date', width: 180, valueFormatter: (params) => params.value ? dayjs(params.value).format('DD/MM/YYYY') : '-' },
        { headerName: 'ผู้ครอบครอง', field: 'asset_holder', width: 150 },
        { headerName: 'ใช้สำหรับงาน', field: 'asset_usedfor', width: 150 },
        { headerName: 'ผู้จำหน่าย', field: 'asset_supplier_name', width: 150 },
        { headerName: 'ยี่ห้อ', field: 'asset_brand', width: 150 },
        { headerName: 'คุณสมบัติ', field: 'asset_feature', width: 150 },
    ], [isPrinting]);

    const filteredRows = useMemo(() => {
        if (!searchTerm) return tableData;
        const lower = searchTerm.toLowerCase();
        return tableData.filter(r =>
            String(r.asset_code || '').toLowerCase().includes(lower) ||
            String(r.asset_detail || '').toLowerCase().includes(lower) ||
            String(r.partName || '').toLowerCase().includes(lower)
        );
    }, [tableData, searchTerm]);

    return (
        <div style={containerStyle} className="bg-slate-50 relative">

            {/* --- Header Bar (Sticky Top) --- */}
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
                            ลงทะเบียนทรัพย์สิน
                        </Title>
                        <Text className="text-slate-500 text-xs ml-4">ระบบจัดการและสร้างรายการทรัพย์สินใหม่ (Asset Registration)</Text>
                    </div>
                </div>
                <Button
                    type="text"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => navigate(-1)}
                    className="hover:bg-red-50 rounded-full"
                >
                    ปิด
                </Button>
            </div>

            {/* --- Main Content --- */}
            <div className="p-2 flex-1 overflow-hidden flex flex-col">

                {/* === SECTION 1: Form === */}
                <Form form={form} layout="vertical">
                    <Card
                        className="shadow-sm border-gray-200 rounded-xl h-full flex flex-col" // เพิ่ม h-full และ flex-col
                        styles={{
                            body: {
                                padding: 0,
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden' // สำคัญ: เพื่อให้ Grid scroll อยู่ภายใน Body นี้
                            }
                        }}
                    >
                        <Row>
                            {/* --- Col 1: ข้อมูลทั่วไป --- */}
                            <Col xs={24} lg={8} className="p-6 border-b lg:border-b-0 lg:border-r border-gray-100 bg-white">
                                <div className="mb-5 flex items-center gap-2 text-slate-700">
                                    <FileTextOutlined className="text-blue-500 text-lg" />
                                    <span className="font-semibold text-base">ข้อมูลทั่วไป</span>
                                </div>
                                <Form.Item name="asset_remark" hidden>
                                    <Input />
                                </Form.Item>
                                <Form.Item name="asset_usedfor" hidden>
                                    <Input />
                                </Form.Item>
                                <Form.Item name="asset_brand" hidden>
                                    <Input />
                                </Form.Item>
                                <Form.Item name="asset_feature" hidden>
                                    <Input />
                                </Form.Item>
                                <Form.Item name="asset_supplier_name" hidden>
                                    <Input />
                                </Form.Item>
                                <Form.Item label="รหัสทรัพย์สิน" name="asset_code" rules={[{ required: true, message: 'ระบุรหัสทรัพย์สิน' }]}>
                                    <Input
                                        size="large"
                                        prefix={<BarcodeOutlined className="text-slate-400 mr-1" />}
                                        placeholder="Scan / ระบุรหัส"
                                        disabled={isFormLocked}
                                        readOnly
                                        addonAfter={
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<SearchOutlined />}
                                                className="text-blue-600 hover:text-blue-700 font-medium"
                                                onClick={() => setIsModalListOpen(true)}
                                                disabled={isFormLocked}
                                            >
                                                เลือกทรัพย์สิน
                                            </Button>
                                        }
                                        className="rounded-lg"
                                    />
                                </Form.Item>

                                <Form.Item label="ชื่อทรัพย์สิน" name="asset_detail" rules={[{ required: true, message: 'ระบุชื่อทรัพย์สิน' }]}>
                                    <Input size="large" prefix={<FileTextOutlined className="text-slate-400 mr-1" />} placeholder="ระบุชื่อทรัพย์สิน" className="rounded-lg" disabled={isFormLocked} />
                                </Form.Item>

                                <Row gutter={12}>
                                    <Col span={12}>
                                        <Form.Item label="ประเภท" name="asset_type">
                                            <Input prefix={<BgColorsOutlined className="text-slate-400" />} placeholder="ประเภท" disabled={isFormLocked} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item label="วันที่ซื้อ" name="asset_date">
                                            <ThaiDateInput placeholder="เลือกวันที่" disabled={isFormLocked} />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Row gutter={12}>
                                    <Col span={12}>
                                        <Form.Item label="เลขที่เอกสาร" name="docID">
                                            <Input prefix={<NumberOutlined className="text-slate-400" />} placeholder="DOC-XXX" disabled={isFormLocked} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item label="หมายเลขล็อต" name="asset_lot">
                                            <Input prefix={<InboxOutlined className="text-slate-400" />} className="bg-gray-50 text-gray-500" readOnly placeholder="Auto Generate" disabled={isFormLocked} />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Form.Item label="ผู้ครอบครอง" name="asset_holder">
                                    <Select
                                        showSearch
                                        placeholder="ค้นหา ชื่อ / รหัสพนักงาน"
                                        optionFilterProp="label"
                                        options={employeeOptions}
                                        disabled={isFormLocked}
                                        allowClear
                                        filterOption={(input, option) =>
                                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                        }
                                    />
                                </Form.Item>
                                <Form.Item label="ที่อยู่/ที่ติดตั้ง" name="asset_location" className="mb-0">
                                    <Select
                                        showSearch
                                        placeholder="ค้นหา Supplier Code / Name"
                                        optionFilterProp="label"
                                        options={supplierOptions}
                                        disabled={isFormLocked}
                                        allowClear
                                        className="rounded-lg"
                                        filterOption={(input, option) =>
                                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                        }
                                    />
                                </Form.Item>
                            </Col>

                            {/* --- Col 2: Specs & QTY --- */}
                            <Col xs={24} lg={8} className="p-6 border-b lg:border-b-0 lg:border-r border-gray-100 bg-slate-50/30">
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg mb-8 relative overflow-hidden group transition-all hover:shadow-blue-300">
                                    <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                                    <div className="absolute bottom-[-20px] left-[-20px] w-20 h-20 bg-white/10 rounded-full blur-lg"></div>

                                    <div className="text-center relative z-10">
                                        <div className="text-blue-100 text-sm font-medium mb-2 uppercase tracking-wide flex justify-center items-center gap-2">
                                            <NumberOutlined /> จำนวนที่ต้องการขึ้นทะเบียน (QTY)
                                        </div>
                                        <Form.Item name="quantity" className="mb-0" rules={[{ required: true, message: 'กรุณาระบุจำนวน' }]}>
                                            <InputNumber
                                                min={1}
                                                max={9999}
                                                maxLength={4}
                                                precision={0}
                                                placeholder="0"
                                                variant="borderless"
                                                className="w-full text-center input-qty-highlight"
                                                style={{
                                                    fontSize: '48px',
                                                    fontWeight: 'bold',
                                                    color: 'white',
                                                    background: 'transparent'
                                                }}
                                                controls={true}
                                                onKeyPress={(event) => {
                                                    if (!/[0-9]/.test(event.key)) {
                                                        event.preventDefault();
                                                    }
                                                }}
                                                disabled={isFormLocked}
                                            />
                                        </Form.Item>
                                        <div className="h-px bg-white/20 w-1/2 mx-auto my-2"></div>
                                        <div className="text-xs text-blue-200">ระบุจำนวนที่ต้องการ Generate Label</div>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <div className="flex items-center gap-2 text-slate-700 mb-4">
                                        <ExpandAltOutlined className="text-orange-500 text-lg" />
                                        <span className="font-semibold text-base">ขนาดและน้ำหนัก</span>
                                    </div>

                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                                        <SpecInput label="ความกว้าง" name="asset_width" unitName="asset_width_unit" unitOptions={unitOptions} disabled={isFormLocked} />
                                        <SpecInput label="ความยาว" name="asset_length" unitName="asset_length_unit" unitOptions={unitOptions} disabled={isFormLocked} />
                                        <SpecInput label="ความสูง" name="asset_height" unitName="asset_height_unit" unitOptions={unitOptions} disabled={isFormLocked} />
                                        <Divider className="my-2 border-gray-100" />
                                        <SpecInput label="ความจุ" name="asset_capacity" unitName="asset_capacity_unit" unitOptions={unitOptions} disabled={isFormLocked} />
                                        <SpecInput label="น้ำหนัก" name="asset_weight" unitName="asset_weight_unit" unitOptions={unitOptions} disabled={isFormLocked} />
                                    </div>
                                </div>
                                <div className="flex items-center justify-center gap-1 mt-1">
                                    <Button
                                        type="primary"
                                        icon={<SaveOutlined />}
                                        onClick={handleSave}
                                        disabled={isFormLocked}
                                        className="bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-200 px-6 h-9 rounded-lg font-semibold border-none"
                                    >
                                        บันทึกสร้างรายการ
                                    </Button>

                                    <div className="h-6 w-px bg-gray-200 mx-2"></div>

                                    <Button
                                        type="primary"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={handleClearAll}
                                        className="shadow-md shadow-red-200 px-6 h-9 rounded-lg font-semibold"
                                    >
                                        ลบรายการทั้งหมด
                                    </Button>
                                </div>
                            </Col>

                            {/* --- Col 3: Image --- */}
                            <Col xs={24} lg={8} className="p-6 bg-white flex flex-col h-full">
                                <div className="mb-4 flex items-center gap-2 text-slate-700">
                                    <PictureOutlined className="text-purple-500 text-lg" />
                                    <span className="font-semibold text-base">รูปภาพทรัพย์สิน</span>
                                </div>

                                <div className="flex-1 flex flex-col">
                                    <div className="relative w-full aspect-[4/3] bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shadow-inner group hover:border-blue-400 transition-colors">
                                        {displayedImage ? (
                                            <>
                                                <Image
                                                    src={displayedImage}
                                                    className="object-contain w-full h-full"
                                                    style={{ maxHeight: '100%', maxWidth: '100%' }}
                                                    alt="Asset Image"
                                                />
                                                <div className="absolute top-3 right-3">
                                                    <Badge status="processing" text={<span className="bg-white/90 px-2 py-0.5 rounded text-xs font-bold shadow-sm text-green-600">PREVIEW</span>} />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center p-6">
                                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm group-hover:scale-110 transition-transform">
                                                    <PictureOutlined className="text-3xl text-slate-300 group-hover:text-blue-400 transition-colors" />
                                                </div>
                                                <Text className="text-slate-400 block">ไม่มีรูปภาพแสดง</Text>
                                                <Text className="text-slate-300 text-xs">(รูปภาพจะปรากฏเมื่อเลือกสินค้า)</Text>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
                                                <InboxOutlined />
                                            </div>
                                            <div>
                                                <Text strong className="text-slate-700 block text-sm">หมายเหตุ</Text>
                                                <Text className="text-slate-500 text-xs">
                                                    ข้อมูลขนาดและรูปภาพจะถูกดึงมาอัตโนมัติเมื่อทำการเลือกรายการสินค้า (Master Data)
                                                </Text>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </Card>
                </Form>

                {/* === SECTION 2: Table === */}
                <Card className="shadow-sm border-gray-200 rounded-xl" styles={{ body: { padding: 0 } }}>
                    <div className="px-5 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-t-xl">
                        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
                            <Input
                                prefix={<SearchOutlined className="text-gray-400" />}
                                placeholder="ค้นหา รหัส, รายละเอียด..."
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
                                loading={isPrinting} // <--- ใส่ตรงนี้
                                disabled={isPrinting || selectedRows.length === 0} // กันกดซ้ำ
                                className="bg-emerald-600 hover:bg-emerald-500 border-none h-9 rounded-lg px-4 font-medium shadow-md"
                            >
                                พิมพ์สติ๊กเกอร์ ({selectedRows.length})
                            </Button>
                        </div>
                    </div>

                    <div style={{ height: 600 }} className="w-full">
                        <DataTable
                            rowData={filteredRows}
                            columnDefs={columnDefs}
                            loading={false}
                            rowSelection="multiple"
                            suppressRowClickSelection={true}
                            onSelectionChanged={(params) => {
                                setSelectedRows(params.api.getSelectedRows());
                            }}
                        />
                    </div>
                </Card>

            </div>

            {/* Modal */}
            <ModalAssetList
                open={isModalListOpen}
                onClose={() => setIsModalListOpen(false)}
                onSelect={handleMaterialSelect}
            />

            {/* --- Hidden Print Component --- */}
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    {/* Loop แสดงรายการที่เลือกพิมพ์ทั้งหมด */}
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
                                    size={80} // ปรับขนาดตามความเหมาะสมกับพื้นที่ 3.5cm
                                    level={"M"}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* CSS Override for InputNumber QTY */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .input-qty-highlight input {
                    text-align: center !important;
                    color: white !important;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .input-qty-highlight .ant-input-number-handler-wrap {
                    opacity: 0.5;
                    background: rgba(255,255,255,0.1);
                }
                .input-qty-highlight:hover .ant-input-number-handler-wrap {
                    opacity: 1;
                }
                .input-qty-highlight .ant-input-number-handler-up,
                .input-qty-highlight .ant-input-number-handler-down {
                    border-left: 1px solid rgba(255,255,255,0.2);
                }
                .input-qty-highlight .anticon {
                    color: white;
                }
            `}} />
        </div>
    );
}

// Helper Component for Specs
const SpecInput = ({ label, name, unitName, unitOptions, disabled }) => (
    <div className="flex items-center justify-between gap-2 text-sm">
        <div className="text-slate-500 w-24 flex-shrink-0">{label}</div>
        <div className={`flex flex-1 shadow-sm rounded-md overflow-hidden border border-gray-200 transition-colors ${disabled ? 'bg-gray-100' : 'focus-within:border-blue-400'}`}>
            <Form.Item name={name} noStyle>
                <InputNumber
                    placeholder="0.00"
                    className="flex-1 border-0 shadow-none !rounded-none focus:shadow-none"
                    min={0}
                    precision={2}
                    disabled={disabled} // ตอนนี้จะใช้งานได้แล้ว
                    onKeyPress={(event) => {
                        if (!/[0-9.]/.test(event.key)) {
                            event.preventDefault();
                        }
                    }}
                />
            </Form.Item>
            <div className="w-px bg-gray-200"></div>
            <Form.Item name={unitName} noStyle>
                <Select
                    placeholder="หน่วย"
                    style={{ width: 160 }}
                    options={unitOptions}
                    variant="borderless"
                    className="bg-slate-50 text-xs"
                    disabled={disabled} // ตอนนี้จะใช้งานได้แล้ว
                />
            </Form.Item>
        </div>
    </div>
);

export default AssetList;