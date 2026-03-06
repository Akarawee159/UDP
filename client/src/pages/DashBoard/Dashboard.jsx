import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calendar, AlertCircle, Box, PackageCheck, Truck } from 'lucide-react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

import api from '../../api';

const COLORS = {
  inStock: '#6b7280',     
  dispatched: '#16a34a',  
  damaged: '#f97316',     
  inactive1m: '#2563eb',  
  inactive2m: '#9333ea',  
  inactive3m: '#b91c1c'   
};

const StatCard = ({ icon: Icon, title, value, change, trend, color, bgColor }) => (
  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-gray-800">{value}</h3>
      {change && (
        <p className={`text-sm mt-2 flex items-center gap-1 ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
          {trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {change}
        </p>
      )}
    </div>
    <div className={`p-4 rounded-full ${bgColor} ${color.replace('bg-', 'text-')}`}>
      <Icon size={32} className={color.replace('bg-', 'text-')} />
    </div>
  </div>
);

// Custom Tooltip สำหรับแสดงข้อมูลตอนเอาเมาส์ชี้กราฟแท่ง
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload; 
    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-100 text-sm min-w-[220px]">
        <p className="font-bold text-gray-800 mb-3 border-b pb-2">รุ่น: {label}</p>
        <div className="space-y-1.5">
          <p className="flex justify-between font-bold text-gray-800">
            <span>จำนวนทั้งหมด:</span> <span>{data.total}</span>
          </p>
          <div className="my-1 border-t border-dashed border-gray-200"></div>
          <p className="flex justify-between text-gray-500">
            <span>คงคลัง:</span> <span>{data.inStock}</span>
          </p>
          <p className="flex justify-between text-green-500">
            <span>ใช้งาน:</span> <span>{data.dispatched}</span>
          </p>
          <p className="flex justify-between text-orange-500">
            <span>ชำรุด:</span> <span>{data.damaged}</span>
          </p>
          <div className="my-1 border-t border-dashed border-gray-200"></div>
          <p className="flex justify-between text-blue-500">
            <span>ไม่เคลื่อนไหว 1 เดือน:</span> <span>{data.inactive1m}</span>
          </p>
          <p className="flex justify-between text-purple-500">
            <span>ไม่เคลื่อนไหว 2 เดือน:</span> <span>{data.inactive2m}</span>
          </p>
          <p className="flex justify-between text-red-700">
            <span>ไม่เคลื่อนไหว 3 เดือน:</span> <span>{data.inactive3m}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

function Dashboard() {
  const [kpi, setKpi] = useState({ total: 0, inStock: 0, dispatched: 0, damaged: 0 });
  const [pieData, setPieData] = useState([]);
  const [barData, setBarData] = useState([]);

  const calculateInactiveDays = (dateString) => {
    if (!dateString) return 0;
    const lastUpdate = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today - lastUpdate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };

  const fetchDashboardData = async () => {
    try {
      const res = await api.get('/dashboard');

      if (res.data && res.data.success) {
        const rawData = res.data.data;

        // 1. KPI ด้านบนสุด
        const inStockCount = rawData.filter(item => String(item.asset_status) === '100').length;
        const dispatchedCount = rawData.filter(item => String(item.asset_status) === '101').length;
        const damagedCount = rawData.filter(item => String(item.asset_status) === '147').length;

        let inactive1mTotal = 0;
        let inactive2mTotal = 0;
        let inactive3mTotal = 0;

        rawData.forEach(item => {
          const inactiveDays = calculateInactiveDays(item.updated_at || item.scan_at || item.created_at);
          if (inactiveDays >= 90) inactive3mTotal++;
          else if (inactiveDays >= 60) inactive2mTotal++;
          else if (inactiveDays >= 30) inactive1mTotal++;
        });

        setKpi({
          total: rawData.length,
          inStock: inStockCount,
          dispatched: dispatchedCount,
          damaged: damagedCount,
          inactive1m: inactive1mTotal,
          inactive2m: inactive2mTotal,
          inactive3m: inactive3mTotal
        });

        // 2. ข้อมูลสำหรับ Pie Chart (ภาพรวมทั้งหมด)
        setPieData([
          { name: 'คงคลัง', value: inStockCount, color: COLORS.inStock },
          { name: 'ใช้งาน', value: dispatchedCount, color: COLORS.dispatched },
          { name: 'ชำรุด', value: damagedCount, color: COLORS.damaged },
          { name: 'ไม่เคลื่อนไหว 1 เดือน', value: inactive1mTotal, color: COLORS.inactive1m },
          { name: 'ไม่เคลื่อนไหว 2 เดือน', value: inactive2mTotal, color: COLORS.inactive2m },
          { name: 'ไม่เคลื่อนไหว 3 เดือน', value: inactive3mTotal, color: COLORS.inactive3m }
        ].filter(item => item.value > 0)); // กรองค่า 0 ออกเพื่อให้กราฟไม่แสดงส่วนที่ไม่มีข้อมูล

        // 3. ข้อมูลสำหรับ Bar Chart (แยกราย asset_model แต่รวมเป็นแท่งเดียว)
        const modelGroups = rawData.reduce((acc, item) => {
          const modelName = item.asset_model || 'ไม่ระบุรุ่น'; 
          
          if (!acc[modelName]) {
            acc[modelName] = { 
              name: modelName, total: 0, 
              inStock: 0, dispatched: 0, damaged: 0, 
              inactive1m: 0, inactive2m: 0, inactive3m: 0 
            };
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

        // แปลง Object ให้เป็น Array สำหรับ Recharts
        setBarData(Object.values(modelGroups));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={Box} title="กล่องทั้งหมด" value={kpi.total} color="bg-gray-500" bgColor="bg-gray-50" />
        <StatCard icon={Truck} title="ใช้งาน" value={kpi.dispatched} color="bg-green-500" bgColor="bg-green-50" />
        <StatCard icon={AlertCircle} title="ชำรุด" value={kpi.damaged} color="bg-orange-500" bgColor="bg-orange-50" />
        <StatCard icon={PackageCheck} title="คงคลัง" value={kpi.inStock} color="bg-blue-500" bgColor="bg-blue-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
      {/* ฝั่งซ้าย: Pie Chart */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm lg:col-span-1 flex flex-col">
        <h3 className="text-lg font-bold text-gray-800 mb-4">ภาพรวมสถานะและเคลื่อนไหว</h3>
        <div className="flex-1 min-h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={90}  // ขยายวงในให้ใหญ่ขึ้น (จากเดิม 60)
                outerRadius={130} // ขยายวงนอกให้ใหญ่ขึ้น (จากเดิม 90)
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              {/* นำเมาส์ไปชี้เพื่อดูข้อมูล */}
              <Tooltip /> 
              {/* แสดงรายละเอียดด้านล่างว่าแต่ละสีคืออะไร */}
              <Legend verticalAlign="bottom" height={36} /> 
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

        {/* ฝั่งขวา: Aging Chart (แยกราย asset_model แต่รวมเป็นแท่งเดียว) */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-800 mb-4">สถานะและการเคลื่อนไหวแยกตามโมเดล</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 20, right: 30, left: 0, bottom: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                {/* หมุนแกน X เผื่อกรณีที่มีชื่อรุ่นยาวๆ หรือมีหลายรุ่น */}
                <XAxis dataKey="name" height={60} tick={{ fontSize: 16, fontWeight: 'bold' }} />
                <YAxis />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                
                {/* สังเกตว่าใช้ stackId="a" เหมือนกันหมด เพื่อให้ต่อเป็นแท่งเดียวกัน */}
                <Bar maxBarSize={60} dataKey="inStock" name="คงคลัง" stackId="a" fill={COLORS.inStock} />
                <Bar maxBarSize={60} dataKey="dispatched" name="ใช้งาน" stackId="a" fill={COLORS.dispatched} />
                <Bar maxBarSize={60} dataKey="damaged" name="ชำรุด" stackId="a" fill={COLORS.damaged} />
                <Bar maxBarSize={60} dataKey="inactive1m" name="ไม่เคลื่อนไหว 1 เดือน" stackId="a" fill={COLORS.inactive1m} />
                <Bar maxBarSize={60} dataKey="inactive2m" name="ไม่เคลื่อนไหว 2 เดือน" stackId="a" fill={COLORS.inactive2m} />
                <Bar maxBarSize={60} dataKey="inactive3m" name="ไม่เคลื่อนไหว 3 เดือน" stackId="a" fill={COLORS.inactive3m} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Dashboard;