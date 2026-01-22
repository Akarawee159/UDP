// src/hooks/usePermission.js
import { useState, useEffect, useCallback } from 'react';
import api from '../api';

export const usePermission = () => {
    const [myPermissions, setMyPermissions] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchPermissions = async () => {
        try {
            const res = await api.get('/permission/my-menus');
            if (res.data?.success) {
                const { actionPermissions, groupName } = res.data.data || {};
                setMyPermissions(actionPermissions || []);
                // เช็คว่าเป็น Administrator หรือไม่
                setIsAdmin(String(groupName || '').toLowerCase() === 'administrator');
            }
        } catch (err) {
            console.error("Error fetching permissions:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPermissions();
    }, []);

    // ฟังก์ชัน canUse สำหรับเช็คสิทธิ์
    const canUse = useCallback((action) => {
        // ถ้าข้อมูลยังโหลดไม่เสร็จ ให้ return false ไปก่อน หรือจะจัดการแบบอื่นก็ได้
        if (loading) return false;

        return isAdmin || myPermissions.includes(action);
    }, [isAdmin, myPermissions, loading]);

    // Return สิ่งที่จำเป็นออกไปใช้งาน
    return { canUse, loading, isAdmin, myPermissions, refreshPermissions: fetchPermissions };
};