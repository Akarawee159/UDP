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
    /* 2. Cell & Borders */
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
  `;

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    suppressMovable: false,
    filter: true,
    floatingFilter: false, // ปิดช่องค้นหาใต้ Header (ใช้ปุ่ม Filter ที่หัวตารางแทน)
    lockVisible: true,
    headerComponent: CustomHeader, // ใช้ Custom Header
    // ❌ ลบ menuTabs ออก (แก้ Error #200 เพราะเป็น Enterprise Feature)
    // ❌ ลบ suppressMenu ออก (แก้ Warning เพราะเลิกใช้แล้ว)
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
        rowHeight={24}
        headerHeight={40}

        // Responsive Logic (มือถือเลื่อนซ้ายขวาได้ Desktop บีบเต็มจอ)
        onGridReady={(params) => {
          if (window.innerWidth > 768) {
            params.api.sizeColumnsToFit();
          }
          if (props.onGridReady) props.onGridReady(params);
        }}

        {...props}
      />
    </div>
  );
};

export default DataTable;