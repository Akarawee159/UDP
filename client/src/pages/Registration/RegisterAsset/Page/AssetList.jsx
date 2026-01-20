import React, { useState, useMemo } from 'react';
import {
    Form, Input, Button, DatePicker, Select, InputNumber,
    Row, Col, Card, Upload, Image, Typography, Divider, App, Modal
} from 'antd';
import {
    SaveOutlined, DeleteOutlined,
    SearchOutlined, PrinterOutlined, FileImageOutlined,
    QrcodeOutlined, ArrowLeftOutlined, CloseOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

// Import Components
import DataTable from '../../../../components/aggrid/DataTable';
import ModalAssetList from './ModalAssetList'; // ✅ Import Modal

const { Title, Text } = Typography;
const { Dragger } = Upload;

function AssetList() {
    const navigate = useNavigate();
    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };
    const [form] = Form.useForm();

    // State
    const [fileList, setFileList] = useState([]);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [tableData, setTableData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // ✅ State สำหรับเปิด Modal เลือกสินค้า
    const [isModalListOpen, setIsModalListOpen] = useState(false);

    // --- Mock Data Options ---
    const unitOptions = [
        { label: 'ซม.', value: 'cm' },
        { label: 'มม.', value: 'mm' },
        { label: 'นิ้ว', value: 'in' },
        { label: 'กก.', value: 'kg' },
        { label: 'ลิตร', value: 'l' },
    ];

    // --- Handlers ---
    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const qty = values.quantity || 1;

            const newRows = Array.from({ length: qty }).map((_, index) => ({
                id: Date.now() + index,
                label: `LABEL-${Math.floor(Math.random() * 10000)}`,
                print_status: 'รอพิมพ์',
                active_status: 'ใช้งาน',
                asset_status: 'ปกติ',
                asset_code: values.asset_code,
                lot_no: values.lot_no,
                asset_detail: values.asset_detail,
                asset_type: values.asset_type,
                location: values.location,
                part_code: `PART-${values.asset_code}`,
                label_code: `LB-${Date.now()}-${index}`,
                doc_no: values.doc_no,
                reg_date: values.reg_date ? dayjs(values.reg_date).format('DD/MM/YYYY') : '-',
                possessor: values.possessor
            }));

            setTableData(prev => [...prev, ...newRows]);
            message.success(`สร้างรายการสำเร็จ ${qty} รายการ`);
        } catch (error) {
            console.error('Validation Failed:', error);
        }
    };

    const handleClearAll = () => {
        form.resetFields();
        setFileList([]);
        setTableData([]);
        message.info('ล้างรายการทั้งหมดเรียบร้อย');
    };

    const handlePreview = async (file) => {
        if (!file.url && !file.preview) {
            file.preview = await getBase64(file.originFileObj);
        }
        setPreviewImage(file.url || file.preview);
        setPreviewOpen(true);
    };

    const handleChange = ({ fileList: newFileList }) => setFileList(newFileList);

    // --- Column Definitions ---
    const columnDefs = useMemo(() => [
        { headerName: '', checkboxSelection: true, headerCheckboxSelection: true, width: 50, pinned: 'left', lockVisible: true },
        {
            headerName: 'Label', field: 'label', width: 120,
            cellRenderer: (params) => (
                <div className="flex items-center gap-2">
                    <QrcodeOutlined className="text-blue-600" />
                    <span>{params.value}</span>
                </div>
            )
        },
        { headerName: 'ลำดับ', valueGetter: "node.rowIndex + 1", width: 80, cellClass: "text-center" },
        { headerName: 'สถานะปริ้น', field: 'print_status', width: 120, cellClass: params => params.value === 'พิมพ์แล้ว' ? 'text-green-600 font-bold' : 'text-orange-500' },
        { headerName: 'สถานะใช้งาน', field: 'active_status', width: 120 },
        { headerName: 'สถานะทรัพย์สิน', field: 'asset_status', width: 140 },
        { headerName: 'รหัสทรัพย์สิน', field: 'asset_code', width: 150 },
        { headerName: 'Lot No', field: 'lot_no', width: 120 },
        { headerName: 'รายละเอียดทรัพย์สิน', field: 'asset_detail', width: 200 },
        { headerName: 'ประเภททรัพย์สิน', field: 'asset_type', width: 150 },
        { headerName: 'ที่อยู่ทรัพย์สิน', field: 'location', width: 200 },
        { headerName: 'Part Code', field: 'part_code', width: 150 },
        { headerName: 'Label Code', field: 'label_code', width: 150 },
        { headerName: 'เลขที่เอกสาร', field: 'doc_no', width: 150 },
        { headerName: 'วันที่ขึ้นทะเบียน', field: 'reg_date', width: 150 },
        { headerName: 'ผู้ครอบครอง', field: 'possessor', width: 150 },
    ], []);

    const filteredRows = useMemo(() => {
        if (!searchTerm) return tableData;
        const lower = searchTerm.toLowerCase();
        return tableData.filter(r =>
            String(r.asset_code).toLowerCase().includes(lower) ||
            String(r.asset_detail).toLowerCase().includes(lower) ||
            String(r.label).toLowerCase().includes(lower)
        );
    }, [tableData, searchTerm]);

    return (
        <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">

            {/* --- Header Bar --- */}
            <div className="bg-white px-6 py-3 border-b border-gray-200 flex items-center justify-between flex-none">
                <div className="flex items-center gap-4">
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate(-1)}
                        className="rounded-full border-none shadow-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    />
                    <div>
                        <Title level={4} style={{ margin: 0 }} className="text-slate-800">
                            รายการทรัพย์สิน (Asset List)
                        </Title>
                        <Text className="text-slate-500 text-sm">สร้างและจัดการรายการทรัพย์สินใหม่</Text>
                    </div>
                </div>
                {/* ✅ เพิ่มปุ่มปิด X ทางขวา */}
                <Button
                    type="text"
                    icon={<CloseOutlined style={{ fontSize: '18px' }} />}
                    onClick={() => navigate(-1)}
                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full w-10 h-10 flex items-center justify-center"
                />
            </div>

            {/* --- Main Content --- */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* === SECTION 1: Form === */}
                <Card className="shadow-sm border-gray-200 rounded-xl" styles={{ body: { padding: '24px' } }}>
                    <Form form={form} layout="vertical" initialValues={{ quantity: 1 }}>
                        <Row gutter={32}>

                            {/* --- Left Column: General Info --- */}
                            <Col xs={24} md={8} className="border-r border-gray-100">
                                <div className="mb-4">
                                    <h3 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                        <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                                        ข้อมูลทั่วไป
                                    </h3>

                                    <Form.Item label="รหัสสินค้า (Asset Code)" name="asset_code" rules={[{ required: true, message: 'ระบุรหัสสินค้า' }]}>
                                        <Input
                                            placeholder="ระบุรหัสสินค้า"
                                            addonAfter={
                                                // ✅ ปุ่มเลือกสินค้าเปิด Modal
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<SearchOutlined />}
                                                    className="text-blue-600 hover:text-blue-700 font-medium"
                                                    onClick={() => setIsModalListOpen(true)}
                                                >
                                                    เลือกสินค้า
                                                </Button>
                                            }
                                        />
                                    </Form.Item>

                                    {/* ... Inputs อื่นๆ คงเดิม ... */}
                                    <Form.Item label="ชื่อสินค้า (Asset Name)" name="asset_detail" rules={[{ required: true }]}>
                                        <Input placeholder="ระบุชื่อสินค้า" />
                                    </Form.Item>
                                    <Row gutter={12}>
                                        <Col span={12}><Form.Item label="เลขที่เอกสาร" name="doc_no"><Input placeholder="Ex. DOC-001" /></Form.Item></Col>
                                        <Col span={12}><Form.Item label="วันที่ซื้อ" name="reg_date"><DatePicker className="w-full" format="DD/MM/YYYY" placeholder="เลือกวันที่" /></Form.Item></Col>
                                    </Row>
                                    <Row gutter={12}>
                                        <Col span={12}><Form.Item label="Lot No." name="lot_no"><Input placeholder="Ex. LOT-2024" /></Form.Item></Col>
                                        <Col span={12}><Form.Item label="ประเภททรัพย์สิน" name="asset_type"><Select placeholder="เลือกประเภท" options={[{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }]} /></Form.Item></Col>
                                    </Row>
                                    <Form.Item label="ผู้ครอบครอง" name="possessor"><Input placeholder="ระบุชื่อผู้ครอบครอง" /></Form.Item>
                                    <Form.Item label="ที่อยู่/ที่ติดตั้ง" name="location"><Input.TextArea rows={2} placeholder="ระบุสถานที่" /></Form.Item>
                                </div>
                            </Col>

                            {/* --- Center Column: Specs --- */}
                            <Col xs={24} md={8} className="border-r border-gray-100 px-6">
                                <div className="mb-4">
                                    <h3 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                        <div className="w-1 h-5 bg-orange-500 rounded-full"></div>
                                        จำนวนและขนาด
                                    </h3>
                                    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 mb-6">
                                        <Form.Item label="จำนวนที่ต้องการสร้าง (Pcs)" name="quantity" className="mb-0" rules={[{ required: true }]}>
                                            <InputNumber min={1} className="w-full" size="large" placeholder="ระบุจำนวน" />
                                        </Form.Item>
                                    </div>
                                    <Divider orientation="left" className="text-slate-400 !text-xs">ขนาดสินค้า (Dimension)</Divider>
                                    <SpecInput label="ความกว้าง" name="width" unitName="width_unit" unitOptions={unitOptions} />
                                    <SpecInput label="ความยาว" name="length" unitName="length_unit" unitOptions={unitOptions} />
                                    <SpecInput label="ความสูง" name="height" unitName="height_unit" unitOptions={unitOptions} />
                                    <Divider orientation="left" className="text-slate-400 !text-xs">ความจุและน้ำหนัก</Divider>
                                    <SpecInput label="ความจุ" name="capacity" unitName="capacity_unit" unitOptions={unitOptions} />
                                    <SpecInput label="น้ำหนัก" name="weight" unitName="weight_unit" unitOptions={unitOptions} />
                                </div>
                            </Col>

                            {/* --- Right Column: Image & Actions --- */}
                            <Col xs={24} md={8} className="pl-4 flex flex-col justify-between h-full">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                        <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
                                        รูปภาพและบันทึก
                                    </h3>
                                    <Form.Item name="image">
                                        <Dragger
                                            fileList={fileList}
                                            onPreview={handlePreview}
                                            onChange={handleChange}
                                            beforeUpload={() => false}
                                            listType="picture-card"
                                            className="bg-slate-50 border-dashed border-2 border-slate-300 rounded-xl hover:border-blue-400 transition-colors"
                                            height={180}
                                            maxCount={1}
                                        >
                                            <p className="ant-upload-drag-icon text-slate-400"><FileImageOutlined style={{ fontSize: 32 }} /></p>
                                            <p className="ant-upload-text text-sm text-slate-600">คลิกหรือลากไฟล์มาวางที่นี่</p>
                                            <p className="ant-upload-hint text-xs text-slate-400">รองรับไฟล์ JPG, PNG</p>
                                        </Dragger>
                                    </Form.Item>
                                </div>

                                {/* ✅ ปุ่มบันทึกและลบ: ปรับ Style และจัดให้อยู่บรรทัดเดียวกัน */}
                                <div className="flex gap-3 mt-8">
                                    <Button
                                        type="primary"
                                        icon={<SaveOutlined />}
                                        size="large"
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 border-none h-10 rounded-lg font-medium shadow-md"
                                        onClick={handleSave}
                                    >
                                        บันทึก
                                    </Button>
                                    <Button
                                        danger
                                        icon={<DeleteOutlined />}
                                        size="large"
                                        className="flex-1 h-10 rounded-lg font-medium border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 shadow-sm"
                                        onClick={handleClearAll}
                                    >
                                        ลบทั้งหมด
                                    </Button>
                                </div>
                            </Col>
                        </Row>
                    </Form>
                </Card>

                {/* === SECTION 2: Table === */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px]">
                    {/* Table Header */}
                    <div className="px-5 py-3 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">

                        {/* ✅ ย้าย Search & Print มาทางซ้าย และใช้ Style เหมือนหน้า RegisterAsset */}
                        <div className="flex items-center gap-4 flex-1">
                            <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
                                <Input
                                    prefix={<SearchOutlined className="text-gray-400" />}
                                    placeholder="ค้นหา รหัส, รายละเอียด..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    allowClear
                                    bordered={false}
                                    className="w-64 bg-transparent"
                                />
                                <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
                                <Button
                                    type="primary"
                                    icon={<PrinterOutlined />}
                                    className="bg-blue-600 hover:bg-blue-500 border-none h-9 rounded-lg px-4 font-medium shadow-md"
                                >
                                    พิมพ์สติ๊กเกอร์
                                </Button>
                            </div>
                        </div>

                        {/* Count Label */}
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-sm">รายการทั้งหมด:</span>
                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">
                                {tableData.length}
                            </span>
                        </div>
                    </div>

                    {/* Table Body */}
                    <div className="flex-1 overflow-hidden">
                        <DataTable
                            rowData={filteredRows}
                            columnDefs={columnDefs}
                            loading={false}
                            rowSelection="multiple"
                            suppressRowClickSelection={true}
                        />
                    </div>
                </div>

            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <Image
                    wrapperStyle={{ display: 'none' }}
                    preview={{
                        visible: previewOpen,
                        onVisibleChange: (visible) => setPreviewOpen(visible),
                        afterOpenChange: (visible) => !visible && setPreviewImage(''),
                    }}
                    src={previewImage}
                />
            )}

            {/* ✅ Modal สำหรับเลือกสินค้า (Placeholder Component) */}
            <Modal
                title="เลือกรายการสินค้า"
                open={isModalListOpen}
                onCancel={() => setIsModalListOpen(false)}
                footer={null}
                width={800}
                centered
            >
                <ModalAssetList />
            </Modal>
        </div>
    );
}

// Helpers
const SpecInput = ({ label, name, unitName, unitOptions }) => (
    <div className="mb-3">
        <div className="text-xs text-slate-500 mb-1">{label}</div>
        <div className="flex">
            <Form.Item name={name} noStyle>
                <InputNumber placeholder="0.00" className="flex-1 !rounded-r-none border-r-0" min={0} precision={2} />
            </Form.Item>
            <Form.Item name={unitName} noStyle>
                <Select placeholder="หน่วย" style={{ width: 80 }} options={unitOptions} className="!rounded-l-none bg-slate-50" />
            </Form.Item>
        </div>
    </div>
);

const getBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });

export default AssetList;