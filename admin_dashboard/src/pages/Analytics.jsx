import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { MessageSquare, Users, AlertCircle, Clock } from 'lucide-react';

const Analytics = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/admin/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error(err));
  }, []);

  // Mock data for charts
  const chatData = [
    { name: 'Senin', chats: 45, unresolved: 2 },
    { name: 'Selasa', chats: 52, unresolved: 0 },
    { name: 'Rabu', chats: 38, unresolved: 1 },
    { name: 'Kamis', chats: 65, unresolved: 4 },
    { name: 'Jumat', chats: 48, unresolved: 0 },
    { name: 'Sabtu', chats: 30, unresolved: 0 },
    { name: 'Minggu', chats: Math.max(10, stats?.total_sessions || 10), unresolved: stats?.total_unanswered || 0 },
  ];

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
      <div className={`p-4 rounded-xl ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Analytics Overview</h1>
        <p className="text-slate-500">Pantau performa Lexa Chatbot dan metrik pelanggan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Percakapan" 
          value={stats?.total_sessions || '-'} 
          icon={MessageSquare} 
          color="bg-blue-50 text-blue-600" 
        />
        <StatCard 
          title="Pertanyaan Belum Terjawab" 
          value={stats?.total_unanswered || '-'} 
          icon={AlertCircle} 
          color="bg-red-50 text-red-600" 
        />
        <StatCard 
          title="Waktu Respon Rata-rata" 
          value="1.2s" 
          icon={Clock} 
          color="bg-emerald-50 text-emerald-600" 
        />
        <StatCard 
          title="Pengguna Aktif (Bulan Ini)" 
          value="84" 
          icon={Users} 
          color="bg-purple-50 text-purple-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="font-semibold text-slate-800 mb-6">Tren Percakapan (7 Hari Terakhir)</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chatData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorChats" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="chats" name="Total Chat" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorChats)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Secondary Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="font-semibold text-slate-800 mb-6">Penyelesaian Pertanyaan</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chatData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                <Bar dataKey="chats" name="Terjawab" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                <Bar dataKey="unresolved" name="Tidak Terjawab" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
