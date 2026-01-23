import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Form, Input, App, Button, ConfigProvider, Spin, Row, Col, InputNumber, Switch, Upload, Select, Typography, Card } from 'antd';
import {
    IdcardOutlined, TagOutlined, PlusCircleOutlined, EditOutlined, SaveOutlined,
    DeleteOutlined, ShopOutlined, BgColorsOutlined, BarcodeOutlined,
    NumberOutlined, DollarOutlined, ColumnWidthOutlined, FileImageOutlined,
    CheckCircleOutlined, StopOutlined, CloudUploadOutlined, ExpandAltOutlined,
    ColumnHeightOutlined, GatewayOutlined, EyeOutlined
} from '@ant-design/icons';
import api from "../../../../api";

const { Title, Text } = Typography;

const getBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });

function ModalForm({ open, record, onClose, onSuccess, onDelete }) {
    const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };
    const [form] = Form.useForm();

    // Watch status for UI changes
    const isStatusActive = Form.useWatch('is_status', form);
    const isEditMode = !!record?.material_id;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [checkingCode, setCheckingCode] = useState(false);
    const [originalCode, setOriginalCode] = useState(null);
    const [unitOptions, setUnitOptions] = useState([]);
    const [currencyOptions, setCurrencyOptions] = useState([]);
    const [packagingOptions, setPackagingOptions] = useState([]);

    // --- State สำหรับรูปหลัก ---
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [fileList, setFileList] = useState([]);

    // --- State สำหรับ Drawing (6 รูป) ---
    const [drawingFiles, setDrawingFiles] = useState({}); // { 1: [], 2: [], ... }
    const [previewDrawing, setPreviewDrawing] = useState({ open: false, url: '' });

    const timerRef = useRef(null);

    const fetchOptions = useCallback(async () => {
        try {
            const res = await api.get('/masterdata/material/options');
            const { units, currencies, packagings } = res.data?.data || {};

            if (units) setUnitOptions(units.map(u => ({ label: u.name, value: u.name })));
            if (currencies) setCurrencyOptions(currencies.map(c => ({ label: c.name, value: c.name })));
            if (packagings) setPackagingOptions(packagings.map(p => ({
                label: p.G_NAME,
                value: p.G_ID,
                fullData: p
            })));
        } catch (error) { console.error("Fetch options error", error); }
    }, []);

    const fetchDetail = useCallback(async (id) => {
        try {
            setFetching(true);
            const res = await api.get(`/masterdata/material/${id}`);
            const data = res?.data?.data;

            if (data) {
                const apiBase = import.meta.env.VITE_API_PATH.replace('/api', '');

                // 1. Set Main Image
                if (data.material_image) {
                    setFileList([{
                        uid: '-1',
                        name: data.material_image,
                        status: 'done',
                        url: `${apiBase}/img/material/${data.material_image}`
                    }]);
                } else {
                    setFileList([]);
                }

                // 2. Set Drawing Images (1-6)
                const newDrawings = {};
                for (let i = 1; i <= 6; i++) {
                    const key = `drawing_00${i}`;
                    const val = data[key];
                    if (val) {
                        newDrawings[i] = [{
                            uid: `-${i}`, // negative uid for existing files
                            name: val,
                            status: 'done',
                            url: `${apiBase}/img/material/drawing/${val}`
                        }];
                    } else {
                        newDrawings[i] = [];
                    }
                }
                setDrawingFiles(newDrawings);

                // 3. Set Form Values
                form.setFieldsValue({
                    ...data,
                    is_status: Number(data.is_status) === 1,
                });
                setOriginalCode(data.material_code || null);
            }
        } catch (err) {
            console.error(err);
            message.error('ดึงข้อมูลวัสดุไม่สำเร็จ');
        } finally {
            setFetching(false);
        }
    }, [form, message]);

    useEffect(() => {
        if (open) {
            fetchOptions();
            clearTimeout(timerRef.current);
            form.resetFields();
            setOriginalCode(null);
            setFileList([]);
            setDrawingFiles({}); // Reset Drawing

            if (isEditMode) {
                form.setFieldsValue({ ...record, is_status: Number(record.is_status) === 1 });
                setOriginalCode(record.material_code || null);
                fetchDetail(record.material_id);
            } else {
                form.setFieldsValue({
                    is_status: true,
                    currency: 'บาท',
                    quantity_mainunit: 0, quantity_subunit: 0,
                    minimum_order: 0, minstock: 0, maxstock: 0
                });
                // Initialize empty drawings
                const emptyDrawings = {};
                for (let i = 1; i <= 6; i++) emptyDrawings[i] = [];
                setDrawingFiles(emptyDrawings);
            }
        }
    }, [open, isEditMode, record, form, fetchDetail, fetchOptions]);

    const handlePackagingChange = (value, option) => {
        if (option && option.fullData) {
            const p = option.fullData;
            form.setFieldsValue({
                material_width: p.G_WIDTH,
                material_width_unit: p.G_WIDTH_UNIT,
                material_length: p.G_LENGTH,
                material_length_unit: p.G_LENGTH_UNIT,
                material_height: p.G_HEIGHT,
                material_height_unit: p.G_HEIGHT_UNIT,
                material_capacity: p.G_CAPACITY,
                material_capacity_unit: p.G_CAPACITY_UNIT,
                material_weight: p.G_WEIGHT,
                material_weight_unit: p.G_WEIGHT_UNIT,
            });
        }
    };

    // --- Handler สำหรับ Drawing ---
    const handleDrawingChange = (index, { fileList: newFileList }) => {
        // จำกัดแค่ 1 รูป (slice(-1) หรือ maxCount={1} ใน Upload ก็ได้)
        setDrawingFiles(prev => ({ ...prev, [index]: newFileList }));
    };

    const handleDrawingPreview = async (file) => {
        if (!file.url && !file.preview) {
            file.preview = await getBase64(file.originFileObj);
        }
        setPreviewDrawing({ open: true, url: file.url || file.preview });
    };

    // --- Handler สำหรับ Main Image ---
    const handleUploadChange = ({ fileList: newFileList }) => setFileList(newFileList);

    const handlePreview = async (file) => {
        if (!file.url && !file.preview) {
            file.preview = await getBase64(file.originFileObj);
        }
        setPreviewImage(file.url || file.preview);
        setPreviewOpen(true);
    };

    const validateCode = (_rule, value) => new Promise((resolve, reject) => {
        const code = (value || '').trim();
        if (!code) return resolve();
        if (isEditMode && code === originalCode) return resolve();
        if (timerRef.current) clearTimeout(timerRef.current);
        setCheckingCode(true);
        timerRef.current = setTimeout(async () => {
            try {
                const res = await api.get('/masterdata/material/check-code', {
                    params: { code, excludeId: isEditMode ? record.material_id : undefined }
                });
                setCheckingCode(false);
                if (res.data?.exists) reject(new Error('รหัสซ้ำ'));
                else resolve();
            } catch (err) {
                setCheckingCode(false);
                reject(new Error('ตรวจสอบล้มเหลว'));
            }
        }, 600);
    });

    const handleOk = async () => {
        try {
            const raw = await form.validateFields();
            const formData = new FormData();

            // 1. Append Text Fields
            Object.keys(raw).forEach(key => {
                // ข้าม field รูป และ status (จัดการแยก)
                if (key !== 'is_status' && key !== 'image' && !key.startsWith('drawing_')) {
                    if (raw[key] !== undefined && raw[key] !== null) {
                        formData.append(key, raw[key]);
                    }
                }
            });

            formData.append('is_status', raw.is_status ? 1 : 2);

            // 2. Append Main Image
            if (fileList.length > 0) {
                if (fileList[0].originFileObj) {
                    formData.append('image', fileList[0].originFileObj);
                } else {
                    formData.append('material_image', fileList[0].name);
                }
            } else {
                formData.append('material_image', '');
            }

            // 3. Append Drawing Images (1-6)
            for (let i = 1; i <= 6; i++) {
                const files = drawingFiles[i] || [];
                const fieldName = `drawing_00${i}`;

                if (files.length > 0) {
                    if (files[0].originFileObj) {
                        // กรณีอัปโหลดใหม่
                        formData.append(fieldName, files[0].originFileObj);
                    } else {
                        // กรณีรูปเดิม (ส่งชื่อไฟล์กลับไป)
                        formData.append(fieldName, files[0].name);
                    }
                } else {
                    // กรณีลบรูป (ส่งค่าว่าง)
                    formData.append(fieldName, '');
                }
            }

            setLoading(true);
            let resData;
            const config = { headers: { 'Content-Type': 'multipart/form-data' } };

            if (isEditMode) {
                const res = await api.put(`/masterdata/material/${record.material_id}`, formData, config);
                message.success('อัปเดตเรียบร้อย');
                resData = res?.data?.data;
            } else {
                const res = await api.post('/masterdata/material', formData, config);
                message.success('เพิ่มข้อมูลเรียบร้อย');
                resData = res?.data?.data;
            }
            form.resetFields();
            onSuccess?.(resData || null);
            onClose?.();
        } catch (err) {
            console.error(err);
            if (err?.errorFields) return;
            const apiMsg = err?.response?.data?.message || 'เกิดข้อผิดพลาด';
            message.error(apiMsg);
        } finally {
            setLoading(false);
        }
    };

    const DimensionInput = ({ label, name, unitName, icon, placeholder }) => (
        <Form.Item label={label} className="mb-0">
            <div className="flex">
                <Form.Item name={name} noStyle>
                    <InputNumber prefix={icon} placeholder={placeholder} className="!rounded-r-none flex-1 border-r-0 w-full" min={0} precision={2} />
                </Form.Item>
                <Form.Item name={unitName} noStyle>
                    <Select options={unitOptions} placeholder="หน่วย" style={{ width: 100 }} allowClear className="!rounded-l-none bg-gray-50" />
                </Form.Item>
            </div>
        </Form.Item>
    );

    // Component การ์ดอัปโหลด Drawing
    const DrawingUploadCard = ({ index }) => (
        <Card
            size="small"
            title={<span className="text-xs font-semibold text-slate-600">DWG. {String(index).padStart(2, '0')}</span>}
            className="shadow-sm border-slate-200 h-full"
            bodyStyle={{ display: 'flex', justifyContent: 'center', padding: '12px', alignItems: 'center', minHeight: '120px' }}
        >
            <Upload
                listType="picture-card"
                fileList={drawingFiles[index] || []}
                onChange={(info) => handleDrawingChange(index, info)}
                onPreview={handleDrawingPreview}
                beforeUpload={() => false}
                maxCount={1}
                showUploadList={{ showPreviewIcon: true, showRemoveIcon: true }}
            >
                {(drawingFiles[index]?.length || 0) < 1 && (
                    <div className="flex flex-col items-center">
                        <PlusCircleOutlined className="text-xl text-slate-400 mb-1" />
                        <span className="text-[10px] text-slate-400">เพิ่มรูป</span>
                    </div>
                )}
            </Upload>
        </Card>
    );

    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#2563eb',
                    borderRadius: 8,
                    fontFamily: "'Prompt', 'Inter', sans-serif"
                },
                components: {
                    Input: { controlHeight: 40 },
                    Select: { controlHeight: 40 },
                    InputNumber: { controlHeight: 40 },
                    Button: { controlHeight: 40 },
                }
            }}
        >
            <Modal
                open={open}
                title={null}
                onCancel={() => { form.resetFields(); onClose?.(); }}
                footer={null}
                width={1000}
                closable={false}
                centered
                maskClosable={false}
                destroyOnClose
                styles={{ content: { padding: 0, borderRadius: '20px', overflow: 'hidden' } }}
            >
                {/* --- Header --- */}
                <div className="bg-white px-8 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 z-50">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm text-2xl ${isEditMode ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {isEditMode ? <EditOutlined /> : <PlusCircleOutlined />}
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0, fontWeight: 700 }} className="text-slate-800">
                                {isEditMode ? 'แก้ไขข้อมูลวัสดุ' : 'เพิ่มวัสดุใหม่'}
                            </Title>
                            <Text className="text-slate-500 text-sm">
                                {isEditMode ? 'อัปเดตรายละเอียดและสถานะของวัสดุ' : 'กรอกข้อมูลเพื่อสร้างรายการวัสดุใหม่ในระบบ'}
                            </Text>
                        </div>
                    </div>
                    <Button
                        type="text"
                        onClick={() => onClose?.()}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center"
                    >
                        <span className="text-2xl font-light">&times;</span>
                    </Button>
                </div>

                <Spin spinning={fetching} tip="กำลังโหลดข้อมูล...">
                    <Form form={form} layout="vertical" autoComplete="off">
                        <div className="flex flex-col md:flex-row h-[70vh]">

                            {/* --- Left Column: Identity & Status (30%) --- */}
                            <div className="w-full md:w-[320px] bg-slate-50 p-6 border-r border-gray-100 flex-shrink-0 overflow-y-auto">
                                <div className="space-y-6">

                                    {/* Main Image Upload */}
                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                                        <div className="mb-3 font-semibold text-slate-700 flex items-center justify-center gap-2">
                                            <FileImageOutlined /> รูปภาพสินค้าหลัก
                                        </div>
                                        <div className="flex justify-center">
                                            <Upload
                                                listType="picture-card"
                                                fileList={fileList}
                                                onPreview={handlePreview}
                                                onChange={handleUploadChange}
                                                beforeUpload={() => false}
                                                maxCount={1}
                                                className="custom-upload-circle"
                                            >
                                                {fileList.length < 1 && (
                                                    <div className="flex flex-col items-center text-slate-400 hover:text-blue-500 transition-colors">
                                                        <CloudUploadOutlined className="text-3xl mb-2" />
                                                        <span className="text-xs font-medium">คลิกเพื่ออัปโหลด</span>
                                                    </div>
                                                )}
                                            </Upload>
                                        </div>
                                        <div className="text-xs text-slate-400 mt-2">
                                            รองรับไฟล์ JPG, PNG
                                        </div>
                                    </div>

                                    {/* Primary Key Input */}
                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                        <Form.Item
                                            label={<span className="font-semibold text-slate-700">รหัสวัสดุ</span>}
                                            name="material_code"
                                            rules={[{ required: true, message: 'ระบุรหัส' }, { validator: validateCode }]}
                                            hasFeedback
                                            validateStatus={checkingCode ? 'validating' : undefined}
                                            className="mb-0"
                                        >
                                            <Input prefix={<IdcardOutlined className="text-slate-400" />} placeholder="Ex. MAT-001" className="font-mono font-medium" maxLength={20} />
                                        </Form.Item>
                                    </div>

                                    {/* Status Card */}
                                    <div className={`p-4 rounded-xl border transition-all ${isStatusActive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={`text-sm font-bold flex items-center gap-2 ${isStatusActive ? 'text-green-700' : 'text-red-700'}`}>
                                                {isStatusActive ? <CheckCircleOutlined /> : <StopOutlined />}
                                                {isStatusActive ? 'พร้อมใช้งาน' : 'ปิดการใช้งาน'}
                                            </span>
                                            <Form.Item name="is_status" valuePropName="checked" noStyle>
                                                <Switch size="small" className={isStatusActive ? 'bg-green-500' : 'bg-slate-300'} />
                                            </Form.Item>
                                        </div>
                                        <div className={`text-xs ${isStatusActive ? 'text-green-600' : 'text-red-600'} opacity-80`}>
                                            {isStatusActive ? 'วัสดุนี้จะแสดงในระบบขึ้นทะเบียนทรัพย์สิน' : 'ซ่อนวัสดุนี้จากระบบชั่วคราว'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* --- Right Column: Details (70%) --- */}
                            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-white">

                                {/* Section 1: ข้อมูลทั่วไป */}
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                                        <TagOutlined className="text-blue-600" />
                                        <h3 className="text-base font-bold text-slate-800 m-0">ข้อมูลทั่วไป</h3>
                                    </div>
                                    <Row gutter={[16, 16]}>
                                        <Col span={24}>
                                            <Form.Item label="ชื่อวัสดุ" name="material_name" rules={[{ required: true, message: 'ระบุชื่อวัสดุ' }]} className="mb-1">
                                                <Input prefix={<TagOutlined className="text-slate-400" />} placeholder="เช่น กล่องกระดาษ A4" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="ประเภท" name="material_type" className="mb-1">
                                                <Input placeholder="ระบุประเภท" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="ผู้ผลิต / Supplier" name="supplier_name" className="mb-1">
                                                <Input prefix={<ShopOutlined className="text-slate-400" />} placeholder="ชื่อบริษัทผู้ผลิต" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="แบรนด์ / ยี่ห้อ" name="material_brand" className="mb-1">
                                                <Input placeholder="ระบุแบรนด์" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="สี" name="material_color" className="mb-1">
                                                <Input prefix={<BgColorsOutlined className="text-slate-400" />} placeholder="เช่น ขาว, ดำ" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="รุ่น (Model)" name="material_model" className="mb-1">
                                                <Input prefix={<BarcodeOutlined className="text-slate-400" />} placeholder="ระบุรุ่น" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="คุณสมบัติพิเศษ" name="material_feature" className="mb-1">
                                                <Input placeholder="เช่น กันน้ำ, ทนความร้อน" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="แหล่งที่มา" name="material_source" className="mb-1">
                                                <Input placeholder="เช่น จัดซื้อ, จัดจ้าง" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label="ใช้สำหรับงาน" name="material_usedfor" className="mb-1">
                                                <Input placeholder="เช่น ใช้บรรจุภัณฑ์" />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>

                                {/* Section 2: ขนาดและบรรจุภัณฑ์ */}
                                <div className="mb-8">
                                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <ExpandAltOutlined className="text-purple-600" />
                                            <h3 className="text-base font-bold text-slate-800 m-0">ขนาดและบรรจุภัณฑ์</h3>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-5 rounded-xl border border-gray-100">
                                        <Row gutter={[16, 16]}>
                                            <Col span={24}>
                                                <Form.Item label="เลือกจากขนาดบรรจุภัณฑ์ต้นแบบ" className="mb-2">
                                                    <Select options={packagingOptions} placeholder="-- เลือกเพื่อดึงข้อมูลขนาดอัตโนมัติ --" onChange={handlePackagingChange} allowClear showSearch optionFilterProp="label" />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}><div className="h-px bg-gray-200 mb-2"></div></Col>
                                            <Col span={8}><DimensionInput label="ความกว้าง" name="material_width" unitName="material_width_unit" icon={<ColumnWidthOutlined className="text-slate-400" />} placeholder="0.00" /></Col>
                                            <Col span={8}><DimensionInput label="ความยาว" name="material_length" unitName="material_length_unit" icon={<ColumnHeightOutlined className="rotate-90 text-slate-400" />} placeholder="0.00" /></Col>
                                            <Col span={8}><DimensionInput label="ความสูง" name="material_height" unitName="material_height_unit" icon={<ColumnHeightOutlined className="text-slate-400" />} placeholder="0.00" /></Col>
                                            <Col span={12}><DimensionInput label="ความจุ (Capacity)" name="material_capacity" unitName="material_capacity_unit" icon={<GatewayOutlined className="text-slate-400" />} placeholder="0.00" /></Col>
                                            <Col span={12}><DimensionInput label="น้ำหนัก (Weight)" name="material_weight" unitName="material_weight_unit" icon={<span className="text-slate-400 text-xs font-bold">W</span>} placeholder="0.00" /></Col>
                                        </Row>
                                    </div>
                                </div>

                                {/* ✅ Section 3: Drawing Parts (เพิ่มใหม่) */}
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                                        <FileImageOutlined className="text-pink-600" />
                                        <h3 className="text-base font-bold text-slate-800 m-0">ส่วนประกอบชิ้นส่วน DWG.</h3>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-gray-100">
                                        <Row gutter={[12, 12]}>
                                            {/* --- ส่วนที่เพิ่มใหม่: Textarea รายละเอียด --- */}
                                            <Col span={24}>
                                                <div className="pb-8">
                                                    <Form.Item
                                                        label="รายละเอียด (Detail)"
                                                        name="material_remark"
                                                        className="mb-0"
                                                    >
                                                        <Input.TextArea
                                                            rows={4}
                                                            placeholder="ระบุรายละเอียดเพิ่มเติม..."
                                                            className="bg-white"
                                                            showCount
                                                            maxLength={500}
                                                        />
                                                    </Form.Item>
                                                </div>
                                            </Col>

                                            {[1, 2, 3, 4, 5, 6].map(i => (
                                                <Col span={8} key={i}>
                                                    <DrawingUploadCard index={i} />
                                                </Col>
                                            ))}
                                        </Row>
                                    </div>
                                </div>

                                {/* Section 4: คลังสินค้าและหน่วยนับ */}
                                <div className="mb-2">
                                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                                        <NumberOutlined className="text-orange-500" />
                                        <h3 className="text-base font-bold text-slate-800 m-0">คลังสินค้าและหน่วยนับ</h3>
                                    </div>
                                    <div className="bg-slate-50 p-5 rounded-xl border border-gray-100">
                                        <Row gutter={[16, 16]}>
                                            <Col span={24}>
                                                <div className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Conversion Rate</div>
                                                <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-gray-200">
                                                    <div className="flex-1"><Form.Item label="จำนวนหน่วยหลัก" name="quantity_mainunit" className="mb-0"><InputNumber className="w-full" min={0} placeholder="1" /></Form.Item></div>
                                                    <div className="flex-1"><Form.Item label="หน่วยหลัก" name="mainunit_name" className="mb-0"><Select options={unitOptions} showSearch allowClear placeholder="เลือกหน่วย" /></Form.Item></div>
                                                    <div className="pt-6 text-slate-400 font-bold">=</div>
                                                    <div className="flex-1"><Form.Item label="จำนวนหน่วยย่อย" name="quantity_subunit" className="mb-0"><InputNumber className="w-full" min={0} placeholder="1" /></Form.Item></div>
                                                    <div className="flex-1"><Form.Item label="หน่วยย่อย" name="subunit_name" className="mb-0"><Select options={unitOptions} showSearch allowClear placeholder="เลือกหน่วย" /></Form.Item></div>
                                                </div>
                                            </Col>
                                            <Col span={24}><div className="h-px bg-gray-200 my-1"></div></Col>
                                            <Col span={8}><Form.Item label="ปริมาณต่ำสุด" name="minstock" className="mb-0" help={<span className="text-[10px] text-slate-400">Min Stock</span>}><InputNumber prefix={<span className="text-orange-400 text-xs">▼</span>} className="w-full border-orange-200 focus:border-orange-400" min={0} /></Form.Item></Col>
                                            <Col span={8}><Form.Item label="ปริมาณสูงสุด" name="maxstock" className="mb-0" help={<span className="text-[10px] text-slate-400">Max Stock</span>}><InputNumber prefix={<span className="text-green-400 text-xs">▲</span>} className="w-full border-green-200 focus:border-green-400" min={0} /></Form.Item></Col>
                                            <Col span={8}><Form.Item label="ปริมาณสั่งซื้อขั้นต่ำ" name="minimum_order" className="mb-0" help={<span className="text-[10px] text-slate-400">MOQ</span>}><InputNumber className="w-full" min={0} placeholder="0" /></Form.Item></Col>
                                            <Col span={24}><Form.Item label="สกุลเงินที่ใช้ซื้อ" name="currency" className="mb-0 mt-2"><Select options={currencyOptions} showSearch prefix={<DollarOutlined />} placeholder="เลือกสกุลเงิน" /></Form.Item></Col>
                                        </Row>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </Form>
                </Spin>

                {/* --- Footer --- */}
                <div className="bg-white px-8 py-4 border-t border-gray-100 flex justify-between items-center z-50">
                    <div>
                        {isEditMode && (
                            <Button danger type="text" onClick={onDelete} disabled={loading} icon={<DeleteOutlined />} className="hover:bg-red-50">
                                ลบข้อมูลนี้
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button type="primary" loading={loading} onClick={handleOk} icon={<SaveOutlined />} className={`h-10 px-6 rounded-lg shadow-lg shadow-blue-200 font-medium ${loading ? '' : 'hover:scale-105 transition-transform'}`}>
                            {isEditMode ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}
                        </Button>
                        <Button onClick={() => { form.resetFields(); onClose?.(); }} disabled={loading} className="h-10 px-6 rounded-lg border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-800">
                            ยกเลิก
                        </Button>
                    </div>
                </div>

            </Modal>

            {/* Image Preview Modal (Main) */}
            <Modal open={previewOpen} title={null} footer={null} onCancel={() => setPreviewOpen(false)} centered width={500}>
                <img alt="preview" style={{ width: '100%', borderRadius: '8px' }} src={previewImage} />
            </Modal>

            {/* Drawing Preview Modal */}
            <Modal open={previewDrawing.open} title="DWG Preview" footer={null} onCancel={() => setPreviewDrawing({ open: false, url: '' })} centered width={600}>
                <img alt="dwg-preview" style={{ width: '100%', borderRadius: '8px' }} src={previewDrawing.url} />
            </Modal>
        </ConfigProvider>
    );
}

export default ModalForm;