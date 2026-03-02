import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Button, Typography, message, Grid, Switch, Dropdown, Modal, Input, ConfigProvider, Tag } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  SafetyCertificateFilled,
  TeamOutlined,
  WarningOutlined
} from "@ant-design/icons";
import api from "../../../api";
import { menuItems } from "../../../layouts/Sidebar";
import ModalCreate from "./Modal/ModalCreate";
import ModalUpdate from "./Modal/ModalUpdate";
import PermissionTags from './PermissionTags';

// ✅ Import DraggableTable
import DraggableTable from '../../../components/antdtable/DraggableTable';

import { getSocket } from '../../../socketClient';

const { Text } = Typography;

function buildMenuIndex(items) {
  const mains = [];
  const subs = [];
  items.forEach((it) => {
    if (!it?.id) return;
    mains.push({ id: String(it.id), label: it.label });
    if (Array.isArray(it.children)) {
      it.children.forEach((c) => {
        if (c?.id) subs.push({ id: String(c.id), label: c.label, parentId: String(it.id) });
      });
    }
  });
  return { mains, subs };
}

export default function PermissionRole() {
  const screens = Grid.useBreakpoint();
  const isMd = !!screens.md;
  const containerStyle = useMemo(() => ({
    margin: isMd ? '-8px' : '0',
    padding: isMd ? '16px' : '12px',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
  }), [isMd]);

  const { mains, subs } = useMemo(() => buildMenuIndex(menuItems), []);
  const mainMap = useMemo(() => Object.fromEntries(mains.map((m) => [m.id, m])), [mains]);
  const subMap = useMemo(() => Object.fromEntries(subs.map((s) => [s.id, s])), [subs]);

  const [page, setPage] = useState({ current: 1, pageSize: 10 });
  const [tableY, setTableY] = useState(600);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const takenNames = useMemo(() => (rows || []).map(r => String(r.groupName || "")).filter(Boolean), [rows]);

  // ✅ คำนวณความสูงตารางอัตโนมัติ
  useEffect(() => {
    const onResize = () => setTableY(Math.max(400, window.innerHeight - 300));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const normalizeRow = (r) => ({
    id: Number(r?.id),
    groupName: String(r?.groupName || ''),
    mainIds: Array.isArray(r?.mainIds) ? r.mainIds.map(String) : [],
    subIds: Array.isArray(r?.subIds) ? r.subIds.map(String) : [],
    actionPermissions: Array.isArray(r?.actionPermissions) ? r.actionPermissions : [],
    privilege_access: r?.privilege_access || 'Normal',
    is_status: Number(r?.is_status ?? 0),
  });

  const upsertById = (list, row) => {
    if (!row?.id) return list;
    let found = false;
    const next = list.map((it) => {
      if (it.id === row.id) {
        found = true;
        return { ...it, ...row };
      }
      return it;
    });
    if (!found) next.unshift(row);
    return next;
  };

  const removeById = (list, id) => list.filter((it) => it.id !== id);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/permission');
      setRows(data?.data || []);
    } catch (err) {
      console.error(err);
      message.error('โหลดรายการสิทธิไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const onUpsert = (e) => {
      const dto = normalizeRow(e.detail || {});
      setRows((prev) => upsertById(prev, dto));
    };
    const onDelete = (e) => {
      const { id } = e.detail || {};
      setRows((prev) => removeById(prev, Number(id)));
    };
    const onStatus = (e) => {
      const { id, is_status } = e.detail || {};
      setRows((prev) => prev.map((r) => r.id === Number(id) ? { ...r, is_status: Number(is_status) } : r));
    };

    window.addEventListener('hrms:permission-upsert', onUpsert);
    window.addEventListener('hrms:permission-delete', onDelete);
    window.addEventListener('hrms:permission-status', onStatus);
    return () => {
      window.removeEventListener('hrms:permission-upsert', onUpsert);
      window.removeEventListener('hrms:permission-delete', onDelete);
      window.removeEventListener('hrms:permission-status', onStatus);
    };
  }, []);

  const onCreate = async (payload) => {
    try {
      const { data } = await api.post('/permission', payload);
      setRows((prev) => upsertById(prev, normalizeRow(data.data)));
      message.success('เพิ่มกลุ่มสิทธิเรียบร้อย');
      setOpenCreate(false);
    } catch (err) {
      console.error(err);
      message.error('เพิ่มกลุ่มสิทธิไม่สำเร็จ');
    }
  };

  const onUpdate = async (id, payload) => {
    try {
      const { data } = await api.put(`/permission/${id}`, payload);
      setRows((prev) => upsertById(prev, normalizeRow(data.data)));
      message.success('อัปเดตกลุ่มสิทธิเรียบร้อย');
      setEditing(null);
    } catch (err) {
      console.error(err);
      message.error('อัปเดตกลุ่มสิทธิไม่สำเร็จ');
    }
  };

  const openDeleteModal = (record) => {
    const isAdmin = Number(record?.id) === 1 || String(record?.groupName || "").trim().toLowerCase() === "administrator";
    if (isAdmin) {
      message.warning('กลุ่ม administrator ถูกป้องกัน ไม่สามารถลบได้');
      return;
    }
    setDeleting(record);
  };

  const handleConfirmDelete = async () => {
    if (!deleting?.id) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/permission/${deleting.id}`);
      setRows(prev => prev.filter(r => r.id !== deleting.id));
      message.success('ลบกลุ่มสิทธิเรียบร้อย');
      setDeleting(null);
    } catch (err) {
      console.error(err);
      message.error('ลบสิทธิไม่สำเร็จ');
    } finally {
      setDeleteLoading(false);
    }
  };

  const onToggleStatus = async (record, checked) => {
    const newStatus = checked ? 1 : 0;
    const originalStatus = record.is_status;
    setRows(prev => prev.map(r => r.id === record.id ? { ...r, is_status: newStatus } : r));
    try {
      await api.patch(`/permission/${record.id}/status`, { is_status: newStatus });
      message.success(checked ? 'เปิดใช้งานแล้ว' : 'ปิดการใช้งานแล้ว');
    } catch (err) {
      console.error(err);
      setRows(prev => prev.map(r => r.id === record.id ? { ...r, is_status: originalStatus } : r));
      message.error('อัปเดตสถานะไม่สำเร็จ');
    }
  };

  // ✅ 2. แปลง Columns ให้มี Filter/Sorter และใช้รูปแบบ DraggableTable
  const baseColumns = useMemo(() => [
    {
      title: 'ลำดับ',
      key: 'index',
      width: 80,
      align: 'center',
      dragDisabled: true,
      render: (_val, _record, index) => <span className="text-gray-400 font-medium">{(page.current - 1) * page.pageSize + index + 1}</span>
    },
    {
      title: "ชื่อกลุ่มสิทธิ",
      dataIndex: "groupName",
      key: "groupName",
      width: 200,
      sorter: (a, b) => String(a.groupName || '').localeCompare(String(b.groupName || '')),
      filters: [...new Set(rows.map(r => r.groupName).filter(Boolean))].map(n => ({ text: n, value: n })),
      filterSearch: true,
      onFilter: (value, record) => record.groupName === value,
      render: (v, record) => {
        const isAdmin = Number(record?.id) === 1 || String(v || "").trim().toLowerCase() === "administrator";
        return (
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isAdmin ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
              {isAdmin ? <SafetyCertificateFilled /> : <TeamOutlined />}
            </div>
            <span className="font-semibold text-gray-700">{v}</span>
            {isAdmin && <Tag color="red" className="ml-2 border-0">System</Tag>}
          </div>
        )
      },
    },
    {
      title: "เมนูหลักที่เข้าถึงได้",
      dataIndex: "mainIds",
      key: "mainIds",
      render: (ids = []) => (
        <PermissionTags
          ids={ids}
          labelMap={mainMap}
          color="cyan"
          visibleCount={2}
          modalTitle="เมนูหลักทั้งหมดที่เข้าถึงได้"
        />
      ),
    },
    {
      title: "เมนูย่อยที่เข้าถึงได้",
      dataIndex: "subIds",
      key: "subIds",
      render: (ids = []) => (
        <PermissionTags
          ids={ids}
          labelMap={subMap}
          color="cyan"
          visibleCount={2}
          modalTitle="เมนูย่อยทั้งหมดที่เข้าถึงได้"
          groupByParent={true}
          parentMap={mainMap}
        />
      ),
    },
    {
      title: "สถานะ",
      dataIndex: "is_status",
      key: "is_status",
      align: "center",
      width: 120,
      sorter: (a, b) => Number(a.is_status) - Number(b.is_status),
      filters: [
        { text: 'เปิดใช้งาน', value: 1 },
        { text: 'ปิดการใช้งาน', value: 0 }
      ],
      onFilter: (value, record) => Number(record.is_status) === value,
      render: (_v, record) => (
        <ConfigProvider theme={{ components: { Switch: { colorPrimary: '#10b981' } } }}>
          <Switch
            size="small"
            checked={Number(record.is_status) === 1}
            onChange={(val) => onToggleStatus(record, val)}
          />
        </ConfigProvider>
      ),
    },
    {
      title: "จัดการ",
      key: "action",
      align: "center",
      width: 80,
      dragDisabled: true,
      render: (_, record) => {
        const isAdmin = Number(record?.id) === 1 || String(record?.groupName || "").trim().toLowerCase() === "administrator";
        return (
          <Dropdown
            menu={{
              items: [
                { key: 'edit', label: 'แก้ไข', icon: <EditOutlined />, onClick: () => setEditing(record) },
                { key: 'delete', label: 'ลบ', icon: <DeleteOutlined />, danger: true, disabled: isAdmin, onClick: () => openDeleteModal(record) },
              ]
            }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button type="text" shape="circle" icon={<EditOutlined className="text-gray-400 text-lg" />} className="hover:!bg-blue-50 hover:!text-blue-600" />
          </Dropdown>
        );
      },
    },
  ], [rows, mainMap, subMap, page]);

  const filteredRows = useMemo(() => {
    if (!searchTerm) return rows;
    const term = searchTerm.toLowerCase().trim();
    return rows.filter((row) => row.groupName?.toLowerCase().includes(term));
  }, [rows, searchTerm]);

  return (
    <ConfigProvider
      theme={{
        token: {
          fontFamily: 'Inter, "Sarabun", sans-serif',
          colorPrimary: '#2563eb',
          borderRadius: 2, // ✅ ปรับเป็น 6px (เท่ากับ rounded-md)
        },
        components: {
          Button: { primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)' }
        }
      }}
    >
      <div style={containerStyle} className="bg-gray-50 flex flex-col h-full overflow-hidden">

        {/* ✅ เรียกใช้ DraggableTable พร้อมย้าย Toolbar */}
        <DraggableTable
          columns={baseColumns}
          dataSource={filteredRows}
          rowKey="id"
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

          // ✅ Render Toolbar
          renderToolbar={(ColumnVisibility) => (
            <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-none">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <SafetyCertificateFilled className="text-blue-600" />
                  จัดการกลุ่มสิทธิ
                </h1>
                <p className="text-slate-600/80 text-sm mt-1">
                  กำหนดบทบาทหน้าที่และการเข้าถึงเมนูต่างๆ ของผู้ใช้งานในระบบ
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-white p-2 rounded-md shadow-sm border border-gray-100 w-full md:w-auto">
                <Input
                  prefix={<SearchOutlined className="text-gray-400" />}
                  placeholder="ค้นหากลุ่มสิทธิ..."
                  allowClear
                  variant="borderless"
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-64 bg-transparent"
                />
                <div className="w-full h-px bg-gray-100 sm:w-px sm:h-6 sm:mx-1 hidden sm:block"></div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setOpenCreate(true)}
                    className="bg-blue-600 hover:bg-blue-500 border-none h-9 rounded-md px-4 font-medium w-full sm:w-auto"
                  >
                    เพิ่มกลุ่มสิทธิ
                  </Button>

                  {/* ปุ่มซ่อน/แสดงคอลัมน์ */}
                  {ColumnVisibility}
                </div>
              </div>
            </div>
          )}
        />

        {/* Modals */}
        <ModalCreate
          open={openCreate}
          onCancel={() => setOpenCreate(false)}
          onSubmit={onCreate}
          mains={mains}
          subs={subs}
          takenNames={takenNames}
        />

        <ModalUpdate
          open={!!editing}
          record={editing}
          onCancel={() => setEditing(null)}
          onSubmit={(payload) => onUpdate(editing.id, payload)}
          mains={mains}
          subs={subs}
          takenNames={takenNames.filter(name => name !== editing?.groupName)}
        />

        <Modal
          open={!!deleting}
          title={null}
          footer={null}
          closable={false}
          width={400}
          centered
          styles={{ content: { padding: 0, borderRadius: '16px', overflow: 'hidden' } }}
        >
          <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-3 text-red-800">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-red-500 text-xl">
                <DeleteOutlined />
              </div>
              <div><h3 className="text-lg font-bold m-0 leading-tight">ยืนยันการลบ</h3></div>
            </div>
          </div>
          <div className="p-6">
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex gap-3 items-start mb-4">
              <WarningOutlined className="text-orange-500 mt-1" />
              <p className="text-sm text-orange-800">
                คุณแน่ใจหรือไม่ว่าต้องการลบ <br />
                กลุ่มสิทธิ <span className="font-bold text-gray-900">"{deleting?.groupName}"</span> ?
              </p>
            </div>
            <p className="text-xs text-red-500 text-center">การดำเนินการนี้ไม่สามารถกู้คืนได้ และ<br /> อาจส่งผลกระทบต่อผู้ใช้งานที่อยู่ในกลุ่มนี้</p>
          </div>
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <Button type="primary" danger loading={deleteLoading} onClick={handleConfirmDelete} className="rounded-md h-10 px-6 shadow-md">ยืนยันลบ</Button>
            <Button onClick={() => setDeleting(null)} className="rounded-md h-10 px-6">ยกเลิก</Button>
          </div>
        </Modal>

      </div>
    </ConfigProvider>
  );
}