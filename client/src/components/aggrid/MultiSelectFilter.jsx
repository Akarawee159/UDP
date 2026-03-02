import React, { forwardRef, useImperativeHandle, useState, useEffect, useRef } from 'react';
import { Checkbox, Input, Button } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const MultiSelectFilter = forwardRef((props, ref) => {
    const [options, setOptions] = useState([]);
    const [selectedValues, setSelectedValues] = useState([]);
    const [searchText, setSearchText] = useState('');

    // ใช้ Ref เพื่อเก็บค่าล่าสุดเสมอ (แก้ปัญหาค่าไม่อัปเดตตอนกดเลือก)
    const selectedValuesRef = useRef([]);

    // ฟังก์ชันช่วยดึงค่าและแปลงเป็น String เพื่อให้เปรียบเทียบแม่นยำ
    const getNodeValue = (node) => {
        if (!node) return '(ว่าง)';
        const val = props.getValue(node);
        if (val === null || val === undefined || val === '') {
            return '(ว่าง)';
        }
        return String(val); // แปลงเป็นข้อความเสมอ
    };

    // 1. ดึงข้อมูลตัวเลือกทั้งหมดจากคอลัมน์ (ทำครั้งเดียวตอนเปิด)
    useEffect(() => {
        const uniqueValues = new Set();
        props.api.forEachLeafNode((node) => {
            const val = getNodeValue(node);
            uniqueValues.add(val);
        });
        // เรียงลำดับข้อมูล
        setOptions(Array.from(uniqueValues).sort());
    }, [props.api]);

    // 2. ฟังก์ชันหลักที่ AG Grid เรียกใช้
    useImperativeHandle(ref, () => ({
        // ตรวจสอบว่ามีการกรองอยู่หรือไม่
        isFilterActive: () => {
            return selectedValuesRef.current.length > 0;
        },
        // ตรวจสอบว่าแถวนี้ผ่านเงื่อนไขหรือไม่
        doesFilterPass: (params) => {
            const rowValue = getNodeValue(params.node);
            return selectedValuesRef.current.includes(rowValue);
        },
        // รับ/ส่ง ค่า State ของ Filter (สำหรับ Save/Restore)
        getModel: () => {
            if (selectedValuesRef.current.length === 0) return null;
            return selectedValuesRef.current;
        },
        setModel: (model) => {
            const newValues = model || [];
            setSelectedValues(newValues);
            selectedValuesRef.current = newValues;
        }
    }));

    // 3. ฟังก์ชันเมื่อกดเลือก Checkbox
    const onCheckboxChange = (value, checked) => {
        const newSelected = checked
            ? [...selectedValues, value]
            : selectedValues.filter(v => v !== value);

        updateFilter(newSelected);
    };

    const onSelectAll = () => updateFilter(options);
    const onClear = () => updateFilter([]);

    // ฟังก์ชันอัปเดตและสั่ง Grid ให้กรองใหม่ทันที
    const updateFilter = (newValues) => {
        setSelectedValues(newValues);
        selectedValuesRef.current = newValues;

        // สั่งให้ AG Grid ทำงาน (ใช้คำสั่งมาตรฐานใหม่)
        props.api.onFilterChanged();
    };

    // กรองตัวเลือกในกล่องค้นหา (Search Box)
    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <div className="p-3 bg-white flex flex-col gap-2 shadow-lg rounded-md border border-gray-100" style={{ width: '260px' }}>
            <Input
                prefix={<SearchOutlined className="text-gray-400" />}
                placeholder="ค้นหาตัวเลือก..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                allowClear
                className="mb-1"
            />
            <div className="flex justify-between items-center px-1 border-b pb-2 mb-1">
                <span className="text-xs text-gray-500">พบ {filteredOptions.length} รายการ</span>
                <div className="flex gap-2">
                    <Button size="small" type="link" onClick={onSelectAll} className="p-0 text-xs text-blue-600">เลือกทั้งหมด</Button>
                    <Button size="small" type="link" onClick={onClear} className="p-0 text-xs text-red-500">ล้างค่า</Button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-1 max-h-60 pt-1 custom-scrollbar">
                {filteredOptions.length > 0 ? (
                    filteredOptions.map(opt => (
                        <Checkbox
                            key={opt}
                            checked={selectedValues.includes(opt)}
                            onChange={(e) => onCheckboxChange(opt, e.target.checked)}
                            className="ml-0 hover:bg-gray-50 px-2 py-1 rounded transition-colors w-full"
                        >
                            <span className="text-sm">{opt}</span>
                        </Checkbox>
                    ))
                ) : (
                    <div className="text-gray-400 text-sm text-center py-4">ไม่พบข้อมูล</div>
                )}
            </div>
        </div>
    );
});

export default MultiSelectFilter;