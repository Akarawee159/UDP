// src/pages/Masterdata/Employees/Modal/TabWorkhistory.jsx
import React from 'react';
import { Typography, Button, Table } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title } = Typography;
const DATE_FORMAT = 'DD/MM/YYYY';

export default function TabWorkhistory({
  workHistory = [],
  loading = false,
  onCreate,
  onEdit,
}) {
  return (
    <div style={{ flex: 1, paddingTop: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <Title level={5} underline style={{ color: '#0916C8', margin: 0 }}>
          ข้อมูลประวัติการทำงาน
        </Title>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={onCreate}
        >
          บันทึกประวัติการทำงาน
        </Button>
      </div>

      <Table
        rowKey={(r) =>
          r.wh_id || `${r.wh_company_name}-${r.wh_start_date}-${Math.random()}`
        }
        dataSource={workHistory}
        loading={loading}
        columns={[
          {
            title: 'ชื่อสถานประกอบการ',
            dataIndex: 'wh_company_name',
            key: 'wh_company_name',
          },
          {
            title: 'เบอร์โทรศัพท์',
            dataIndex: 'wh_phone',
            key: 'wh_phone',
          },
          {
            title: 'ตำแหน่ง',
            dataIndex: 'wh_position',
            key: 'wh_position',
          },
          {
            title: 'เงินเดือน',
            dataIndex: 'wh_salary',
            key: 'wh_salary',
          },
          {
            title: 'ชื่อผู้บังคับบัญชา',
            dataIndex: 'wh_supervisor_name',
            key: 'wh_supervisor_name',
          },
          {
            title: 'ตำแหน่งของหัวหน้า',
            dataIndex: 'wh_supervisor_position',
            key: 'wh_supervisor_position',
          },
          {
            title: 'เบอร์โทรศัพท์ (หัวหน้า)',
            dataIndex: 'wh_supervisor_phone',
            key: 'wh_supervisor_phone',
          },
          {
            title: 'ลักษณะงานที่ทำ',
            dataIndex: 'wh_job_description',
            key: 'wh_job_description',
          },
          {
            title: 'วันที่เข้า',
            dataIndex: 'wh_start_date',
            key: 'wh_start_date',
            render: (text) =>
              text ? dayjs(text).format(DATE_FORMAT) : null,
          },
          {
            title: 'วันที่ออก',
            dataIndex: 'wh_end_date',
            key: 'wh_end_date',
            render: (text) =>
              text ? dayjs(text).format(DATE_FORMAT) : null,
          },
          {
            title: 'สาเหตุที่ออก',
            dataIndex: 'wh_reason_for_leaving',
            key: 'wh_reason_for_leaving',
          },
        ]}
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: [5, 10, 20, 50, 100],
        }}
        size="small"
        style={{ marginTop: 8 }}
        onRow={(record) => ({
          onClick: () => {
            onEdit && onEdit(record);
          },
        })}
      />
    </div>
  );
}
