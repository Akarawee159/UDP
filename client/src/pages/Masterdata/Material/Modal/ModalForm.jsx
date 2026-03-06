import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Form, Input, App, Button, ConfigProvider, Spin, Row, Col, InputNumber, Switch, Upload, Select, Typography, Card, Image } from 'antd';
import {
    IdcardOutlined, TagOutlined, PlusCircleOutlined, EditOutlined, SaveOutlined,
    DeleteOutlined, BgColorsOutlined, BarcodeOutlined,
    ColumnWidthOutlined, FileImageOutlined,
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

    // 🟢 State สำหรับเก็บข้อมูลดั้งเดิมทั้งหมด ป้องกันฟิลด์ที่ถูกซ่อนหายไปตอนบันทึก
    const [fullData, setFullData] = useState({});

    // --- State สำหรับรูปหลัก ---
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [fileList, setFileList] = useState([]);

    // --- State สำหรับรูปภาพ (1-6) ---
    const [drawingFiles, setDrawingFiles] = useState({});
    const [previewDrawing, setPreviewDrawing] = useState({ open: false, url: '' });

    const timerRef = useRef(null);

    const fetchOptions = useCallback(async () => {
        try {
            const res = await api.get('/masterdata/material/options');
            const { units } = res.data?.data || {};

            if (units) setUnitOptions(units.map(u => ({ label: u.name, value: u.name })));
        } catch (error) { console.error("Fetch options error", error); }
    }, []);

    const fetchDetail = useCallback(async (id) => {
        try {
            setFetching(true);
            const res = await api.get(`/masterdata/material/${id}`);
            const data = res?.data?.data;

            if (data) {
                setFullData(data); // 🟢 เก็บข้อมูลเต็มไว้เพื่ออ้างอิงตอนกด Save

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
                            uid: `-${i}`,
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
            message.error('ดึงข้อมูลไม่สำเร็จ');
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
            setDrawingFiles({});
            setFullData({}); // รีเซ็ต FullData

            if (isEditMode) {
                form.setFieldsValue({ ...record, is_status: Number(record.is_status) === 1 });
                setOriginalCode(record.material_code || null);
                fetchDetail(record.material_id);
            } else {
                form.setFieldsValue({
                    is_status: true,
                });
                const emptyDrawings = {};
                for (let i = 1; i <= 6; i++) emptyDrawings[i] = [];
                setDrawingFiles(emptyDrawings);
            }
        }
    }, [open, isEditMode, record, form, fetchDetail, fetchOptions]);

    // --- Handler สำหรับ Drawing ---
    const handleDrawingChange = (index, { fileList: newFileList }) => {
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

            // 🟢 รวมข้อมูลดั้งเดิม(ที่ถูกซ่อน) เข้ากับข้อมูลที่ถูกแก้ในฟอร์ม
            const mergedData = { ...fullData, ...raw };

            // 1. Append Text Fields (ใช้ mergedData แทน raw)
            Object.keys(mergedData).forEach(key => {
                if (key !== 'is_status' && key !== 'image' && key !== 'material_image' && !key.startsWith('drawing_')) {
                    if (mergedData[key] !== undefined && mergedData[key] !== null) {
                        formData.append(key, mergedData[key]);
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
                        formData.append(fieldName, files[0].originFileObj);
                    } else {
                        formData.append(fieldName, files[0].name);
                    }
                } else {
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
            const apiMsg = err?.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
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
                    <Select options={unitOptions} placeholder="หน่วย" style={{ width: 140 }} allowClear className="!rounded-l-none bg-gray-50" />
                </Form.Item>
            </div>
        </Form.Item>
    );

    const DrawingUploadCard = ({ index }) => (
        <Card
            size="small"
            title={<span className="text-[11px] font-semibold text-slate-600">รูปภาพ {index}</span>}
            className="shadow-sm border-slate-200 h-full rounded-md"
            // ลด padding และ minHeight ลงเพื่อให้พอดีกับการแสดง 3 รูปต่อแถว
            styles={{ body: { display: 'flex', justifyContent: 'center', padding: '8px', alignItems: 'center', minHeight: '85px' }, header: { minHeight: '30px', padding: '0 8px' } }}
        >
            <Upload
                listType="picture-card"
                fileList={drawingFiles[index] || []}
                onChange={(info) => handleDrawingChange(index, info)}
                onPreview={handleDrawingPreview}
                beforeUpload={() => false}
                maxCount={1}
                itemRender={customItemRender}
            >
                {(drawingFiles[index]?.length || 0) < 1 && (
                    <div className="flex flex-col items-center mt-1">
                        <PlusCircleOutlined className="text-lg text-slate-400 mb-1" />
                        <span className="text-[10px] text-slate-400">เพิ่มรูป</span>
                    </div>
                )}
            </Upload>
        </Card>
    );

    // ฟังก์ชันสำหรับจัด Layout รูปที่อัปโหลดเอง
    const customItemRender = (originNode, file, fileList, actions) => {
        const imgSrc = file.url || file.thumbUrl || file.preview;

        // ถ้ารูปยังโหลดไม่เสร็จหรือไม่ใช่สถานะปกติ โยนกลับไปใช้ค่าเริ่มต้นของ AntD เพื่อแสดง Loading
        if (!imgSrc || file.status === 'uploading') {
            return originNode;
        }

        return (
            <div className="relative w-full h-full rounded-md overflow-hidden group border border-slate-200">
                <img
                    src={imgSrc}
                    alt={file.name}
                    className="w-full h-full object-cover"
                />
                {/* Overlay (พื้นหลังสีดำโปร่งแสงตอน Hover) */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">

                    {/* ปุ่ม Preview (จัดให้อยู่ตรงกลาง) */}
                    <div
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer text-white/80 hover:text-white"
                        onClick={actions.preview}
                    >
                        <EyeOutlined className="text-2xl hover:scale-110 transition-transform" />
                    </div>

                    {/* ปุ่ม Remove (จัดให้อยู่มุมล่างขวา) */}
                    <div
                        className="absolute bottom-1 right-1 cursor-pointer text-white/80 hover:text-red-500 bg-black/40 p-1 rounded-md hover:bg-black/60 transition-colors"
                        onClick={actions.remove}
                    >
                        <DeleteOutlined className="text-[14px] flex items-center justify-center" />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#2563eb',
                    borderRadius: 6,
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
                width="95%"
                style={{ maxWidth: '1100px' }}
                closable={false}
                centered
                maskClosable={false}
                destroyOnHidden
                styles={{ content: { padding: 0, borderRadius: '6px', overflow: 'hidden' } }}
            >
                <div className="bg-white px-4 md:px-8 py-4 md:py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 z-50">
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-md flex items-center justify-center shadow-sm text-xl md:text-2xl ${isEditMode ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {isEditMode ? <EditOutlined /> : <PlusCircleOutlined />}
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0, fontWeight: 700 }} className="text-slate-800 text-lg md:text-xl">
                                {isEditMode ? 'แก้ไขข้อมูล' : 'เพิ่มใหม่'}
                            </Title>
                            <Text className="text-slate-500 text-xs md:text-sm">
                                {isEditMode ? 'อัปเดตรายละเอียดและสถานะของ' : 'กรอกข้อมูลเพื่อสร้างรายการใหม่ในระบบ'}
                            </Text>
                        </div>
                    </div>
                    <Button
                        type="text"
                        onClick={() => onClose?.()}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md w-10 h-10 flex items-center justify-center"
                    >
                        <span className="text-2xl font-light">&times;</span>
                    </Button>
                </div>

                <Spin spinning={fetching} tip="กำลังโหลดข้อมูล...">
                    <Form form={form} layout="vertical" autoComplete="off">
                        <div className="flex flex-col md:flex-row md:h-[70vh] max-h-[75vh] md:max-h-none overflow-y-auto md:overflow-hidden">

                            {/* ขยายความกว้างเป็น md:w-[380px] lg:w-[450px] เพื่อให้กว้างขึ้นตามที่ต้องการ */}
                            <div className="w-full md:w-[380px] lg:w-[450px] bg-slate-50 p-4 md:p-6 border-b md:border-b-0 md:border-r border-gray-100 flex-shrink-0 md:overflow-y-auto custom-scrollbar">
                                <div className="space-y-4 md:space-y-6">

                                    {/* 1. รูปภาพสินค้าหลัก */}
                                    <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100 text-center">
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
                                                itemRender={customItemRender}
                                            >
                                                {fileList.length < 1 && (
                                                    <div className="flex flex-col items-center text-slate-400 hover:text-blue-500 transition-colors">
                                                        <CloudUploadOutlined className="text-3xl mb-2" />
                                                        <span className="text-xs font-medium">คลิกอัปโหลด</span>
                                                    </div>
                                                )}
                                            </Upload>
                                        </div>
                                        <div className="text-xs text-slate-400 mt-2">
                                            รองรับไฟล์ JPG, PNG
                                        </div>
                                    </div>

                                    {/* 2. รูปภาพเพิ่มเติม */}
                                    <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100 text-center">
                                        <div className="mb-3 font-semibold text-slate-700 flex items-center justify-center gap-2">
                                            <FileImageOutlined /> รูปภาพเพิ่มเติม
                                        </div>
                                        <Row gutter={[8, 8]}>
                                            {[1, 2, 3, 4, 5, 6].map(i => (
                                                <Col xs={12} sm={8} key={i}>
                                                    <DrawingUploadCard index={i} />
                                                </Col>
                                            ))}
                                        </Row>
                                    </div>

                                    {/* 3. รายละเอียดเพิ่มเติม (เพิ่มใหม่) */}
                                    <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100">
                                        <div className="mb-3 font-semibold text-slate-700 flex items-center gap-2">
                                            <EditOutlined className="text-pink-600" /> รายละเอียด (Detail)
                                        </div>
                                        <Form.Item
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

                                    {/* 4. สถานะการใช้งาน */}
                                    <div className={`p-4 rounded-md border transition-all ${isStatusActive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
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
                                            {isStatusActive ? 'นี้จะแสดงในระบบ' : 'ซ่อนนี้จากระบบชั่วคราว'}
                                        </div>
                                    </div>

                                </div>
                            </div>

                            <div className="flex-1 p-4 md:p-6 md:overflow-y-auto custom-scrollbar bg-white">
                                <div className="mb-6 md:mb-8">
                                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                                        <TagOutlined className="text-blue-600" />
                                        <h3 className="text-base font-bold text-slate-800 m-0">ข้อมูลทั่วไป</h3>
                                    </div>
                                    <Row gutter={[16, 16]}>
                                        <Col xs={24} sm={12}>
                                            <Form.Item
                                                label={<span className="font-semibold text-slate-700">รหัส</span>}
                                                name="material_code"
                                                rules={[{ required: true, message: 'ระบุรหัส' }, { validator: validateCode }]}
                                                hasFeedback
                                                validateStatus={checkingCode ? 'validating' : undefined}
                                                className="mb-1"
                                            >
                                                <Input prefix={<IdcardOutlined className="text-slate-400" />} placeholder="Ex. MAT-001" className="font-mono font-medium" maxLength={20} />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} sm={12}>
                                            <Form.Item label={<span className="font-semibold text-slate-700">ชื่อ</span>} name="material_name" rules={[{ required: true, message: 'ระบุชื่อ' }]} className="mb-1">
                                                <Input prefix={<TagOutlined className="text-slate-400" />} placeholder="เช่น กล่องกระดาษ A4" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} sm={12}>
                                            <Form.Item label="ประเภท" name="material_type" className="mb-1">
                                                <Input placeholder="ระบุประเภท" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} sm={12}>
                                            <Form.Item label="สี" name="material_color" className="mb-1">
                                                <Input prefix={<BgColorsOutlined className="text-slate-400" />} placeholder="เช่น ขาว, ดำ" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} sm={12}>
                                            <Form.Item label="โมเดล" name="material_model" className="mb-1">
                                                <Input prefix={<BarcodeOutlined className="text-slate-400" />} placeholder="ระบุรุ่น" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} sm={12}>
                                            <Form.Item label="คุณสมบัติพิเศษ" name="material_feature" className="mb-1">
                                                <Input placeholder="เช่น กันน้ำ, ทนความร้อน" />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>

                                {/* Section 2: ขนาดและบรรจุภัณฑ์ */}
                                <div className="mb-6 md:mb-8">
                                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <ExpandAltOutlined className="text-purple-600" />
                                            <h3 className="text-base font-bold text-slate-800 m-0">ขนาดและบรรจุภัณฑ์</h3>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-4 md:p-5 rounded-md border border-gray-100">
                                        <Row gutter={[16, 16]}>
                                            {/* เปลี่ยน md={8} เป็น md={12} เพื่อให้กว้างขึ้น แบ่งเป็น 2 คอลัมน์ต่อแถว */}
                                            <Col xs={24} sm={12} md={12}><DimensionInput label="ความกว้าง" name="material_width" unitName="material_width_unit" icon={<ColumnWidthOutlined className="text-slate-400" />} placeholder="0.00" /></Col>
                                            <Col xs={24} sm={12} md={12}><DimensionInput label="ความยาว" name="material_length" unitName="material_length_unit" icon={<ColumnHeightOutlined className="rotate-90 text-slate-400" />} placeholder="0.00" /></Col>
                                            <Col xs={24} sm={24} md={24}><DimensionInput label="ความสูง" name="material_height" unitName="material_height_unit" icon={<ColumnHeightOutlined className="text-slate-400" />} placeholder="0.00" /></Col>
                                            <Col xs={24} sm={12} md={12}><DimensionInput label="ความจุ (Capacity)" name="material_capacity" unitName="material_capacity_unit" icon={<GatewayOutlined className="text-slate-400" />} placeholder="0.00" /></Col>
                                            <Col xs={24} sm={12} md={12}><DimensionInput label="น้ำหนัก (Weight)" name="material_weight" unitName="material_weight_unit" icon={<span className="text-slate-400 text-xs font-bold">W</span>} placeholder="0.00" /></Col>
                                        </Row>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Form>
                </Spin>

                <div className="bg-white px-4 md:px-8 py-4 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 z-50">
                    <div className="w-full md:w-auto text-center md:text-left">
                        {isEditMode && (
                            <Button danger type="text" onClick={onDelete} disabled={loading} icon={<DeleteOutlined />} className="hover:bg-red-50 rounded-md w-full md:w-auto">
                                ลบข้อมูลนี้
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <Button type="primary" loading={loading} onClick={handleOk} icon={<SaveOutlined />} className={`flex-1 md:flex-none h-10 px-6 rounded-md shadow-md shadow-blue-200 font-medium ${loading ? '' : 'hover:scale-105 transition-transform'}`}>
                            {isEditMode ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}
                        </Button>
                        <Button onClick={() => { form.resetFields(); onClose?.(); }} disabled={loading} className="flex-1 md:flex-none h-10 px-6 rounded-md border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-800">
                            ยกเลิก
                        </Button>
                    </div>
                </div>

            </Modal>

            {/* ระบบพรีวิวรูปภาพหลัก */}
            {previewImage && (
                <Image
                    wrapperStyle={{ display: 'none' }}
                    src={previewImage}
                    preview={{
                        visible: previewOpen,
                        onVisibleChange: (visible) => setPreviewOpen(visible),
                        zIndex: 9999, // บังคับ Z-index ให้อยู่หน้าสุด ทะลุ Modal หลักแน่นอน
                    }}
                />
            )}

            {/* ระบบพรีวิวรูปภาพ Drawing */}
            {previewDrawing.url && (
                <Image
                    wrapperStyle={{ display: 'none' }}
                    src={previewDrawing.url}
                    preview={{
                        visible: previewDrawing.open,
                        onVisibleChange: (visible) => setPreviewDrawing(prev => ({ ...prev, open: visible })),
                        zIndex: 9999, // บังคับ Z-index ให้อยู่หน้าสุด
                    }}
                />
            )}
        </ConfigProvider>
    );
}

export default ModalForm;