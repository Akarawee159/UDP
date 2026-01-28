// src/pages/Registration/RegisterAsset/Page/SystemOutRepair.jsx
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

// Import สำหรับการพิมพ์
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';

const { Title, Text } = Typography;

function SystemOutRepair() {
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
                            <span className="bg-orange-600 w-2 h-6 rounded-r-md block"></span>
                            ทำรายการเบิกซ่อม
                        </Title>
                        <Text className="text-slate-500 text-xs ml-4">ระบบเบิกซ่อมทรัพย์สิน</Text>
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
        </div>
    );
}


export default SystemOutRepair;