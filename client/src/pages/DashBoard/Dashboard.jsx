import React, { useState } from 'react';
import { 
  Users, UserPlus, UserCheck, UserX, TrendingUp, 
  TrendingDown, Briefcase, Award, Calendar, Clock,
  Target, Activity, DollarSign, AlertCircle
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, 
  AreaChart, Area, Cell, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar
} from 'recharts';

// Mock Data
const departmentData = [
  { name: 'วิศวกรรม', value: 45, employees: 68, color: '#3b82f6' },
  { name: 'ฝ่ายขาย', value: 25, employees: 38, color: '#10b981' },
  { name: 'การตลาด', value: 15, employees: 23, color: '#f59e0b' },
  { name: 'HR', value: 10, employees: 15, color: '#ef4444' },
  { name: 'อื่นๆ', value: 5, employees: 6, color: '#8b5cf6' },
];

const monthlyTrendData = [
  { month: 'ม.ค.', เข้า: 8, ออก: 3, พนักงาน: 142 },
  { month: 'ก.พ.', เข้า: 5, ออก: 4, พนักงาน: 143 },
  { month: 'มี.ค.', เข้า: 7, ออก: 2, พนักงาน: 148 },
  { month: 'เม.ย.', เข้า: 6, ออก: 5, พนักงาน: 149 },
  { month: 'พ.ค.', เข้า: 9, ออก: 3, พนักงาน: 155 },
  { month: 'มิ.ย.', เข้า: 4, ออก: 2, พนักงาน: 157 },
];

const ageDistribution = [
  { range: '20-29', value: 30, fill: '#3b82f6' },
  { range: '30-39', value: 45, fill: '#10b981' },
  { range: '40-49', value: 20, fill: '#f59e0b' },
  { range: '50+', value: 5, fill: '#ef4444' },
];

const performanceData = [
  { name: 'ยอดเยี่ยม', value: 25, fill: '#10b981' },
  { name: 'ดีมาก', value: 45, fill: '#3b82f6' },
  { name: 'ดี', value: 25, fill: '#f59e0b' },
  { name: 'ปรับปรุง', value: 5, fill: '#ef4444' },
];

const attendanceData = [
  { day: 'จ.', rate: 98 },
  { day: 'อ.', rate: 95 },
  { day: 'พ.', rate: 97 },
  { day: 'พฤ.', rate: 96 },
  { day: 'ศ.', rate: 94 },
];

const leaveTypeData = [
  { type: 'ลาป่วย', count: 45, color: '#ef4444' },
  { type: 'ลาพักร้อน', count: 89, color: '#3b82f6' },
  { type: 'ลากิจ', count: 32, color: '#f59e0b' },
  { type: 'อื่นๆ', count: 12, color: '#8b5cf6' },
];

// Stat Card Component
const StatCard = ({ icon: Icon, title, value, change, trend, color, bgColor }) => (
  <div className={`${bgColor} rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:scale-105`}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
        <h3 className="text-3xl font-bold text-gray-800 mb-3">{value}</h3>
        {change && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span>{change}</span>
            <span className="text-gray-500 text-xs">จากเดือนก่อน</span>
          </div>
        )}
      </div>
      <div className={`${color} p-4 rounded-lg`}>
        <Icon size={28} className="text-white" />
      </div>
    </div>
  </div>
);

// Chart Card Wrapper
const ChartCard = ({ title, children, info }) => (
  <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 border border-gray-100">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-bold text-gray-800">{title}</h3>
      {info && (
        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {info}
        </span>
      )}
    </div>
    {children}
  </div>
);

function Dashboard() {
  const [timeRange, setTimeRange] = useState('6m');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">ระบบบริหารทรัพยากรบุคคล</h1>
        <p className="text-gray-600 flex items-center gap-2">
          <Calendar size={18} />
          วันที่ {new Date().toLocaleDateString('th-TH', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Users}
          title="พนักงานทั้งหมด"
          value="157"
          change="+8 คน"
          trend="up"
          color="bg-blue-500"
          bgColor="bg-blue-50"
        />
        <StatCard
          icon={UserPlus}
          title="พนักงานเข้าใหม่"
          value="9"
          change="+3 คน"
          trend="up"
          color="bg-green-500"
          bgColor="bg-green-50"
        />
        <StatCard
          icon={UserCheck}
          title="พนักงานทดลองงาน"
          value="12"
          change="+4 คน"
          trend="up"
          color="bg-orange-500"
          bgColor="bg-orange-50"
        />
        <StatCard
          icon={UserX}
          title="พนักงานลาออก"
          value="3"
          change="-1 คน"
          trend="down"
          color="bg-red-500"
          bgColor="bg-red-50"
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* Employee Trend Chart */}
        <ChartCard title="แนวโน้มพนักงาน" info="6 เดือนล่าสุด">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyTrendData}>
              <defs>
                <linearGradient id="colorพนักงาน" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '8px'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="พนักงาน" 
                stroke="#3b82f6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorพนักงาน)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Department Distribution */}
        <ChartCard title="การกระจายตามแผนก">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={departmentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} ${value}%`}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
              >
                {departmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* In/Out Trend */}
        <ChartCard title="พนักงานเข้า-ออก">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="เข้า" fill="#10b981" radius={[8, 8, 0, 0]} />
              <Bar dataKey="ออก" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        
        {/* Age Distribution */}
        <ChartCard title="การกระจายตามอายุ">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ageDistribution} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="range" type="category" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {ageDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Performance Distribution */}
        <ChartCard title="การประเมินผลงาน">
          <ResponsiveContainer width="100%" height={250}>
            <RadialBarChart 
              cx="50%" 
              cy="50%" 
              innerRadius="20%" 
              outerRadius="90%" 
              data={performanceData}
              startAngle={90}
              endAngle={-270}
            >
              <RadialBar
                minAngle={15}
                background
                clockWise
                dataKey="value"
                cornerRadius={10}
              />
              <Legend 
                iconSize={10} 
                layout="vertical" 
                verticalAlign="bottom" 
                align="center"
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              />
              <Tooltip />
            </RadialBarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Attendance Rate */}
        <ChartCard title="อัตราการมาทำงาน" info="สัปดาห์นี้">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis domain={[90, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="rate" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 5 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Leave Types */}
        <ChartCard title="สถิติการลา">
          <div className="space-y-4">
            {leaveTypeData.map((leave) => (
              <div key={leave.type}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">{leave.type}</span>
                  <span className="text-sm font-bold text-gray-800">{leave.count}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${(leave.count / 180) * 100}%`,
                      backgroundColor: leave.color 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Award className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-600">ค่าเฉลี่ยผลงาน</p>
              <p className="text-xl font-bold text-gray-800">4.2/5.0</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-100 p-3 rounded-lg">
              <Clock className="text-cyan-600" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-600">ชั่วโมง OT เฉลี่ย</p>
              <p className="text-xl font-bold text-gray-800">12.5 ชม.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-3 rounded-lg">
              <Target className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-600">บรรลุเป้าหมาย</p>
              <p className="text-xl font-bold text-gray-800">87%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all">
          <div className="flex items-center gap-3">
            <div className="bg-pink-100 p-3 rounded-lg">
              <Activity className="text-pink-600" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-600">อัตราคงอยู่</p>
              <p className="text-xl font-bold text-gray-800">94.2%</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Dashboard;