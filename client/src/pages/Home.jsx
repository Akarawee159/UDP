// src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Steps, Tag, Divider, Alert, Space } from 'antd';
import {
  QrcodeOutlined,
  ScanOutlined,
  EnvironmentOutlined,
  BarChartOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
  HistoryOutlined,
  FileExcelOutlined
} from '@ant-design/icons';
import api from '../api'; // ✅ path ถูกต้องตามเดิม

const { Title, Text, Paragraph } = Typography;

function Home() {
  // ✅ State สำหรับเก็บข้อมูล User และ Role Name
  const [me, setMe] = useState(null);
  const [roleName, setRoleName] = useState("กำลังโหลด...");

  // ✅ 1. ดึงข้อมูล User Profile
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/management/me");
        setMe(data?.data || null);
      } catch (error) {
        console.error("โหลดข้อมูลผู้ใช้ไม่สำเร็จ", error);
      }
    })();
  }, []);

  // ✅ 2. ดึงชื่อสิทธิ์ (Role Name) ให้ตรงกับ Navbar (copy logic จาก Navbar)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/permission/my-menus");
        // ถ้ามี groupName ให้ใช้ groupName ถ้าไม่มีให้ใช้ permission_role
        const name = data?.data?.groupName || me?.permission_role || "พนักงาน";
        if (alive) setRoleName(name);
      } catch {
        if (alive) setRoleName(me?.permission_role || "พนักงาน");
      }
    })();
    return () => { alive = false; };
  }, [me]); // run เมื่อ me เปลี่ยนหรือโหลดเสร็จ

  return (
    <div style={{ padding: '24px', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>

      {/* 1. Header: ชื่อระบบและข้อมูลผู้ใช้ */}
      <Card
        bordered={false}
        style={{
          // ✅ เปลี่ยนเป็นธีมสีแดง (ไล่เฉดจากแดงเข้มไปแดงสว่าง)
          background: 'linear-gradient(135deg, #a8071a 0%, #f5222d 100%)',
          borderRadius: '12px',
          marginBottom: '24px',
          color: '#fff',
          boxShadow: '0 4px 12px rgba(168, 7, 26, 0.3)' // เงาสีแดง
        }}
      >
        <Row align="middle" gutter={[24, 24]}>
          <Col xs={24} md={16}>
            <Space direction="vertical" size={2}>
              <Title level={2} style={{ color: '#fff', margin: 0 }}>
                SMART PACKAGE TRACKING (UDP SPT)
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: '18px' }}>
                ระบบติดตามบรรจุภัณฑ์
              </Text>
              <div style={{ marginTop: '16px' }}>
                <Tag color="#87d068" style={{ fontSize: '14px', padding: '4px 10px' }}>
                  <SafetyCertificateOutlined /> สถานะ: ออนไลน์
                </Tag>
                <Tag color="orange" style={{ fontSize: '14px', padding: '4px 10px' }}>
                  เวอร์ชัน 1.0
                </Tag>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '24px' }}>
            <Text style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>ผู้ใช้งานปัจจุบัน:</Text>
            <Title level={4} style={{ color: '#fff', margin: 0 }}>
              {me?.firstname_th ? `${me.firstname_th} ${me.lastname_th}` : 'Guest User'}
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.9)' }}>
              {/* ✅ แสดง Role Name ที่ดึงมาจาก API แบบเดียวกับ Navbar */}
              สิทธิ์การใช้งาน: <span style={{ fontWeight: 'bold' }}>{roleName}</span>
            </Text>
            <br />
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
              System Date: {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </Col>
        </Row>
      </Card>

      {/* 2. System Concept Workflow (แผนภาพการทำงาน) */}
      <Card title="📦 ภาพรวมกระบวนการทำงาน (System Workflow)" bordered={false} style={{ marginBottom: '24px', borderRadius: '12px' }}>
        <Steps
          current={-1}
          items={[
            {
              title: 'Create QR',
              description: 'สร้างรหัสกล่อง (Manager Only)',
              icon: <QrcodeOutlined />,
            },
            {
              title: 'Scan In/Out',
              description: 'สแกนรับเข้า-จ่ายออก / ระบุ Location',
              icon: <ScanOutlined />,
            },
            {
              title: 'Track Status',
              description: 'ติดตามสถานะ (ปกติ/ซ่อม/ชำรุด)',
              icon: <ToolOutlined />,
            },
            {
              title: 'Reporting',
              description: 'Timeline, Non-move, Excel',
              icon: <BarChartOutlined />,
            },
          ]}
        />
      </Card>

      {/* 3. ฟังก์ชันหลักของระบบ (Key Features) */}
      <Row gutter={[24, 24]}>
        {/* คอลัมน์ซ้าย: การปฏิบัติงาน */}
        <Col xs={24} lg={14}>
          <Card title="📌 ฟังก์ชันการปฏิบัติงานหลัก" bordered={false} style={{ height: '100%', borderRadius: '12px' }}>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  {/* ✅ เปลี่ยนไอคอนเป็นสีแดง */}
                  <ScanOutlined style={{ fontSize: '32px', color: '#f5222d' }} />
                  <div>
                    <Text strong style={{ fontSize: '16px' }}>ระบบสแกน (Scan Operation)</Text>
                    <Paragraph type="secondary">
                      บันทึกการ รับเข้า (IN) และ จ่ายออก (OUT) โดยใช้เครื่องสแกนยิงที่ QR Code
                      ระบบจะบันทึก Location ต้นทาง/ปลายทาง และเวลาละเอียดระดับ วินาที
                    </Paragraph>
                  </div>
                </div>
              </Col>
              <Divider style={{ margin: '12px 0' }} />
              <Col span={24}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <EnvironmentOutlined style={{ fontSize: '32px', color: '#52c41a' }} />
                  <div>
                    <Text strong style={{ fontSize: '16px' }}>ติดตามและตรวจสอบ (Tracking & Verify)</Text>
                    <Paragraph type="secondary">
                      ตรวจสอบสถานะกล่องว่าอยู่ที่ Location ใด สถานะเป็น ปกติ, รอซ่อม หรือ ชำรุด
                      และมีระบบป้องกันการสแกนซ้ำเบอร์กล่องเดิม
                    </Paragraph>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* คอลัมน์ขวา: รายงานและเงื่อนไข */}
        <Col xs={24} lg={10}>
          <Card title="📊 รูปแบบรายงานสรุป (Reports)" bordered={false} style={{ marginBottom: '24px', borderRadius: '12px' }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileExcelOutlined style={{ color: '#217346', fontSize: '20px' }} />
                <Text>Report Excel (สรุปยอดคงค้างตาม M/K)</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* ✅ เปลี่ยนไอคอนกราฟเป็นสีแดง */}
                <BarChartOutlined style={{ color: '#f5222d', fontSize: '20px' }} />
                <Text>กราฟแท่งแนวตั้ง (Summary Graph)</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <HistoryOutlined style={{ color: '#faad14', fontSize: '20px' }} />
                <Text>Timeline Report (ไทม์ไลน์การเคลื่อนย้าย)</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* ✅ เปลี่ยนไอคอน Non-move เป็นสีเทาเข้ม หรือแดงเข้ม */}
                <ScanOutlined style={{ color: '#cf1322', fontSize: '20px' }} />
                <Text>Non-Move Report (กล่องไม่เคลื่อนไหว 1-3 เดือน)</Text>
              </div>
            </Space>
          </Card>

          {/* กฎเหล็กของระบบ */}
          <Alert
            message="เงื่อนไขสำคัญของระบบ"
            description={
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                <li>หากสแกนผิดพลาด (IN/OUT ผิด) ต้องรอ <strong>1 นาที</strong> ถึงจะทำรายการต่อได้</li>
                <li>ห้ามสแกนเบอร์กล่องซ้ำ (ระบบจะล็อคเพื่อป้องกัน Report ซ้ำ)</li>
                <li>การแก้ไขข้อมูลต้องทำโดยหัวหน้า/ผู้จัดการเท่านั้น (มี Audit Trail เก็บประวัติ)</li>
              </ul>
            }
            type="warning"
            showIcon
            style={{ borderRadius: '12px' }}
          />
        </Col>
      </Row>

    </div>
  );
}

export default Home;