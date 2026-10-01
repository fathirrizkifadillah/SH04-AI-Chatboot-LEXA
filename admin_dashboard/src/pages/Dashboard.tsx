import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, Users, BookOpen, Layers, Activity, Plus, FileText, 
  ArrowRight, MoreVertical, GraduationCap, Library, Landmark, 
  Briefcase, HeartPulse, Compass, TrendingUp, Cpu, UploadCloud, 
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

interface LexaModule {
  id: string;
  name: string;
  category: string;
  desc: string;
  status: 'Aktif' | 'Konfigurasi';
  icon: any;
  color: string;
  bg: string;
}

const lexaModules: LexaModule[] = [
  {
    id: 'campus',
    name: 'Campus AI',
    category: 'Akademik',
    desc: 'Asisten cerdas untuk kampus, mahasiswa & layanan akademik',
    status: 'Aktif',
    icon: GraduationCap,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-500/10 text-violet-600',
  },
  {
    id: 'library',
    name: 'Library AI',
    category: 'Perpustakaan',
    desc: 'Pencarian buku, katalog pintar & informasi perpustakaan',
    status: 'Aktif',
    icon: Library,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 text-emerald-600',
  },
  {
    id: 'journal',
    name: 'Journal AI',
    category: 'Publikasi',
    desc: 'Asisten editor & reviewer untuk jurnal ilmiah (OJS)',
    status: 'Aktif',
    icon: FileText,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10 text-blue-600',
  },
  {
    id: 'gov',
    name: 'Government AI',
    category: 'Pelayanan Publik',
    desc: 'Layanan informasi & administrasi instansi pemerintahan',
    status: 'Aktif',
    icon: Landmark,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10 text-amber-600',
  },
  {
    id: 'biz',
    name: 'Business AI',
    category: 'Enterprise',
    desc: 'Dukungan bisnis, customer service & layanan pelanggan 24/7',
    status: 'Aktif',
    icon: Briefcase,
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-500/10 text-teal-600',
  },
  {
    id: 'health',
    name: 'Healthcare AI',
    category: 'Kesehatan',
    desc: 'Asisten informasi rumah sakit, dokter, poli & klinik',
    status: 'Aktif',
    icon: HeartPulse,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10 text-rose-600',
  },
  {
    id: 'tourism',
    name: 'Tourism AI',
    category: 'Pariwisata',
    desc: 'Informasi wisata, pemesanan tiket, fasilitas & promo lokal',
    status: 'Aktif',
    icon: Compass,
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-500/10 text-sky-600',
  },
  {
    id: 'hr',
    name: 'HR AI',
    category: 'Internal',
    desc: 'Rekrutmen, screening kandidat & layanan karyawan mandiri',
    status: 'Aktif',
    icon: Users,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-500/10 text-indigo-600',
  },
  {
    id: 'sales',
    name: 'Sales AI',
    category: 'Growth',
    desc: 'Automasi penjualan, kualifikasi leads & follow-up prospek',
    status: 'Aktif',
    icon: TrendingUp,
    color: 'text-amber-500 dark:text-amber-300',
    bg: 'bg-amber-500/10 text-amber-600',
  },
  {
    id: 'research',
    name: 'Research AI',
    category: 'R&D',
    desc: 'Bantu riset, sintesis literatur & analisis data komprehensif',
    status: 'Aktif',
    icon: Layers,
    color: 'text-blue-500 dark:text-blue-300',
    bg: 'bg-blue-500/10 text-blue-600',
  },
];

const recentActivities = [
  {
    id: 1,
    title: 'Modul Campus AI diperbarui',
    author: 'Admin LEXA',
    time: '10 menit lalu',
    icon: GraduationCap,
    bg: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    statusDot: 'bg-emerald-500',
  },
  {
    id: 2,
    title: 'Dokumen baru ditambahkan ke Library AI System',
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
      title: 'Active Modules',
      value: '9',
      growth: '+12.5%',
      subtext: 'vs last month',
      icon: Layers,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/30',
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
      {/* 1. Hero Banner matching Reference Image 1 */}
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
                <span>Buat Modul Baru</span>
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
          
          {/* Glowing AI Emblem matching Image 1 */}
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

      {/* 3. "Modul LEXA AI" Section matching Reference Image 1 */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Modul LEXA AI
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              {lexaModules.length} Modul
            </span>
          </div>
          <button 
            onClick={() => navigate('/kb')}
            className="text-xs font-semibold text-[#0066FF] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Lihat Semua Modul</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {lexaModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                className="bg-white dark:bg-[#0D182E] rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 hover:border-[#0066FF]/50 transition-all hover:shadow-md group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${mod.bg} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <button 
                      onClick={() => navigate('/kb')}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                      title="Menu modul"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-[#0066FF] transition-colors">
                    {mod.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {mod.status}
                  </span>
                  <button
                    onClick={() => navigate('/conversations')}
                    className="text-[11px] font-medium text-slate-400 hover:text-[#0066FF] transition-colors"
                  >
                    Buka →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Lower 3-Column Section matching Image 1: Chart | Aktivitas Terbaru | Aksi Cepat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Col 1: Statistik Percakapan (approx 5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0D182E] rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Statistik Percakapan
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Tren volume obrolan masuk</p>
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

          <div className="w-full h-[230px] relative">
            <ResponsiveContainer width="100%" height={230}>
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

        {/* Col 2: Aktivitas Terbaru (approx 4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#0D182E] rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col">
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

        {/* Col 3: Aksi Cepat (approx 3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-[#0D182E] rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
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
              <Plus className="w-4 h-4 text-[#0066FF] group-hover:scale-110 transition-transform" />
              <span>Buat Modul Baru</span>
            </button>
            <button
              onClick={() => navigate('/kb')}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-all hover:border-[#0066FF] text-left group cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
              <span>Upload Dokumen</span>
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