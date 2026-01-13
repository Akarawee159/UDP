// src/pages/Masterdata/Trainings/Modal/ModalEmployee.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Modal, Table, Input, Button, message, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../../../api';

const renderThaiDate = (val) => {
    return val ? dayjs(val).add(543, 'year').format('DD/MM/YYYY') : '-';
};

function ModalEmployee({ open, onCancel, onConfirm, existingData = [] }) {
    // ... (State และ Logic ส่วนบนเหมือนเดิม)
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);

    const existingIds = useMemo(() => {
        return new Set(existingData.map(item => item.employee_code));
    }, [existingData]);

    useEffect(() => {
        if (open) {
            fetchEmployees();
            setSelectedRowKeys([]);
            setSelectedRows([]);
        }
    }, [open]);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const res = await api.get('/trainings/employees');
            if (res.data.success) {
                const mapped = res.data.data.map((item) => ({
                    ...item,
                    key: item.employee_code,
                }));
                setData(mapped);
            }
        } catch (err) {
            console.error(err);
            message.error('ไม่สามารถดึงข้อมูลพนักงานได้');
        } finally {
            setLoading(false);
        }
    };

    const filteredData = data.filter((item) => {
        const searchLower = searchText.toLowerCase();
        return Object.values(item).some(
            (val) => val && String(val).toLowerCase().includes(searchLower)
        );
    });

    // ✅ แก้ไข 1: กำหนด width ให้ครบทุกคอลัมน์
    const columns = [
        {
            title: 'รหัสพนักงาน',
            dataIndex: 'employee_code',
            key: 'employee_code',
            width: 120, // กำหนดความกว้าง
        },
        {
            title: 'ชื่อ-สกุล',
            dataIndex: 'fullname_th',
            key: 'fullname_th',
            width: 200, // ชื่อยาวหน่อย ให้กว้างกว่า
        },
        {
            title: 'สถานะ',
            key: 'status',
            align: 'center',
            width: 100, // มีอยู่แล้ว
            render: (_, record) => (
                existingIds.has(record.employee_code) ? (
                    <Tag color="orange">เลือกแล้ว</Tag>
                ) : null
            )
        },
        {
            title: 'ตำแหน่ง',
            dataIndex: 'position',
            key: 'position',
            width: 150,
        },
        {
            title: 'แผนก',
            dataIndex: 'department',
            key: 'department',
            width: 150,
        },
        {
            title: 'ไซต์งาน',
            dataIndex: 'worksites',
            key: 'worksites',
            width: 150,
        },
        {
            title: 'วันที่เริ่มงาน',
            dataIndex: 'sign_date',
            key: 'sign_date',
            width: 120,
            render: renderThaiDate
        },
        {
            title: 'วันที่ลาออก',
            dataIndex: 'resign_date',
            key: 'resign_date',
            width: 120,
            render: renderThaiDate
        },
    ];

    // ... (Logic rowSelection และ handleConfirm เหมือนเดิม)
    const onSelectChange = (newSelectedRowKeys, newSelectedRows) => {
        setSelectedRowKeys(newSelectedRowKeys);
        setSelectedRows(newSelectedRows);
    };

    const rowSelection = {
        selectedRowKeys,
        onChange: onSelectChange,
        getCheckboxProps: (record) => ({
            disabled: existingIds.has(record.employee_code),
        }),
    };

    const handleConfirm = () => {
        if (selectedRows.length === 0) {
            message.warning('กรุณาเลือกพนักงานอย่างน้อย 1 คน');
            return;
        }
        onConfirm(selectedRows);
        message.success(`เพิ่มพนักงาน ${selectedRows.length} รายการเรียบร้อย`);
        setSelectedRowKeys([]);
        setSelectedRows([]);
    };

    return (
        <Modal
            title="เลือกพนักงานเข้าร่วมอบรม"
            open={open}
            onCancel={onCancel}
            width={1000}
            footer={[
                <Button key="submit" type="primary" onClick={handleConfirm}>
                    เลือกข้อมูล ({selectedRows.length})
                </Button>,
                <Button key="cancel" onClick={onCancel}>
                    ปิดหน้าต่าง
                </Button>,
            ]}
        >
            <div style={{ marginBottom: 16 }}>
                <Input
                    placeholder="ค้นหาข้อมูล (ทุกคอลัมน์)"
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: '100%' }}
                />
            </div>

            <Table
                rowSelection={rowSelection}
                columns={columns}
                dataSource={filteredData}
                loading={loading}
                pagination={{ pageSize: 15 }}
                size="small"
                // ✅ แก้ไข 2: เพิ่ม scroll x: 'max-content'
                // max-content จะดันตารางให้ออกไปด้านข้างตาม width ของคอลัมน์รวมกัน ไม่บีบลงบรรทัดใหม่
                scroll={{ x: 'max-content', y: 400 }}
                onRow={(record) => ({
                    onClick: () => {
                        if (existingIds.has(record.employee_code)) {
                            message.warning(`คุณเลือก "${record.fullname_th}" ไปแล้ว`);
                            return;
                        }

                        const key = record.employee_code;
                        const isSelected = selectedRowKeys.includes(key);
                        let newKeys, newRows;

                        if (isSelected) {
                            newKeys = selectedRowKeys.filter(k => k !== key);
                            newRows = selectedRows.filter(r => r.employee_code !== key);
                        } else {
                            newKeys = [...selectedRowKeys, key];
                            newRows = [...selectedRows, record];
                        }

                        setSelectedRowKeys(newKeys);
                        setSelectedRows(newRows);
                    },
                    style: {
                        cursor: existingIds.has(record.employee_code) ? 'not-allowed' : 'pointer',
                        background: selectedRowKeys.includes(record.employee_code) ? '#e6f7ff' : 'inherit'
                    },
                })}
            />
        </Modal>
    );
}

export default ModalEmployee;