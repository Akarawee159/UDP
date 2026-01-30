import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

import CustomHeader from './CustomHeader';
import { LOCALE_TEXT_TH } from './constants';

// Register Module
ModuleRegistry.registerModules([AllCommunityModule]);

const DataTable = ({
  rowData,
  columnDefs,
  loading,
  ...props
}) => {

  const gridStyle = `
    /* 1. Header Setting */
    .ag-theme-alpine .ag-header {
      background-color: #e2e8f0; 
      border-bottom: 2px solid #cbd5e1;
    }
    .ag-theme-alpine .ag-header-cell {
      padding-left: 8px !important;
      padding-right: 8px !important;
    }
    .ag-theme-alpine .ag-header-cell-text {
      color: #000000 !important;
      font-weight: 600;
    }
    /* 2. Cell & Borders (ตรงนี้คือสาเหตุที่สีไม่เปลี่ยน เพราะมี !important) */
    .ag-theme-alpine .ag-cell,
    .ag-theme-alpine .ag-header-cell {
      border-right: 1px solid #cbd5e1 !important;
      color: #000000 !important; 
      display: flex;
      align-items: center;
    }
    /* 3. Cell Hover */
    .ag-theme-alpine .ag-row-hover {
      background-color: transparent !important; 
    }
    .ag-theme-alpine .ag-cell:hover {
      background-color: #fecaca !important; 
      cursor: default; 
    }
    /* 4. Selection Style */
    .ag-theme-alpine .ag-row-selected {
      background-color: #fed7aa !important;
      border-color: #fdba74 !important;
    }
    .ag-theme-alpine .ag-row-selected .ag-cell {
      background-color: #fed7aa !important;
    }
    .ag-theme-alpine .ag-row-selected::before {
        display: none !important;
    }
    /* 5. Pagination Font */
    .ag-theme-alpine .ag-paging-panel {
      border-top: 1px solid #cbd5e1;
      font-family: 'Sarabun', sans-serif;
    }
    /* 6. Scrollbar */
    .ag-body-horizontal-scroll-viewport {
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch;
    }
    /* 7. แก้ไข CSS สำหรับจัดกึ่งกลาง Header Group */
    .ag-theme-alpine .header-group-center .ag-header-group-cell-label {
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      width: 100% !important;
      flex: 1 !important;
    }

    /* 8. (เพิ่มใหม่) Header Group สีแดง */
    .ag-theme-alpine .header-group-red {
        background-color: #ef4444 !important; /* red-500 */
        border-bottom: 1px solid #dc2626 !important;
    }
    
    /* เปลี่ยนสีตัวอักษรใน Group Header เป็นสีขาว */
    .ag-theme-alpine .header-group-red .ag-header-group-cell-label,
    .ag-theme-alpine .header-group-red span {
        color: #ffffff !important;
        font-weight: bold !important;
    }
    
    /* เปลี่ยนสี icon (ลูกศรย่อ/ขยาย) เป็นสีขาวถ้ามี */
    .ag-theme-alpine .header-group-red .ag-header-icon {
        color: #ffffff !important;
    }
    
    /* 9. (เพิ่มใหม่) Custom Cell Colors Override */
    /* ต้องระบุเจาะจงและใช้ !important เพื่อชนะ color: #000000 ด้านบน */
    .ag-theme-alpine .cell-blue-bold { color: #2563eb !important; font-weight: bold !important; }
    .ag-theme-alpine .cell-green-bold { color: #16a34a !important; font-weight: bold !important; }
    .ag-theme-alpine .cell-orange-bold { color: #f97316 !important; font-weight: bold !important; }
    .ag-theme-alpine .cell-red-bold { color: #dc2626 !important; font-weight: bold !important; }
    
    /* ------------------------------------------------------- */
    /* 10. (เพิ่มใหม่ล่าสุด) บังคับ Header Checkbox ให้อยู่ตรงกลาง */
    /* ------------------------------------------------------- */
    .ag-theme-alpine .header-center-checkbox .ag-header-select-all {
        justify-content: center !important;
        width: 180% !important;
        margin-right: 0 !important; /* ลบ margin ที่อาจจะดันให้เบี้ยว */
    }
    
    /* กรณีมี label ว่างๆ กวนใจ ให้ซ่อน หรือจัดระเบียบ */
    .ag-theme-alpine .header-center-checkbox .ag-header-cell-label {
        justify-content: center !important;
    }
  `;

  const defaultColDef = useMemo(() => ({
    sortable: false, // 🔴 แก้เป็น false (ปิด sort ทุกคอลัมน์เป็นค่าเริ่มต้น)
    resizable: true,
    suppressMovable: false,
    filter: false,   // 🔴 แก้เป็น false (ปิด filter ทุกคอลัมน์เป็นค่าเริ่มต้น)
    floatingFilter: false,
    lockVisible: true,
    headerComponent: CustomHeader,
    headerComponentParams: { align: 'center' },
  }), []);

  return (
    <div className="ag-theme-alpine w-full h-full relative">
      {/* Inject CSS */}
      <style>{gridStyle}</style>

      <AgGridReact
        // ✅ ใส่ theme="legacy" เพื่อแก้ Error #239 (ให้ใช้ CSS แบบเดิมได้)
        theme="legacy"

        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}

        // Pagination
        pagination={true}
        paginationPageSize={30}
        paginationPageSizeSelector={[30, 50, 100]}
        localeText={LOCALE_TEXT_TH}

        // Selection (แก้ Warning deprecated string)
        rowSelection={{
          mode: 'singleRow',
          checkboxes: false,
          headerCheckbox: false
        }}

        animateRows={true}
        rowHeight={26}
        headerHeight={40}

        // Responsive Logic (มือถือเลื่อนซ้ายขวาได้ Desktop บีบเต็มจอ)
        onGridReady={(params) => {
          // if (window.innerWidth > 768) {
          //   params.api.sizeColumnsToFit();
          // }
          if (props.onGridReady) props.onGridReady(params);
        }}

        {...props}
      />
    </div>
  );
};

export default DataTable;