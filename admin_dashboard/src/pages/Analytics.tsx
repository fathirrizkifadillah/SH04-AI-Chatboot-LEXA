import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { MessageSquare, Users, AlertCircle, Clock, HelpCircle, BookOpen, ArrowRight, CheckCircle2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/apiClient';
import type { AdminStatsResponse, ChartDataPoint, AnalyticsMetrics } from '../types/api';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  onInfoClick?: () => void;
}

const StatCard = ({ title, value, subtitle, icon: Icon, color, onInfoClick }: StatCardProps) => (
  <div className="bg-white dark:bg-slate-800/90 p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex items-start justify-between transition-colors">
    <div className="flex items-start gap-3.5">
      <div className={`p-3 rounded-xl ${color} shrink-0 mt-0.5`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{title}</p>
          {onInfoClick && (
            <button
              onClick={onInfoClick}
              className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              title="Pelajari definisi metrik ini"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-1">{value}</h3>
        {subtitle && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  </div>
);

const Analytics = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ total_conversations: number; unanswered_queries: number; chart: ChartDataPoint[] } | null>(null);
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [showDefinitionModal, setShowDefinitionModal] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.authGet<AdminStatsResponse>('/api/admin/stats');
        setStats({ ...data.kpi, chart: data.chart });
        setMetrics(data.metrics);
      } catch (err) {
        console.error('Error fetching analytics:', err);
      }
    };
    fetchStats();
  }, []);

  const chatData: ChartDataPoint[] = stats?.chart || [];

  const metricsData: AnalyticsMetrics = metrics || { avg_response_time: 'N/A', active_users_30min: 0, monthly_active: 0 };
  const avgResponseTime = metricsData.avg_response_time;
  const activeUsers30min = metricsData.active_users_30min;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Analytics Overview</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Laporan efektivitas kecerdasan buatan, volume interaksi, dan evaluasi Knowledge Base.
          </p>
        </div>
        <button
          onClick={() => setShowDefinitionModal(true)}
          className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors shadow-sm"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Definisi & Panduan Metrik
        </button>
      </div>

      {/* Dedicated Highlight Banner: Definisi Pertanyaan Belum Terjawab */}
      <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200/70 dark:border-amber-800/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              Apa maksud "Pertanyaan Belum Terjawab" ({stats?.unanswered_queries || 0} Terdeteksi)?
            </h4>
            <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 leading-relaxed mt-0.5 max-w-3xl">
              Pertanyaan pelanggan dikategorikan <strong>Belum Terjawab</strong> saat mesin RAG <strong>tidak menemukan dokumen referensi yang relevan</strong> di Knowledge Base. Bot LEXA dirancang anti-halusinasi sehingga tidak mengarang jawaban, melainkan menjawab jujur bahwa informasi belum tersedia dan mencatat pertanyaan tersebut agar tim dapat memperbarui dokumen panduan.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/kb')}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <BookOpen className="w-3.5 h-3.5" />
          Kelola Knowledge Base
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Percakapan" 
          value={stats?.total_conversations || '-'} 
          subtitle="Volume obrolan pelanggan"
          icon={MessageSquare} 
          color="bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400" 
        />
        <StatCard 
          title="Pertanyaan Belum Terjawab" 
          value={stats?.unanswered_queries || '-'} 
          subtitle="Topik belum ada di KB"
          icon={AlertCircle} 
          color="bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400" 
          onInfoClick={() => setShowDefinitionModal(true)}
        />
        <StatCard 
          title="Waktu Respon Rata-rata" 
          value={avgResponseTime} 
          subtitle="Kecepatan streaming AI"
          icon={Clock} 
          color="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400" 
        />
        <StatCard 
          title="Pengguna Aktif (30 Menit)" 
          value={activeUsers30min} 
          subtitle="Sesi aktif di widget"
          icon={Users} 
          color="bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400" 
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800/90 p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 transition-colors">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Tren Percakapan (7 Hari Terakhir)</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Pertumbuhan traffic interaksi pengunjung dan pelanggan</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chatData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorChats" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid #334155', 
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    fontSize: '12px'
                  }}
                  labelStyle={{ fontWeight: 'bold', color: '#93c5fd', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="chats" name="Total Chat" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorChats)" dot={{ r: 3, fill: '#2563eb' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Secondary Chart */}
        <div className="bg-white dark:bg-slate-800/90 p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 transition-colors">
          <div className="mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Penyelesaian Pertanyaan</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Rasio terjawab dari dokumen KB vs pertanyaan tanpa referensi
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chatData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid #334155', 
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    fontSize: '12px'
                  }} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} />
                <Bar dataKey="chats" name="Terjawab (Ada di KB)" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                <Bar dataKey="unresolved" name="Belum Terjawab (Perlu Dokumen)" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Modal Definisi & Panduan Lengkap */}
      {showDefinitionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Definisi & Tata Kelola Pertanyaan Belum Terjawab
                  </h3>
                  <p className="text-[11px] text-slate-500">Unanswered Queries Knowledge Base System</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDefinitionModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-[70vh] overflow-y-auto">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                  1. Mengapa Pertanyaan Masuk Kategori Ini?
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Ketika pelanggan menanyakan hal baru, mesin RAG LEXA mencari potongan dokumen yang relevan di database vector (Chroma). Jika <strong>tidak ada satu pun dokumen</strong> yang skor kemiripannya mencapai ambang batas (threshold) atau dokumen belum pernah diunggah, sistem otomatis mengklasifikasikan pertanyaan tersebut sebagai <em>Unanswered Query</em>.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  2. Prinsip Anti-Halusinasi AI
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Chatbot LEXA dirancang dengan standar enterprise agar tidak memberikan informasi palsu atau mengarang jawaban saat referensi data tidak tersedia. Bot akan menjawab secara sopan bahwa informasi belum ada di dokumentasi kami dan mengarahkan kontak resmi ke tim terkait.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                  3. Apa Langkah Tindak Lanjut yang Harus Dilakukan?
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Administrator dan Editor Knowledge Base disarankan memeriksa daftar pertanyaan ini di menu <strong>Dashboard</strong> atau <strong>Knowledge Base</strong>, kemudian menambahkan dokumen referensi (.txt, .md, .pdf) yang memuat jawaban pertanyaan tersebut lalu menekan tombol <strong>Sinkronisasi AI</strong>. Setelah itu, AI akan langsung bisa menjawab pertanyaan serupa secara otomatis!
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <button
                onClick={() => {
                  setShowDefinitionModal(false);
                  navigate('/kb');
                }}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Buka Halaman Knowledge Base
              </button>
              <button
                onClick={() => setShowDefinitionModal(false)}
                className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;