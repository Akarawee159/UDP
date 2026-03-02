import React, { useState } from 'react';
import { Table, Button, Popover, Checkbox, ConfigProvider } from 'antd';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HolderOutlined } from '@ant-design/icons';

// Custom Header สำหรับ Drag & Drop
const DraggableHeaderCell = ({ id, dragDisabled, children, ...restProps }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: id || 'dummy-id',
    });

    const style = {
        ...restProps.style,
        transform: CSS.Transform.toString(transform && { ...transform, scaleX: 1 }),
        transition,
        ...(isDragging ? { position: 'relative', zIndex: 9999, opacity: 0.8, background: '#f8fafc' } : {}),
    };

    // หากไม่ได้กำหนด id หรือถูกกำหนดว่าห้ามลาก (dragDisabled) ให้แสดง th ปกติ
    if (!id || dragDisabled) {
        return <th {...restProps}>{children}</th>;
    }

    return (
        <th {...restProps} ref={setNodeRef} style={style} {...attributes} {...listeners} className={`${restProps.className} cursor-grab active:cursor-grabbing hover:bg-gray-200 transition-colors`}>
            <div className="flex items-center w-full">
                <HolderOutlined className="text-gray-400 mr-2 flex-shrink-0" />
                <div className="flex-1">{children}</div>
            </div>
        </th>
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
    // ดึง key จาก columns มาเป็นค่าตั้งต้น
    const initialKeys = baseColumns.map(c => c.key);
    const [columnsOrder, setColumnsOrder] = useState(initialKeys);
    const [visibleColumns, setVisibleColumns] = useState(initialKeys);

    // เซนเซอร์แยกการลาก/คลิก (ระยะเกิน 5px ค่อยลาก ทำให้คลิกเปิด Filter ได้ปกติ)
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

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

    // คัดกรองและเรียงคอลัมน์ที่จะแสดง
    const displayColumns = columnsOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => {
            const col = baseColumns.find(c => c.key === key);
            return {
                ...col,
                onHeaderCell: () => ({
                    id: col.key,
                    dragDisabled: col.dragDisabled // กำหนดจากหน้าแม่ได้ว่าคอลัมน์ไหนห้ามลาก
                }),
            };
        });

    // ปุ่ม Popover แสดง/ซ่อนคอลัมน์
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
                        <Checkbox key={col.key} value={col.key}>
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
            {/* เรียกฟังก์ชันที่ส่งมาจากไฟล์แม่ เพื่อแสดง Toolbar (ถ้ามี) */}
            {renderToolbar && renderToolbar(ColumnVisibilityPopover)}

            {/* Config สำหรับ Table โดยเฉพาะ */}
            <ConfigProvider
                theme={{
                    components: {
                        Table: {
                            headerBg: '#e5e7eb',
                            headerColor: '#000000',
                            borderColor: '#f1f5f9',
                            rowHoverBg: '#f8fafc',
                            cellPaddingBlock: 2, // ลดความสูงแนวตั้ง
                            cellPaddingInline: 8,
                        }
                    }
                }}
            >
                {/* จุดที่ 1: เพิ่ม flex flex-col ให้กับ wrapper div */}
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
                                components={{ header: { cell: DraggableHeaderCell } }}
                                pagination={pagination}
                                onChange={onChange}
                                onRow={onRow}
                                rowSelection={rowSelection}
                                // จุดที่ 2: เพิ่ม h-full flex-1 ให้ Table class
                                className="custom-blue-table h-full flex-1"
                            />
                        </SortableContext>
                    </DndContext>
                </div>
            </ConfigProvider>

            {/* จุดที่ 3: เพิ่ม CSS บังคับให้ไส้ในของ Table ยืดเต็มกรอบเสมอ */}
            <style>{`
                /* สลับปุ่ม Filter: OK มาซ้าย, Reset ไปขวา */
                .ant-table-filter-dropdown-btns {
                    display: flex;
                    flex-direction: row-reverse;
                    justify-content: space-between;
                }
                /* ปิดการ Hover ทั้งแถว */
                .custom-blue-table .ant-table-tbody > tr:hover > td,
                .custom-blue-table .ant-table-tbody > tr > td.ant-table-cell-row-hover {
                    background-color: transparent !important;
                }
                /* เปิดการ Hover เฉพาะช่องที่เมาส์ชี้ เป็นสี yellow-100 */
                .custom-blue-table .ant-table-tbody > tr > td:hover {
                    background-color: #fef9c3 !important; 
                    transition: background-color 0.2s ease;
                }

                /* ====== โค้ดที่เพิ่มเข้ามา เพื่อบังคับให้ตารางยืดเต็มพื้นที่ ====== */
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
                    /* ยกเลิก max-height ที่มาจาก prop scroll={y} เพื่อให้ Flex จัดการแทน */
                    max-height: none !important; 
                }
                /* ========================================================== */
            `}</style>
        </>
    );
}