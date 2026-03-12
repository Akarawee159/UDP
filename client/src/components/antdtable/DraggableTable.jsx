import React, { useState, useEffect } from 'react';
import { Table, Button, Popover, Checkbox, ConfigProvider } from 'antd';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HolderOutlined } from '@ant-design/icons';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';

// Custom Header ที่รวมทั้ง Drag & Drop และ Resize
const DraggableResizableHeaderCell = ({ id, dragDisabled, width, onResize, onDoubleClickResize, children, ...restProps }) => {
    // 1. Setup สำหรับลากสลับตำแหน่ง (dnd-kit)
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: id || 'dummy-id',
    });

    const style = {
        ...restProps.style,
        transform: CSS.Transform.toString(transform && { ...transform, scaleX: 1 }),
        transition,
        ...(isDragging ? { position: 'relative', zIndex: 9999, opacity: 0.8, background: '#f8fafc' } : {}),
    };

    // ส่วนเนื้อหาภายใน Header
    const content = (
        <div className="flex items-center w-full h-full">
            {/* จุดจับสำหรับลากสลับตำแหน่ง */}
            {!dragDisabled && id && (
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-1 -ml-1 mr-1 hover:bg-gray-200 rounded transition-colors"
                >
                    <HolderOutlined className="text-gray-400 flex-shrink-0" />
                </div>
            )}
            <div className="flex-1 truncate">{children}</div>
        </div>
    );

    // หากไม่ได้กำหนดความกว้าง หรือไม่มี id ให้แสดง th ปกติ (สลับตำแหน่งได้ แต่ยืดหดไม่ได้)
    if (!width || !id) {
        return (
            <th {...restProps} ref={setNodeRef} style={style}>
                {content}
            </th>
        );
    }

    // 2. Setup สำหรับยืดหดคอลัมน์ (react-resizable) ครอบ th เอาไว้
    return (
        <Resizable
            width={width}
            height={0}
            handle={
                <div
                    className="absolute right-0 top-0 bottom-0 w-[10px] cursor-col-resize z-10 group flex justify-center items-center"
                    onClick={(e) => e.stopPropagation()} // ป้องกัน Event ตีกัน
                    onMouseDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (onDoubleClickResize) onDoubleClickResize(); // เรียกใช้ฟังก์ชันเมื่อดับเบิลคลิก
                    }}
                >
                    {/* ขีดเส้นสีฟ้าแสดงขึ้นมาเวลาเอาเมาส์ไปชี้ที่ขอบ */}
                    <div className="h-full w-[2px] bg-transparent group-hover:bg-blue-400 group-active:bg-blue-600 transition-colors" />
                </div>
            }
            onResize={onResize}
            draggableOpts={{ enableUserSelectHack: false }}
        >
            <th {...restProps} ref={setNodeRef} style={style} className={`${restProps.className} relative`}>
                {content}
            </th>
        </Resizable>
    );
};

export default function DraggableTable({
    columns: baseColumns,
    dataSource,
    rowKey = 'id',
    loading,
    scroll,
    pagination,
    onChange,
    renderToolbar,
    onRow,
    rowSelection
}) {
    // State จัดการลำดับการแสดงผลคอลัมน์
    const initialKeys = baseColumns.map(c => c.key || c.dataIndex);
    const [columnsOrder, setColumnsOrder] = useState(initialKeys);
    const [visibleColumns, setVisibleColumns] = useState(initialKeys);

    // State จัดการความกว้างของแต่ละคอลัมน์
    const [colWidths, setColWidths] = useState(() => {
        const widths = {};
        baseColumns.forEach(c => {
            if (c.width) widths[c.key || c.dataIndex] = c.width;
        });
        return widths;
    });

    // อัปเดต State ความกว้างเมื่อ Component แม่มีการเปลี่ยน columns
    useEffect(() => {
        setColWidths(prev => {
            const newWidths = { ...prev };
            baseColumns.forEach(c => {
                if (c.width && !newWidths[c.key || c.dataIndex]) {
                    newWidths[c.key || c.dataIndex] = c.width;
                }
            });
            return newWidths;
        });
    }, [baseColumns]);

    // เซนเซอร์แยกการลาก/คลิก
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    // จัดการเมื่อลากสลับคอลัมน์เสร็จ
    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setColumnsOrder((prev) => {
                const activeIndex = prev.indexOf(active.id);
                const overIndex = prev.indexOf(over.id);
                return arrayMove(prev, activeIndex, overIndex);
            });
        }
    };

    // จัดการเมื่อลากขยายความกว้างคอลัมน์
    const handleResize = (key) => (e, { size }) => {
        // หาค่าความกว้างเริ่มต้นจาก baseColumns มาเป็นค่าต่ำสุด
        const column = baseColumns.find(c => (c.key || c.dataIndex) === key);
        const minWidth = column?.width || 50;

        setColWidths(prev => ({
            ...prev,
            // บังคับให้ขนาดใหม่ ต้องไม่น้อยกว่าค่า minWidth ที่กำหนดไว้ตอนแรก
            [key]: size.width >= minWidth ? size.width : minWidth,
        }));
    };

    // จัดการเมื่อดับเบิลคลิกขอบคอลัมน์ (Auto-fit)
    const handleDoubleClickResize = (key) => () => {
        const column = baseColumns.find(c => (c.key || c.dataIndex) === key);
        if (!column) return;

        const dataIndex = column.dataIndex || key;

        // 1. หาความยาวตัวอักษรที่ยาวที่สุด เริ่มจากความยาวของชื่อหัวคอลัมน์
        let maxLength = (column.title || '').toString().length;

        // 2. วนลูปหาข้อมูลใน dataSource ที่ยาวที่สุดในคอลัมน์นี้
        if (dataSource && dataSource.length > 0) {
            dataSource.forEach(row => {
                const cellValue = row[dataIndex];
                if (cellValue !== null && cellValue !== undefined) {
                    const strVal = cellValue.toString();
                    if (strVal.length > maxLength) {
                        maxLength = strVal.length;
                    }
                }
            });
        }

        // 3. คำนวณความกว้าง (1 ตัวอักษรใช้พื้นที่ประมาณ 8.5px + เผื่อพื้นที่ Padding/ไอคอน 50px)
        let estimatedWidth = Math.ceil(maxLength * 8.5) + 50;

        // 4. ตรวจสอบไม่ให้แคบกว่าค่าเริ่มต้น และไม่ให้กว้างเกินไป (กันเลย์เอาต์พัง)
        const minWidth = column.width || 50;
        if (estimatedWidth < minWidth) estimatedWidth = minWidth;
        if (estimatedWidth > 800) estimatedWidth = 800; // จำกัดกว้างสุดไม่เกิน 800px

        // อัปเดตความกว้าง
        setColWidths(prev => ({
            ...prev,
            [key]: estimatedWidth,
        }));
    };

    // เตรียมคอลัมน์ก่อนส่งให้ Table
    const displayColumns = columnsOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => {
            const col = baseColumns.find(c => (c.key || c.dataIndex) === key);
            if (!col) return null;

            const currentWidth = colWidths[key] || col.width || 100;

            return {
                ...col,
                width: currentWidth, // ใช้ความกว้างจาก State
                onHeaderCell: () => ({
                    id: key,
                    dragDisabled: col.dragDisabled,
                    width: currentWidth,
                    onResize: handleResize(key), // ส่งฟังก์ชันจับการขยายกลับไป
                    onDoubleClickResize: handleDoubleClickResize(key), // ส่งฟังก์ชันดับเบิลคลิกกลับไป
                }),
            };
        }).filter(Boolean);

    const ColumnVisibilityPopover = (
        <Popover
            placement="bottomRight"
            title={<span className="font-semibold text-gray-700">แสดง/ซ่อนคอลัมน์</span>}
            trigger="click"
            content={
                <Checkbox.Group
                    value={visibleColumns}
                    onChange={setVisibleColumns}
                    className="flex flex-col gap-2 mt-2 max-h-72 overflow-y-auto pr-3"
                >
                    {baseColumns.map(col => (
                        <Checkbox key={col.key || col.dataIndex} value={col.key || col.dataIndex}>
                            {col.title}
                        </Checkbox>
                    ))}
                </Checkbox.Group>
            }
        >
            <Button className="bg-gray-100 text-gray-600 hover:bg-gray-200 border-none h-9 rounded px-4 font-medium w-full sm:w-auto transition-colors">
                แสดง/ซ่อนคอลัมน์
            </Button>
        </Popover>
    );

    return (
        <>
            {renderToolbar && renderToolbar(ColumnVisibilityPopover)}

            <ConfigProvider
                theme={{
                    components: {
                        Table: {
                            headerBg: '#e5e7eb',
                            headerColor: '#000000',
                            borderColor: '#f1f5f9',
                            rowHoverBg: '#f8fafc',
                            cellPaddingBlock: 2,
                            cellPaddingInline: 8,
                        }
                    }
                }}
            >
                <div className="w-full flex-1 bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={columnsOrder} strategy={horizontalListSortingStrategy}>
                            <Table
                                rowKey={rowKey}
                                loading={loading}
                                dataSource={dataSource}
                                columns={displayColumns}
                                sticky
                                size="small"
                                scroll={scroll}
                                components={{ header: { cell: DraggableResizableHeaderCell } }}
                                pagination={pagination}
                                onChange={onChange}
                                onRow={onRow}
                                rowSelection={rowSelection}
                                className="custom-blue-table h-full flex-1"
                            />
                        </SortableContext>
                    </DndContext>
                </div>
            </ConfigProvider>

            <style>{`
                .ant-table-filter-dropdown-btns {
                    display: flex;
                    flex-direction: row-reverse;
                    justify-content: space-between;
                }
                .custom-blue-table .ant-spin-nested-loading,
                .custom-blue-table .ant-spin-container {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }
                .custom-blue-table .ant-table {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .custom-blue-table .ant-table-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .custom-blue-table .ant-table-body {
                    flex: 1;
                    overflow-y: auto !important;
                    max-height: none !important; 
                }
                
                /* ปรับหน้าตาเวลาลากยืดหดคอลัมน์ */
                .react-resizable {
                    position: relative;
                    background-clip: padding-box;
                }
                .react-resizable-handle {
                    position: absolute;
                    width: 10px;
                    height: 100%;
                    bottom: 0;
                    right: -5px;
                    cursor: col-resize;
                    z-index: 10;
                }

                /* ยกเลิกสีตอน Hover ทั้งแถว โดยให้เป็นสีขาวทึบแทน transparent เพื่อบังข้อมูลที่เลื่อนซ่อนอยู่ข้างหลัง */
                .custom-blue-table .ant-table-tbody > tr:hover > td,
                .custom-blue-table .ant-table-tbody > tr > td.ant-table-cell-row-hover {
                    background-color: #ffffff !important;
                }

                /* บังคับให้คอลัมน์ที่ถูก Fixed ซ้าย-ขวา มีพื้นหลังเป็นสีขาวทึบเสมอ */
                .custom-blue-table .ant-table-tbody > tr > td.ant-table-cell-fix-left,
                .custom-blue-table .ant-table-tbody > tr > td.ant-table-cell-fix-right {
                    background-color: #ffffff !important;
                }

                /* ไฮไลท์สีเหลืองเฉพาะช่องที่เมาส์ชี้ (คงฟีเจอร์เดิมไว้) */
                .custom-blue-table .ant-table-tbody > tr > td:hover {
                    background-color: #fef9c3 !important; 
                    transition: background-color 0.2s ease;
                }
            `}</style>
        </>
    );
}