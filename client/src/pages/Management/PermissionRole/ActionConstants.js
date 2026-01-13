// src/pages/UserManagement/PermissionRole/ActionConstants.js

export const ACTION_MASTER = [
    {
        module: 'สร้างข้อมูลพนักงาน',
        key: 'trainings',
        options: [
            { label: 'สร้างได้', value: 'trainings:create' },
            { label: 'แก้ไขได้', value: 'trainings:update' },
            { label: 'ลบได้', value: 'trainings:delete' }
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