import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Grid } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import api from "../../../api";
import ModalForm from "./Modal/ModalForm";
import ModalDelete from "./Modal/ModalDelete";
import { getSocket } from '../../../socketClient';

// ✅ นำเข้า DraggableTable
import DraggableTable from '../../../components/antdtable/DraggableTable';

function Department() {
  const screens = Grid.useBreakpoint();
  const isMd = !!screens.md;

  const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };

  const containerStyle = useMemo(() => ({
    margin: isMd ? '-8px' : '0',
    padding: isMd ? '16px' : '12px',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
  }), [isMd]);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // ✅ State สำหรับ Pagination และความสูงของตาราง
  const [page, setPage] = useState({ current: 1, pageSize: 10 });
  const [tableY, setTableY] = useState(600);

  const [modalFormOpen, setModalFormOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [openDelete, setOpenDelete] = useState(false);

  // ✅ คำนวณความสูงตารางอัตโนมัติ
  useEffect(() => {
    const onResize = () => setTableY(Math.max(400, window.innerHeight - 300));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ====== Fetching & Socket ======
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings/department');
      setRows(res?.data?.data || []);
    } catch (err) {
      console.error(err);
      message.error('ดึงข้อมูลแผนกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const onUpsert = (row) => {
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.G_ID === row.G_ID);
        if (idx === -1) {
          return [...prev, row].sort((a, b) => a.G_ID - b.G_ID);
        }
        const next = prev.slice();
        next[idx] = row;
        return next;
      });
    };

    const onDelete = ({ G_ID }) => {
      setRows((prev) => prev.filter((r) => r.G_ID !== G_ID));
    };

    s.on('department:upsert', onUpsert);
    s.on('department:delete', onDelete);

    return () => {
      s.off('department:upsert', onUpsert);
      s.off('department:delete', onDelete);
    };
  }, []);

  // ====== Actions ======

  const handleCreate = () => {
    setCurrentRecord(null);
    setModalFormOpen(true);
  };

  const handleUpdate = (record) => {
    setCurrentRecord(record);
    setModalFormOpen(true);
  };

  const openDeleteModal = (record) => {
    setCurrentRecord(record);
    setOpenDelete(true);
  };

  const handleFormSuccess = () => {
    fetchData();
  };

  const handleDeleteSuccess = () => {
    setOpenDelete(false);
    setModalFormOpen(false);
    fetchData();
  };

  // ====== Columns (Ant Design Format) ======
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
      title: 'รหัสแผนก',
      dataIndex: 'G_CODE',
      key: 'G_CODE',
      width: 150,
      sorter: (a, b) => String(a.G_CODE || '').localeCompare(String(b.G_CODE || '')),
      filters: [...new Set(rows.map(r => r.G_CODE).filter(Boolean))].map(v => ({ text: v, value: v })),
      filterSearch: true,
      onFilter: (value, record) => record.G_CODE === value,
      render: (val) => <span className="font-mono font-semibold text-blue-700">{val}</span>
    },
    {
      title: 'ชื่อแผนก',
      dataIndex: 'G_NAME',
      key: 'G_NAME',
      width: 250,
      sorter: (a, b) => String(a.G_NAME || '').localeCompare(String(b.G_NAME || '')),
      filters: [...new Set(rows.map(r => r.G_NAME).filter(Boolean))].map(v => ({ text: v, value: v })),
      filterSearch: true,
      onFilter: (value, record) => record.G_NAME === value,
    },
    {
      title: 'อยู่ภายใต้สาขา',
      dataIndex: 'branch_name',
      key: 'branch_name',
      width: 300,
      sorter: (a, b) => String(a.branch_name || '').localeCompare(String(b.branch_name || '')),
      filters: [...new Set(rows.map(r => r.branch_name).filter(Boolean))].map(v => ({ text: v, value: v })),
      filterSearch: true,
      onFilter: (value, record) => record.branch_name === value,
      render: (val) => val || '-'
    },
    {
      title: 'รหัสสาขา',
      dataIndex: 'branch_code',
      key: 'branch_code',
      width: 150,
      sorter: (a, b) => String(a.branch_code || '').localeCompare(String(b.branch_code || '')),
      filters: [...new Set(rows.map(r => r.branch_code).filter(Boolean))].map(v => ({ text: v, value: v })),
      filterSearch: true,
      onFilter: (value, record) => record.branch_code === value,
      render: (val) => val || '-'
    }
  ], [page, rows]);

  // Logic กรองข้อมูล
  const filteredRows = useMemo(() => {
    if (!searchTerm) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(
      (row) =>
        String(row.G_CODE || '').toLowerCase().includes(term) ||
        String(row.G_NAME || '').toLowerCase().includes(term) ||
        String(row.branch_name || '').toLowerCase().includes(term)
    );
  }, [rows, searchTerm]);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#2563eb',
          borderRadius: 2, // ✅ ปรับเป็น 6px (เท่ากับ rounded-md)
          fontFamily: 'Inter, "Sarabun", sans-serif',
        },
        components: {
          Button: {
            primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)',
          }
        }
      }}
    >
      <div style={containerStyle} className="bg-gray-50 flex flex-col h-full overflow-hidden">

        {/* ✅ เรียกใช้ DraggableTable */}
        <DraggableTable
          columns={baseColumns}
          dataSource={filteredRows}
          rowKey="G_ID" // ใช้ G_ID ตาม Database
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

          // ✅ คลิกแถวเพื่อแก้ไข
          onRow={(record) => ({
            onClick: () => handleUpdate(record),
            className: "cursor-pointer"
          })}

          // ✅ Toolbar: ใช้ rounded-md
          renderToolbar={(ColumnVisibility) => (
            <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-white p-2 rounded-md shadow-sm border border-gray-100 w-full md:w-auto">
                <Input
                  prefix={<SearchOutlined className="text-gray-400" />}
                  placeholder="ค้นหารหัส, ชื่อแผนก..."
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
                    onClick={handleCreate}
                    className="bg-blue-600 hover:bg-blue-500 border-none h-9 rounded-md px-4 font-medium w-full sm:w-auto shadow-md"
                  >
                    เพิ่มข้อมูลใหม่
                  </Button>

                  {/* ปุ่มซ่อน/แสดงคอลัมน์ */}
                  {ColumnVisibility}
                </div>
              </div>
            </div>
          )}
        />

        {/* Modals */}
        <ModalForm
          open={modalFormOpen}
          record={currentRecord}
          onClose={() => { setModalFormOpen(false); setCurrentRecord(null); }}
          onSuccess={handleFormSuccess}
          onDelete={() => openDeleteModal(currentRecord)}
        />

        <ModalDelete
          open={openDelete}
          record={currentRecord}
          onClose={() => { setOpenDelete(false); }}
          onSuccess={handleDeleteSuccess}
        />
      </div>
    </ConfigProvider>
  );
}

export default Department;