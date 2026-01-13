// src/pages/UserManagement/PermissionRole/PermissionTags.jsx
import React, { useState, useMemo } from 'react';
import { Modal, Button, ConfigProvider } from 'antd';
import {
  FolderOpenOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  CheckCircleFilled
} from '@ant-design/icons';

const PermissionTags = ({
  ids = [],
  labelMap = {},
  color = 'default', // cyan, blue, default
  visibleCount = 2,
  modalTitle = "รายการทั้งหมด",
  groupByParent = false,
  parentMap = {}
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const normalizedIds = useMemo(
    () => (Array.isArray(ids) ? ids.map(String).filter(Boolean) : []),
    [ids]
  );

  const allItems = useMemo(
    () =>
      normalizedIds.map((id) => ({
        id,
        label: labelMap?.[id]?.label ?? 'N/A',
        parentId: labelMap?.[id]?.parentId,
      })),
    [normalizedIds, labelMap]
  );

  // ✅ Helper: เลือกสี Tag ตาม props ให้เข้าธีม Blue/Indigo
  const getTagStyle = () => {
    if (color === 'cyan') {
      // ธีมเมนูหลัก (Main Menu) -> Blue (แทน Emerald เดิม)
      return "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
    }
    if (color === 'blue') {
      // ธีมเมนูย่อย (Sub Menu) -> Indigo/Cyan (แทน Teal เดิม เพื่อให้ตัดกันเล็กน้อยแต่ยังอยู่ในโทนฟ้า)
      return "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100";
    }
    return "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100";
  };

  const tagBaseClass = `inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border transition-colors cursor-default select-none ${getTagStyle()}`;

  if (normalizedIds.length === 0) {
    return <span className="text-gray-400 text-sm font-light">-</span>;
  }

  const renderTags = (items) => (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item.id} className={tagBaseClass}>
          {item.label}
        </span>
      ))}
    </div>
  );

  // กรณีมีน้อยกว่า Limit -> แสดงทั้งหมด
  if (normalizedIds.length <= visibleCount) {
    return renderTags(allItems);
  }

  // กรณีมีมากกว่า Limit -> ตัดคำ + ปุ่ม More
  const visibleItems = allItems.slice(0, visibleCount);
  const hiddenCount = normalizedIds.length - visibleCount;

  return (
    <>
      <div className="flex flex-wrap gap-2 items-center">
        {visibleItems.map((item) => (
          <span key={item.id} className={tagBaseClass}>
            {item.label}
          </span>
        ))}

        <button
          onClick={() => setIsModalVisible(true)}
          // เปลี่ยน Hover เป็นธีมสีน้ำเงิน
          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-500 border border-transparent hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all cursor-pointer"
        >
          +{hiddenCount} เพิ่มเติม...
        </button>
      </div>

      {/* Modal แสดงรายการทั้งหมด */}
      <ConfigProvider
        theme={{
          token: {
            // เปลี่ยน Primary Color เป็น Blue 600
            colorPrimary: '#2563eb',
            borderRadius: 8,
          }
        }}
      >
        <Modal
          open={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          footer={null}
          centered
          width={600}
          title={null}
          className="custom-permission-modal"
          styles={{ content: { padding: 0, borderRadius: '16px', overflow: 'hidden' } }}
        >
          {/* Modal Header - เปลี่ยนธีมเป็นสีน้ำเงิน */}
          <div className="bg-gray-200 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3 text-gray-800">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-600 text-xl">
                <AppstoreOutlined />
              </div>
              <div>
                <h3 className="text-lg font-bold m-0 leading-tight">{modalTitle}</h3>
                <span className="text-xs text-gray-700">รายการสิทธิ์ทั้งหมด ({normalizedIds.length} รายการ)</span>
              </div>
            </div>
          </div>

          {/* Modal Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            {groupByParent ? (
              <GroupedView allItems={allItems} parentMap={parentMap} />
            ) : (
              <FlatView allItems={allItems} />
            )}
          </div>

          {/* Modal Footer */}
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-end">
            <Button onClick={() => setIsModalVisible(false)}>ปิดหน้าต่าง</Button>
          </div>
        </Modal>
      </ConfigProvider>
    </>
  );
};

// ✅ Sub-Component: แสดงแบบเรียงกัน (Flat)
const FlatView = ({ allItems }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {allItems.map(item => (
      // เปลี่ยน Hover เป็นธีมสีน้ำเงิน
      <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all">
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-blue-600">
          <FileTextOutlined />
        </div>
        <span className="text-gray-700 text-sm font-medium">{item.label}</span>
      </div>
    ))}
  </div>
);

// ✅ Sub-Component: แสดงแบบกลุ่ม (Grouped by Parent)
const GroupedView = ({ allItems, parentMap }) => {
  const grouped = allItems.reduce((acc, item) => {
    const pid = item.parentId;
    if (pid && parentMap[pid]) {
      acc[pid] ??= { parentLabel: parentMap[pid].label, children: [] };
      acc[pid].children.push(item);
    }
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([pid, data]) => (
        <div key={pid} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {/* Group Header */}
          <div className="bg-gradient-to-r from-gray-50 to-white px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* ไอคอนสีน้ำเงิน */}
              <FolderOpenOutlined className="text-blue-600" />
              <span className="font-bold text-gray-700">{data.parentLabel}</span>
            </div>
            {/* Badge สีน้ำเงิน */}
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {data.children.length}
            </span>
          </div>

          {/* Children Grid */}
          <div className="p-3 bg-white grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.children.map(child => (
              // เปลี่ยน Hover Item เป็นสีน้ำเงิน
              <div key={child.id} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-50/50 hover:bg-blue-50 hover:text-blue-800 rounded-lg transition-colors border border-transparent hover:border-blue-100">
                <CheckCircleFilled className="text-blue-400 text-xs" />
                {child.label}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PermissionTags;