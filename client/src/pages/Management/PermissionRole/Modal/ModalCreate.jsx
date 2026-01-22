import React, { useMemo, useState } from "react";
import { Modal, Form, Input, Button, Checkbox, Empty, ConfigProvider, Switch, Tooltip } from "antd"; // ✅ เพิ่ม Switch, Tooltip
import {
    FolderOpenOutlined,
    PlusCircleOutlined,
    SearchOutlined,
    AppstoreOutlined,
    CheckSquareOutlined,
    FileTextOutlined,
    ToolOutlined,
    UnlockOutlined
} from '@ant-design/icons';
import { ACTION_MASTER } from "../ActionConstants"; // ✅ Import Master Data

const ModalCreate = ({ open, onCancel, onSubmit, mains = [], subs = [], takenNames = [] }) => {
    const [form] = Form.useForm();
    const [searchTerm, setSearchTerm] = useState("");

    // ... (Logic menuTree และ filteredMenuTree เหมือนเดิม ไม่ต้องแก้) ...
    const menuTree = useMemo(() => {
        return mains.map(main => ({
            ...main,
            children: subs.filter(sub => sub.parentId === main.id)
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [mains, subs]);

    const filteredMenuTree = useMemo(() => {
        if (!searchTerm.trim()) return menuTree;
        const lowercasedFilter = searchTerm.trim().toLowerCase();
        return menuTree
            .map(main => {
                const isMainMatch = main.label.toLowerCase().includes(lowercasedFilter);
                const matchingSubs = main.children.filter(sub =>
                    sub.label.toLowerCase().includes(lowercasedFilter)
                );
                if (isMainMatch || matchingSubs.length > 0) {
                    return { ...main, children: isMainMatch ? main.children : matchingSubs };
                }
                return null;
            }).filter(Boolean);
    }, [searchTerm, menuTree]);

    const takenSet = useMemo(() => new Set((takenNames || []).map(s => String(s).trim().toLowerCase())), [takenNames]);

    // Form Watchers
    const selectedMainIds = Form.useWatch("mainIds", form) || [];
    const selectedSubIds = Form.useWatch("subIds", form) || [];

    // ... (Logic handleMainChange, handleSubChange, handleSelectAll เหมือนเดิม) ...
    const handleMainChange = (mainId, childIds, isChecked) => {
        const mainSet = new Set(selectedMainIds);
        const subSet = new Set(selectedSubIds);
        if (isChecked) {
            mainSet.add(mainId);
            childIds.forEach(id => subSet.add(id));
        } else {
            mainSet.delete(mainId);
            childIds.forEach(id => subSet.delete(id));
        }
        form.setFieldsValue({ mainIds: Array.from(mainSet), subIds: Array.from(subSet) });
    };

    const handleSubChange = (parentId, subId, isChecked) => {
        const mainSet = new Set(selectedMainIds);
        const subSet = new Set(selectedSubIds);
        if (isChecked) {
            subSet.add(subId);
            mainSet.add(parentId);
        } else {
            subSet.delete(subId);
            const parent = menuTree.find(m => m.id === parentId);
            const siblings = parent ? parent.children.map(c => c.id) : [];
            if (!siblings.some(sid => subSet.has(sid))) mainSet.delete(parentId);
        }
        form.setFieldsValue({ mainIds: Array.from(mainSet), subIds: Array.from(subSet) });
    };

    const handleSelectAll = (isChecked) => {
        if (isChecked) {
            form.setFieldsValue({
                mainIds: mains.map(m => m.id),
                subIds: subs.map(s => s.id)
            });
        } else {
            form.setFieldsValue({ mainIds: [], subIds: [] });
        }
    };

    const allSubsSelected = selectedSubIds.length > 0 && selectedSubIds.length === subs.length;
    const isIndeterminateAll = selectedSubIds.length > 0 && !allSubsSelected;


    // ✅ Update Handle OK: เพิ่ม actionPermissions
    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            const payload = {
                groupName: values.groupName.trim(),
                mainIds: (values.mainIds || []).map(String),
                subIds: (values.subIds || []).map(String),
                actionPermissions: values.actionPermissions || [],
                privilege_access: values.privilege_access ? 'Allow' : 'Normal'
            };
            onSubmit?.(payload);
            form.resetFields();
            setSearchTerm("");
        } catch (err) {
            console.log('Validate Failed:', err);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setSearchTerm("");
        onCancel?.();
    }

    return (
        <ConfigProvider
            theme={{
                token: { colorPrimary: '#2563eb', borderRadius: 8 },
                components: {
                    Checkbox: { colorPrimary: '#3b82f6', colorPrimaryHover: '#2563eb' },
                    Button: { primaryShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)' }
                }
            }}
        >
            <Modal
                open={open}
                title={null}
                onCancel={handleCancel}
                maskClosable={false}
                destroyOnClose
                width={900} // ✅ เพิ่มความกว้างเพื่อให้วาง 2 คอลัมน์ได้สวยงาม (ถ้าต้องการ) หรือใช้ 600 เท่าเดิมแล้วเรียงลงมา
                centered
                footer={null}
                className="custom-modal-create"
                styles={{ content: { padding: 0, borderRadius: '16px', overflow: 'hidden' } }}
            >
                {/* Header */}
                <div className="bg-gray-200 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-gray-800">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-600 text-xl">
                            <PlusCircleOutlined />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold m-0 leading-tight">เพิ่มกลุ่มสิทธิใหม่</h3>
                            <span className="text-xs text-gray-700">กำหนดชื่อกลุ่ม, เมนู และปุ่มกด</span>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <Form form={form} layout="vertical" preserve={false}
                        initialValues={{
                            groupName: "",
                            mainIds: [],
                            subIds: [],
                            actionPermissions: [],
                            privilege_access: false
                        }}
                    >
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <Form.Item
                                    name="groupName"
                                    label={<span className="font-semibold text-gray-700">ชื่อกลุ่มสิทธิ</span>}
                                    rules={[
                                        { required: true, message: "กรุณาระบุชื่อกลุ่มสิทธิ" },
                                        { validator: (_, value) => (value && takenSet.has(value.trim().toLowerCase())) ? Promise.reject(new Error("ชื่อนี้มีอยู่แล้ว")) : Promise.resolve() }
                                    ]}
                                >
                                    <Input prefix={<AppstoreOutlined className="text-gray-400" />} placeholder="เช่น HR Manager" className="h-10 rounded-lg bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 hover:border-blue-400 transition-all" />
                                </Form.Item>
                            </div>
                            <div>
                                <Form.Item
                                    name="privilege_access"
                                    label={
                                        <span className="font-semibold text-gray-700 flex items-center gap-1">
                                            สิทธิพิเศษ <Tooltip title="เข้าใช้งานได้โดยไม่สนสถานะ"><UnlockOutlined className="text-gray-400" /></Tooltip>
                                        </span>
                                    }
                                    valuePropName="checked"
                                >
                                    <Switch
                                        checkedChildren="Allow"
                                        unCheckedChildren="Normal"
                                        className="bg-gray-300"
                                    />
                                </Form.Item>
                            </div>
                        </div>


                        <div className="flex flex-col md:flex-row gap-6 mt-4">
                            {/* Left Column: Menu Permissions (เหมือนเดิม) */}
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="font-semibold text-gray-700 flex items-center gap-2">
                                        <CheckSquareOutlined className="text-blue-500" /> สิทธิ์เข้าถึงเมนู
                                    </label>
                                </div>
                                <div className="border border-gray-200 rounded-xl overflow-hidden flex flex-col h-[400px] bg-white shadow-sm">
                                    <div className="p-3 bg-gray-50 border-b border-gray-100 flex flex-col gap-3">
                                        <Input prefix={<SearchOutlined className="text-gray-400" />} placeholder="ค้นหาเมนู..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} allowClear className="rounded-lg border-gray-200 focus:border-blue-500" />
                                        <div className="flex items-center px-1">
                                            <Checkbox checked={allSubsSelected} indeterminate={isIndeterminateAll} onChange={(e) => handleSelectAll(e.target.checked)} className="text-sm font-medium text-gray-600 hover:text-blue-600">เลือกทั้งหมด</Checkbox>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                                        {/* ... (Render Menu Tree Logic เดิม) ... */}
                                        {filteredMenuTree.length > 0 ? (
                                            <div className="space-y-1">
                                                {filteredMenuTree.map(main => {
                                                    const childIds = main.children.map(c => c.id);
                                                    const hasChildren = childIds.length > 0;
                                                    let isMainChecked;
                                                    let isMainIndeterminate = false;
                                                    if (hasChildren) {
                                                        const selectedChildrenCount = childIds.filter(id => selectedSubIds.includes(id)).length;
                                                        isMainChecked = selectedChildrenCount === childIds.length && childIds.length > 0;
                                                        isMainIndeterminate = selectedChildrenCount > 0 && !isMainChecked;
                                                    } else {
                                                        isMainChecked = selectedMainIds.includes(main.id);
                                                    }
                                                    return (
                                                        <div key={main.id} className="border border-gray-100 rounded-lg mb-2 overflow-hidden">
                                                            <div className={`p-2.5 flex items-center gap-2 transition-colors ${isMainChecked ? 'bg-blue-50/50' : 'bg-white hover:bg-gray-50'}`}>
                                                                <Checkbox checked={isMainChecked} indeterminate={isMainIndeterminate} onChange={(e) => handleMainChange(main.id, childIds, e.target.checked)} />
                                                                <div className="flex items-center gap-2 text-gray-700 font-medium flex-1"><FolderOpenOutlined className="text-blue-500" />{main.label}</div>
                                                            </div>
                                                            {hasChildren && (
                                                                <div className="pl-9 pr-2 pb-2 pt-1 space-y-1 bg-gray-50/30 border-t border-gray-50">
                                                                    {main.children.map(sub => (
                                                                        <div key={sub.id} className="flex items-center gap-2 py-1 hover:bg-white rounded px-2 transition-colors">
                                                                            <Checkbox checked={selectedSubIds.includes(sub.id)} onChange={(e) => handleSubChange(main.id, sub.id, e.target.checked)} />
                                                                            <span className="text-sm text-gray-600 flex items-center gap-2"><FileTextOutlined className="text-gray-400 text-xs" /> {sub.label}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : <div className="h-full flex flex-col items-center justify-center text-gray-400"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่พบเมนู" /></div>}
                                    </div>
                                </div>
                            </div>

                            {/* ✅ Right Column: Action Permissions (ส่วนที่เพิ่มใหม่) */}
                            <div className="flex-1 md:max-w-[350px]">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="font-semibold text-gray-700 flex items-center gap-2">
                                        <ToolOutlined className="text-blue-500" /> สิทธิ์การใช้งานปุ่ม (Actions)
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

                        {/* Hidden Fields */}
                        <Form.Item name="mainIds" noStyle rules={[{ required: true, message: "โปรดเลือกเมนูอย่างน้อย 1 รายการ" }]}><Input type="hidden" /></Form.Item>
                        <Form.Item name="subIds" noStyle><Input type="hidden" /></Form.Item>
                    </Form>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <Button type="primary" onClick={handleOk} className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 border-none shadow-md shadow-blue-200 font-semibold">บันทึกข้อมูล</Button>
                    <Button onClick={handleCancel} className="h-10 px-6 rounded-lg border-gray-300 text-gray-600 hover:text-gray-800 hover:border-gray-400 hover:bg-white">ยกเลิก</Button>
                </div>
            </Modal>
        </ConfigProvider>
    );
};

export default ModalCreate;