import React, { useEffect, useState } from 'react';
import { Table, App } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import api from "../../../../api";

// Extend DayJS
dayjs.extend(buddhistEra);
dayjs.locale('th');

function ModalEmployeeWorkReport({ employeeId }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const { message } = App.useApp?.() || { message: { error: console.error } };

    useEffect(() => {
        if (employeeId) {
            fetchLog();
        }
    }, [employeeId]);

    const fetchLog = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/report/employee/log/${employeeId}`);
            if (res.data?.success) {
                // Add unique keys for Antd Table
                const rows = (res.data.data || []).map((item, index) => ({
                    ...item,
                    key: index
                }));
                setData(rows);
            }
        } catch (err) {
            console.error(err);
            message.error('ไม่สามารถดึงข้อมูลประวัติการทำงานได้');
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'รหัสพนักงาน',
            dataIndex: 'employee_code',
            key: 'employee_code',
            width: 100,
        },
        {
            title: 'ชื่อ-นามสกุล',
            dataIndex: 'fullname_th',
            key: 'fullname_th',
            width: 200,
        },
        {
            title: 'เลขบัตรประชาชน',
            dataIndex: 'id_card',
            key: 'id_card',
            width: 150,
        },
        {
            title: 'ไซต์งาน',
            dataIndex: 'worksites',
            key: 'worksites',
            width: 150,
        },
        {
            title: 'แผนก',
            dataIndex: 'department',
            key: 'department',
            width: 150,
        },
        {
            title: 'ตำแหน่ง',
            dataIndex: 'position',
            key: 'position',
            width: 150,
        },
        {
            title: 'ประเภท',
            dataIndex: 'employee_type',
            key: 'employee_type',
            width: 120,
        },
        {
            title: 'สถานะการทำงาน',
            dataIndex: 'working_status',
            key: 'working_status',
            width: 200,
        },
        {
            title: 'สถานะทางทหาร',
            dataIndex: 'military_status',
            key: 'military_status',
            width: 200,
        },
        {
            title: 'สร้างโดย',
            dataIndex: 'created_by_name',
            key: 'created_by_name',
            width: 200,
            render: (text) => text || '-'
        },
        {
            title: 'วันที่สร้าง',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 160,
            render: (date) => date ? dayjs(date).format('D MMM BB HH:mm') : '-'
        },
        {
            title: 'อัปเดตโดย',
            dataIndex: 'updated_by_name',
            key: 'updated_by_name',
            width: 200,
            render: (text) => text || '-'
        },
        {
            title: 'วันที่อัปเดต',
            dataIndex: 'updated_at',
            key: 'updated_at',
            width: 160,
            render: (date) => date ? dayjs(date).format('D MMM BB HH:mm') : '-'
        },
    ];

    return (
        <Table
            columns={columns}
            dataSource={data}
            loading={loading}
            scroll={{ x: 1800, y: 400 }} // Scrollable for many columns
            size="small"
            pagination={{ pageSize: 10 }}
            bordered
        />
    );
}

export default ModalEmployeeWorkReport;