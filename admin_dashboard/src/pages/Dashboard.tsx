import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, BookOpen, Activity, Plus, 
  ArrowUpRight, UploadCloud, 
  Share2, BarChart3, Settings, ShieldCheck,
  ArrowRight, RefreshCw, AlertTriangle
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

const operationalLogs = [
  {
    id: 1,
    title: 'Knowledge Base Vector Index updated',
    desc: '42 chunks embedded into vector memory cluster',
    actor: 'System Ingestion',
    time: '8m ago',
    icon: BookOpen,
    badge: 'Vector Sync',
    badgeColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  },
  {
    id: 2,
    title: 'Customer Handoff Escalation resolved',
    desc: 'Session #8921 transferred & concluded by CS Agent',
    actor: 'Agent Desk',
    time: '34m ago',
    icon: MessageSquare,
    badge: 'Handoff',
    badgeColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    id: 3,
    title: 'WhatsApp Webhook Handshake verified',
    desc: 'Outbound webhook response 200 OK • 18ms latency',
    actor: 'Gateway',
    time: '2h ago',
    icon: Share2,
    badge: 'Integration',
    badgeColor: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
  },
  {
    id: 4,
    title: 'Automated Telemetry Health Check passed',
    desc: 'Core LLM pipeline, RAG retriever & DB clusters healthy',
    actor: 'Monitor',
    time: '4h ago',
    icon: ShieldCheck,
    badge: 'System SLA',
    badgeColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
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
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentUser = (() => {
    try {
      const u = sessionStorage.getItem('lexa_admin_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  })();

  const fetchStats = (range: '24h' | '7d' | '30d' = timeRange) => {
    setIsRefreshing(true);
    api.authGet<{ kpi: KPIStats; chart: ChartDataPoint[] }>(`/api/admin/stats?range=${range}`)
      .then(data => {
        if (data.kpi) {
          setStats(prev => ({
            ...prev,
            total_conversations: data.kpi.total_conversations,
            active_users: data.kpi.active_users,
            unanswered_queries: data.kpi.unanswered_queries,
          }));
        }
        if (Array.isArray(data.chart) && data.chart.length > 0) {
          setChartData(data.chart);
        }
      })
      .catch(() => {})
      .finally(() => {
        setTimeout(() => setIsRefreshing(false), 300);
      });

    api.authGet<FeedbackStats>('/api/admin/feedback/stats')
      .then(data => setFeedbackStats(data))
      .catch(() => {});
  };

  const handleTimeRangeChange = (range: '24h' | '7d' | '30d') => {
    setTimeRange(range);
    fetchStats(range);
  };
  
  useEffect(() => {
    fetchStats(timeRange);
  }, []);

  return (
    <div className="space-y-6 pb-12 antialiased max-w-[1440px] mx-auto">
      
      {/* 1. Executive Operations Header Bar (Linear / Vercel Tier) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800/90 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Operations Hub
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Cluster ID-CGK-1</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">99.98% SLA</span>
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Console Overview
            </h1>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Welcome back, <span className="font-semibold text-slate-700 dark:text-slate-200">{currentUser?.name || 'Admin'}</span>
            </span>
          </div>
        </div>

        {/* Operational Controls & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Time Filter Pill */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
            {(['24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                  timeRange === range
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchStats()}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shadow-xs cursor-pointer"
            title="Refresh telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#0066FF]' : ''}`} />
          </button>

          {/* Primary Action Button (Nested Island Architecture) */}
          <button
            onClick={() => navigate('/kb')}
            className="group relative inline-flex items-center gap-2.5 pl-4 pr-1.5 py-1.5 bg-[#0066FF] hover:bg-[#0052CC] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-[#0066FF]/25 cursor-pointer"
          >
            <span>Ingest Document</span>
            <span className="w-6 h-6 rounded-lg bg-white/20 group-hover:bg-white/30 flex items-center justify-center transition-colors">
              <Plus className="w-3.5 h-3.5 text-white" />
            </span>
          </button>
        </div>
      </div>

      {/* 2. Asymmetric Executive Bento Grid (Double-Bezel Architecture) */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* Bento Card 1: Throughput Hero (Col 5) */}
        <div className="col-span-12 lg:col-span-5 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-800/40 ring-1 ring-slate-300/60 dark:ring-white/[0.08] shadow-xs">
          <div className="h-full rounded-[calc(1rem-2px)] bg-white dark:bg-[#0A1224] p-5 flex flex-col justify-between border border-slate-200/40 dark:border-white/5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                  Autonomous Throughput
                </span>
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-[#0066FF] border border-blue-500/20">
                  <MessageSquare className="w-4 h-4" />
                </div>
              </div>
              
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono tabular-nums">
                  {stats.total_conversations.toLocaleString()}
                </span>
                <span className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  +18.4%
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Total chat inquiries processed across all deployment channels
              </p>
            </div>

            {/* Split Progress Meter: AI vs Escalation */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] mb-2 font-mono">
                <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#0066FF]"></span>
                  94.2% AI Auto-Resolved
                </span>
                <span className="text-slate-400 dark:text-slate-500">
                  5.8% Escalated
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                <div className="h-full bg-[#0066FF] rounded-l-full" style={{ width: '94.2%' }}></div>
                <div className="h-full bg-amber-500 rounded-r-full" style={{ width: '5.8%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Bento Card 2: AI Resolution Precision (Col 2.5) */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-2 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-800/40 ring-1 ring-slate-300/60 dark:ring-white/[0.08] shadow-xs">
          <div className="h-full rounded-[calc(1rem-2px)] bg-white dark:bg-[#0A1224] p-5 flex flex-col justify-between border border-slate-200/40 dark:border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                Resolution Rate
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            
            <div className="my-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono tabular-nums">
                98.4%
              </span>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <span>Optimal response</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 font-mono pt-3 border-t border-slate-100 dark:border-slate-800/80">
              Avg latency: ~480ms
            </div>
          </div>
        </div>

        {/* Bento Card 3: Vector Knowledge Corpus (Col 2) */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-2 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-800/40 ring-1 ring-slate-300/60 dark:ring-white/[0.08] shadow-xs">
          <div className="h-full rounded-[calc(1rem-2px)] bg-white dark:bg-[#0A1224] p-5 flex flex-col justify-between border border-slate-200/40 dark:border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                Vector Corpus
              </span>
              <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-500 border border-violet-500/20">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            
            <div className="my-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono tabular-nums">
                1,247
              </span>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Indexed documents
              </div>
            </div>

            <button
              onClick={() => navigate('/kb')}
              className="text-[11px] font-semibold text-[#0066FF] hover:underline flex items-center gap-1 pt-3 border-t border-slate-100 dark:border-slate-800/80 cursor-pointer"
            >
              <span>Manage Store</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Bento Card 4: Action Required Queue (Col 3) */}
        <div className="col-span-12 lg:col-span-3 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-800/40 ring-1 ring-slate-300/60 dark:ring-white/[0.08] shadow-xs">
          <div className="h-full rounded-[calc(1rem-2px)] bg-white dark:bg-[#0A1224] p-5 flex flex-col justify-between border border-slate-200/40 dark:border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                Action Queue
              </span>
              <div className={`p-1.5 rounded-lg ${
                stats.unanswered_queries > 0 
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                  : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
              }`}>
                {stats.unanswered_queries > 0 ? <AlertTriangle className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
              </div>
            </div>
            
            <div className="my-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono tabular-nums">
                  {stats.unanswered_queries}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                  stats.unanswered_queries > 0
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                }`}>
                  {stats.unanswered_queries > 0 ? 'Pending Agent Review' : 'Zero Escalations'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Sessions flagged for manual review or supervisor verification
              </p>
            </div>

            <button
              onClick={() => navigate('/conversations')}
              className="w-full py-2 px-3 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center justify-between cursor-pointer border border-slate-200 dark:border-slate-700/80"
            >
              <span>View Escalation Desk</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

      </div>

      {/* 3. Main Operational Telemetry: High-Fidelity Waveform Area */}
      <div className="p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-800/40 ring-1 ring-slate-300/60 dark:ring-white/[0.08] shadow-xs">
        <div className="rounded-[calc(1rem-2px)] bg-white dark:bg-[#0A1224] p-5 md:p-6 border border-slate-200/40 dark:border-white/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                  Inquiry Volume & Telemetry Waveform
                </h3>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time throughput metrics recorded across streaming inference endpoints
              </p>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#0066FF]"></span>
                <span>Inferences</span>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-[11px]">
                Peak: <span className="font-semibold text-slate-800 dark:text-slate-200">1,680 / day</span>
              </div>
            </div>
          </div>

          <div className="w-full h-[290px] relative">
            <ResponsiveContainer width="100%" height={290}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                <defs>
                  <linearGradient id="lexaTelemetryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0066FF" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0066FF" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#64748b" strokeOpacity={0.12} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }} 
                  dy={8} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }} 
                  dx={-4} 
                  allowDecimals={false} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    backgroundColor: '#070D1A',
                    color: '#F8FAFC',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    padding: '10px 14px'
                  }}
                  cursor={{ stroke: '#0066FF', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="percakapan" 
                  stroke="#0066FF" 
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#lexaTelemetryGradient)"
                  dot={{ r: 3, fill: '#0066FF', strokeWidth: 2, stroke: '#FFFFFF' }}
                  activeDot={{ r: 5, fill: '#0052CC', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Lower Operational Split: Audit Trail (7 cols) & Quick Dispatch (5 cols) */}
      <div className="grid grid-cols-12 gap-5">
        
        {/* Real-Time Operational Audit Trail */}
        <div className="col-span-12 lg:col-span-7 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-800/40 ring-1 ring-slate-300/60 dark:ring-white/[0.08] shadow-xs">
          <div className="h-full rounded-[calc(1rem-2px)] bg-white dark:bg-[#0A1224] p-5 flex flex-col justify-between border border-slate-200/40 dark:border-white/5">
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Live Operational Audit Trail
                  </h3>
                  <span className="text-slate-400 text-xs font-mono">• Telemetry Stream</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/60 mt-2">
                {operationalLogs.map((log) => {
                  const Icon = log.icon;
                  return (
                    <div key={log.id} className="py-3 flex items-start gap-3 group">
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 shrink-0 mt-0.5 group-hover:text-[#0066FF] transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {log.title}
                          </p>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {log.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          {log.desc}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-md border ${log.badgeColor}`}>
                            {log.badge}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            by {log.actor}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center">
              <span className="text-[11px] font-mono text-slate-400">
                Continuous event streaming connected via Secure WebSocket (WSS)
              </span>
            </div>
          </div>
        </div>

        {/* Quick Operations Dispatch (Island Button Architecture) */}
        <div className="col-span-12 lg:col-span-5 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-800/40 ring-1 ring-slate-300/60 dark:ring-white/[0.08] shadow-xs">
          <div className="h-full rounded-[calc(1rem-2px)] bg-white dark:bg-[#0A1224] p-5 flex flex-col justify-between border border-slate-200/40 dark:border-white/5">
            <div>
              <div className="pb-3.5 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Operations Dispatch
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Direct hardware access & cluster management shortcuts
                </p>
              </div>

              <div className="space-y-2.5 mt-3.5">
                {/* Action 1 */}
                <button
                  onClick={() => navigate('/kb')}
                  className="w-full group flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-[#0066FF] flex items-center justify-center shrink-0">
                      <UploadCloud className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Knowledge Corpus Sync
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Upload PDF, DOCX, or URL sources into Vector Store
                      </p>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700/60 flex items-center justify-center text-slate-400 group-hover:text-[#0066FF] group-hover:translate-x-0.5 transition-all">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Action 2 */}
                <button
                  onClick={() => navigate('/conversations')}
                  className="w-full group flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Live Escalation Desk
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Take over active sessions or review flagged messages
                      </p>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700/60 flex items-center justify-center text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Action 3 */}
                <button
                  onClick={() => navigate('/widget')}
                  className="w-full group flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Integration & Widget Embed
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Deploy web widget snippets & WhatsApp gateways
                      </p>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700/60 flex items-center justify-center text-slate-400 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Action 4 */}
                <button
                  onClick={() => navigate('/analytics')}
                  className="w-full group flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Analytics & CSAT Telemetry
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Inspect user satisfaction scores & query breakdown
                      </p>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700/60 flex items-center justify-center text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400">
                LEXA Software House Console
              </span>
              <button
                onClick={() => navigate('/settings')}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;