import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Input, ConfigProvider, Grid } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import api from "../../../api";
import ModalForm from "./Modal/ModalForm";
import ModalDelete from "./Modal/ModalDelete";
import { getSocket } from '../../../socketClient';
import DataTable from '../../../components/aggrid/DataTable';

function Position() {
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

  const [modalFormOpen, setModalFormOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [openDelete, setOpenDelete] = useState(false);

  // ====== Fetching & Socket ======
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings/position');
      setRows(res?.data?.data || []);
    } catch (err) {
      console.error(err);
      message.error('ดึงข้อมูลตำแหน่งงานไม่สำเร็จ');
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

    s.on('position:upsert', onUpsert);
    s.on('position:delete', onDelete);

    return () => {
      s.off('position:upsert', onUpsert);
      s.off('position:delete', onDelete);
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

  // เปิด Modal ลบ (โดยไม่ปิด ModalForm เพื่อให้ซ้อนกัน)
  const openDeleteModal = (record) => {
    setCurrentRecord(record);
    setOpenDelete(true);
  };

  const handleFormSuccess = () => {
    fetchData();
    // ModalForm จะปิดตัวเอง หรือสั่งปิดที่นี่ก็ได้
  };

  const handleDeleteSuccess = () => {
    setOpenDelete(false);
    setModalFormOpen(false); // ปิดฟอร์มด้วยเมื่อลบเสร็จ
    fetchData();
  };

  // ====== AG Grid Definitions ======

  // 2. กำหนด Columns (ตัด Action Column ออก)
  const columnDefs = useMemo(() => [
    {
      headerName: 'ลำดับ',
      width: 140,
      maxWidth: 140,
      valueGetter: "node.rowIndex + 1",
      cellClass: "text-center flex items-center justify-center cursor-pointer",
      sortable: false,
      filter: false,
      pinned: 'left',
      lockVisible: true,
      suppressMovable: true,
      headerComponent: undefined,
      headerComponentParams: { align: 'center' }
    },
    {
      headerName: 'รหัสตำแหน่ง',
      field: 'G_CODE',
      width: 200,
      filter: true,
      cellClass: "font-mono font-semibold text-blue-700 cursor-pointer",
      filterParams: { buttons: ['reset'] },
      headerComponentParams: { align: 'center' }
    },
    {
      headerName: 'ชื่อตำแหน่งงาน (ไทย)',
      field: 'G_NAME',
      minWidth: 140,
      flex: 1,
      filter: true,
      cellClass: "cursor-pointer",
      filterParams: { buttons: ['reset'] },
      headerComponentParams: { align: 'center' }
    },
    {
      headerName: 'อยู่ภายใต้แผนก',
      field: 'dept_name',
      minWidth: 400,
      valueFormatter: (p) => p.value || '-',
      filter: true,
      cellClass: "cursor-pointer",
      filterParams: { buttons: ['reset'] },
      headerComponentParams: { align: 'center' }
    },
    {
      headerName: 'รหัสแผนก',
      field: 'dept_code_ref',
      width: 140,
      valueFormatter: (p) => p.value || '-',
      filter: true,
      cellClass: "cursor-pointer",
      filterParams: { buttons: ['reset'] },
      headerComponentParams: { align: 'center' }
    }
  ], []);

  // Logic กรองข้อมูล
  const filteredRows = useMemo(() => {
    if (!searchTerm) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(
      (row) =>
        String(row.G_CODE || '').toLowerCase().includes(term) ||
        String(row.G_NAME || '').toLowerCase().includes(term) ||
        String(row.dept_name || '').toLowerCase().includes(term)
    );
  }, [rows, searchTerm]);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#2563eb',
          borderRadius: 8,
          fontFamily: 'Inter, "Sarabun", sans-serif',
        },
        components: {
          Button: {
            primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)',
          }
        }
      }}
    >
      <div style={containerStyle} className="bg-gray-50">

        {/* Header Section: ปรับ Layout ให้ปุ่มอยู่ซ้าย */}
        <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-start gap-4 flex-none">
          <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
            <Input
              prefix={<SearchOutlined className="text-gray-400" />}
              placeholder="ค้นหารหัส, ชื่อตำแหน่ง..."
              allowClear
              variant="borderless"
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-64 bg-transparent"
            />
            <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
              className="bg-blue-600 hover:bg-blue-500 border-none h-9 rounded-lg px-4 font-medium shadow-md"
            >
              เพิ่มข้อมูลใหม่
            </Button>
          </div>
        </div>

        {/* Table Content */}
        <div className="w-full flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
          <DataTable
            rowData={filteredRows}
            columnDefs={columnDefs}
            loading={loading}
            // ✅ คลิกแถวเพื่อแก้ไข
            onRowClicked={(params) => handleUpdate(params.data)}
            rowClass="cursor-pointer hover:bg-blue-50 transition-colors"
          />
        </div>

        {/* Modals */}
        <ModalForm
          open={modalFormOpen}
          record={currentRecord}
          onClose={() => { setModalFormOpen(false); setCurrentRecord(null); }}
          onSuccess={handleFormSuccess}
          // ✅ ส่งฟังก์ชัน onDelete ไปให้ ModalForm
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

export default Position;