import React, { useRef } from 'react';
import { Dropdown } from 'antd';
import {
    SortAscendingOutlined,
    SortDescendingOutlined,
    ClearOutlined,
    FilterFilled,
    SwapOutlined
} from '@ant-design/icons';

const CustomHeader = (props) => {
    const { column, displayName, setSort, showColumnMenu, align } = props;
    const menuRef = useRef(null);

    const sort = column.getSort();
    const isFilterAllowed = column.isFilterAllowed();

    const items = [
        {
            key: 'asc',
            label: 'เรียงจากน้อยไปมาก',
            icon: <SortAscendingOutlined className="text-blue-600" />,
            onClick: () => setSort('asc'),
        },
        {
            key: 'desc',
            label: 'เรียงจากมากไปน้อย',
            icon: <SortDescendingOutlined className="text-blue-600" />,
            onClick: () => setSort('desc'),
        },
        { type: 'divider' },
        {
            key: 'reset',
            label: 'ค่าเริ่มต้น (รีเซ็ต)',
            icon: <ClearOutlined className="text-gray-500" />,
            onClick: () => setSort(null),
        },
    ];

    return (
        <div className="flex items-center justify-between w-full h-full">
            <div
                onClick={() => props.progressSort()}
                className={`flex-1 cursor-pointer flex items-center gap-1 overflow-hidden ${align === 'center' ? 'justify-center' : ''}`}
            >
                <span className="truncate">{displayName}</span>
                {sort === 'asc' && <SortAscendingOutlined className="text-blue-600 text-xs" />}
                {sort === 'desc' && <SortDescendingOutlined className="text-blue-600 text-xs" />}
            </div>

            <div className="flex items-center gap-1 ml-2">
                <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
                    <div className="cursor-pointer hover:bg-gray-200 p-1 rounded transition-colors text-gray-500 flex items-center justify-center" title="ตัวเลือกการเรียง">
                        <SwapOutlined rotate={90} style={{ fontSize: '12px' }} />
                    </div>
                </Dropdown>

                {isFilterAllowed && (
                    <div
                        ref={menuRef}
                        onClick={(e) => {
                            e.stopPropagation();
                            showColumnMenu(menuRef.current);
                        }}
                        className={`cursor-pointer hover:bg-gray-200 p-1 rounded transition-colors flex items-center justify-center ${column.isFilterActive() ? 'text-blue-600' : 'text-gray-400'}`}
                        title="กรองข้อมูล"
                    >
                        <FilterFilled style={{ fontSize: '12px' }} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomHeader;