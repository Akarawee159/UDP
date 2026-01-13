// src/pages/Management/UserManagement/UserManagement.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Table, Grid, Avatar, Switch, Tooltip, Typography, App, Input, Popconfirm, ConfigProvider, Button, Dropdown, Tag, Card } from 'antd';
import {
    TeamOutlined, KeyOutlined, UserOutlined, PlusOutlined, DeleteOutlined, MoreOutlined,
    SearchOutlined, SafetyCertificateFilled, ClearOutlined, StopOutlined, CheckCircleFilled,
    CheckCircleOutlined, WarningOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import api from "../../../api";
import ModalGroup from "./Modal/ModalGroup";
import ModalReset from "./Modal/ModalReset";
import ModalCreate from "./Modal/ModalCreate";
import ModalDelete from "./Modal/ModalDelete";

const { Text } = Typography;

const PROTECTED_EMP_ID = '1'; // ✅ id พิเศษ (ผู้ดูแลระบบ)

const UserManagement = () => {
    const screens = Grid.useBreakpoint();
    const isMd = !!screens.md;
    const containerStyle = useMemo(() => ({
        margin: isMd ? '-8px' : '0',
        padding: isMd ? '16px' : '12px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
    }), [isMd]);

    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [keyword, setKeyword] = useState('');
    const [page, setPage] = useState({ current: 1, pageSize: 10 });
    const [tableY, setTableY] = useState(600);

    const [activeUser, setActiveUser] = useState(null);
    const [openGroup, setOpenGroup] = useState(false);
    const [openReset, setOpenReset] = useState(false);
    const [openCreate, setOpenCreate] = useState(false);
    const [openDelete, setOpenDelete] = useState(false);

    // --- Logic เดิม ---
    const openDeleteModal = (record) => {
        if (String(record.employee_id) === PROTECTED_EMP_ID) {
            message.warning('ไม่อนุญาตให้ลบผู้ดูแลระบบ');
            return;
        }
        setActiveUser(record);
        setOpenDelete(true);
    };

    const openAssign = (record) => {
        if (String(record.employee_id) === PROTECTED_EMP_ID) {
            message.warning('ไม่อนุญาตให้กำหนดกลุ่มสิทธิสำหรับผู้ดูแลระบบ');
            return;
        }
        setActiveUser(record);
        setOpenGroup(true);
    };

    const openResetModal = (record) => {
        if (String(record.employee_id) === PROTECTED_EMP_ID) {
            message.warning('ไม่อนุญาตให้รีเซ็ทรหัสผ่านสำหรับผู้ดูแลระบบ');
            return;
        }
        setActiveUser(record);
        setOpenReset(true);
    };

    // ✅ ฟังก์ชันสำหรับปุ่ม "รับทราบ" (Status 4 -> 5)
    const handleAck = async (record) => {
        try {
            // 1. เรียก API
            await api.patch(`/management/${record.employee_id}/ack-reset`);

            message.success('รับเรื่องดำเนินการเรียบร้อยแล้ว');

            // 2. ✅ แก้ไข: อัปเดต State ในตารางทันที (ไม่ต้องรอ Socket)
            setRows(prevRows => prevRows.map(row => {
                if (String(row.employee_id) === String(record.employee_id)) {
                    // เปลี่ยน status เป็น 5 (รับเรื่องแล้ว) ทันที
                    return { ...row, is_status: 5 };
                }
                return row;
            }));

        } catch (err) {
            console.error(err);
            message.error('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
        }
    };

    const BE_BASE = useMemo(() => {
        const base = api?.defaults?.baseURL || "";
        if (/^https?:\/\//i.test(base)) return base.replace(/\/api\/?$/, '');
        if (base.startsWith('/')) return (window.location.origin + base).replace(/\/api\/?$/, '');
        return window.location.origin;
    }, []);

    const toProfileUrl = (val, v) => {
        if (!val) return undefined;
        if (/^https?:\/\//i.test(val)) return val;
        if (val.startsWith('/')) return `${BE_BASE}${val}`;
        const qs = v ? `?v=${v}` : '';
        return `${BE_BASE}/img/profile/${val}${qs}`;
    };

    useEffect(() => {
        const onResize = () => setTableY(Math.max(400, window.innerHeight - 380));
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // ✅ Realtime Listeners
    useEffect(() => {
        const onStatus = (e) => {
            const { employee_id, is_status } = e.detail || {};
            if (!employee_id) return;
            setRows((list) => {
                return list.map((r) => {
                    if (String(r.employee_id) === String(employee_id)) {
                        return { ...r, is_status: Number(is_status) };
                    }
                    return r;
                });
            });
        };
        window.addEventListener('hrms:user-status', onStatus);
        // ฟัง event จาก forgot password ด้วย (ถ้ามี custom event)
        const onForgotUpdate = (e) => {
            const { employee_code, is_status } = e.detail || {};
            // ต้องหา employee_id จาก code (ถ้า rows มี code)
            // ในที่นี้สมมติว่า update ผ่าน employee_id หรือ map code เอา
            if (employee_code) {
                setRows(list => list.map(r => {
                    if (r.employee_code === employee_code || String(r.employee_id) === String(employee_code)) {
                        return { ...r, is_status: Number(is_status) };
                    }
                    return r;
                }));
            }
        };
        window.addEventListener('hrms:forgot-password-update', onForgotUpdate);

        return () => {
            window.removeEventListener('hrms:user-status', onStatus);
            window.removeEventListener('hrms:forgot-password-update', onForgotUpdate);
        };
    }, []);

    useEffect(() => {
        const onUpsert = (e) => upsertRow(e.detail);
        window.addEventListener('hrms:user-upsert', onUpsert);
        return () => window.removeEventListener('hrms:user-upsert', onUpsert);
    }, []);

    const upsertRow = (newRow) => {
        if (!newRow || !newRow.employee_id) return;
        setRows((list) => {
            const idx = list.findIndex(r => String(r.employee_id) === String(newRow.employee_id));
            const prev = idx >= 0 ? list[idx] : null;
            const merged = { ...(prev || {}), ...newRow };
            if ('profileImg' in newRow) merged._imgV = Date.now();
            merged.is_status = Number(merged.is_status ?? 1);
            if (idx >= 0) {
                const copy = list.slice();
                copy[idx] = merged;
                return copy;
            }
            return [merged, ...list];
        });
    };

    const removeRow = (id) => {
        setRows((list) => list.filter(r => String(r.employee_id) !== String(id)));
    };

    useEffect(() => {
        const onRemove = (e) => {
            if (e.detail?.employee_id) removeRow(e.detail.employee_id);
        };
        window.addEventListener('hrms:user-remove', onRemove);
        return () => window.removeEventListener('hrms:user-remove', onRemove);
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/management');
            const list = Array.isArray(data?.data) ? data.data : [];
            setRows(list.map(r => ({ ...r, is_status: Number(r.is_status) })));
        } catch (err) {
            console.error(err);
            message.error('โหลดข้อมูลไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { fetchUsers(); }, []);

    const data = useMemo(() => {
        const q = keyword.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(r => {
            const full = `${r.titlename_th || ''}${r.firstname_th || ''} ${r.lastname_th || ''}`.toLowerCase();
            return (
                String(r.employee_id).includes(q) ||
                (r.username || '').toLowerCase().includes(q) ||
                full.includes(q) ||
                (r.company || '').toLowerCase().includes(q) ||
                (r.branch || '').toLowerCase().includes(q)
            );
        });
    }, [rows, keyword]);

    const handleToggleBan = async (record, checked) => {
        if (String(record.employee_id) === PROTECTED_EMP_ID) {
            message.warning('ไม่อนุญาตให้ห้ามใช้งานผู้ดูแลระบบ');
            return;
        }
        const next = checked ? 3 : 1;
        const prev = record.is_status;
        setRows(list => list.map(r => r.employee_id === record.employee_id ? { ...r, is_status: next } : r));
        try {
            await api.patch(`/management/${record.employee_id}/status`, { is_status: next });
            if (checked) {
                await api.post('/auth/revoke-sessions', { employee_id: record.employee_id, keep_status: true });
                message.success('ปิดการใช้งานผู้ใช้ และบังคับออกจากระบบแล้ว');
            } else {
                message.success('เปิดการใช้งานผู้ใช้แล้ว');
            }
        } catch (err) {
            setRows(list => list.map(r => r.employee_id === record.employee_id ? { ...r, is_status: prev } : r));
            message.error('อัปเดตสถานะไม่สำเร็จ');
        }
    };

    const handleClearStatus = async (record) => {
        if (String(record.employee_id) === PROTECTED_EMP_ID) return;
        try {
            await api.post('/auth/revoke-sessions', { employee_id: record.employee_id });
            message.success('เคลียร์สถานะสำเร็จ');
            setRows(list => list.map(r => r.employee_id === record.employee_id ? { ...r, is_status: 1 } : r));
        } catch (err) {
            message.error('เคลียร์สถานะไม่สำเร็จ');
        }
    };

    const Fullname = (r) => `${r.titlename_th || ''}${r.firstname_th || ''}${r.lastname_th ? ' ' + r.lastname_th : ''}`;

    const StatusCell = (record) => {
        const v = Number(record.is_status);
        const isProtected = String(record.employee_id) === PROTECTED_EMP_ID;

        // ✅ Status 4 (Pending) & 5 (Processing): ลืมรหัสผ่าน (ส้มสลับเทา)
        if (v === 4 || v === 5) {
            return (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border animate-blink-warning">
                    <WarningOutlined /> ลืมรหัสผ่าน
                </div>
            );
        }

        // ✅ Status 6: รีเซ็ทแล้ว (น้ำเงิน) -> เปลี่ยนจากเขียวเป็นน้ำเงินตามธีม
        if (v === 6) {
            return (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-xs font-medium">
                    <CheckCircleFilled /> รีเซ็ทแล้ว
                </div>
            );
        }

        if (v === 3) return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
                <StopOutlined /> ห้ามใช้งาน
            </div>
        );

        if (v === 2) {
            // เปลี่ยน status ออนไลน์เป็นสีน้ำเงิน
            const node = (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-medium shadow-sm">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    ออนไลน์
                </div>
            );
            return isProtected ? (
                <Tooltip title="ไม่อนุญาต">{node}</Tooltip>
            ) : (
                <Popconfirm
                    title="เคลียร์สถานะออนไลน์?"
                    description="บังคับออกจากระบบ และตั้งสถานะเป็นออฟไลน์"
                    onConfirm={() => handleClearStatus(record)}
                    okText="ยืนยัน"
                    cancelText="ยกเลิก"
                >
                    <span className="cursor-pointer hover:opacity-80 transition-opacity">{node}</span>
                </Popconfirm>
            );
        }
        return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-500 text-xs font-medium">
                <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                ออฟไลน์
            </div>
        );
    };

    const columns = useMemo(() => [
        {
            title: 'ลำดับ',
            dataIndex: 'index',
            width: 60,
            align: 'center',
            render: (_val, _record, index) => <span className="text-gray-400 font-medium">{(page.current - 1) * page.pageSize + index + 1}</span>
        },
        {
            title: 'ผู้ใช้งาน',
            dataIndex: 'fullname',
            ellipsis: true,
            render: (_val, r) => (
                <div className="flex items-center gap-3 group cursor-default">
                    {/* เปลี่ยนสีกรอบและ icon avatar เป็นสีน้ำเงิน */}
                    <div className={`relative p-0.5 rounded-full border-2 ${r.is_status === 2 ? 'border-red-400' : 'border-transparent'}`}>
                        <Avatar src={toProfileUrl(r.profileImg, r._imgV)} icon={!r.profileImg && <UserOutlined />} size={42} className="bg-slate-50 text-slate-600" />
                    </div>
                    <div>
                        {/* เปลี่ยนสี hover เป็นน้ำเงิน */}
                        <div className="font-bold text-gray-700 group-hover:text-blue-700 transition-colors">
                            {String(r.employee_id) === PROTECTED_EMP_ID ? (
                                <span className="flex items-center gap-1 text-blue-600">
                                    <SafetyCertificateFilled /> ผู้ดูแลระบบ
                                </span>
                            ) : Fullname(r)}
                        </div>
                        <div className="text-xs text-gray-400 font-mono">ID: {r.employee_id}</div>
                    </div>
                </div>
            )
        },
        {
            title: 'ชื่อผู้ใช้งาน',
            dataIndex: 'username',
            width: 150,
            render: (t) => <span className="font-mono text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{t}</span>
        },
        {
            title: 'สาขา',
            dataIndex: 'branch',
            width: 160,
            // แสดงจำนวนรายการ (Count) ต่อท้ายชื่อตัวเลือกใน Filter
            filters: [...new Set(rows.map(r => r.branch).filter(Boolean))].map(b => ({
                text: `${b} (${rows.filter(r => r.branch === b).length})`,
                value: b
            })),
            onFilter: (value, record) => record.branch === value,
            render: (t) => <span className="text-gray-600">{t || '-'}</span>
        },
        {
            title: 'กลุ่มสิทธิ',
            dataIndex: 'permission_role',
            width: 140,
            // แสดงจำนวนรายการ (Count) ต่อท้ายชื่อตัวเลือกใน Filter
            filters: [...new Set(rows.map(r => r.permission_role).filter(Boolean))].map(p => ({
                text: `${p} (${rows.filter(r => r.permission_role === p).length})`,
                value: p
            })),
            onFilter: (value, record) => record.permission_role === value,
            render: (role) => role ? (
                <Tag color="slate" className="border-0 bg-slate-400 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                    {role}
                </Tag>
            ) : <Text type="secondary">-</Text>
        },
        {
            title: 'สถานะ',
            dataIndex: 'is_status',
            width: 130,
            align: 'center',
            // ✅ แก้ไข: แปลงตัวเลขเป็นข้อความภาษาไทยตามเงื่อนไข พร้อมแสดงจำนวน
            filters: [...new Set(rows.map(r => r.is_status).filter(Boolean))].sort((a, b) => a - b).map(status => {
                const statusMap = {
                    1: 'ออฟไลน์',
                    2: 'ออนไลน์',
                    3: 'ห้ามใช้งาน',
                    4: 'ลืมรหัสผ่าน',
                    5: 'ลืมรหัสผ่าน',
                    6: 'รีเซ็ทแล้ว'
                };
                const label = statusMap[status] || status;
                const count = rows.filter(r => r.is_status === status).length;
                return {
                    text: `${label} (${count})`,
                    value: status
                };
            }),
            onFilter: (value, record) => record.is_status === value,
            render: (_v, r) => StatusCell(r)
        },
        {
            title: 'ระงับ',
            key: 'ban',
            width: 100, // ปรับ width เผื่อปุ่มรับทราบ
            align: 'center',
            render: (_v, r) => {
                const isProtected = String(r.employee_id) === PROTECTED_EMP_ID;

                // ✅ Status 4: แสดงปุ่ม "รับทราบ"
                if (r.is_status === 4) {
                    return (
                        <Button
                            type="primary"
                            size="small"
                            onClick={() => handleAck(r)}
                            className="bg-orange-500 hover:bg-orange-600 border-none text-xs shadow-sm"
                        >
                            รับทราบ
                        </Button>
                    );
                }

                // ✅ Status 5 & 6: แสดงข้อความ "รับเรื่องแล้ว"
                if (r.is_status === 5) {
                    return (
                        <span className="text-xs text-gray-400 font-medium">
                            รับเรื่องแล้ว
                        </span>
                    );
                }

                // ปกติ: Switch
                return (
                    <ConfigProvider theme={{ components: { Switch: { colorPrimary: '#ef4444', colorPrimaryHover: '#dc2626' } } }}>
                        <Tooltip title={isProtected ? 'ไม่อนุญาต' : (r.is_status === 3 ? 'ปลดแบน' : 'ระงับการใช้งาน')}>
                            <span onClick={(e) => isProtected && e.stopPropagation()} className={isProtected ? 'opacity-50 cursor-not-allowed' : ''}>
                                <Switch
                                    size="small"
                                    checked={r.is_status === 3}
                                    onChange={(checked) => handleToggleBan(r, checked)}
                                    disabled={isProtected}
                                />
                            </span>
                        </Tooltip>
                    </ConfigProvider>
                );
            },
        },
        {
            title: '',
            key: 'action',
            width: 60,
            align: 'center',
            render: (_, record) => {
                const isProtected = String(record.employee_id) === PROTECTED_EMP_ID;

                // ✅ Status 4: ซ่อน Menu (Action ว่างเปล่า)
                if (record.is_status === 4) {
                    return null;
                }

                // ✅ Status 5: ปุ่ม "รีเซ็ต" (เปิด ModalReset)
                if (record.is_status === 5) {
                    return (
                        <Tooltip title="ดำเนินการรีเซ็ตรหัสผ่าน">
                            <Button
                                type="text"
                                shape="circle"
                                onClick={() => openResetModal(record)}
                                className="text-orange-500 hover:bg-orange-50 hover:text-orange-600"
                            >
                                <KeyOutlined />
                            </Button>
                        </Tooltip>
                    );
                }

                // ✅ Status 6: ไอคอน CheckCircle สีน้ำเงิน (เปลี่ยนจากเขียว)
                if (record.is_status === 6) {
                    return <CheckCircleOutlined className="text-lg text-blue-500" />;
                }

                // ปกติ: Dropdown Menu
                const menuItems = [
                    { key: 'assign', label: 'กำหนดกลุ่มสิทธิ', icon: <TeamOutlined />, onClick: () => openAssign(record), disabled: isProtected },
                    { key: 'reset', label: 'รีเซ็ตรหัสผ่าน', icon: <KeyOutlined />, onClick: () => openResetModal(record), disabled: isProtected },
                    { type: 'divider' },
                    { key: 'delete', label: 'ลบผู้ใช้งาน', icon: <DeleteOutlined />, onClick: () => openDeleteModal(record), disabled: isProtected, danger: true },
                ];
                return (
                    <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                        {/* เปลี่ยน Hover ของปุ่ม action เป็นสีน้ำเงิน */}
                        <Button type="text" shape="circle" icon={<MoreOutlined className="text-gray-400 text-lg" />} className="hover:bg-blue-50 hover:text-blue-600" />
                    </Dropdown>
                );
            },
        },
    ], [page, containerStyle, rows]);

    return (
        <ConfigProvider
            theme={{
                token: {
                    fontFamily: 'Inter, "Sarabun", sans-serif',
                    colorPrimary: '#2563eb',
                    borderRadius: 8,
                },
                components: {
                    Table: {
                        headerBg: '#e5e7eb',
                        headerColor: '#000000',
                        headerBorderRadius: 8,
                        borderColor: '#f1f5f9',
                        rowHoverBg: '#f8fafc',
                    },
                    Button: {
                        // เปลี่ยนเงาปุ่มเป็นสีน้ำเงิน
                        primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)',
                    }
                }
            }}
        >
            <div style={containerStyle} className="bg-gray-50">

                {/* Header Section */}
                <div className="w-full mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        {/* เปลี่ยน text สีน้ำเงิน */}
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <TeamOutlined className="text-blue-600" />
                            จัดการผู้ใช้งาน
                        </h1>
                        <p className="text-slate-600/80 text-sm mt-1">
                            บริหารจัดการบัญชี, กำหนดสิทธิ และตรวจสอบสถานะการใช้งาน
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
                        <Input
                            prefix={<SearchOutlined className="text-gray-400" />}
                            placeholder="ค้นหาชื่อ, ID, สาขา..."
                            allowClear
                            bordered={false}
                            onChange={(e) => setKeyword(e.target.value)}
                            className="w-full md:w-64 bg-transparent"
                        />
                        {/* เปลี่ยนปุ่มหลักเป็นสีน้ำเงิน */}
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setOpenCreate(true)}
                            className="bg-blue-600 hover:bg-blue-500 border-none h-9 rounded-lg px-4 font-medium"
                        >
                            เพิ่มผู้ใช้งาน
                        </Button>
                    </div>
                </div>

                {/* Table Card */}
                <div className="w-full flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <Table
                        rowKey="employee_id"
                        loading={loading}
                        dataSource={data}
                        columns={columns}
                        sticky
                        size="middle"
                        scroll={{ x: 'max-content', y: tableY }}
                        pagination={{
                            current: page.current,
                            pageSize: page.pageSize,
                            showSizeChanger: true,
                            pageSizeOptions: [10, 20, 50, 100],
                            showTotal: (t, r) => <span className="text-gray-400 text-xs">แสดง {r[0]}-{r[1]} จาก {t} รายการ</span>,
                            className: 'px-4 pb-4'
                        }}
                        onChange={(pg) => setPage({ current: pg.current, pageSize: pg.pageSize })}
                        className="custom-blue-table"
                    />
                </div>

                {/* Modals */}
                <ModalGroup
                    open={openGroup}
                    record={activeUser}
                    onClose={() => setOpenGroup(false)}
                    onSaved={(groupName) => {
                        setRows(list => list.map(r => r.employee_id === activeUser?.employee_id ? { ...r, permission_role: groupName } : r));
                        setOpenGroup(false);
                    }}
                />
                <ModalReset
                    open={openReset}
                    record={activeUser}
                    onClose={() => setOpenReset(false)}
                />
                <ModalCreate
                    open={openCreate}
                    onClose={() => setOpenCreate(false)}
                    onSaved={(row) => {
                        upsertRow(row);
                        setOpenCreate(false);
                    }}
                />
                <ModalDelete
                    open={openDelete}
                    record={activeUser}
                    onClose={() => setOpenDelete(false)}
                    onDeleted={(employee_id) => {
                        removeRow(employee_id);
                        setOpenDelete(false);
                    }}
                />
            </div>

            {/* Style for Blinking Animation (Keep Orange Warning) */}
            <style>{`
                @keyframes blinkWarning {
                    0%, 100% { color: #c2410c; background-color: #ffedd5; border-color: #fed7aa; }
                    50% { color: #6b7280; background-color: #f3f4f6; border-color: #e5e7eb; }
                }
                .animate-blink-warning {
                    animation: blinkWarning 1.5s infinite ease-in-out;
                }
            `}</style>
        </ConfigProvider>
    );
};

export default UserManagement;