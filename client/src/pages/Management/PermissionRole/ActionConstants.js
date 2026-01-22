// src/pages/UserManagement/PermissionRole/ActionConstants.js

export const ACTION_MASTER = [
    {
        module: 'จัดการผู้ใช้งาน',
        key: '201',
        options: [
            { label: 'เพิ่มผู้ใช้งาน', value: '201:create' },
            { label: 'เคลียร์สถานะ', value: '201:clear' },
            { label: 'ระงับการใช้งาน', value: '201:ban' },
            { label: 'กำหนดกลุ่มสิทธิ', value: '201:update' },
            { label: 'รีเซ็ตรหัสผ่าน', value: '201:reset' },
            { label: 'ลบผู้ใช้งาน', value: '201:delete' },
        ]
    },
    {
        module: 'สร้างข้อมูลกล่อง',
        key: 'dochistory',
        options: [
            { label: 'สร้างได้', value: 'dochistory:create' },
            { label: 'แก้ไขได้', value: 'dochistory:update' },
            { label: 'ลบได้', value: 'dochistory:delete' }
        ]
    },
    // อนาคตเพิ่ม Module อื่นต่อท้ายตรงนี้ได้เลย
    // {
    //     module: 'ข้อมูลพนักงาน (Employee)',
    //     key: 'employee',
    //     options: [
    //         { label: 'Export PDF', value: 'employee:export' }
    //     ]
    // }
];