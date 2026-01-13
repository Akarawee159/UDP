// ./src/pages/Masterdata/Employees/Employees.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Space, Button, Input, Modal, message, Tooltip, ConfigProvider, Grid } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import api from "../../../api";
import ModalForm from './Modal/ModalForm';

// ✅ Import Reusable AG Grid
import DataTable from '../../../components/aggrid/DataTable';

function Employees() {
  const screens = Grid.useBreakpoint();
  const isMd = !!screens.md;

  const containerStyle = useMemo(() => ({
    margin: isMd ? '-8px' : '0',
    padding: isMd ? '16px' : '12px',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
  }), [isMd]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  // ---------- Helper Functions ----------
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/employee');
      setRows(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      console.error('Fetch employees failed:', err);
      message.error('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const h = () => fetchData();
    window.addEventListener('hrms:employee-upsert', h);
    return () => window.removeEventListener('hrms:employee-upsert', h);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const handleSoftDelete = (row) => {
    const hasUsername = !!String(row?.username || '').trim();
    if (hasUsername) {
      Modal.warning({
        title: 'ไม่สามารถลบได้',
        content: 'กรุณาลบผู้ใช้งาน ในหน้าเมนู "กำหนดสิทธิผู้ใช้งาน" ก่อน',
        okButtonProps: { className: 'bg-blue-600 hover:bg-blue-500' }
      });
      return;
    }

    Modal.confirm({
      title: <span className="text-red-600 font-bold">ยืนยันการลบพนักงาน?</span>,
      icon: <DeleteOutlined className="text-red-500" />,
      content: (
        <div>
          <p className="text-gray-600">คุณต้องการลบข้อมูลของ <br></br><b>{nameTH(row)}</b> ใช่หรือไม่?</p>
          <p className="text-xs text-gray-400 mt-1">*ระบบจะทำการลบแบบ Soft Delete (สามารถกู้คืนได้ภายหลัง)</p>
        </div>
      ),
      centered: true,
      footer: (_, { OkBtn, CancelBtn }) => (<><OkBtn /><CancelBtn /></>),
      okText: 'ยืนยันลบ',
      cancelText: 'ยกเลิก',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/employee/${row.employee_id}`);
          setRows(prev => prev.filter(x => x.employee_id !== row.employee_id));
          message.success('ลบข้อมูลสำเร็จ');
        } catch (err) {
          const msg = err?.response?.data?.message || 'ลบไม่สำเร็จ';
          message.error(msg);
        }
      }
    });
  };

  const pick = (row, candidates) => {
    for (const k of candidates) {
      const v = row?.[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return '';
  };
  const nameTH = (r) => [r.titlename_th || '', r.firstname_th || '', r.lastname_th || ''].filter(Boolean).join(' ');
  const nameEN = (r) => [r.titlename_en || '', r.firstname_en || '', r.lastname_en || ''].filter(Boolean).join(' ');

  const filteredRows = useMemo(() => {
    if (!searchTerm) return rows;
    const term = searchTerm.toLowerCase().trim();
    return rows.filter((r) => {
      const empCode = pick(r, ['employee_code', 'emp_code', 'employeeId', 'employee_id', 'code', 'id']);
      return (
        String(empCode).toLowerCase().includes(term) ||
        nameTH(r).toLowerCase().includes(term) ||
        nameEN(r).toLowerCase().includes(term) ||
        String(r.branch || '').toLowerCase().includes(term) ||
        String(r.department || '').toLowerCase().includes(term) ||
        String(r.position || '').toLowerCase().includes(term)
      );
    });
  }, [rows, searchTerm]);


  // ---------- Column Definitions (ส่วนนี้ต้องอยู่ที่นี่) ----------

  const ActionRenderer = (params) => {
    const r = params.data;
    if (!r) return null;
    const hasUsername = String(r?.username || '').trim();

    return (
      <Space size="small" className='h-full flex items-center justify-center w-full'>
        <Tooltip title="แก้ไขรายละเอียด">
          <Button
            type="text"
            shape="circle"
            size='small'
            icon={<EditOutlined className="text-blue-700" />}
            className="hover:bg-blue-50 flex items-center justify-center"
            onClick={(e) => { e.stopPropagation(); showUpdateModal(r); }}
          />
        </Tooltip>
        <Tooltip title={hasUsername ? 'มีบัญชีผู้ใช้งานอยู่ (ลบไม่ได้)' : 'ลบข้อมูล'}>
          <Button
            type="text"
            shape="circle"
            size='small'
            icon={<DeleteOutlined className={hasUsername ? "text-gray-300" : "text-red-500"} />}
            className={!hasUsername ? "hover:bg-red-50 flex items-center justify-center" : "flex items-center justify-center"}
            onClick={(e) => { e.stopPropagation(); handleSoftDelete(r); }}
            disabled={!!hasUsername}
          />
        </Tooltip>
      </Space>
    );
  };

  const columnDefs = useMemo(() => [
    {
      headerName: 'ลำดับ',
      width: 80,
      maxWidth: 80,
      valueGetter: "node.rowIndex + 1",
      cellClass: "text-center flex items-center justify-center",
      sortable: false,
      filter: false,
      pinned: 'left',
      lockVisible: true,
      suppressMovable: true,
      headerComponent: undefined
    },
    {
      headerName: 'รหัสพนักงาน',
      field: 'employee_code',
      width: 140,
      valueGetter: (p) => pick(p.data, ['employee_code', 'emp_code', 'employeeId']),
      lockVisible: true,
      filter: true,
      filterParams: { buttons: ['reset'] }
    },
    {
      headerName: 'ชื่อ-นามสกุล',
      field: 'firstname_th',
      minWidth: 200,
      flex: 1,
      valueGetter: (p) => nameTH(p.data),
      lockVisible: true,
      filter: true,
    },
    {
      headerName: 'ตำแหน่ง',
      field: 'position',
      width: 160,
      lockVisible: true,
      filter: 'agTextColumnFilter',
    },
    {
      headerName: 'แผนก',
      field: 'department',
      width: 160,
      valueFormatter: (p) => p.value || '-',
      lockVisible: true,
      filter: 'agTextColumnFilter',
    },
    {
      headerName: 'สาขา',
      field: 'branch',
      width: 160,
      lockVisible: true,
      filter: 'agTextColumnFilter',
    },
    {
      headerName: 'จัดการ',
      width: 100,
      cellRenderer: ActionRenderer,
      sortable: false,
      filter: false,
      pinned: 'right',
      lockVisible: true,
      cellClass: "flex items-center justify-center",
      suppressMovable: true,
      headerComponent: undefined
    }
  ], []);


  // ---------- Modal Helpers ----------
  const showCreateModal = () => { setEditingEmployee(null); setIsModalOpen(true); };
  const showUpdateModal = (employee) => { setEditingEmployee(employee); setIsModalOpen(true); };
  const handleModalClose = () => { setIsModalOpen(false); setEditingEmployee(null); };
  const handleModalSuccess = () => { setIsModalOpen(false); setEditingEmployee(null); fetchData(); };

  const fullScreenModalProps = {
    footer: null, destroyOnHidden: true, maskClosable: false, keyboard: false, width: "100vw",
    style: { top: 0, padding: 0, margin: 0, width: '100vw', maxWidth: '100vw', borderRadius: 0 },
    styles: {
      content: { height: '100vh', padding: 0, borderRadius: 0, display: 'flex', flexDirection: 'column' },
      header: { padding: '16px 24px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 18, color: '#1e40af' },
      body: { flex: 1, overflow: 'auto', padding: 24, background: '#f9fafb' },
    }, title: null,
  };

  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: '#2563eb', borderRadius: 8, fontFamily: 'Inter, "Sarabun", sans-serif' },
        components: { Button: { primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)' } }
      }}
    >
      <div style={containerStyle} className="bg-gray-50">

        {/* Header Section */}
        <div className="w-full mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-none">
          <div>
            <h1 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
              <TeamOutlined className="text-blue-600" />
              ข้อมูลพนักงาน
            </h1>
            <p className="text-blue-600/80 text-sm mt-1 pl-9">
              จัดการฐานข้อมูลบุคลากร ประวัติ และสถานะการทำงาน
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
            <Input
              prefix={<SearchOutlined className="text-gray-400" />}
              placeholder="ค้นหาชื่อ, รหัสพนักงาน..."
              allowClear
              bordered={false}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-64 bg-transparent"
            />
            <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={showCreateModal}
              className="bg-blue-600 hover:bg-blue-500 border-none h-9 rounded-lg px-4 font-medium shadow-md"
            >
              เพิ่มพนักงาน
            </Button>
            <Tooltip title="ตรวจสอบประวัติอาชญากรรม (เว็บภายนอก)">
              <Button
                icon={<SafetyCertificateOutlined />}
                onClick={() => window.open('https://www.crd.go.th/bg/landing', '_blank', 'noopener,noreferrer')}
                className="text-blue-700 border-blue-200 hover:border-blue-400 hover:text-blue-600 h-9 rounded-lg"
              >
                ตรวจสอบประวัติ
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* ✅ Table Content (ใช้ DataTable ที่สร้างใหม่) */}
        <div className="w-full flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
          <DataTable
            rowData={filteredRows}
            columnDefs={columnDefs}
            loading={loading}
          />
        </div>

        {/* Modals */}
        <Modal open={isModalOpen} onCancel={handleModalClose} {...fullScreenModalProps}>
          <ModalForm employee={editingEmployee} onClose={handleModalClose} onSuccess={handleModalSuccess} />
        </Modal>
      </div>
    </ConfigProvider>
  );
}

export default Employees;