// src/pages/Masterdata/Employees/Modal/TabRelatives.jsx
import React from 'react';
import { Typography, Button, Table } from 'antd';
import { SaveOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function TabRelatives({
    relatives = [],
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
                    ข้อมูลญาติ/บุคคลที่ติดต่อได้
                </Title>
                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={onCreate}
                >
                    บันทึกญาติหรือบุคคลที่สามารถติดต่อได้
                </Button>
            </div>

            <Table
                rowKey={(r) => r.g_id}
                dataSource={relatives}
                loading={loading}
                columns={[
                    {
                        title: 'ชื่อสกุลญาติ',
                        dataIndex: 'g_full_name',
                        key: 'g_full_name',
                    },
                    {
                        title: 'ความสัมพันธ์',
                        dataIndex: 'g_relation',
                        key: 'g_relation',
                    },
                    {
                        title: 'ที่อยู่',
                        dataIndex: 'g_address',
                        key: 'g_address',
                    },
                    {
                        title: 'เบอร์โทรศัพท์',
                        dataIndex: 'g_phone',
                        key: 'g_phone',
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
