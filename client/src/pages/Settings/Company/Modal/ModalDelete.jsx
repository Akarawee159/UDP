import React, { useState } from 'react';
import { Modal, App, Button, ConfigProvider } from 'antd';
import {
  DeleteOutlined,
  WarningOutlined,
  ApartmentOutlined,
  GlobalOutlined,
  BarcodeOutlined
} from '@ant-design/icons';
import api from "../../../../api";

function ModalDelete({ open, record, onClose, onSuccess }) {
  const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    if (!record?.id) return;
    try {
      setLoading(true);
      // ✅ API Endpoint สำหรับ Department
      await api.delete(`/company/${record.id}`);
      message.success('ลบข้อมูลสำเร็จ');
      onSuccess?.(record?.G_ID);
      onClose?.();
    } catch (err) {
      const apiMsg = err?.response?.data?.message || 'ลบไม่สำเร็จ';
      message.error(apiMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigProvider
      theme={{
        components: {
          Button: {
            dangerShadow: '0 4px 14px 0 rgba(220, 38, 38, 0.25)',
          }
        }
      }}
    >
      <Modal
        open={open}
        title={null}
        footer={null}
        closable={false}
        onCancel={onClose}
        maskClosable={!loading}
        destroyOnClose
        width={480}
        centered
        className="custom-modal-delete"
        styles={{ content: { padding: 0, borderRadius: '16px', overflow: 'hidden' } }}
      >
        {/* Header (Red for Danger) */}
        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-3 text-red-800">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-red-500 text-xl">
              <DeleteOutlined />
            </div>
            <div>
              <h3 className="text-lg font-bold m-0 leading-tight">ยืนยันการลบสถานที่อบรม</h3>
              <span className="text-xs text-red-600/70">การดำเนินการนี้ไม่สามารถกู้คืนได้</span>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-red-400 hover:text-red-700 transition-colors text-3xl"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Warning Banner */}
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6 flex gap-3 items-start">
            <WarningOutlined className="text-orange-500 mt-1 text-lg" />
            <div>
              <div className="font-bold text-orange-800 text-sm mb-1">คำเตือน: การลบข้อมูลถาวร</div>
              <p className="text-xs text-orange-700/80 leading-relaxed">
                คุณกำลังจะลบข้อมูลสถานที่อบรมนี้ออกจากระบบ กรุณาตรวจสอบให้แน่ใจก่อนดำเนินการ
              </p>
            </div>
          </div>

          {/* Record Details Card */}
          {record && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="grid grid-cols-1 gap-4">
                {/* Department Name */}
                <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 mt-1">
                    <ApartmentOutlined className="text-xl" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">ชื่อบริษัท (ไทย)</div>
                    <div className="font-bold text-gray-800 text-base leading-tight">{record.company_name_th || '-'}</div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <GlobalOutlined className="text-[10px]" /> {record.company_name_en || '-'}
                    </div>
                  </div>
                </div>

                {/* Code Grid */}
                <div className="bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                    <BarcodeOutlined /> รหัสสถานที่อบรม
                  </div>
                  <div className="font-mono text-sm font-semibold text-emerald-700">
                    {record.company_code || '-'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <Button
            key="submit"
            danger
            type="primary"
            onClick={handleOk}
            loading={loading}
            icon={<DeleteOutlined />}
            className="h-10 px-6 rounded-lg shadow-md font-semibold bg-red-600 hover:bg-red-500 border-none"
          >
            ยืนยันการลบ
          </Button>
          <Button
            key="back"
            onClick={onClose}
            disabled={loading}
            className="h-10 px-6 rounded-lg border-gray-300 text-gray-600 hover:text-gray-800 hover:border-gray-400 hover:bg-white"
          >
            ยกเลิก
          </Button>
        </div>
      </Modal>
    </ConfigProvider>
  );
}

export default ModalDelete;