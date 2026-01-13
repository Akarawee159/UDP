import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { useParams } from 'react-router-dom';
import api from '../api';

export default function PdfViewer() {
  const { employee_code } = useParams();
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let url;

    (async () => {
      try {
        const res = await api.get(
          `/employee/code/${encodeURIComponent(employee_code)}/pdf`,
          { responseType: 'blob' }
        );
        if (!alive) return;
        url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        setSrc(url);
      } catch (err) {
        // ถ้าถูกยกเลิก/เปลี่ยนหน้า ไม่ต้องทำอะไร
        if (err?.code !== 'ERR_CANCELED') console.error(err);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [employee_code]);

  if (loading) return <Spin tip="กำลังสร้างเอกสาร PDF" fullscreen />;

  if (!src) return <div style={{ padding: 24 }}>ไม่พบไฟล์เอกสารสำหรับรหัส {employee_code}</div>;

  return (
    <iframe
      title={`employee-${employee_code}.pdf`}
      src={src}
      style={{ width: '100vw', height: '100vh', border: 'none' }}
    />
  );
}
