import React, { useEffect, useMemo, useState } from "react";
import { Modal, Form, Input, Button, Checkbox, Alert, Empty, ConfigProvider } from "antd";
import {
  FolderOpenOutlined, EditOutlined, SearchOutlined, AppstoreOutlined,
  CheckSquareOutlined, FileTextOutlined, DeleteOutlined, SaveOutlined, StopOutlined,
  ToolOutlined // ✅ เพิ่มไอคอน
} from "@ant-design/icons";
import { ACTION_MASTER } from "../ActionConstants"; // ✅ Import

// ... (Constants ADMIN_ID, etc. เหมือนเดิม) ...
const ADMIN_ID = 1;
const ADMIN_NAME = "administrator";
const REQ_MAIN = "20";
const REQ_SUBS = ["201", "202"];

const ModalUpdate = ({ open, record, onCancel, onSubmit, onDelete, mains = [], subs = [], takenNames = [] }) => {
  const [form] = Form.useForm();
  const [searchTerm, setSearchTerm] = useState("");

  // ... (Logic menuTree, filteredMenuTree, isAdmin, allowedSubIdsInit เหมือนเดิม) ...
  const menuTree = useMemo(() => {
    return mains.map((main) => ({
      ...main,
      children: subs.filter((sub) => sub.parentId === main.id),
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [mains, subs]);

  const filteredMenuTree = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return menuTree;
    return menuTree.map((main) => {
      const isMainMatch = main.label.toLowerCase().includes(q);
      const matchingSubs = main.children.filter((s) => s.label.toLowerCase().includes(q));
      if (isMainMatch || matchingSubs.length > 0) {
        return { ...main, children: isMainMatch ? main.children : matchingSubs };
      }
      return null;
    }).filter(Boolean);
  }, [searchTerm, menuTree]);

  const isAdmin = Number(record?.id) === ADMIN_ID && String(record?.groupName || "").trim().toLowerCase() === ADMIN_NAME;

  const allowedSubIdsInit = useMemo(() => {
    const rMains = (record?.mainIds || []).map(String);
    return (record?.subIds || []).map(String).filter((sid) => {
      const s = subs.find((x) => x.id === sid);
      return s && rMains.includes(s.parentId);
    });
  }, [record, subs]);


  // ✅ เพิ่ม initialization สำหรับ actionPermissions
  useEffect(() => {
    if (open && record) {
      form.setFieldsValue({
        groupName: record.groupName || "",
        mainIds: (record.mainIds || []).map(String),
        subIds: allowedSubIdsInit,
        actionPermissions: record.actionPermissions || [] // ✅ ดึงค่าเดิม
      });
    } else {
      form.resetFields();
      setSearchTerm("");
    }
  }, [open, record, allowedSubIdsInit, form]);

  const selectedMainIds = Form.useWatch("mainIds", form) || [];
  const selectedSubIds = Form.useWatch("subIds", form) || [];

  // ... (Duplicate check logic, Toggle handlers, SelectAll logic เหมือนเดิม) ...
  const originalNorm = (record?.groupName || "").trim().toLowerCase();
  const takenSet = useMemo(() => new Set((takenNames || []).map((s) => String(s).trim().toLowerCase())), [takenNames]);
  const nameVal = Form.useWatch("groupName", form) || "";
  const curNorm = (nameVal || "").trim().toLowerCase();
  const isDup = !isAdmin && !!curNorm && curNorm !== originalNorm && takenSet.has(curNorm);

  const handleMainToggle = (mainId, childIds, isChecked) => {
    // (Copy Logic เดิมมาใส่)
    const mainSet = new Set(selectedMainIds.map(String));
    const subSet = new Set(selectedSubIds.map(String));
    if (isChecked) {
      mainSet.add(mainId);
      childIds.forEach((id) => subSet.add(id));
    } else {
      if (isAdmin && mainId === REQ_MAIN) { mainSet.add(mainId); }
      else { mainSet.delete(mainId); childIds.forEach((id) => subSet.delete(id)); }
    }
    if (isAdmin) { mainSet.add(REQ_MAIN); REQ_SUBS.forEach((s) => subSet.add(s)); }
    form.setFieldsValue({ mainIds: Array.from(mainSet), subIds: Array.from(subSet) });
  };

  const handleSubToggle = (parentId, subId, isChecked) => {
    // (Copy Logic เดิมมาใส่)
    const mainSet = new Set(selectedMainIds.map(String));
    const subSet = new Set(selectedSubIds.map(String));
    if (isChecked) { subSet.add(subId); mainSet.add(parentId); }
    else {
      if (isAdmin && REQ_SUBS.includes(subId)) { subSet.add(subId); }
      else {
        subSet.delete(subId);
        const parent = menuTree.find((m) => m.id === parentId);
        const siblings = parent ? parent.children.map((c) => c.id) : [];
        if (!siblings.some((sid) => subSet.has(sid))) {
          if (!(isAdmin && parentId === REQ_MAIN)) mainSet.delete(parentId);
          else mainSet.add(parentId);
        }
      }
    }
    if (isAdmin) { mainSet.add(REQ_MAIN); REQ_SUBS.forEach((s) => subSet.add(s)); }
    form.setFieldsValue({ mainIds: Array.from(mainSet), subIds: Array.from(subSet) });
  };

  const handleSelectAll = (isChecked) => {
    // (Copy Logic เดิมมาใส่)
    if (isChecked) {
      const allMainIds = mains.map((m) => m.id);
      const allSubIds = subs.map((s) => s.id);
      let nextMain = new Set(allMainIds.map(String));
      let nextSub = new Set(allSubIds.map(String));
      if (isAdmin) { nextMain.add(REQ_MAIN); REQ_SUBS.forEach((s) => nextSub.add(s)); }
      form.setFieldsValue({ mainIds: Array.from(nextMain), subIds: Array.from(nextSub) });
    } else {
      if (isAdmin) { form.setFieldsValue({ mainIds: [REQ_MAIN], subIds: [...REQ_SUBS] }); }
      else { form.setFieldsValue({ mainIds: [], subIds: [] }); }
    }
  };

  const allSubsSelected = selectedSubIds.length > 0 && selectedSubIds.length === subs.length;
  const isIndeterminateAll = selectedSubIds.length > 0 && !allSubsSelected;

  // ✅ Update Handle OK
  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        groupName: values.groupName.trim(),
        mainIds: (values.mainIds || []).map(String),
        subIds: (values.subIds || []).map(String),
        actionPermissions: values.actionPermissions || [] // ✅ ส่งค่า actionPermissions กลับไป
      };
      if (isAdmin) {
        if (!payload.mainIds.includes(REQ_MAIN)) payload.mainIds.push(REQ_MAIN);
        REQ_SUBS.forEach((s) => { if (!payload.subIds.includes(s)) payload.subIds.push(s); });
      }
      onSubmit?.(payload);
      form.resetFields();
      setSearchTerm("");
    } catch (e) { }
  };

  const handleCancel = () => { form.resetFields(); setSearchTerm(""); onCancel?.(); };

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#2563eb', borderRadius: 8 }, components: { Checkbox: { colorPrimary: '#3b82f6', colorPrimaryHover: '#2563eb' }, Button: { primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)' } } }}>
      <Modal
        open={open}
        title={null}
        onCancel={handleCancel}
        maskClosable={false}
        destroyOnClose
        width={900} // ✅ ปรับความกว้าง
        centered
        footer={null}
        className="custom-modal-update"
        styles={{ content: { padding: 0, borderRadius: '16px', overflow: 'hidden' } }}
      >
        {/* Header */}
        <div className="bg-gray-200 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3 text-gray-800">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-600 text-xl"><EditOutlined /></div>
            <div>
              <h3 className="text-lg font-bold m-0 leading-tight">แก้ไขกลุ่มสิทธิ</h3>
              <span className="text-xs text-gray-700">{record?.groupName ? record.groupName : "ปรับปรุงข้อมูล"}</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {isAdmin && (<Alert message="กลุ่ม Administrator" description="กลุ่มสิทธิ์นี้ถูกป้องกันโดยระบบ..." type="info" showIcon className="mb-6 border-blue-100 bg-blue-50 text-blue-800" icon={<StopOutlined className="text-blue-500" />} />)}

          {/* ✅ เพิ่ม initialValues: actionPermissions */}
          <Form key={record?.id || "update"} form={form} layout="vertical" preserve={false} initialValues={{ groupName: record?.groupName || "", mainIds: (record?.mainIds || []).map(String), subIds: allowedSubIdsInit, actionPermissions: record?.actionPermissions || [] }}>

            <Form.Item name="groupName" label={<span className="font-semibold text-gray-700">ชื่อกลุ่มสิทธิ</span>} rules={isAdmin ? [{ required: true }] : [{ required: true }, () => ({ validator(_, value) { /* dup check */ return Promise.resolve(); } })]} validateStatus={!isAdmin && isDup ? "error" : undefined} help={!isAdmin && isDup ? "ชื่อกลุ่มนี้มีแล้วในระบบ" : undefined}>
              <Input prefix={<AppstoreOutlined className="text-gray-400" />} disabled={isAdmin} className={`h-10 rounded-lg bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 hover:border-blue-400 transition-all ${isAdmin ? 'cursor-not-allowed opacity-70' : ''}`} />
            </Form.Item>

            <div className="flex flex-col md:flex-row gap-6 mt-6">
              {/* Left Column: Menu (Copy Code from Create or Existing Update) */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3"><label className="font-semibold text-gray-700 flex items-center gap-2"><CheckSquareOutlined className="text-blue-500" /> แก้ไขสิทธิ์เข้าถึงเมนู</label></div>
                <div className="border border-gray-200 rounded-xl overflow-hidden flex flex-col h-[400px] bg-white shadow-sm">
                  <div className="p-3 bg-gray-50 border-b border-gray-100 flex flex-col gap-3">
                    <Input prefix={<SearchOutlined className="text-gray-400" />} placeholder="ค้นหาเมนู..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} allowClear className="rounded-lg border-gray-200 focus:border-blue-500" />
                    <div className="flex items-center px-1"><Checkbox checked={allSubsSelected} indeterminate={isIndeterminateAll} onChange={(e) => handleSelectAll(e.target.checked)} className="text-sm font-medium text-gray-600 hover:text-blue-600">เลือกทั้งหมด</Checkbox></div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    {filteredMenuTree.length > 0 ? (
                      <div className="space-y-1">
                        {filteredMenuTree.map((main) => {
                          const childIds = main.children.map((c) => c.id);
                          const hasChildren = childIds.length > 0;
                          let isMainChecked;
                          let isMainIndeterminate = false;
                          if (hasChildren) {
                            const selectedChildrenCount = childIds.filter((id) => selectedSubIds.includes(id)).length;
                            isMainChecked = selectedChildrenCount === childIds.length && childIds.length > 0;
                            isMainIndeterminate = selectedChildrenCount > 0 && !isMainChecked;
                          } else { isMainChecked = selectedMainIds.includes(main.id); }

                          return (
                            <div key={main.id} className="border border-gray-100 rounded-lg mb-2 overflow-hidden">
                              <div className={`p-2.5 flex items-center gap-2 transition-colors ${isMainChecked ? 'bg-blue-50/50' : 'bg-white hover:bg-gray-50'}`}>
                                <Checkbox checked={isMainChecked} indeterminate={isMainIndeterminate} onChange={(e) => handleMainToggle(main.id, childIds, e.target.checked)} disabled={isAdmin && main.id === REQ_MAIN && !isMainChecked} />
                                <div className="flex items-center gap-2 text-gray-700 font-medium flex-1"><FolderOpenOutlined className="text-blue-500" />{main.label}</div>
                              </div>
                              {hasChildren && (
                                <div className="pl-9 pr-2 pb-2 pt-1 space-y-1 bg-gray-50/30 border-t border-gray-50">
                                  {main.children.map((sub) => {
                                    const checked = selectedSubIds.includes(sub.id);
                                    const isProtected = isAdmin && REQ_SUBS.includes(sub.id) && checked;
                                    return (
                                      <div key={sub.id} className="flex items-center gap-2 py-1 hover:bg-white rounded px-2 transition-colors">
                                        <Checkbox checked={checked} onChange={(e) => handleSubToggle(main.id, sub.id, e.target.checked)} disabled={isProtected} />
                                        <span className="text-sm text-gray-600 flex items-center gap-2"><FileTextOutlined className="text-gray-400 text-xs" /> {sub.label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : <div className="h-full flex flex-col items-center justify-center text-gray-400"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่พบเมนูที่ค้นหา" /></div>}
                  </div>
                </div>
              </div>

              {/* ✅ Right Column: Action Permissions (ส่วนที่เพิ่มใหม่) */}
              <div className="flex-1 md:max-w-[350px]">
                <div className="flex items-center justify-between mb-3">
                  <label className="font-semibold text-gray-700 flex items-center gap-2">
                    <ToolOutlined className="text-blue-500" /> แก้ไขสิทธิ์ปุ่ม (Actions)
                  </label>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                  <Form.Item name="actionPermissions" noStyle>
                    <Checkbox.Group style={{ width: '100%' }}>
                      <div className="flex flex-col gap-5">
                        {ACTION_MASTER.map((group) => (
                          <div key={group.key}>
                            <div className="font-bold text-gray-700 mb-2 border-b border-gray-100 pb-1 flex items-center gap-2">
                              <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                              {group.module}
                            </div>
                            <div className="flex flex-col gap-2 pl-2">
                              {group.options.map(opt => (
                                <Checkbox key={opt.value} value={opt.value} className="ml-0 hover:text-blue-600">
                                  <span className="text-gray-600">{opt.label}</span>
                                </Checkbox>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Checkbox.Group>
                  </Form.Item>
                </div>
              </div>
            </div>

            <Form.Item name="mainIds" noStyle rules={[{ required: true }]}><Input type="hidden" /></Form.Item>
            <Form.Item name="subIds" noStyle><Input type="hidden" /></Form.Item>
          </Form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-between items-center gap-3">
          <div>{!isAdmin && onDelete && (<Button danger onClick={() => onDelete?.()} icon={<DeleteOutlined />} className="border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300">ลบกลุ่มสิทธิ</Button>)}</div>
          <div className="flex gap-3">
            <Button type="primary" onClick={handleOk} disabled={!isAdmin && isDup} icon={<SaveOutlined />} className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 border-none shadow-md shadow-blue-200 font-semibold">อัปเดตข้อมูล</Button>
            <Button onClick={handleCancel} className="h-10 px-6 rounded-lg border-gray-300 text-gray-600 hover:text-gray-800 hover:border-gray-400 hover:bg-white">ยกเลิก</Button>
          </div>
        </div>
      </Modal>
    </ConfigProvider>
  );
};

export default ModalUpdate;