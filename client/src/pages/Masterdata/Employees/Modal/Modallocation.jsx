// src/pages/Masterdata/Employees/Modal/Modallocation.jsx
import React, { useEffect, useState } from 'react';
import { Modal, Input, Table, Button, Space, Typography } from 'antd';
import { HomeOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../../../../api';

const { Text } = Typography;

export default function Modallocation({ open, onClose, onSelect }) {
  const [query, setQuery] = useState('');            // คำค้นที่ผู้ใช้กำลังพิมพ์
  const [debouncedQuery, setDebouncedQuery] = useState(''); // คำค้นที่เราจะใช้ยิง API (หน่วง 300ms)

  const [page, setPage] = useState(1);
  const [pageSize] = useState(50); // แสดงหน้าละ 50 รายการ (ตาม UI ปัจจุบัน)
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // 1) หน่วง query 300ms เพื่อยิง search อัตโนมัติ
  useEffect(() => {
    // ทุกครั้งที่ผู้ใช้พิมพ์ ให้เริ่มจับเวลาใหม่
    const t = setTimeout(() => {
      // อัปเดตคำค้นจริงที่จะใช้ไปยิง API
      setDebouncedQuery(query);
      // รีเซ็ตหน้าเป็น 1 ทุกครั้งที่เปลี่ยนคำค้น
      setPage(1);
    }, 300);

    return () => clearTimeout(t);
  }, [query]);

  // 2) โหลดข้อมูลจาก server ทุกครั้งที่ modal เปิด หรือ page / debouncedQuery เปลี่ยน
  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/location/search', {
          params: {
            q: debouncedQuery,
            page,
            pageSize,
          },
        });

        setRows(Array.isArray(data?.data) ? data.data : []);
        setTotal(data?.total || 0);
      } catch (err) {
        console.error('fetchLocations error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, debouncedQuery, page, pageSize]);

  // 3) เวลาเปิด modal รอบใหม่ ให้รีเซ็ตหน้า/ผลค้นหาเริ่มต้น (optional: เคลียร์ query ด้วยก็ได้)
  useEffect(() => {
    if (open) {
      setPage(1);
      // ถ้าอยากให้เปิดใหม่แล้วเคลียร์ข้อความค้นหาให้ว่าง ให้ uncomment บรรทัดข้างล่าง
      // setQuery('');
      // setDebouncedQuery('');
    }
  }, [open]);

  // 4) เปลี่ยนหน้าในตาราง: แค่เปลี่ยน page state ก็พอ แล้ว useEffect จะโหลดเอง
  const handleTableChange = (pagination) => {
    setPage(pagination.current);
  };

  const columns = [
    {
      title: 'เลือก',
      key: 'select',
      width: 70,
      align: 'center',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<HomeOutlined />}
          onClick={() => {
            // ส่งแถวที่เลือกกลับไปให้ ModalCreate
            onSelect?.(record);
          }}
        />
      ),
    },
    { title: 'แขวง/ตำบล', dataIndex: 'subdistrict_name_th' },
    { title: 'เขต/อำเภอ', dataIndex: 'district_name_th' },
    { title: 'จังหวัด', dataIndex: 'province_name_th' },
    { title: 'รหัสไปรษณีย์', dataIndex: 'zip_code', width: 120 },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="เลือกพื้นที่"
      destroyOnClose
      maskClosable={false}
      width={800}
      bodyStyle={{ paddingTop: 8 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {/* แถวค้นหา */}
        <Input
          placeholder="ค้นหา จังหวัด / อำเภอ / ตำบล / รหัสไปรษณีย์"
          allowClear
          prefix={<SearchOutlined />}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
        />

        <Text type="secondary" style={{ fontSize: 12 }}>
          แสดงหน้าละ {pageSize} รายการ
        </Text>

        {/* ตารางผลลัพธ์ */}
        <Table
          size="small"
          rowKey="subdistrict_id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false, // ไม่ให้เปลี่ยน 50
          }}
          scroll={{ y: 400 }}
          onChange={handleTableChange}
        />
      </Space>
    </Modal>
  );
}
