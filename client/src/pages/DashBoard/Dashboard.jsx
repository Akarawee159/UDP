import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Calendar, AlertCircle, Box,
  PackageCheck, Truck, MapPin, Filter, XCircle
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

import api from '../../api';

const COLORS = {
  inStock: '#3b82f6',     // Blue
  dispatched: '#10b981',  // Green
  damaged: '#ef4444',     // Red
  inactive1m: '#f59e0b',  // Yellow/Amber
  inactive2m: '#8b5cf6',  // Purple
  inactive3m: '#64748b'   // Slate
};

const StatCard = ({ icon: Icon, title, value, color, bgColor }) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
    <div>
      <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-gray-800">{value.toLocaleString()}</h3>
    </div>
    <div className={`p-4 rounded-xl ${bgColor} ${color}`}>
      <Icon size={28} />
    </div>
  </div>
);

// Custom Tooltip สำหรับกราฟแท่ง
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-gray-100 text-sm min-w-[240px]">
        <p className="font-bold text-gray-800 mb-3 border-b pb-2">{label}</p>
        <div className="space-y-2">
          <p className="flex justify-between font-bold text-gray-800 bg-gray-50 p-1.5 rounded">
            <span>จำนวนทั้งหมด:</span> <span>{data.total}</span>
          </p>
          <p className="flex justify-between text-blue-600 px-1.5">
            <span>คงคลัง:</span> <span className="font-semibold">{data.inStock}</span>
          </p>
          <p className="flex justify-between text-emerald-600 px-1.5">
            <span>ใช้งาน:</span> <span className="font-semibold">{data.dispatched}</span>
          </p>
          <p className="flex justify-between text-red-500 px-1.5">
            <span>ชำรุด:</span> <span className="font-semibold">{data.damaged}</span>
          </p>
          {(data.inactive1m > 0 || data.inactive2m > 0 || data.inactive3m > 0) && (
            <>
              <div className="my-1 border-t border-dashed border-gray-200"></div>
              {data.inactive1m > 0 && <p className="flex justify-between text-amber-500 px-1.5"><span>ไม่เคลื่อนไหว 1 เดือน:</span> <span>{data.inactive1m}</span></p>}
              {data.inactive2m > 0 && <p className="flex justify-between text-purple-500 px-1.5"><span>ไม่เคลื่อนไหว 2 เดือน:</span> <span>{data.inactive2m}</span></p>}
              {data.inactive3m > 0 && <p className="flex justify-between text-slate-500 px-1.5"><span>ไม่เคลื่อนไหว 3 เดือนขึ้นไป:</span> <span>{data.inactive3m}</span></p>}
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
};

function Dashboard() {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter States (เพิ่ม location)
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    model: 'all',
    status: 'all',
    location: 'all'
  });

  const [availableModels, setAvailableModels] = useState([]);
  const [availableLocations, setAvailableLocations] = useState([]); // เก็บรายชื่อพื้นที่ทั้งหมด

  const calculateInactiveDays = (dateString) => {
    if (!dateString) return 0;
    const lastUpdate = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today - lastUpdate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // ส่ง query params เฉพาะวันที่ไปให้ backend
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const res = await api.get(`/dashboard?${params.toString()}`);

      if (res.data && res.data.success) {
        setRawData(res.data.data);

        // ดึงรายชื่อโมเดลทั้งหมดที่ไม่มีค่าว่าง มาทำเป็นตัวเลือก
        const models = [...new Set(res.data.data.map(item => item.asset_model).filter(Boolean))];
        setAvailableModels(models.sort());

        // ดึงรายชื่อพื้นที่ทั้งหมดที่ไม่มีค่าว่าง มาทำเป็นตัวเลือก
        const locations = [...new Set(res.data.data.map(item => item.current_address).filter(Boolean))];
        setAvailableLocations(locations.sort());
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const handleSocketUpdate = () => fetchDashboardData();
    window.addEventListener('hrms:registerasset-upsert', handleSocketUpdate);
    window.addEventListener('hrms:registerasset-delete', handleSocketUpdate);
    return () => {
      window.removeEventListener('hrms:registerasset-upsert', handleSocketUpdate);
      window.removeEventListener('hrms:registerasset-delete', handleSocketUpdate);
    };
  }, [filters.startDate, filters.endDate]); // ดึงข้อมูลใหม่จาก DB เมื่อเปลี่ยนวันที่

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '', model: 'all', status: 'all', location: 'all' });
  };

  // ----------------------------------------------------------------
  // Data Processing (ใช้ useMemo เพื่อคำนวณใหม่เมื่อ rawData หรือ filter เปลี่ยน)
  // ----------------------------------------------------------------
  const { kpi, pieData, barData, addressData } = useMemo(() => {
    // 1. กรองข้อมูลจาก Model, Status และ Location ที่ผู้บริหารเลือก
    let filteredData = rawData;

    if (filters.model !== 'all') {
      filteredData = filteredData.filter(item => item.asset_model === filters.model);
    }

    if (filters.location !== 'all') {
      filteredData = filteredData.filter(item => item.current_address === filters.location);
    }

    if (filters.status !== 'all') {
      if (filters.status === '100') filteredData = filteredData.filter(item => String(item.asset_status) === '100');
      if (filters.status === '101') filteredData = filteredData.filter(item => String(item.asset_status) === '101');
      if (filters.status === '147') filteredData = filteredData.filter(item => String(item.asset_status) === '147');
      if (filters.status === 'inactive1m') {
        filteredData = filteredData.filter(item => calculateInactiveDays(item.updated_at || item.scan_at || item.created_at) >= 30);
      }
      if (filters.status === 'inactive2m') {
        filteredData = filteredData.filter(item => calculateInactiveDays(item.updated_at || item.scan_at || item.created_at) >= 60);
      }
      if (filters.status === 'inactive3m') {
        filteredData = filteredData.filter(item => calculateInactiveDays(item.updated_at || item.scan_at || item.created_at) >= 90);
      }
    }

    // 2. คำนวณ KPI
    const inStockCount = filteredData.filter(item => String(item.asset_status) === '100').length;
    const dispatchedCount = filteredData.filter(item => String(item.asset_status) === '101').length;
    const damagedCount = filteredData.filter(item => String(item.asset_status) === '147').length;

    let inactive1mTotal = 0, inactive2mTotal = 0, inactive3mTotal = 0;
    filteredData.forEach(item => {
      const inactiveDays = calculateInactiveDays(item.updated_at || item.scan_at || item.created_at);
      if (inactiveDays >= 90) inactive3mTotal++;
      else if (inactiveDays >= 60) inactive2mTotal++;
      else if (inactiveDays >= 30) inactive1mTotal++;
    });

    const calculatedKpi = {
      total: filteredData.length,
      inStock: inStockCount, dispatched: dispatchedCount, damaged: damagedCount,
      inactive1m: inactive1mTotal, inactive2m: inactive2mTotal, inactive3m: inactive3mTotal
    };

    // 3. ข้อมูล Pie Chart
    const calculatedPie = [
      { name: 'คงคลัง', value: inStockCount, color: COLORS.inStock },
      { name: 'ใช้งาน', value: dispatchedCount, color: COLORS.dispatched },
      { name: 'ชำรุด', value: damagedCount, color: COLORS.damaged },
      { name: 'ไม่เคลื่อนไหว 1 เดือน', value: inactive1mTotal, color: COLORS.inactive1m },
      { name: 'ไม่เคลื่อนไหว 2 เดือน', value: inactive2mTotal, color: COLORS.inactive2m },
      { name: 'ไม่เคลื่อนไหว 3 เดือนขึ้นไป', value: inactive3mTotal, color: COLORS.inactive3m }
    ].filter(item => item.value > 0);

    // 4. ข้อมูล Bar Chart (โมเดล)
    const modelGroups = filteredData.reduce((acc, item) => {
      const modelName = item.asset_model || 'ไม่ระบุรุ่น';
      if (!acc[modelName]) {
        acc[modelName] = { name: modelName, total: 0, inStock: 0, dispatched: 0, damaged: 0, inactive1m: 0, inactive2m: 0, inactive3m: 0 };
      }
      acc[modelName].total++;
      if (String(item.asset_status) === '100') acc[modelName].inStock++;
      if (String(item.asset_status) === '101') acc[modelName].dispatched++;
      if (String(item.asset_status) === '147') acc[modelName].damaged++;

      const inactiveDays = calculateInactiveDays(item.updated_at || item.scan_at || item.created_at);
      if (inactiveDays >= 90) acc[modelName].inactive3m++;
      else if (inactiveDays >= 60) acc[modelName].inactive2m++;
      else if (inactiveDays >= 30) acc[modelName].inactive1m++;

      return acc;
    }, {});
    const calculatedBar = Object.values(modelGroups).sort((a, b) => b.total - a.total);

    // 5. ข้อมูล Address Chart (แยกสถานะในแต่ละโลเคชั่น)
    const addressGroups = filteredData.reduce((acc, item) => {
      const address = item.current_address || 'ไม่ระบุที่อยู่';
      if (!acc[address]) {
        acc[address] = { address, total: 0, inStock: 0, dispatched: 0, damaged: 0, inactive1m: 0, inactive2m: 0, inactive3m: 0 };
      }
      acc[address].total++;
      if (String(item.asset_status) === '100') acc[address].inStock++;
      if (String(item.asset_status) === '101') acc[address].dispatched++;
      if (String(item.asset_status) === '147') acc[address].damaged++;

      const inactiveDays = calculateInactiveDays(item.updated_at || item.scan_at || item.created_at);
      if (inactiveDays >= 90) acc[address].inactive3m++;
      else if (inactiveDays >= 60) acc[address].inactive2m++;
      else if (inactiveDays >= 30) acc[address].inactive1m++;

      return acc;
    }, {});
    const calculatedAddress = Object.values(addressGroups).sort((a, b) => b.total - a.total);

    return { kpi: calculatedKpi, pieData: calculatedPie, barData: calculatedBar, addressData: calculatedAddress };
  }, [rawData, filters]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">

      {/* Header & Filter Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Filter size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Executive Dashboard</h2>
              <p className="text-sm text-gray-500">รายงานสถานะกล่องและความเคลื่อนไหว</p>
            </div>
          </div>

          <button
            onClick={clearFilters}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            <XCircle size={16} /> ล้างตัวกรอง
          </button>
        </div>

        {/* ปรับ Grid เป็น 5 คอลัมน์บนจอใหญ่ เพื่อใส่ Filter พื้นที่เพิ่มเข้าไป */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">

          {/* Model Dropdown */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">เลือกโมเดล</label>
            <select
              name="model" value={filters.model} onChange={handleFilterChange}
              className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="all">ดูทุกรุ่นทั้งหมด</option>
              {availableModels.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          {/* Location Dropdown (ใหม่) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">เลือกพื้นที่</label>
            <select
              name="location" value={filters.location} onChange={handleFilterChange}
              className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="all">ดูทุกพื้นที่ทั้งหมด</option>
              {availableLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">มุมมองที่ต้องการดู</label>
            <select
              name="status" value={filters.status} onChange={handleFilterChange}
              className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="all">ดูสถานะทั้งหมด</option>
              <option value="100">เฉพาะ คงคลัง</option>
              <option value="101">เฉพาะ ใช้งานอยู่</option>
              <option value="147">เฉพาะ ชำรุด</option>
              <option value="inactive1m">เฉพาะ ไม่เคลื่อนไหว 1 เดือน</option>
              <option value="inactive2m">เฉพาะ ไม่เคลื่อนไหว 2 เดือน</option>
              <option value="inactive3m">เฉพาะ ไม่เคลื่อนไหว 3 เดือนขึ้นไป</option>
            </select>
          </div>

          {/* Date Picker (Start) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">วันที่เริ่มต้น</label>
            <input
              type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange}
              className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Date Picker (End) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">วันที่สิ้นสุด</label>
            <input
              type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange}
              className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard icon={Box} title="กล่องทั้งหมด (จากที่กรอง)" value={kpi.total} color="text-slate-600" bgColor="bg-slate-100" />
        <StatCard icon={PackageCheck} title="คงคลัง (พร้อมใช้)" value={kpi.inStock} color="text-blue-600" bgColor="bg-blue-100" />
        <StatCard icon={Truck} title="กำลังใช้งาน" value={kpi.dispatched} color="text-emerald-600" bgColor="bg-emerald-100" />
        <StatCard icon={AlertCircle} title="ชำรุด" value={kpi.damaged} color="text-red-500" bgColor="bg-red-100" />
      </div>

      {loading && <div className="text-center py-10 text-gray-500 animate-pulse">กำลังโหลดข้อมูล...</div>}

      {!loading && (
        <div className="flex flex-col gap-6">

          {/* Row 1: Model Status (Bar Chart with Scrollbar) */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-2">ข้อมูลเชิงลึกแยกตามโมเดล (Model Insights)</h3>
            <p className="text-sm text-gray-500 mb-4">คุณสามารถเลื่อนซ้าย-ขวาที่ตัวกราฟเพื่อดูโมเดลอื่นๆ ได้</p>

            <div className="overflow-x-auto overflow-y-hidden w-full custom-scrollbar pb-2">
              <div style={{ minWidth: `${Math.max(1000, barData.length * 60)}px`, height: '400px' }}>
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" height={60} tick={{ fontSize: 13, fontWeight: 'bold' }} />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                      <Legend wrapperStyle={{ paddingBottom: '20px' }} iconType="circle" />

                      <Bar maxBarSize={50} dataKey="inStock" name="คงคลัง" stackId="a" fill={COLORS.inStock} />
                      <Bar maxBarSize={50} dataKey="dispatched" name="ใช้งาน" stackId="a" fill={COLORS.dispatched} />
                      <Bar maxBarSize={50} dataKey="damaged" name="ชำรุด" stackId="a" fill={COLORS.damaged} />
                      <Bar maxBarSize={50} dataKey="inactive1m" name="ไม่เคลื่อนไหว 1 เดือน" stackId="a" fill={COLORS.inactive1m} />
                      <Bar maxBarSize={50} dataKey="inactive2m" name="ไม่เคลื่อนไหว 2 เดือน" stackId="a" fill={COLORS.inactive2m} />
                      <Bar maxBarSize={50} dataKey="inactive3m" name="ไม่เคลื่อนไหว 3 เดือนขึ้นไป" stackId="a" fill={COLORS.inactive3m} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-400">ไม่มีข้อมูลโมเดลสำหรับเงื่อนไขนี้</div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Pie Chart & Location Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Pie Chart */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm col-span-1">
              <h3 className="text-lg font-bold text-gray-800 mb-2">สัดส่วนสถานะ</h3>
              <p className="text-sm text-gray-500 mb-4">ภาพรวมของกล่องตามเงื่อนไขที่เลือก</p>
              <div className="h-[300px]">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={4} dataKey="value">
                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value) => [value, 'จำนวน']} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">ไม่มีข้อมูลสำหรับเงื่อนไขนี้</div>
                )}
              </div>
            </div>

            {/* Location Chart (Stacked & Scrollable) */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm col-span-1 lg:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="text-blue-500" size={24} />
                <h3 className="text-lg font-bold text-gray-800">ความเคลื่อนไหวรายพื้นที่ (Location Status)</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">แสดงสถานะของกล่องที่อยู่ในแต่ละสถานที่ปัจจุบัน คุณสามารถเลื่อนซ้าย-ขวาเพื่อดูเพิ่มเติมได้</p>

              <div className="overflow-x-auto overflow-y-hidden w-full custom-scrollbar pb-2">
                <div style={{ minWidth: `${Math.max(600, addressData.length * 60)}px`, height: '300px' }}>
                  {addressData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={addressData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="address" tick={{ fontSize: 12, fontWeight: 'bold' }} interval={0} height={40} />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                        <Legend wrapperStyle={{ paddingTop: '16px' }} iconType="circle" />

                        <Bar maxBarSize={40} dataKey="inStock" name="คงคลัง" stackId="a" fill={COLORS.inStock} />
                        <Bar maxBarSize={40} dataKey="dispatched" name="ใช้งาน" stackId="a" fill={COLORS.dispatched} />
                        <Bar maxBarSize={40} dataKey="damaged" name="ชำรุด" stackId="a" fill={COLORS.damaged} />
                        <Bar maxBarSize={40} dataKey="inactive1m" name="ไม่เคลื่อนไหว 1 เดือน" stackId="a" fill={COLORS.inactive1m} />
                        <Bar maxBarSize={40} dataKey="inactive2m" name="ไม่เคลื่อนไหว 2 เดือน" stackId="a" fill={COLORS.inactive2m} />
                        <Bar maxBarSize={40} dataKey="inactive3m" name="ไม่เคลื่อนไหว 3 เดือนขึ้นไป" stackId="a" fill={COLORS.inactive3m} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">ไม่มีข้อมูลที่อยู่สำหรับเงื่อนไขนี้</div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default Dashboard;