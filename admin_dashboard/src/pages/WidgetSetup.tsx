import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Palette, ExternalLink, Info, Monitor } from 'lucide-react';
import api from '../lib/apiClient';
import { useLanguage } from '../lib/i18n';

interface EmbedCodeResponse {
  embed_code: string;
  iframe_fallback: string;
  js_api_example: string;
  config: {
    api_url: string;
    position: string;
    color: string;
    theme?: string;
  };
}

interface CopyButtonProps {
  text: string;
  field: string;
  isCopied: boolean;
  onCopy: (text: string, field: string) => void;
}

const CopyButton = ({ text, field, isCopied, onCopy }: CopyButtonProps) => (
  <button
    onClick={() => onCopy(text, field)}
    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors
      bg-white/10 hover:bg-white/20 text-white border border-white/10 cursor-pointer shadow-xs active:scale-95"
  >
    {isCopied ? (
      <>
        <Check className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-emerald-400">Tersalin!</span>
      </>
    ) : (
      <>
        <Copy className="w-3.5 h-3.5" />
        Salin Kode
      </>
    )}
  </button>
);

const WidgetSetup = () => {
  const { lang, t } = useLanguage();
  const [embedData, setEmbedData] = useState<EmbedCodeResponse | null>(null);
  const [apiUrl, setApiUrl] = useState('');
  const [position, setPosition] = useState('bottom-right');
  const [color, setColor] = useState('#0066FF');
  const [theme, setTheme] = useState('dark');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'html' | 'wordpress' | 'react' | 'iframe'>('html');
  const [previewChatOpen, setPreviewChatOpen] = useState(false);

  const positions = [
    { value: 'bottom-right', label: t.pos_bottom_right },
    { value: 'bottom-left', label: t.pos_bottom_left },
  ];

  const themes = [
    { value: 'dark', label: t.theme_dark },
    { value: 'light', label: t.theme_light },
    { value: 'auto', label: t.theme_auto },
  ];

  const fetchEmbedCode = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ position, color, theme });
      if (apiUrl) params.set('api_url', apiUrl);
      const data = await api.authGet<EmbedCodeResponse>(`/api/admin/widget/embed-code?${params}`);
      setEmbedData(data);
    } catch (err) {
      console.error('Failed to fetch embed code:', err);
    } finally {
      setLoading(false);
    }
  }, [position, color, apiUrl, theme]);

  useEffect(() => {
    fetchEmbedCode();
  }, [fetchEmbedCode]);

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const reactSnippet = `// Next.js (App Router / Pages) atau React Vite
import Script from 'next/script'; // atau useEffect biasa di React

export default function ChatWidget() {
  return (
    <Script
      src="${embedData?.config.api_url || 'https://gianni-subvitalised-lauditorily.ngrok-free.dev'}/widget/widget-loader.js"
      data-api-url="${embedData?.config.api_url || 'https://gianni-subvitalised-lauditorily.ngrok-free.dev'}"
      data-position="${position}"
      data-color="${color}"
      data-theme="${theme}"
      strategy="lazyOnload"
    />
  );
}`;

  const wordpressGuide = `<!-- Panduan WordPress:
1. Pasang plugin gratis "WPCode - Insert Headers and Footers" dari Menu Plugins.
2. Buka menu Code Snippets -> Header & Footer.
3. Tempelkan script berikut ke kolom "Footer": -->

${embedData?.embed_code || ''}`;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 pb-16">
      {/* Title & Informative Brief */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t.widget_setup_title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.widget_setup_subtitle}
          </p>
        </div>

        <a
          href="https://lexa-chatbot.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>{t.try_live_widget}</span>
        </a>
      </div>

      {/* Explanatory 3-Step Guide (Truly Informative for Admins) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#0A1224] border border-slate-200/80 dark:border-white/5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
          <Info className="w-4 h-4 text-[#0066FF]" />
          {t.how_it_works_title}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed max-w-4xl">
          {t.how_it_works_desc}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-white/5">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
            <span className="text-xs font-bold text-[#0066FF] block mb-1">{t.step_1}</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.step_1_desc}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
            <span className="text-xs font-bold text-[#0066FF] block mb-1">{t.step_2}</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.step_2_desc}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1">{t.step_3}</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.step_3_desc}
            </p>
          </div>
        </div>
      </div>

      {/* Configuration & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Customization Form (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white dark:bg-[#0A1224] rounded-2xl border border-slate-200/80 dark:border-white/5 p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#0066FF]" />
              {t.config_widget}
            </h3>

            {/* Accent Color */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.accent_color}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0066FF]"
                />
              </div>
            </div>

            {/* Position */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {lang === 'id' ? 'Posisi Tombol di Layar' : 'Button Screen Position'}
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0066FF]"
              >
                {positions.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Theme */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {lang === 'id' ? 'Tema Warna Chat' : 'Chat Appearance Theme'}
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0066FF]"
              >
                {themes.map((tItem) => (
                  <option key={tItem.value} value={tItem.value}>{tItem.label}</option>
                ))}
              </select>
            </div>

            {/* API Endpoint */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {lang === 'id' ? 'Host API Backend (Otomatis)' : 'Backend API Host (Auto)'}
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder={embedData?.config.api_url || 'https://gianni-subvitalised-lauditorily.ngrok-free.dev'}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0066FF]"
              />
            </div>
          </div>
        </div>

        {/* Right: Interactive Live Simulation Box (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white dark:bg-[#0A1224] rounded-2xl border border-slate-200/80 dark:border-white/5 p-5 shadow-xs h-full flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5 mb-3">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-[#0066FF]" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t.live_preview}
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {position === 'bottom-right' ? 'Kanan Bawah' : 'Kiri Bawah'} • {theme.toUpperCase()}
              </span>
            </div>

            {/* Simulated Web Page */}
            <div className="relative w-full h-[360px] rounded-xl bg-slate-50 dark:bg-[#070D1D] border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col shadow-inner select-none">
              {/* Fake Browser Top Bar */}
              <div className="h-7 bg-slate-200/80 dark:bg-slate-800/80 px-3 flex items-center gap-1.5 border-b border-slate-200 dark:border-white/5">
                <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <div className="mx-auto px-4 py-0.5 rounded-md bg-white/70 dark:bg-slate-900/60 text-[10px] font-mono text-slate-500 dark:text-slate-400 border border-slate-300/40 dark:border-white/5 w-60 text-center truncate">
                  https://perusahaan-anda.com
                </div>
              </div>

              {/* Fake Website Content */}
              <div className="p-4 flex-1 overflow-hidden space-y-3">
                {/* Mock Navbar */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <img src="/lexa_icon.png" alt="Company Logo" className="w-5 h-5 rounded-md object-contain" onError={(e)=>{ (e.target as HTMLElement).style.display = 'none'; }} />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Acme Enterprise</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <span>Produk</span>
                    <span>Solusi</span>
                    <span>Kontak</span>
                    <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-medium">Login</span>
                  </div>
                </div>

                {/* Mock Hero Section */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-transparent border border-blue-500/15">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-1.5">
                    🚀 Next-Gen Digital Platform
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                    Transformasi Bisnis Lebih Cepat dengan AI
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm line-clamp-2">
                    Otomasi layanan pelanggan, manajemen pengetahuan, dan komunikasi 24/7 tanpa henti.
                  </p>
                </div>

                {/* Mock Content Cards */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-white/5">
                    <div className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-[10px] font-bold mb-1">✓</div>
                    <div className="text-[10px] font-bold text-slate-800 dark:text-slate-200">99.9% Uptime</div>
                    <div className="text-[9px] text-slate-400">Handal & Teruji</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-white/5">
                    <div className="w-6 h-6 rounded bg-blue-500/10 text-blue-500 flex items-center justify-center text-[10px] font-bold mb-1">⚡</div>
                    <div className="text-[10px] font-bold text-slate-800 dark:text-slate-200">&lt; 1s Response</div>
                    <div className="text-[9px] text-slate-400">Instan & Akurat</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-white/5">
                    <div className="w-6 h-6 rounded bg-violet-500/10 text-violet-500 flex items-center justify-center text-[10px] font-bold mb-1">🔒</div>
                    <div className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Bank-Grade</div>
                    <div className="text-[9px] text-slate-400">Enkripsi Aman</div>
                  </div>
                </div>
              </div>

              {/* Floating Chat Bubble Simulation */}
              <div
                className={`absolute bottom-4 ${
                  position === 'bottom-right' ? 'right-4' : 'left-4'
                } flex flex-col ${position === 'bottom-right' ? 'items-end' : 'items-start'} gap-2 z-20`}
              >
                {/* Popover Preview if clicked */}
                {previewChatOpen && (
                  <div className="w-72 rounded-2xl bg-white dark:bg-[#0D182E] border border-slate-200 dark:border-white/15 p-3.5 shadow-2xl text-left animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10 mb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="relative w-7 h-7 rounded-full bg-blue-600/20 p-0.5 border border-blue-500/30 overflow-hidden flex items-center justify-center">
                          <img 
                            src="/lexa_bot_transparent.png" 
                            alt="LEXA AI" 
                            className="w-full h-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/lexa_icon.png'; }}
                          />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block leading-tight">LEXA AI</span>
                          <span className="text-[9px] text-emerald-500 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Online Siap Membantu
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setPreviewChatOpen(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs p-1"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-200/50 dark:border-white/5">
                        Halo! 👋 Selamat datang di layanan kami. Ada informasi produk atau solusi yang ingin Anda tanyakan?
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 cursor-pointer">
                          Info Layanan
                        </span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 cursor-pointer">
                          Hubungi Tim Sales
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Floating Action Button */}
                <button
                  onClick={() => setPreviewChatOpen(prev => !prev)}
                  style={{ backgroundColor: color }}
                  className="relative group w-12 h-12 rounded-full text-white shadow-xl flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all overflow-hidden border-2 border-white/20"
                  title="Klik untuk mencoba simulasi buka/tutup balon obrolan"
                >
                  <img
                    src="/lexa_bot_transparent.png"
                    alt="Chat Bot"
                    className="w-8 h-8 object-contain transition-transform group-hover:scale-110 drop-shadow-md"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white dark:border-slate-900 rounded-full"></span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-3">
              {lang === 'id' ? 'Klik tombol bulat di atas untuk mensimulasikan buka/tutup balon obrolan.' : 'Click the circular bubble above to simulate open/close.'}
            </p>
          </div>
        </div>

      </div>

      {/* Tabbed Embed Code Section */}
      <div className="bg-white dark:bg-[#0A1224] rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-xs overflow-hidden">
        <div className="flex items-center gap-1 p-2 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('html')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'html'
                ? 'bg-[#0066FF] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5'
            }`}
          >
            {t.tab_html}
          </button>
          <button
            onClick={() => setActiveTab('wordpress')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'wordpress'
                ? 'bg-[#0066FF] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5'
            }`}
          >
            {t.tab_wordpress}
          </button>
          <button
            onClick={() => setActiveTab('react')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'react'
                ? 'bg-[#0066FF] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5'
            }`}
          >
            {t.tab_react}
          </button>
          <button
            onClick={() => setActiveTab('iframe')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'iframe'
                ? 'bg-[#0066FF] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5'
            }`}
          >
            {t.tab_iframe}
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Memuat kode embed...
          </div>
        ) : embedData && (
          <div className="p-5">
            {activeTab === 'html' && (
              <div className="bg-[#060D1E] rounded-xl overflow-hidden border border-white/10">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02]">
                  <span className="text-xs text-slate-400 font-mono">index.html (sebelum &lt;/body&gt;)</span>
                  <CopyButton
                    text={embedData.embed_code}
                    field="html"
                    isCopied={copiedField === 'html'}
                    onCopy={handleCopy}
                  />
                </div>
                <pre className="p-5 text-xs text-emerald-400 font-mono overflow-x-auto leading-relaxed">
                  {embedData.embed_code}
                </pre>
              </div>
            )}

            {activeTab === 'wordpress' && (
              <div className="bg-[#060D1E] rounded-xl overflow-hidden border border-white/10">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02]">
                  <span className="text-xs text-slate-400 font-mono">WordPress WPCode / Theme Footer</span>
                  <CopyButton
                    text={embedData.embed_code}
                    field="wp"
                    isCopied={copiedField === 'wp'}
                    onCopy={handleCopy}
                  />
                </div>
                <pre className="p-5 text-xs text-blue-300 font-mono overflow-x-auto leading-relaxed">
                  {wordpressGuide}
                </pre>
              </div>
            )}

            {activeTab === 'react' && (
              <div className="bg-[#060D1E] rounded-xl overflow-hidden border border-white/10">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02]">
                  <span className="text-xs text-slate-400 font-mono">ChatWidget.tsx (React / Next.js)</span>
                  <CopyButton
                    text={reactSnippet}
                    field="react"
                    isCopied={copiedField === 'react'}
                    onCopy={handleCopy}
                  />
                </div>
                <pre className="p-5 text-xs text-violet-300 font-mono overflow-x-auto leading-relaxed">
                  {reactSnippet}
                </pre>
              </div>
            )}

            {activeTab === 'iframe' && (
              <div className="bg-[#060D1E] rounded-xl overflow-hidden border border-white/10">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02]">
                  <span className="text-xs text-slate-400 font-mono">Iframe Fallback</span>
                  <CopyButton
                    text={embedData.iframe_fallback}
                    field="iframe"
                    isCopied={copiedField === 'iframe'}
                    onCopy={handleCopy}
                  />
                </div>
                <pre className="p-5 text-xs text-amber-300 font-mono overflow-x-auto leading-relaxed">
                  {embedData.iframe_fallback}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WidgetSetup;
