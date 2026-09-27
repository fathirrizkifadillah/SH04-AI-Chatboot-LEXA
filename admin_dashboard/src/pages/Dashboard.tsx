import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Users, AlertCircle, Activity, Plus, FileText, ThumbsUp, HelpCircle, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../lib/apiClient';
import type { KPIStats, ChartDataPoint, UnansweredQuery, FeedbackStats } from '../types/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<KPIStats>({
    active_users: 0,
    total_conversations: 0,
    unanswered_queries: 0
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [unansweredList, setUnansweredList] = useState<UnansweredQuery[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);

  const currentUser = (() => {
    try {
      const u = localStorage.getItem('lexa_admin_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  })();
  
  useEffect(() => {
    api.authGet<{ kpi: KPIStats; chart: ChartDataPoint[] }>('/api/admin/stats')
      .then(data => {
        if(data.kpi) {
          setStats(data.kpi);
          setChartData(data.chart);
        }
      })
      .catch(err => console.error("Error fetching stats:", err));
      
    api.authGet<UnansweredQuery[]>('/api/admin/unanswered')
      .then(data => {
        if (Array.isArray(data)) setUnansweredList(data);
      })
      .catch(err => console.error("Error fetching unanswered queries:", err));

    api.authGet<FeedbackStats>('/api/admin/feedback/stats')
      .then(data => setFeedbackStats(data))
      .catch(err => console.error("Error fetching feedback stats:", err));
  }, []);

  const kpiData: Array<{
    title: string;
    value: string | number;
    trend: string;
    trendUp: boolean;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
  }> = [
    { 
      title: 'Total Conversations', 
      value: stats.total_conversations.toLocaleString(), 
      trend: 'Real-time sync', 
      trendUp: true, 
      icon: MessageSquare, 
      color: 'text-blue-600 dark:text-blue-400', 
      bg: 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-900/50' 
    },
    { 
      title: 'Unanswered Queries', 
      value: stats.unanswered_queries.toLocaleString(), 
      trend: 'Perlu ditinjau', 
      trendUp: false, 
      icon: AlertCircle, 
      color: 'text-amber-600 dark:text-amber-400', 
      bg: 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-900/50' 
    },
    { 
      title: 'Active Users (30m)', 
      value: stats.active_users.toLocaleString(), 
      trend: 'Aktivitas sesi', 
      trendUp: true, 
      icon: Users, 
      color: 'text-emerald-600 dark:text-emerald-400', 
      bg: 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/50' 
    },
    { 
      title: 'Satisfaction Rate', 
      value: feedbackStats?.satisfaction_rate || '0%', 
      trend: feedbackStats ? `${feedbackStats.thumbs_up} Positif / ${feedbackStats.thumbs_down} Negatif` : 'Belum ada data', 
      trendUp: true, 
      icon: ThumbsUp, 
      color: 'text-indigo-600 dark:text-indigo-400', 
      bg: 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-900/50' 
    },
    { 
      title: 'Resolution Rate', 
      value: stats.total_conversations > 0 ? `${((1 - stats.unanswered_queries / Math.max(stats.total_conversations, 1)) * 100).toFixed(1)}%` : '100%', 
      trend: 'Penyelesaian AI', 
      trendUp: true, 
      icon: Activity, 
      color: 'text-sky-600 dark:text-sky-400', 
      bg: 'bg-sky-50 dark:bg-sky-950/40 border border-sky-200/50 dark:border-sky-900/50' 
    },
  ];
  
  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl translate-y-1/2"></div>
        
        <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row justify-between items-center">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-medium tracking-wide">
              <span>LEXA Operations Console</span>
              <span className="w-1 h-1 rounded-full bg-blue-400"></span>
              <span className="text-blue-200">{currentUser?.name || 'Administrator'}</span>
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
              Customer Support Intelligence Platform
            </h1>
            <p className="text-slate-300 text-xs md:text-sm leading-relaxed max-w-xl">
              Pantau performa asisten cerdas secara real-time, evaluasi pertanyaan tanpa jawaban, dan optimasi basis pengetahuan organisasi Anda.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => navigate('/kb')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" /> Kelola Knowledge Base
              </button>
              <button
                onClick={() => navigate('/conversations')}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl transition-colors border border-white/10 flex items-center gap-2"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Buka Percakapan
              </button>
              <button
                onClick={() => navigate('/analytics')}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl transition-colors border border-white/10 flex items-center gap-2"
              >
                <FileText className="w-3.5 h-3.5" /> Laporan Analitik
              </button>
            </div>
          </div>
          
          <div className="hidden lg:block relative z-20">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl"></div>
              <img 
                src="/lexa_bot.png" 
                alt="Lexa CS Engine" 
                className="relative z-10 w-full h-full object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.5)]" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiData.map((kpi, idx) => (
          <div 
            key={idx} 
            className="bg-white dark:bg-slate-800/80 rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-700/80 card-hover transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.title}</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 tracking-tight">{kpi.value}</h3>
              </div>
              <div className={`p-2.5 rounded-xl ${kpi.bg}`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {kpi.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800/80 rounded-2xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-700/80 transition-colors">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">Tren Interaksi Pelanggan</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Grafik volume percakapan selama 7 hari terakhir</p>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-2.5 py-1 rounded-md">
              7 Hari Terakhir
            </span>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dx={-10} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '10px', 
                    border: '1px solid #334155', 
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)' 
                  }}
                  cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="percakapan" 
                  stroke="#2563eb" 
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#2563eb', strokeWidth: 1.5, stroke: '#fff' }}
                  activeDot={{ r: 5, fill: '#1d4ed8', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Unanswered Queries */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex flex-col transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">Unanswered Queries</h3>
                <span title="Pertanyaan user yang tidak memiliki konteks relevan di Knowledge Base">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                Pertanyaan yang tidak dapat dijawab bot karena informasi belum ada pada Knowledge Base.
              </p>
            </div>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto max-h-[300px]">
            {unansweredList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Tidak ada pertanyaan yang gagal dijawab saat ini.
              </div>
            ) : unansweredList.map((item, idx) => (
              <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-700/60 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug break-words">
                    "{item.query}"
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    {new Date(item.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/kb')}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-blue-600 dark:text-blue-400 text-[11px] font-medium rounded-lg transition-colors shrink-0 flex items-center gap-1 shadow-sm"
                  title="Tambah ke Knowledge Base"
                >
                  <Plus className="w-3 h-3" /> Tambah ke KB
                </button>
              </div>
            ))}
          </div>

          <button 
            onClick={() => navigate('/conversations')}
            className="w-full mt-4 py-2.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors border border-blue-200 dark:border-blue-900/60 flex items-center justify-center gap-1.5"
          >
            <span>Lihat Semua Aktivitas Percakapan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;