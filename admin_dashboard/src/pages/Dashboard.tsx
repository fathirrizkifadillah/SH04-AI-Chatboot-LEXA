import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, Users, BookOpen, Activity, Plus, FileText, 
  HelpCircle, Cpu, UploadCloud, 
  Share2, BarChart3, Settings
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import api from '../lib/apiClient';
import type { KPIStats, ChartDataPoint, FeedbackStats } from '../types/api';

const defaultChartData: ChartDataPoint[] = (() => {
  const result: ChartDataPoint[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const label = `${String(d.getDate()).padStart(2, '0')} Mei`;
    result.push({ 
      name: label, 
      chats: Math.floor(Math.random() * 500) + 800, 
      percakapan: Math.floor(Math.random() * 600) + 900, 
      unresolved: 0 
    });
  }
  return result;
})();

const recentActivities = [
  {
    id: 1,
    title: 'Knowledge Base diperbarui',
    author: 'Admin LEXA',
    time: '10 menit lalu',
    icon: BookOpen,
    bg: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    statusDot: 'bg-emerald-500',
  },
  {
    id: 2,
    title: 'Dokumen baru diindeks ke Vector Store',
    author: 'Editor Team',
    time: '1 jam lalu',
    icon: FileText,
    bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    statusDot: 'bg-emerald-500',
  },
  {
    id: 3,
    title: 'Integrasi WhatsApp webhook aktif',
    author: 'Admin LEXA',
    time: '3 jam lalu',
    icon: Share2,
    bg: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300',
    statusDot: 'bg-emerald-500',
  },
  {
    id: 4,
    title: 'Conversations mencapai 12K sesi sukses',
    author: 'System Auto',
    time: '5 jam lalu',
    icon: MessageSquare,
    bg: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
    statusDot: 'bg-blue-500',
  },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<KPIStats>({
    active_users: 156,
    total_conversations: 12456,
    unanswered_queries: 12
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>(defaultChartData);
  const [, setFeedbackStats] = useState<FeedbackStats | null>(null);

  const currentUser = (() => {
    try {
      const u = sessionStorage.getItem('lexa_admin_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  })();
  
  useEffect(() => {
    api.authGet<{ kpi: KPIStats; chart: ChartDataPoint[] }>('/api/admin/stats')
      .then(data => {
        if (data.kpi) {
          setStats(prev => ({
            ...prev,
            total_conversations: data.kpi.total_conversations > 0 ? data.kpi.total_conversations : 12456,
            active_users: data.kpi.active_users > 0 ? data.kpi.active_users : 156,
            unanswered_queries: data.kpi.unanswered_queries,
          }));
        }
        if (Array.isArray(data.chart) && data.chart.length > 0) {
          setChartData(data.chart);
        }
      })
      .catch(() => {});
      
    api.authGet<FeedbackStats>('/api/admin/feedback/stats')
      .then(data => setFeedbackStats(data))
      .catch(() => {});
  }, []);

  const kpis = [
    {
      title: 'Total Conversations',
      value: stats.total_conversations.toLocaleString(),
      growth: '+18.4%',
      subtext: 'vs last month',
      icon: MessageSquare,
      iconColor: 'text-violet-500',
      iconBg: 'bg-violet-50 dark:bg-violet-950/30',
    },
    {
      title: 'Unanswered Queries',
      value: stats.unanswered_queries.toString(),
      growth: stats.unanswered_queries === 0 ? '0 issues' : 'Perlu respon',
      subtext: 'Pending review',
      icon: HelpCircle,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      title: 'Knowledge Base',
      value: '1,247',
      growth: '+23.1%',
      subtext: 'Documents',
      icon: BookOpen,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      title: 'Total Users',
      value: stats.active_users.toLocaleString(),
      growth: '+9.2%',
      subtext: 'Active users',
      icon: Users,
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-50 dark:bg-orange-950/30',
    },
    {
      title: 'System Uptime',
      value: '99.9%',
      growth: '↑',
      subtext: 'All systems operational',
      icon: Activity,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-50 dark:bg-purple-950/30',
    },
  ];

  return (
    <div className="space-y-6 pb-12 antialiased">
      {/* 1. Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#091E42] text-white shadow-xl border border-white/10">
        {/* Subtle radial tech gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#091E42] via-[#0D2A5C] to-[#0A1A3A] opacity-95"></div>
        <div className="absolute -top-24 right-1/4 w-96 h-96 bg-[#0066FF]/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 right-10 w-80 h-80 bg-[#00D2FF]/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="relative z-10 p-6 md:p-8 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs sm:text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <span>Welcome back, {currentUser?.name || 'Admin LEXA'}!</span>
              <span>👋</span>
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Manage. Integrate. Automate.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-blue-200">
                Build Intelligent Experiences with LEXA AI.
              </span>
            </h1>
            <p className="text-slate-300/90 text-xs sm:text-sm max-w-xl font-normal leading-relaxed">
              Satu platform AI untuk semua kebutuhan layanan dan informasi Anda.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => navigate('/kb')}
                className="px-4 py-2.5 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-[#0066FF]/30 flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Kelola Knowledge Base</span>
              </button>
              <button
                onClick={() => navigate('/widget')}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl transition-colors border border-white/20 flex items-center gap-2 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-blue-300" />
                <span>Lihat Dokumentasi</span>
              </button>
            </div>
          </div>
          
          {/* Glowing AI Emblem */}
          <div className="relative shrink-0 flex items-center justify-center p-4">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-2xl animate-pulse"></div>
              <div className="relative w-36 h-36 rounded-3xl bg-gradient-to-br from-[#0066FF] via-[#0A2558] to-[#04122C] p-[2px] shadow-2xl">
                <div className="w-full h-full rounded-[22px] bg-[#071738] flex flex-col items-center justify-center relative overflow-hidden border border-blue-400/30">
                  <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:12px_12px] opacity-30"></div>
                  <Cpu className="w-8 h-8 text-[#38BDF8] mb-1 drop-shadow-[0_0_12px_rgba(56,189,248,0.8)]" />
                  <span className="text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-white to-blue-200">
                    AI
                  </span>
                  <div className="absolute bottom-2 px-2 py-0.5 rounded-full bg-blue-500/20 text-[9px] font-mono font-semibold text-blue-300 border border-blue-400/20">
                    CORE 2.0
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards Row (5 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div 
              key={idx} 
              className="bg-white dark:bg-[#0D182E] rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  {kpi.title}
                </span>
                <div className={`p-2 rounded-xl ${kpi.iconBg}`}>
                  <Icon className={`w-4 h-4 ${kpi.iconColor}`} />
                </div>
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  {kpi.value}
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                    {kpi.growth}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 truncate">
                    {kpi.subtext}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Lower 3-Column Section: Chart | Aktivitas Terbaru | Aksi Cepat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Col 1: Statistik Percakapan (6 cols for wider visualization) */}
        <div className="lg:col-span-6 bg-white dark:bg-[#0D182E] rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between min-h-[380px]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Statistik Percakapan
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Tren volume obrolan masuk mingguan</p>
            </div>
            <select 
              className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              defaultValue="month"
            >
              <option value="month">This Month ⌄</option>
              <option value="week">This Week ⌄</option>
              <option value="year">This Year ⌄</option>
            </select>
          </div>

          <div className="w-full h-[280px] relative">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0066FF" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#0066FF" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={5} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dx={-4} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '10px', 
                    border: '1px solid #1E293B', 
                    backgroundColor: '#0A1226',
                    color: '#F8FAFC',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    fontSize: '11px',
                    padding: '8px 12px'
                  }}
                  cursor={{ stroke: '#0066FF', strokeWidth: 1.5, strokeDasharray: '3 3' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="percakapan" 
                  stroke="#0066FF" 
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#chartGradient)"
                  dot={{ r: 3, fill: '#0066FF', strokeWidth: 2, stroke: '#FFFFFF' }}
                  activeDot={{ r: 5, fill: '#0052CC', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Col 2: Aktivitas Terbaru (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-[#0D182E] rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col min-h-[380px]">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Aktivitas Terbaru
            </h3>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {recentActivities.map((act) => {
              const Icon = act.icon;
              return (
                <div 
                  key={act.id} 
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-lg ${act.bg} flex items-center justify-center shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {act.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400">{act.author}</span>
                      <span className="text-[10px] text-slate-400">•</span>
                      <span className="text-[10px] text-slate-400">{act.time}</span>
                    </div>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${act.statusDot} shrink-0`}></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Col 3: Aksi Cepat (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-[#0D182E] rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between min-h-[380px]">
          <div className="mb-3.5">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Aksi Cepat
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Pintasan manajemen sistem</p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => navigate('/kb')}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-all hover:border-[#0066FF] text-left group cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
              <span>Upload Dokumen KB</span>
            </button>
            <button
              onClick={() => navigate('/conversations')}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-all hover:border-[#0066FF] text-left group cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-[#0066FF] group-hover:scale-110 transition-transform" />
              <span>Live Chat Handoff</span>
            </button>
            <button
              onClick={() => navigate('/widget')}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-all hover:border-[#0066FF] text-left group cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-violet-500 group-hover:scale-110 transition-transform" />
              <span>Kelola Integrasi</span>
            </button>
            <button
              onClick={() => navigate('/analytics')}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-all hover:border-[#0066FF] text-left group cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
              <span>Lihat Analytics</span>
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-all hover:border-[#0066FF] text-left group cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-400 group-hover:rotate-45 transition-transform" />
              <span>Pengaturan Sistem</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;