// ./src/layouts/Modal/ModalExpired.jsx
import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Button, message, Typography } from "antd";
import {
  LockOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  FieldTimeOutlined
} from "@ant-design/icons";
import api from "../../api";

const { Title, Text } = Typography;

export default function ModalExpired({ open, resetToken, onClose, onForceLogout }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  // State สำหรับเก็บจำนวนวันที่ดึงมาจาก DB
  const [policyDays, setPolicyDays] = useState("-");
  const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

  // ✅ Fetch Password Policy when open
  useEffect(() => {
    if (open) {
      const fetchPolicy = async () => {
        try {
          // เรียก API Public ที่สร้างไว้ใน authRoutes
          const { data } = await api.get('/auth/password-policy');
          if (data?.policy_days) {
            setPolicyDays(data.policy_days);
          }
        } catch (error) {
          console.error("Failed to fetch password policy", error);
        }
      };
      fetchPolicy();
    }
  }, [open]);

  const handleOk = async () => {
    try {
      const v = await form.validateFields();
      if (!resetToken) {
        message.error("ยังไม่มี resetToken โปรดลองอีกครั้ง");
        return;
      }
      setLoading(true);

      // ✅ ส่ง currentPassword ไปด้วย (กรณี Backend ต้องการ)
      // หมายเหตุ: โดยปกติ expired-change จะใช้ resetToken ยืนยันตัวตน
      await api.post("/auth/password/expired-change", {
        resetToken,
        currentPassword: v.currentPassword, // เพิ่มส่งรหัสเดิม
        newPassword: v.newPassword,
        continue: false, // 👈 ห้ามต่อเซสชัน
      });

      message.success("ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง");

      // ✅ บังคับออกจากระบบ
      try {
        const useLocal = !!localStorage.getItem("refreshToken");
        const store = useLocal ? localStorage : sessionStorage;
        const r = store.getItem("refreshToken");
        if (r) {
          await api.post("/auth/logout", { refreshToken: r });
        }
      } catch { }

      await (onForceLogout?.());
      form.resetFields();
      onClose?.();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      closable={false}
      maskClosable={false}
      footer={null}
      centered
      width={420}
      className="custom-modal-expired"
      styles={{
        content: { padding: 0, borderRadius: '24px', overflow: 'hidden' }
      }}
    >
      <div className="relative bg-white">
        {/* Header Graphic */}
        <div className="bg-gradient-to-b from-blue-50 to-white pt-8 pb-4 px-6 text-center">
          <div className="w-20 h-20 mx-auto bg-white rounded-full shadow-lg flex items-center justify-center mb-4 border-4 border-blue-50">
            <FieldTimeOutlined className="text-4xl text-blue-500" />
          </div>
          <Title level={3} className="!text-blue-800 !mb-1">รหัสผ่านหมดอายุ</Title>
          <Text className="text-gray-500 text-sm">
            เพื่อความปลอดภัย กรุณาตั้งรหัสผ่านใหม่<br />ก่อนเข้าใช้งานระบบ
          </Text>
        </div>

        <div className="px-8 pb-8">
          {/* Info Banner - แสดงค่า dynamic จาก policyDays */}
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 mb-6 flex gap-3 items-start">
            <SafetyCertificateOutlined className="text-orange-500 mt-1" />
            <div className="text-xs text-orange-800 leading-relaxed">
              <b>นโยบายความปลอดภัย:</b> ระบบกำหนดอายุรหัสผ่านรอบนี้เป็น <b>{policyDays} วัน</b> และต้องเปลี่ยนใหม่เมื่อครบกำหนด
            </div>
          </div>

          <Form form={form} layout="vertical" className="space-y-2">

            {/* ✅ เพิ่มช่องรหัสผ่านเดิม */}
            <Form.Item
              name="currentPassword"
              label={<span className="font-semibold text-gray-700 ml-1">รหัสผ่านเดิม</span>}
              rules={[
                { required: true, message: "กรุณากรอกรหัสผ่านเดิม" }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="ระบุรหัสผ่านเดิม"
                className="py-2.5 rounded-xl border-gray-200 hover:border-blue-400 focus:border-blue-500"
              />
            </Form.Item>

            <Form.Item
              name="newPassword"
              label={<span className="font-semibold text-gray-700 ml-1">รหัสผ่านใหม่</span>}
              rules={[
                { required: true, message: "กรุณากรอกรหัสผ่านใหม่" },
                { pattern: strong, message: "ต้องมี ตัวเล็ก/ใหญ่/ตัวเลข/อักขระพิเศษ และ ≥ 8 ตัว" },
              ]}
              hasFeedback
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="ระบุรหัสผ่านใหม่"
                className="py-2.5 rounded-xl border-gray-200 hover:border-blue-400 focus:border-blue-500"
              />
            </Form.Item>

            <Form.Item
              name="confirm"
              label={<span className="font-semibold text-gray-700 ml-1">ยืนยันรหัสผ่านใหม่</span>}
              dependencies={["newPassword"]}
              rules={[
                { required: true, message: "กรุณายืนยันรหัสผ่าน" },
                ({ getFieldValue }) => ({
                  validator(_, val) {
                    return !val || getFieldValue("newPassword") === val
                      ? Promise.resolve()
                      : Promise.reject(new Error("รหัสผ่านไม่ตรงกัน"));
                  },
                }),
              ]}
              hasFeedback
            >
              <Input.Password
                prefix={<CheckCircleOutlined className="text-gray-400" />}
                placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                className="py-2.5 rounded-xl border-gray-200 hover:border-blue-400 focus:border-blue-500"
              />
            </Form.Item>

            <div className="pt-2">
              <Button
                type="primary"
                loading={loading}
                onClick={handleOk}
                block
                size="large"
                className="h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 border-none font-bold shadow-md shadow-blue-200"
              >
                บันทึกและเข้าสู่ระบบใหม่
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </Modal>
  );
}