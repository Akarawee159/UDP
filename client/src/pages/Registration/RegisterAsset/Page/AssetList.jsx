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
    PlusCircleOutlined, NumberOutlined,
    BgColorsOutlined, ExpandAltOutlined, InboxOutlined,
    PictureOutlined, UserOutlined, SyncOutlined, SolutionOutlined, TagOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from "../../../../api";
import { ThaiDateInput } from '../../../../components/form/ThaiDateInput';
import DataTable from '../../../../components/aggrid/DataTable';
import ModalAssetList from './ModalAssetList';
import ModalDepartment from './ModalDepartment';

// Import สำหรับการพิมพ์
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';

const { Title, Text } = Typography;

function AssetList() {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;

    const containerStyle = useMemo(() => ({
        margin: isMd ? '-8px' : '0',
        padding: isMd ? '16px' : '8px', // ปรับ Padding บนมือถือให้เล็กลง
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
    const [isModalDeptOpen, setIsModalDeptOpen] = useState(false);
    const [lastSavedLot, setLastSavedLot] = useState(null);
    const [isPrinting, setIsPrinting] = useState(false);

    const [employeeOptions, setEmployeeOptions] = useState([]);
    const [supplierOptions, setSupplierOptions] = useState([]);

    const [selectedDrawings, setSelectedDrawings] = useState({});
    const [isFormLocked, setIsFormLocked] = useState(false);
    const [selectedRows, setSelectedRows] = useState([]);
    const [printList, setPrintList] = useState([]);
    const printRef = useRef();

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
            const updatePromises = selectedRows.map(row => api.patch(`/registration/registerasset/print/${row.asset_code}`));
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

    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const resUnit = await api.get('/masterdata/material/options');
                const dataUnit = resUnit.data?.data || {};
                if (dataUnit.units) {
                    const opts = dataUnit.units.map(u => ({ label: u.name, value: u.name }));
                    setUnitOptions(opts);
                }

                const resOpts = await api.get('/registration/registerasset/options');
                if (resOpts.data?.success) {
                    const { employees, suppliers } = resOpts.data.data;
                    const empOpts = employees.map(e => {
                        const fullName = `${e.titlename_th || ''}${e.firstname_th} ${e.lastname_th}`;
                        return { label: `${e.employee_code} : ${fullName}`, value: fullName };
                    });
                    setEmployeeOptions(empOpts);

                    const supOpts = suppliers.map(s => {
                        return { label: `${s.supplier_code} : ${s.supplier_name}`, value: s.supplier_name, code: s.supplier_code };
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

    const handleMaterialSelect = (material) => {
        form.setFieldsValue({
            asset_code: material.material_code,
            asset_detail: material.material_name,
            asset_type: material.material_type,
            asset_model: material.material_model,
            asset_remark: material.material_remark,
            asset_usedfor: material.material_usedfor,
            asset_brand: material.material_brand,
            asset_source: material.material_source,
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

    const handleDepartmentSelect = (dept) => {
        form.setFieldsValue({
            asset_responsible_department: dept.G_CODE
        });
        message.success(`เลือกฝ่าย: ${dept.G_CODE} เรียบร้อย`);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const targetSupplier = supplierOptions.find(opt => opt.value === values.asset_location);
            const assetOrigin = targetSupplier ? targetSupplier.code : '';

            const payload = {
                ...values,
                asset_origin: assetOrigin,
                asset_date: values.asset_date ? dayjs(values.asset_date).format('YYYY-MM-DD') : null,
                asset_img: displayedImage ? displayedImage.split('/').pop() : '',
                ...selectedDrawings
            };

            const res = await api.post('/registration/registerasset', payload);

            if (res.data?.success) {
                const newRows = res.data.data;
                const createdLot = res.data.lot;

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
            cancelText: 'ยืนยันลบ',
            cancelButtonProps: { type: 'primary', danger: true },
            okText: 'ยกเลิก',
            okType: 'default',
            okButtonProps: { danger: false },
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
                    throw err;
                }
            },
            onOk: () => { }
        });
    };

    const doClearForm = () => {
        form.resetFields();
        form.setFieldValue('asset_lot', 'Auto Generate');
        setDisplayedImage(null);
        setSelectedDrawings({});
        setIsFormLocked(false);
        message.info('ยกเลิกการขึ้นทะเบียนเรียบร้อยแล้ว');
    };

    const columnDefs = useMemo(() => [
        { headerName: 'ลำดับ', valueGetter: "node.rowIndex + 1", width: 60, pinned: 'left', cellClass: "flex justify-center items-center", headerClass: "text-center justify-center" },
        { checkboxSelection: true, headerCheckboxSelection: true, width: 50, pinned: 'left', lockVisible: true, headerClass: 'header-center-checkbox', cellClass: "flex justify-center items-center" },
        {
            headerName: 'Label', field: 'label_register', width: 120, pinned: 'left',
            cellRenderer: (params) => (
                <Button
                    type="dashed"
                    size="small"
                    loading={isPrinting}
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
                const name = params.data.asset_status_name || params.value;
                const colorClass = params.data.asset_status_color || 'bg-gray-100 text-gray-600 border-gray-200';
                return <div className={`px-2 py-0.5 rounded border text-xs text-center font-medium ${colorClass}`}>{name}</div>;
            }
        },
        {
            headerName: 'สถานะทรัพย์สิน', field: 'is_status', width: 180,
            cellRenderer: (params) => {
                const name = params.data.is_status_name || params.value;
                const colorClass = params.data.is_status_color || 'bg-gray-100 text-gray-600 border-gray-200';
                return <div className={`px-2 py-0.5 rounded border text-xs text-center font-medium ${colorClass}`}>{name}</div>;
            }
        },
        { headerName: 'รหัสทรัพย์สิน', field: 'asset_code', width: 180 },
        { headerName: 'Lot No', field: 'asset_lot', width: 150 },
        { headerName: 'รายละเอียดทรัพย์สิน', field: 'asset_detail', width: 200 },
        { headerName: 'ประเภททรัพย์สิน', field: 'asset_type', width: 180 },
        { headerName: 'โมเดล', field: 'asset_model', width: 180 },
        { headerName: 'ที่อยู่ทรัพย์สิน', field: 'asset_location', width: 150 },
        { headerName: 'Part Code', field: 'partCode', width: 150 },
        { headerName: 'Part Name', field: 'partName', width: 150 },
        { headerName: 'Label Code', field: 'label_register', width: 150 },
        { headerName: 'เลขที่เอกสาร', field: 'doc_no', width: 150 },
        { headerName: 'วันที่ขึ้นทะเบียน', field: 'create_date', width: 180, valueFormatter: (params) => params.value ? dayjs(params.value).format('DD/MM/YYYY') : '-' },
        { headerName: 'ผู้ครอบครอง', field: 'asset_holder', width: 150 },
        { headerName: 'ใช้สำหรับงาน', field: 'asset_usedfor', width: 150 },
        { headerName: 'ผู้จำหน่าย', field: 'asset_supplier_name', width: 150 },
        { headerName: 'ยี่ห้อ', field: 'asset_brand', width: 150 },
        { headerName: 'แหล่งที่มา', field: 'asset_source', width: 150 },
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
            {/* --- Header (Responsive) --- */}
            <div className="bg-white px-4 sm:px-6 py-2 border-b rounded-md border-gray-300 flex items-center justify-between sticky top-0 z-20 shadow-sm backdrop-blur-sm bg-white/90">
                <div className="flex items-center gap-2 sm:gap-4 flex-1 overflow-hidden">
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} shape="circle" className="border-gray-200 text-slate-500 hover:text-blue-600 hover:border-blue-600 shrink-0" />
                    <div className="truncate">
                        <Title level={4} style={{ margin: 0 }} className="text-slate-800 flex items-center gap-2 text-base sm:text-lg">
                            <span className="bg-blue-600 w-1.5 sm:w-2 h-5 sm:h-6 rounded-r-md block"></span>
                            <span className="truncate">ลงทะเบียนทรัพย์สิน</span>
                        </Title>
                        <Text className="text-slate-500 text-[10px] sm:text-xs ml-3 sm:ml-4 truncate block">ระบบจัดการและสร้างรายการทรัพย์สินใหม่</Text>
                    </div>
                </div>
                <Button type="text" danger icon={<CloseOutlined />} onClick={() => navigate(-1)} className="hover:bg-red-50 rounded-full shrink-0 hidden sm:flex">ปิด</Button>
                <Button type="text" danger icon={<CloseOutlined />} onClick={() => navigate(-1)} className="hover:bg-red-50 rounded-full shrink-0 sm:hidden" />
            </div>

            <div className="p-0 sm:p-2 flex-1 overflow-hidden flex flex-col mt-2 sm:mt-0">
                <Form form={form} layout="vertical">
                    <Card
                        className="shadow-sm border-gray-200 rounded-xl h-full flex flex-col"
                        styles={{ body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
                    >
                        <Row>
                            {/* --- Col 1: ข้อมูลทั่วไป --- */}
                            <Col xs={24} lg={8} className="p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-gray-100 bg-white">
                                <div className="mb-4 sm:mb-5 flex items-center gap-2 text-slate-700">
                                    <FileTextOutlined className="text-blue-500 text-lg" />
                                    <span className="font-semibold text-base">ข้อมูลทั่วไป</span>
                                </div>
                                <Form.Item name="asset_remark" hidden><Input /></Form.Item>
                                <Form.Item name="asset_feature" hidden><Input /></Form.Item>
                                <Form.Item name="asset_type" hidden><Input /></Form.Item>

                                {/* ใช้ xs={24} sm={12} เพื่อให้ช่อง input เรียงซ้อนบนมือถือ เรียงคู่บน Desktop/Tablet */}
                                <Row gutter={12}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="รหัสทรัพย์สิน" name="asset_code" rules={[{ required: true, message: 'ระบุรหัสทรัพย์สิน' }]}>
                                            <Input
                                                prefix={<BarcodeOutlined className="text-slate-400 mr-1" />}
                                                placeholder="Scan / ระบุรหัส"
                                                disabled={isFormLocked}
                                                readOnly
                                                addonAfter={
                                                    <Button type="text" size="small" icon={<PlusCircleOutlined />} className="!text-blue-600 hover:!text-blue-700 font-medium" onClick={() => setIsModalListOpen(true)} disabled={isFormLocked}>เลือก</Button>
                                                }
                                                className="rounded-lg"
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="ฝ่ายที่รับผิดชอบ" name="asset_responsible_department" rules={[{ required: true, message: 'ระบุฝ่ายที่รับผิดชอบ' }]}>
                                            <Input
                                                prefix={<UserOutlined className="text-slate-400 mr-1" />}
                                                placeholder="เลือกฝ่ายที่รับผิดชอบ"
                                                disabled={isFormLocked}
                                                readOnly
                                                addonAfter={
                                                    <Button type="text" size="small" icon={<PlusCircleOutlined />} className="!text-blue-600 hover:!text-blue-700 font-medium" onClick={() => setIsModalDeptOpen(true)} disabled={isFormLocked}>เลือก</Button>
                                                }
                                                className="rounded-lg"
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={12}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="ใช้สำหรับ" name="asset_usedfor" rules={[{ required: true, message: 'ระบุใช้สำหรับ' }]}>
                                            <Select
                                                placeholder="เลือกประเภทการใช้งาน"
                                                disabled={isFormLocked}
                                                options={[
                                                    { label: 'ใช้ภายใน', value: '01' },
                                                    { label: 'ใช้ภายนอก', value: '02' }
                                                ]}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="โมเดล" name="asset_model" rules={[{ required: true, message: 'ระบุโมเดล' }]}>
                                            <Input prefix={<InboxOutlined className="text-slate-400" />} placeholder="ระบุโมเดล" disabled={isFormLocked} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={12}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="เลขที่เอกสาร" name="doc_no" rules={[{ required: true, message: 'กรุณาระบุเลขที่เอกสาร' }]}>
                                            <Input prefix={<FileTextOutlined className="text-slate-400" />} placeholder="PO123456" disabled={isFormLocked} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="วันที่ซื้อ" name="asset_date">
                                            <ThaiDateInput placeholder="เลือกวันที่" disabled={isFormLocked} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={12}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="ชื่อทรัพย์สิน" name="asset_detail">
                                            <Input prefix={<TagOutlined className="text-slate-400" />} placeholder="ระบุชื่อทรัพย์สิน" disabled={isFormLocked} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="สี" name="asset_color">
                                            <Input prefix={<BgColorsOutlined className="text-slate-400" />} placeholder="สี" disabled={isFormLocked} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={12}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="ผู้จำหน่าย" name="asset_supplier_name">
                                            <Input prefix={<SolutionOutlined className="text-slate-400" />} placeholder="ผู้จำหน่าย" disabled={isFormLocked} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="แบรนด์" name="asset_brand">
                                            <Input prefix={<NumberOutlined className="text-slate-400" />} placeholder="แบรนด์" disabled={isFormLocked} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={12}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="แหล่งที่มา" name="asset_source">
                                            <Input prefix={<NumberOutlined className="text-slate-400" />} placeholder="แหล่งที่มา" disabled={isFormLocked} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="หมายเลขล็อต" name="asset_lot">
                                            <Input prefix={<SyncOutlined className="text-slate-400" />} className="bg-gray-50 text-gray-500" readOnly placeholder="Auto Generate" disabled={isFormLocked} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Col>

                            {/* --- Col 2: Specs & QTY --- */}
                            <Col xs={24} lg={8} className="p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-gray-100 bg-slate-50/30">
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg mb-6 sm:mb-8 relative overflow-hidden group transition-all hover:shadow-blue-300">
                                    <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                                    <div className="absolute bottom-[-20px] left-[-20px] w-20 h-20 bg-white/10 rounded-full blur-lg"></div>

                                    <div className="text-center relative z-10">
                                        <div className="text-blue-100 text-[10px] sm:text-sm font-medium mb-2 uppercase tracking-wide flex justify-center items-center gap-2">
                                            <NumberOutlined /> จำนวนที่ต้องการขึ้นทะเบียน (QTY)
                                        </div>
                                        <Form.Item name="quantity" className="mb-0" rules={[{ required: true, message: 'กรุณาระบุจำนวน' }]}>
                                            <InputNumber
                                                min={1} max={9999} maxLength={4} precision={0} placeholder="0" variant="borderless"
                                                className="w-full text-center input-qty-highlight text-4xl sm:text-[48px]"
                                                style={{ fontWeight: 'bold', color: 'white', background: 'transparent' }}
                                                controls={true}
                                                onKeyPress={(event) => { if (!/[0-9]/.test(event.key)) event.preventDefault(); }}
                                                disabled={isFormLocked}
                                            />
                                        </Form.Item>
                                        <div className="h-px bg-white/20 w-1/2 mx-auto my-2"></div>
                                        <div className="text-[10px] sm:text-xs text-blue-200">ระบุจำนวนที่ต้องการ Generate Label</div>
                                    </div>
                                </div>

                                {/* ปรับปุ่ม Action สำหรับ Responsive */}
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-1 mt-1 w-full">
                                    <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} disabled={isFormLocked} className="bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-200 px-6 h-10 sm:h-9 rounded-lg font-semibold border-none w-full sm:w-auto">
                                        บันทึกการขึ้นทะเบียน
                                    </Button>
                                    <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block"></div>
                                    <Button type="primary" danger icon={<DeleteOutlined />} onClick={handleClearAll} className="shadow-md shadow-red-200 px-6 h-10 sm:h-9 rounded-lg font-semibold w-full sm:w-auto">
                                        ยกเลิกการขึ้นทะเบียน
                                    </Button>
                                </div>

                                <div className="mt-6">
                                    <div className="flex items-center gap-2 text-slate-700 mb-4">
                                        <ExpandAltOutlined className="text-orange-500 text-lg" />
                                        <span className="font-semibold text-base">ขนาดและน้ำหนัก</span>
                                    </div>
                                    <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                                        <SpecInput label="ความกว้าง" name="asset_width" unitName="asset_width_unit" unitOptions={unitOptions} disabled={isFormLocked} />
                                        <SpecInput label="ความยาว" name="asset_length" unitName="asset_length_unit" unitOptions={unitOptions} disabled={isFormLocked} />
                                        <SpecInput label="ความสูง" name="asset_height" unitName="asset_height_unit" unitOptions={unitOptions} disabled={isFormLocked} />
                                        <Divider className="my-2 border-gray-100" />
                                        <SpecInput label="ความจุ" name="asset_capacity" unitName="asset_capacity_unit" unitOptions={unitOptions} disabled={isFormLocked} />
                                        <SpecInput label="น้ำหนัก" name="asset_weight" unitName="asset_weight_unit" unitOptions={unitOptions} disabled={isFormLocked} />
                                    </div>
                                </div>
                            </Col>

                            {/* --- Col 3: Image --- */}
                            <Col xs={24} lg={8} className="p-4 sm:p-6 bg-white flex flex-col h-full">
                                <div className="mb-4 flex items-center gap-2 text-slate-700">
                                    <PictureOutlined className="text-purple-500 text-lg" />
                                    <span className="font-semibold text-base">รูปภาพทรัพย์สิน</span>
                                </div>
                                <div className="flex-1 flex flex-col">
                                    <div className="relative w-full aspect-[4/3] bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shadow-inner group hover:border-blue-400 transition-colors">
                                        {displayedImage ? (
                                            <>
                                                <Image src={displayedImage} className="object-contain w-full h-full" style={{ maxHeight: '100%', maxWidth: '100%' }} alt="Asset Image" />
                                                <div className="absolute top-3 right-3">
                                                    <Badge status="processing" text={<span className="bg-white/90 px-2 py-0.5 rounded text-xs font-bold shadow-sm text-green-600">PREVIEW</span>} />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center p-6">
                                                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm group-hover:scale-110 transition-transform">
                                                    <PictureOutlined className="text-2xl sm:text-3xl text-slate-300 group-hover:text-blue-400 transition-colors" />
                                                </div>
                                                <Text className="text-slate-400 block text-sm">ไม่มีรูปภาพแสดง</Text>
                                                <Text className="text-slate-300 text-[10px] sm:text-xs">(รูปภาพจะปรากฏเมื่อเลือกสินค้า)</Text>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                        <div className="flex items-start gap-2 sm:gap-3">
                                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600"><InboxOutlined className="text-xs sm:text-base" /></div>
                                            <div>
                                                <Text strong className="text-slate-700 block text-xs sm:text-sm">หมายเหตุ</Text>
                                                <Text className="text-slate-500 text-[10px] sm:text-xs">ข้อมูลขนาดและรูปภาพจะถูกดึงมาอัตโนมัติเมื่อทำการเลือกรายการสินค้า (Master Data)</Text>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </Card>
                </Form>

                {/* === SECTION 2: Table === */}
                <Card className="shadow-sm border-gray-200 rounded-xl mt-4 sm:mt-2" styles={{ body: { padding: 0 } }}>
                    <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white rounded-t-xl">
                        {/* ปรับ Toolbar ค้นหา และพิมพ์ ให้ Responsive เต็มจอในมือถือ */}
                        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 w-full md:w-auto">
                            <Input
                                prefix={<SearchOutlined className="text-gray-400" />}
                                placeholder="ค้นหา รหัส, รายละเอียด..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                allowClear
                                variant="borderless"
                                className="w-full sm:w-64 bg-transparent"
                            />
                            <div className="h-px w-full sm:w-px sm:h-6 bg-gray-200 mx-1"></div>
                            <Button
                                type="primary"
                                icon={<PrinterOutlined />}
                                onClick={handleBulkPrint}
                                loading={isPrinting}
                                disabled={isPrinting || selectedRows.length === 0}
                                className="bg-emerald-600 hover:bg-emerald-500 border-none h-10 sm:h-9 rounded-lg px-4 font-medium shadow-md w-full sm:w-auto"
                            >
                                พิมพ์สติ๊กเกอร์ ({selectedRows.length})
                            </Button>
                        </div>
                    </div>
                    {/* กำหนดให้ตารางไหลลื่นแนวนอน (overflow-x-auto) และปรับระดับความสูงให้เข้ากับอุปกรณ์ */}
                    <div className="w-full h-[400px] md:h-[500px] lg:h-[600px] overflow-hidden">
                        <DataTable
                            rowData={filteredRows}
                            columnDefs={columnDefs}
                            loading={false}
                            rowSelection="multiple"
                            suppressRowClickSelection={true}
                            onSelectionChanged={(params) => setSelectedRows(params.api.getSelectedRows())}
                        />
                    </div>
                </Card>
            </div >

            {/* Modal เลือก Master Data ทรัพย์สิน */}
            <ModalAssetList open={isModalListOpen} onClose={() => setIsModalListOpen(false)} onSelect={handleMaterialSelect} />

            {/* Modal เลือกแผนกที่เพิ่มมาใหม่ */}
            <ModalDepartment open={isModalDeptOpen} onClose={() => setIsModalDeptOpen(false)} onSelect={handleDepartmentSelect} />

            {/* --- Hidden Print Component --- */}
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    {printList.map((item, index) => (
                        <div key={index} style={{
                            width: '3cm',
                            height: '3cm',
                            padding: '0.1cm',
                            boxSizing: 'border-box',
                            display: 'flex',
                            flexDirection: 'column', /* เปลี่ยนจาก row เป็น column เพื่อให้อยู่บน-ล่าง */
                            alignItems: 'center',    /* จัดกึ่งกลางแนวนอน */
                            justifyContent: 'center',/* จัดกึ่งกลางแนวตั้ง */
                            border: '1px solid #ddd',
                            overflow: 'hidden',
                            pageBreakAfter: 'always',
                            fontFamily: 'sans-serif',
                            gap: '4px'               /* ระยะห่างระหว่าง QR Code และข้อความ */
                        }}>
                            {/* 1. QR Code แสดงอยู่ด้านบน */}
                            <div>
                                <QRCodeSVG
                                    value={item.label_register}
                                    size={90} /* ปรับขนาดให้ใหญ่ขึ้นเล็กน้อยเพื่อให้สแกนง่ายในขนาด 3x3 ซม. */
                                    level={"M"}
                                />
                            </div>

                            {/* 2. รหัสทรัพย์สิน แสดงอยู่ด้านล่าง */}
                            <div style={{ textAlign: 'center', overflow: 'hidden' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '5px' }}> {/* ปรับ fontSize ให้พอดีกับการพิมพ์ (2px จะเล็กเกินไปตอนพิมพ์จริง) */}
                                    {item.asset_code}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .input-qty-highlight input { text-align: center !important; color: white !important; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .input-qty-highlight .ant-input-number-handler-wrap { opacity: 0.5; background: rgba(255,255,255,0.1); }
                .input-qty-highlight:hover .ant-input-number-handler-wrap { opacity: 1; }
                .input-qty-highlight .ant-input-number-handler-up, .input-qty-highlight .ant-input-number-handler-down { border-left: 1px solid rgba(255,255,255,0.2); }
                .input-qty-highlight .anticon { color: white; }
            `}} />
        </div >
    );
}

// ปรับแต่ง SpecInput เพื่อให้ Field ภายในมีความ Responsive โดย Dropdown ไม่เบียดช่องกรอกข้อมูลเกินไป
const SpecInput = ({ label, name, unitName, unitOptions, disabled }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 text-sm">
        <div className="text-slate-500 sm:w-24 flex-shrink-0 text-[13px] sm:text-sm">{label}</div>
        <div className={`flex flex-1 shadow-sm rounded-md overflow-hidden border border-gray-200 transition-colors ${disabled ? 'bg-gray-100' : 'focus-within:border-blue-400'} w-full`}>
            <Form.Item name={name} noStyle>
                <InputNumber
                    placeholder="0.00"
                    className="flex-1 border-0 shadow-none !rounded-none focus:shadow-none min-w-[60px]"
                    min={0}
                    precision={2}
                    disabled={disabled}
                    onKeyPress={(event) => { if (!/[0-9.]/.test(event.key)) event.preventDefault(); }}
                />
            </Form.Item>
            <div className="w-px bg-gray-200"></div>
            <Form.Item name={unitName} noStyle>
                <Select
                    placeholder="หน่วย"
                    className="bg-slate-50 text-xs w-[80px] sm:w-[120px]"
                    variant="borderless"
                    options={unitOptions}
                    disabled={disabled}
                    popupMatchSelectWidth={false}
                />
            </Form.Item>
        </div>
    </div>
);

export default AssetList;