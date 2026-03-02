// src/pages/Management/UserManagement/UserManagement.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Grid, Avatar, Switch, Tooltip, Typography, App, Input, Popconfirm, ConfigProvider, Button, Dropdown, Tag } from 'antd';
import {
    TeamOutlined, KeyOutlined, UserOutlined, PlusOutlined, DeleteOutlined,
    SearchOutlined, SafetyCertificateFilled, StopOutlined, CheckCircleFilled,
    CheckCircleOutlined, WarningOutlined, EditOutlined
} from '@ant-design/icons';
import api from "../../../api";
import ModalGroup from "./Modal/ModalGroup";
import ModalReset from "./Modal/ModalReset";
import ModalCreate from "./Modal/ModalCreate";
import ModalCreate2 from "./Modal/ModalCreate2";
import ModalDelete from "./Modal/ModalDelete";
import { usePermission } from '../../../hooks/usePermission';

// ✅ Import Component ตารางที่เราแยกไว้
import DraggableTable from '../../../components/antdtable/DraggableTable';

const { Text } = Typography;
const PROTECTED_EMP_ID = '1';

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
    const [openCreate2, setOpenCreate2] = useState(false);
    const [openDelete, setOpenDelete] = useState(false);
    const { canUse } = usePermission();

    // --- Logic ทั้งหมด คงเดิม ---
    const openDeleteModal = (record) => {
        if (String(record.employee_id) === PROTECTED_EMP_ID) { message.warning('ไม่อนุญาตให้ลบผู้ดูแลระบบ'); return; }
        setActiveUser(record); setOpenDelete(true);
    };

    const openAssign = (record) => {
        if (String(record.employee_id) === PROTECTED_EMP_ID) { message.warning('ไม่อนุญาตให้กำหนดกลุ่มสิทธิสำหรับผู้ดูแลระบบ'); return; }
        setActiveUser(record); setOpenGroup(true);
    };

    const openResetModal = (record) => {
        if (String(record.employee_id) === PROTECTED_EMP_ID) { message.warning('ไม่อนุญาตให้รีเซ็ทรหัสผ่านสำหรับผู้ดูแลระบบ'); return; }
        setActiveUser(record); setOpenReset(true);
    };

    const handleAck = async (record) => {
        try {
            await api.patch(`/management/${record.employee_id}/ack-reset`);
            message.success('รับเรื่องดำเนินการเรียบร้อยแล้ว');
            setRows(prev => prev.map(row => String(row.employee_id) === String(record.employee_id) ? { ...row, is_status: 5 } : row));
        } catch (err) { console.error(err); message.error('เกิดข้อผิดพลาดในการอัปเดตสถานะ'); }
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

    useEffect(() => {
        const onStatus = (e) => {
            const { employee_id, is_status } = e.detail || {};
            if (employee_id) setRows((list) => list.map((r) => String(r.employee_id) === String(employee_id) ? { ...r, is_status: Number(is_status) } : r));
        };
        const onForgotUpdate = (e) => {
            const { employee_code, is_status } = e.detail || {};
            if (employee_code) setRows(list => list.map(r => (r.employee_code === employee_code || String(r.employee_id) === String(employee_code)) ? { ...r, is_status: Number(is_status) } : r));
        };
        window.addEventListener('hrms:user-status', onStatus);
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
            if (idx >= 0) { const copy = list.slice(); copy[idx] = merged; return copy; }
            return [merged, ...list];
        });
    };

    const removeRow = (id) => setRows((list) => list.filter(r => String(r.employee_id) !== String(id)));

    useEffect(() => {
        const onRemove = (e) => { if (e.detail?.employee_id) removeRow(e.detail.employee_id); };
        window.addEventListener('hrms:user-remove', onRemove);
        return () => window.removeEventListener('hrms:user-remove', onRemove);
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/management');
            setRows((Array.isArray(data?.data) ? data.data : []).map(r => ({ ...r, is_status: Number(r.is_status) })));
        } catch (err) { console.error(err); message.error('โหลดข้อมูลไม่สำเร็จ'); } finally { setLoading(false); }
    };
    useEffect(() => { fetchUsers(); }, []);

    const data = useMemo(() => {
        const q = keyword.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(r => {
            const full = `${r.titlename_th || ''}${r.firstname_th || ''} ${r.lastname_th || ''}`.toLowerCase();
            return (
                String(r.employee_id).includes(q) || (r.username || '').toLowerCase().includes(q) ||
                full.includes(q) || (r.company || '').toLowerCase().includes(q) || (r.branch || '').toLowerCase().includes(q)
            );
        });
    }, [rows, keyword]);

    const handleToggleBan = async (record, checked) => {
        if (String(record.employee_id) === PROTECTED_EMP_ID) { message.warning('ไม่อนุญาตให้ห้ามใช้งานผู้ดูแลระบบ'); return; }
        const next = checked ? 3 : 1; const prev = record.is_status;
        setRows(list => list.map(r => r.employee_id === record.employee_id ? { ...r, is_status: next } : r));
        try {
            await api.patch(`/management/${record.employee_id}/status`, { is_status: next });
            if (checked) {
                await api.post('/auth/revoke-sessions', { employee_id: record.employee_id, keep_status: true });
                message.success('ปิดการใช้งานผู้ใช้ และบังคับออกจากระบบแล้ว');
            } else { message.success('เปิดการใช้งานผู้ใช้แล้ว'); }
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
        } catch (err) { message.error('เคลียร์สถานะไม่สำเร็จ'); }
    };

    const Fullname = (r) => `${r.titlename_th || ''}${r.firstname_th || ''}${r.lastname_th ? ' ' + r.lastname_th : ''}`;

    const StatusCell = (record) => {
        const v = Number(record.is_status);
        const isProtected = String(record.employee_id) === PROTECTED_EMP_ID;

        if (v === 4 || v === 5) return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border animate-blink-warning">
                <WarningOutlined /> ลืมรหัสผ่าน
            </div>
        );
        if (v === 6) return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-600 text-xs font-medium">
                <CheckCircleFilled /> รีเซ็ทแล้ว
            </div>
        );
        if (v === 3) return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
                <StopOutlined /> ห้ามใช้งาน
            </div>
        );
        if (v === 2) {
            const node = (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-medium shadow-sm">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-md bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-md h-2 w-2 bg-emerald-500"></span>
                    </span> ออนไลน์
                </div>
            );
            if (isProtected) return <Tooltip title="ไม่อนุญาต">{node}</Tooltip>;
            if (!canUse('201:clear')) return <Tooltip title="ไม่มีสิทธิ์เคลียร์สถานะ">{node}</Tooltip>;
            return (
                <Popconfirm title="เคลียร์สถานะออนไลน์?" description="บังคับออกจากระบบ และตั้งสถานะเป็นออฟไลน์" onConfirm={() => handleClearStatus(record)} okText="ยืนยัน" cancelText="ยกเลิก">
                    <span className="cursor-pointer hover:opacity-80 transition-opacity">{node}</span>
                </Popconfirm>
            );
        }
        return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 border border-gray-200 text-gray-500 text-xs font-medium">
                <div className="h-2 w-2 rounded-md bg-gray-400"></div> ออฟไลน์
            </div>
        );
    };

    const baseColumns = useMemo(() => [
        {
            title: 'ลำดับ', dataIndex: 'index', key: 'index', width: 60, align: 'center',
            render: (_val, _record, index) => <span className="text-gray-400 font-medium">{(page.current - 1) * page.pageSize + index + 1}</span>
        },
        {
            title: 'ผู้ใช้งาน', dataIndex: 'fullname', key: 'fullname', width: 250, ellipsis: true,
            sorter: (a, b) => Fullname(a).localeCompare(Fullname(b)),
            filters: [...new Set(rows.map(r => Fullname(r)).filter(Boolean))].map(name => ({ text: name, value: name })),
            filterSearch: true, onFilter: (value, record) => Fullname(record) === value,
            render: (_val, r) => (
                <div className="flex items-center gap-3 group cursor-default">
                    <div className={`relative p-0.5 rounded-full border-2 ${r.is_status === 2 ? 'border-red-400' : 'border-transparent'}`}>
                        <Avatar src={toProfileUrl(r.profileImg, r._imgV)} icon={!r.profileImg && <UserOutlined />} size={36} className="bg-slate-50 text-slate-600" />
                    </div>
                    <div>
                        <div className="font-bold text-gray-700 group-hover:text-blue-700 transition-colors text-sm">
                            {String(r.employee_id) === PROTECTED_EMP_ID ? <span className="flex items-center gap-1 text-blue-600"><SafetyCertificateFilled /> ผู้ดูแลระบบ</span> : Fullname(r)}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono leading-tight">ID: {r.employee_id}</div>
                    </div>
                </div>
            )
        },
        {
            title: 'ชื่อผู้ใช้งาน', dataIndex: 'username', key: 'username', width: 150,
            sorter: (a, b) => String(a.username || '').localeCompare(String(b.username || '')),
            filters: [...new Set(rows.map(r => r.username).filter(Boolean))].map(u => ({ text: u, value: u })),
            filterSearch: true, onFilter: (value, record) => record.username === value,
            render: (t) => <span className="font-mono text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 text-sm">{t}</span>
        },
        {
            title: 'จำกัดเวลา', dataIndex: 'time_login', key: 'time_login', width: 140, align: 'center',
            sorter: (a, b) => String(a.time_login || '').localeCompare(String(b.time_login || '')),
            filters: [...new Set(rows.map(r => r.time_login).filter(Boolean))].map(time => ({ text: time, value: time })),
            onFilter: (value, record) => record.time_login === value,
            render: (timeStr) => {
                if (!timeStr) return <Text type="secondary" className="text-sm">-</Text>;
                const [h, m] = timeStr.split(':').map(Number);
                let text = h > 0 ? `${h} ชม. ` : ''; text += m > 0 ? `${m} นาที` : '';
                return text ? <Tag className="border-0 bg-blue-50 text-blue-600 font-medium text-xs">{text.trim()}</Tag> : <Text type="secondary">-</Text>;
            }
        },
        {
            title: 'เข้าสู่ระบบล่าสุด', dataIndex: 'last_login', key: 'last_login', width: 160,
            sorter: (a, b) => new Date(a.last_login || 0) - new Date(b.last_login || 0),
            render: (dateStr) => {
                if (!dateStr) return <Text type="secondary" className="text-sm">-</Text>;
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return <Text type="secondary" className="text-sm">-</Text>;
                return (
                    <div className="flex flex-col text-sm">
                        <span className="text-gray-500 font-medium">{d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        <span className="text-[14px] text-gray-700 font-mono leading-tight">เวลา {d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
                    </div>
                );
            }
        },
        {
            title: 'สาขา', dataIndex: 'branch', key: 'branch', width: 150,
            sorter: (a, b) => String(a.branch || '').localeCompare(String(b.branch || '')),
            filters: [...new Set(rows.map(r => r.branch).filter(Boolean))].map(b => ({ text: `${b} (${rows.filter(r => r.branch === b).length})`, value: b })),
            onFilter: (value, record) => record.branch === value,
            render: (t) => <span className="text-gray-600 text-sm">{t || '-'}</span>
        },
        {
            title: 'กลุ่มสิทธิ', dataIndex: 'permission_role', key: 'permission_role', width: 140,
            sorter: (a, b) => String(a.permission_role || '').localeCompare(String(b.permission_role || '')),
            filters: [...new Set(rows.map(r => r.permission_role).filter(Boolean))].map(p => ({ text: `${p} (${rows.filter(r => r.permission_role === p).length})`, value: p })),
            onFilter: (value, record) => record.permission_role === value,
            render: (role) => role ? <Tag color="slate" className="border-0 bg-slate-400 text-slate-700 px-2 py-0.5 rounded-md font-medium text-xs">{role}</Tag> : <Text type="secondary">-</Text>
        },
        {
            title: 'สถานะ', dataIndex: 'is_status', key: 'is_status', width: 140, align: 'center',
            sorter: (a, b) => Number(a.is_status) - Number(b.is_status),
            filters: [...new Set(rows.map(r => r.is_status).filter(Boolean))].sort((a, b) => a - b).map(status => {
                const statusMap = { 1: 'ออฟไลน์', 2: 'ออนไลน์', 3: 'ห้ามใช้งาน', 4: 'ลืมรหัสผ่าน', 5: 'ลืมรหัสผ่าน', 6: 'รีเซ็ทแล้ว' };
                return { text: `${statusMap[status] || status} (${rows.filter(r => r.is_status === status).length})`, value: status };
            }),
            onFilter: (value, record) => record.is_status === value,
            render: (_v, r) => StatusCell(r)
        },
        {
            title: 'ระงับ', key: 'ban', width: 80, align: 'center',
            dragDisabled: true, // ✅ ห้ามลากคอลัมน์นี้
            render: (_v, r) => {
                const hasBanPermission = canUse('201:ban');
                const isProtected = String(r.employee_id) === PROTECTED_EMP_ID;
                if (r.is_status === 4) return hasBanPermission ? <Button type="primary" size="small" onClick={() => handleAck(r)} className="bg-orange-500 hover:bg-orange-600 border-none text-xs shadow-sm px-2">รับทราบ</Button> : <span className="text-gray-300">-</span>;
                if (r.is_status === 5) return <span className="text-xs text-gray-400 font-medium">รับเรื่องแล้ว</span>;
                return (
                    <ConfigProvider theme={{ components: { Switch: { colorPrimary: '#ef4444', colorPrimaryHover: '#dc2626' } } }}>
                        <Tooltip title={!hasBanPermission ? 'คุณไม่มีสิทธิ์' : isProtected ? 'ไม่อนุญาต' : (r.is_status === 3 ? 'ปลดแบน' : 'ระงับการใช้งาน')}>
                            <span onClick={(e) => (isProtected || !hasBanPermission) && e.stopPropagation()} className={(isProtected || !hasBanPermission) ? 'opacity-50 cursor-not-allowed' : ''}>
                                <Switch size="small" checked={r.is_status === 3} onChange={(checked) => handleToggleBan(r, checked)} disabled={isProtected || !hasBanPermission} />
                            </span>
                        </Tooltip>
                    </ConfigProvider>
                );
            },
        },
        {
            title: 'จัดการ', key: 'action', width: 80, align: 'center',
            dragDisabled: true, // ✅ ห้ามลากคอลัมน์นี้
            render: (_, record) => {
                const isProtected = String(record.employee_id) === PROTECTED_EMP_ID;
                if (record.is_status === 4) return null;
                if (record.is_status === 5) return canUse('201:reset') ? <Tooltip title="ดำเนินการรีเซ็ตรหัสผ่าน"><Button type="text" shape="circle" onClick={() => openResetModal(record)} className="text-orange-500 hover:bg-orange-50 hover:text-orange-600"><KeyOutlined /></Button></Tooltip> : null;
                if (record.is_status === 6) return <CheckCircleOutlined className="text-lg text-blue-500" />;
                const menuItems = [];
                if (canUse('201:update')) menuItems.push({ key: 'assign', label: 'สิทธิและเวลา', icon: <TeamOutlined />, onClick: () => openAssign(record), disabled: isProtected });
                if (canUse('201:reset')) menuItems.push({ key: 'reset', label: 'รีเซ็ตรหัสผ่าน', icon: <KeyOutlined />, onClick: () => openResetModal(record), disabled: isProtected });
                if (canUse('201:delete')) {
                    if (menuItems.length > 0) menuItems.push({ type: 'divider' });
                    menuItems.push({ key: 'delete', label: 'ลบผู้ใช้งาน', icon: <DeleteOutlined />, onClick: () => openDeleteModal(record), disabled: isProtected, danger: true });
                }
                return menuItems.length > 0 ? (
                    <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                        <Button type="text" shape="circle" icon={<EditOutlined className="text-gray-400 text-base" />} className="hover:bg-blue-50 hover:text-blue-600 h-8 w-8" />
                    </Dropdown>
                ) : null;
            },
        },
    ], [page, rows, canUse]);

    return (
        <ConfigProvider theme={{ token: { fontFamily: 'Inter, "Sarabun", sans-serif', colorPrimary: '#2563eb', borderRadius: 2 }, components: { Button: { primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)' } } }}>
            <div style={containerStyle} className="bg-gray-50">

                {/* ✅ ส่งค่าไปยัง DraggableTable และรับ ColumnVisibility กลับมาวาดใน renderToolbar */}
                <DraggableTable
                    columns={baseColumns}
                    dataSource={data}
                    rowKey="employee_id"
                    loading={loading}
                    scroll={{ x: 'max-content', y: tableY }}
                    pagination={{
                        current: page.current,
                        pageSize: page.pageSize,
                        showSizeChanger: true,
                        pageSizeOptions: [10, 20, 50, 100],
                        showTotal: (t, r) => <span className="text-gray-400 text-xs">แสดง {r[0]}-{r[1]} จาก {t} รายการ</span>,
                        className: 'px-4 pb-4 mt-4'
                    }}
                    onChange={(pg) => setPage({ current: pg.current, pageSize: pg.pageSize })}
                    renderToolbar={(ColumnVisibility) => (
                        <div className="w-full mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                    <TeamOutlined className="text-blue-600" />
                                    จัดการผู้ใช้งาน
                                </h1>
                                <p className="text-slate-600/80 text-sm mt-1">
                                    บริหารจัดการบัญชี, กำหนดสิทธิ และตรวจสอบสถานะการใช้งาน
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-white p-2 rounded-md shadow-sm border border-gray-100">
                                <Input prefix={<SearchOutlined className="text-gray-400" />} placeholder="ค้นหาชื่อ, ID, สาขา..." allowClear variant="borderless" onChange={(e) => setKeyword(e.target.value)} className="w-full sm:w-64 bg-transparent" />
                                <div className="w-full h-px bg-gray-100 sm:w-px sm:h-6 sm:mx-1 hidden sm:block"></div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    {canUse('201:create') && (
                                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpenCreate2(true)} className="bg-blue-600 hover:bg-blue-500 border-none h-9 rounded-md px-4 font-medium w-full sm:w-auto">
                                            สร้างผู้ใช้งาน
                                        </Button>
                                    )}
                                    {/* นำปุ่ม แสดง/ซ่อนคอลัมน์ มาแสดงตรงนี้ */}
                                    {ColumnVisibility}
                                </div>
                            </div>
                        </div>
                    )}
                />

                {/* Modals */}
                <ModalGroup open={openGroup} record={activeUser} onClose={() => setOpenGroup(false)} onSaved={(groupName) => { setRows(list => list.map(r => r.employee_id === activeUser?.employee_id ? { ...r, permission_role: groupName } : r)); setOpenGroup(false); }} />
                <ModalReset open={openReset} record={activeUser} onClose={() => setOpenReset(false)} />
                <ModalCreate open={openCreate} onClose={() => setOpenCreate(false)} onSaved={(row) => { upsertRow(row); setOpenCreate(false); }} />
                <ModalCreate2 open={openCreate2} onClose={() => setOpenCreate2(false)} onSaved={(row) => { upsertRow(row); setOpenCreate2(false); }} />
                <ModalDelete open={openDelete} record={activeUser} onClose={() => setOpenDelete(false)} onDeleted={(employee_id) => { removeRow(employee_id); setOpenDelete(false); }} />
            </div>

            <style>{`
                @keyframes blinkWarning { 0%, 100% { color: #c2410c; background-color: #ffedd5; border-color: #fed7aa; } 50% { color: #6b7280; background-color: #f3f4f6; border-color: #e5e7eb; } }
                .animate-blink-warning { animation: blinkWarning 1.5s infinite ease-in-out; }
            `}</style>
        </ConfigProvider>
    );
};

export default UserManagement;