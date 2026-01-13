import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Modal, Form, Input, Select, App, Button, Flex, Grid } from 'antd';
import {
  BranchesOutlined,
  IdcardOutlined,
  TagOutlined,
  ApartmentOutlined
} from '@ant-design/icons';
import api from "../../../../api";

function ModalCreate() {
        // ✅ 2. โค้ดส่วนนี้จะทำงานได้แล้ว (เพราะเรา import Grid มาแล้ว)
        // และยังคงฟังก์ชั่นเดิมไว้ตามที่คุณต้องการ
        const screens = Grid.useBreakpoint();
        const isMd = !!screens.md;
    
        const containerStyle = useMemo(() => ({
            margin: isMd ? '-8px' : '0',
            padding: isMd ? '16px' : '12px',
        }), [isMd]);

  return (
    <div style={containerStyle}>
      {/* ✅ 3. เปลี่ยนหัวข้อให้สื่อความหมาย */}
      <h1>เพิ่มพนักงาน</h1>
      
      {/* คุณสามารถเริ่มสร้างฟอร์มเพิ่มพนักงาน
        (Form, Input, Select, etc.) 
        ได้ที่นี่ในอนาคต
      */}
    </div>
  )
}

export default ModalCreate;