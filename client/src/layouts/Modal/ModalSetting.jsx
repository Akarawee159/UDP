// ./src/layouts/Modal/ModalSetting.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    Modal, Form, Input, Button, Space, App, Popconfirm, Upload, Tabs, Typography, Avatar, Tag
} from "antd";
import {
    SettingOutlined, UserOutlined, SafetyCertificateOutlined, UploadOutlined, DeleteOutlined, LockOutlined, IdcardOutlined, BankOutlined, SolutionOutlined, KeyOutlined, CameraOutlined, SignatureOutlined
} from "@ant-design/icons";
import useAuth from "../../hooks/useAuth.js";
import api from "../../api";

const { Title } = Typography;

const buildBase = () => {
    const base = api.defaults?.baseURL || "";
    return base.replace(/\/api\/?$/, "");
};

export default function ModalSetting({ open, onClose, onChanged, tabKey = "profile" }) {
    const { user, logout } = useAuth();
    const { message } = App.useApp();
    const [me, setMe] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(tabKey);
    const [pwForm] = Form.useForm();
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

    const [expiresAt, setExpiresAt] = useState(null);
    const [leftText, setLeftText] = useState("-");
    const [policyDays, setPolicyDays] = useState("-"); // ✅ State เก็บค่าวันจาก DB

    const BE_BASE = useMemo(() => buildBase(), []);
    const [imgV, setImgV] = useState(0);
    const profileUrl = me?.profileImg ? `${BE_BASE}/img/profile/${me.profileImg}?v=${imgV}` : null;
    const signatureUrl = me?.signature ? `${BE_BASE}/img/signature/${me.signature}` : null;

    useEffect(() => {
        if (!open) return;
        (async () => {
            try {
                const { data } = await api.get("/management/me");
                setMe(data?.data || null);
                pwForm.resetFields();
                setActiveTab(tabKey || "profile");
            } catch {
                message.error("โหลดข้อมูลผู้ใช้ไม่สำเร็จ");
            }
        })();
        // ✅ ดึงสถานะวันหมดอายุ + Policy Days
        (async () => {
            try {
                const { data } = await api.get("/auth/status");
                const iso = data?.password_expires_at || null;
                setExpiresAt(iso);
                if (data?.policy_days) setPolicyDays(data.policy_days); // เก็บค่าวัน
            } catch { /* เงียบ */ }
        })();
    }, [open, pwForm, message, tabKey]);

    useEffect(() => {
        setActiveTab(tabKey || "profile");
    }, [tabKey]);

    // Update Real-time countdown
    useEffect(() => {
        if (!expiresAt) { setLeftText("-"); return; }
        const calc = () => {
            const end = new Date(expiresAt).getTime();
            const now = Date.now();
            const diff = end - now;

            if (isNaN(end)) { setLeftText("-"); return; }
            if (diff <= 0) { setLeftText("หมดอายุแล้ว"); return; }

            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            let text = "";
            if (d > 0) text = `${d} วัน ${h} ชม. ${m} นาที ${s} วินาที`;
            else if (h > 0) text = `${h} ชม. ${m} นาที ${s} วินาที`;
            else text = `${m} นาที ${s} วินาที`;

            setLeftText(text);
        };
        calc();
        const t = setInterval(calc, 1000);
        return () => clearInterval(t);
    }, [expiresAt]);

    const handleChangePassword = async () => {
        try {
            const v = await pwForm.validateFields();
            setLoading(true);
            const isRoot = String(me?.employee_id || user?.employee_id) === "1";

            // ✅ ส่งแค่ password อย่างเดียว Backend จะไปดึงวันจาก DB เอง
            if (isRoot) {
                await api.patch("/management/me/password", { new_password: v.password });
            } else {
                // ✅ แก้ไข: เพิ่ม currentPassword และแก้ชื่อ key เป็น newPassword (CamelCase)
                await api.post("/auth/password/change", {
                    currentPassword: v.currentPassword,
                    newPassword: v.password
                });
            }

            try { await api.post("/auth/revoke-sessions", { employee_id: user?.employee_id }); } catch { }
            message.success("เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบอีกครั้ง");
            await logout();
            window.location.href = "/";
        } catch (err) {
            if (err?.errorFields) return;
            message.error(err?.response?.data?.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    // ... (ส่วน UserInfoItem, createUploadProps, handleDeleteImage เหมือนเดิม) ...
    const createUploadProps = (type) => ({
        name: "file",
        maxCount: 1,
        showUploadList: false,
        customRequest: async ({ file, onSuccess, onError }) => {
            try {
                const fd = new FormData();
                fd.append("file", file);
                const url = type === "profile" ? "/management/me/profile-image" : "/management/me/signature";
                const { data } = await api.post(url, fd, { headers: { "Content-Type": "multipart/form-data" } });

                if (type === "profile") {
                    setMe((m) => ({ ...m, profileImg: data?.filename }));
                    setImgV(Date.now());
                    onChanged?.({ profileImg: data?.filename });
                } else {
                    setMe((m) => ({ ...m, signature: data?.filename }));
                }
                onSuccess?.(data);
                message.success("อัปโหลดรูปสำเร็จ");
            } catch (e) {
                message.error("อัปโหลดรูปไม่สำเร็จ");
                onError?.(e);
            }
        },
    });

    const handleDeleteImage = async (type) => {
        const url = type === "profile" ? "/management/me/profile-image" : "/management/me/signature";
        try {
            await api.delete(url);
            if (type === "profile") {
                setMe((m) => ({ ...m, profileImg: null }));
                setImgV(Date.now());
                onChanged?.({ profileImg: null });
            } else {
                setMe((m) => ({ ...m, signature: null }));
            }
            message.success(type === "profile" ? "ลบรูปโปรไฟล์แล้ว" : "ลบรูปลายเซ็นแล้ว");
        } catch (e) {
            message.error("ลบรูปไม่สำเร็จ");
        }
    };

    const UserInfoItem = ({ icon, label, value }) => (
        <div className="flex items-center p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 mr-4">{icon}</div>
            <div className="flex-1">
                <div className="text-xs text-gray-400 font-medium mb-0.5">{label}</div>
                <div className="text-gray-700 font-semibold text-sm">{value || '-'}</div>
            </div>
        </div>
    );

    const tabItems = [
        {
            key: 'profile',
            label: <span className="flex items-center gap-2 px-2"><UserOutlined /> ข้อมูลส่วนตัว</span>,
            children: (
                <div className="animate-fadeIn">
                    {/* ... (ส่วน Header Profile/Signature เหมือนเดิม) ... */}
                    <div className="relative h-32 rounded-t-2xl bg-gradient-to-r from-blue-500 to-indigo-400 mb-20 shadow-inner">
                        <div className="absolute -bottom-16 left-8 flex items-end">
                            <div className="relative group">
                                <div className="p-1 bg-white rounded-full">
                                    <Avatar size={100} src={profileUrl} icon={<UserOutlined className="text-3xl" />} className="bg-gray-100 border-2 border-white shadow-lg" />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 cursor-pointer">
                                    <Upload {...createUploadProps("profile")}><Button shape="circle" icon={<CameraOutlined />} type="primary" className="bg-blue-600 border-blue-600" /></Upload>
                                </div>
                                {me?.profileImg && (<Popconfirm title="ลบรูปโปรไฟล์?" onConfirm={() => handleDeleteImage("profile")}><Button shape="circle" size="small" danger icon={<DeleteOutlined />} className="absolute bottom-2 right-1 shadow-md bg-white border-red-100 z-50 hover:bg-red-50" /></Popconfirm>)}
                            </div>
                            <div className="ml-5 mb-1">
                                <h2 className="text-xl text-gray-800 leading-tight">{me?.firstname_th} {me?.lastname_th}</h2>
                                <Tag color="blue" className="mt-1 border-0 bg-blue-100 text-blue-700 font-medium px-3 py-0.5 rounded-full">{me?.permission_role || '-'}</Tag>
                            </div>
                        </div>
                    </div>
                    <div className="px-2 space-y-6">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-blue-500 shadow-sm"><SignatureOutlined className="text-xl" /></div>
                                <div><div className="font-semibold text-gray-700">ลายเซ็นดิจิทัล</div><div className="text-xs text-gray-400">ใช้สำหรับการอนุมัติเอกสาร</div></div>
                            </div>
                            <div className="flex items-center gap-3">
                                {signatureUrl ? (<div className="h-12 w-24 bg-white rounded border border-gray-200 p-1"><img src={signatureUrl} alt="Signature" className="h-full w-full object-contain" /></div>) : <div className="text-xs text-gray-400 italic">ยังไม่มีลายเซ็น</div>}
                                <Space>
                                    <Upload {...createUploadProps("signature")}><Button size="small" icon={<UploadOutlined />}>อัปโหลด</Button></Upload>
                                    {me?.signature && (<Popconfirm title="ลบรูปลายเซ็น?" onConfirm={() => handleDeleteImage("signature")}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>)}
                                </Space>
                            </div>
                        </div>
                        <div>
                            <Title level={5} className="text-blue-700 mb-3 flex items-center gap-2"><SolutionOutlined /> รายละเอียดบัญชี</Title>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <UserInfoItem icon={<IdcardOutlined />} label="รหัสพนักงาน" value={me?.employee_id} />
                                <UserInfoItem icon={<BankOutlined />} label="สังกัด / สาขา" value={me?.branch} />
                                <UserInfoItem icon={<SolutionOutlined />} label="ชื่อผู้ใช้งาน (Username)" value={me?.username} />
                                <UserInfoItem icon={<SafetyCertificateOutlined />} label="ระดับสิทธิ์" value={me?.permission_role} />
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: 'security',
            label: <span className="flex items-center gap-2 px-2"><KeyOutlined /> ความปลอดภัย</span>,
            children: (
                <div className="animate-fadeIn pt-2 px-2">
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6 flex gap-4 items-start">
                        <div className="p-2 bg-orange-100 rounded-full text-orange-500 mt-1"><LockOutlined /></div>
                        <div>
                            <h4 className="text-orange-800 font-semibold mb-1">คำแนะนำความปลอดภัย</h4>
                            <p className="text-orange-700/80 text-sm leading-relaxed">การเปลี่ยนรหัสผ่านจะทำให้ระบบ Log out ออกจากทุกอุปกรณ์ทันที เพื่อความปลอดภัยสูงสุด กรุณาตั้งรหัสผ่านที่มีความยาวอย่างน้อย 8 ตัวอักษร</p>
                        </div>
                    </div>

                    <div className={`border rounded-xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 ${leftText === "หมดอายุแล้ว" ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100"}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${leftText === "หมดอายุแล้ว" ? "bg-red-100 text-red-500" : "bg-blue-100 text-blue-500"}`}><SafetyCertificateOutlined className="text-xl" /></div>
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">สถานะรหัสผ่าน</div>
                                <div className={`text-lg font-bold ${leftText === "หมดอายุแล้ว" ? "text-red-600" : "text-blue-700"}`}>{leftText === "หมดอายุแล้ว" ? "หมดอายุแล้ว" : `หมดอายุใน ${leftText}`}</div>
                            </div>
                        </div>
                        <div className="text-right hidden md:block">
                            <div className="text-xs text-gray-400">วันที่หมดอายุ</div>
                            <div className="text-sm font-medium text-gray-600">{expiresAt ? new Date(expiresAt).toLocaleString("th-TH") : "-"}</div>
                        </div>
                    </div>

                    <Form form={pwForm} layout="vertical" className="space-y-3">
                        {/* ✅ เพิ่มช่องรหัสผ่านปัจจุบัน (สำหรับ User ทั่วไป) */}
                        {String(me?.employee_id || user?.employee_id) !== "1" && (
                            <Form.Item
                                name="currentPassword"
                                label={<span className="font-medium text-gray-700">รหัสผ่านปัจจุบัน</span>}
                                rules={[{ required: true, message: "กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยัน" }]}
                            >
                                <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="ระบุรหัสผ่านเดิม" className="py-2.5 rounded-lg" />
                            </Form.Item>
                        )}

                        <Form.Item name="password" label={<span className="font-medium text-gray-700">รหัสผ่านใหม่</span>} rules={[{ required: true, message: "กรุณากรอกรหัสผ่านใหม่" }, { pattern: strong, message: "รหัสผ่านไม่ปลอดภัย (ต้องมี ตัวเล็ก, ใหญ่, ตัวเลข, อักขระพิเศษ)" }]} hasFeedback>
                            <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="อย่างน้อย 8 ตัวอักษร" className="py-2.5 rounded-lg" />
                        </Form.Item>
                        <Form.Item name="confirm" label={<span className="font-medium text-gray-700">ยืนยันรหัสผ่านใหม่</span>} dependencies={["password"]} rules={[{ required: true, message: "กรุณายืนยันรหัสผ่าน" }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('password') === value) return Promise.resolve(); return Promise.reject(new Error("รหัสผ่านไม่ตรงกัน")); } })]} hasFeedback>
                            <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง" className="py-2.5 rounded-lg" />
                        </Form.Item>

                        {/* ✅ แสดงวัน Config ที่ดึงจาก DB */}
                        {String(me?.employee_id || user?.employee_id) !== "1" && (
                            <Form.Item label="อายุการใช้งานรหัสผ่าน (ตามนโยบายบริษัท)">
                                <div className="flex justify-between items-center h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-blue-200 transition-colors cursor-default">
                                    <span className="text-gray-500 text-sm flex items-center gap-2">
                                        <SafetyCertificateOutlined className="text-blue-500" />
                                        <span>กำหนดโดยระบบ</span>
                                    </span>
                                    <Tag color="blue" bordered={false} className="m-0 px-2 font-semibold text-sm">
                                        {policyDays} วัน
                                    </Tag>
                                </div>
                            </Form.Item>
                        )}

                        <Button type="primary" onClick={handleChangePassword} loading={loading} block size="large" className="mt-2 bg-blue-600 hover:bg-blue-500 border-none h-12 rounded-xl font-semibold shadow-lg shadow-blue-200">เปลี่ยนรหัสผ่าน</Button>
                    </Form>
                </div>
            )
        }
    ];

    return (
        <Modal open={open} onCancel={onClose} title={null} footer={null} width={600} centered className="custom-modal-setting" closable={false} styles={{ content: { padding: 0, borderRadius: '16px', overflow: 'hidden' }, body: { padding: 0 } }} maskClosable={false}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
                <div className="flex items-center gap-3 text-blue-800"><div className="p-2 bg-blue-50 rounded-lg text-blue-600"><SettingOutlined className="text-xl" /></div><span className="text-lg font-bold">ตั้งค่าบัญชีผู้ใช้</span></div>
                <Button type="text" shape="circle" onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100">✕</Button>
            </div>
            <div className="p-6 bg-white min-h-[500px]">
                <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} tabBarStyle={{ marginBottom: 24 }} type="card" className="custom-tabs-blue" />
            </div>
        </Modal>
    );
}